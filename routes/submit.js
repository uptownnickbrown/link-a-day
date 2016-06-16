var express = require('express');
var router = express.Router();
var firebase = require('firebase');
var cheerio = require('cheerio');
var request = require('request');
var validUrl = require('valid-url');

var api_key = process.env.MAILGUNKEY;
var domain = process.env.MAILGUNDOMAIN;

// Init Mailgun API
var mailgun = require('mailgun-js')({
  apiKey: api_key,
  domain: domain
});

var db = firebase.database();
var linksRef = db.ref("links");
var usersRef = db.ref("users");
var connectionsRef = db.ref("connections");

// Parse POST request body into fields we care about
var parseInboundLink = function(postBody) {
  var messageSubject = postBody['subject'];
  var messageBody = postBody['stripped-text'];
  var messageSender = postBody['sender'];

  var messageFrom = postBody['From'];
  messageFrom = messageFrom.replace(/ \<.*\>/,'');

  var recommendation = {
    submitterName: messageFrom,
    submitterEmail: messageSender,
    url: messageSubject,
    blurb: messageBody
  };

  return recommendation;
};

var addToLinkQueue = function(recommendation,recommenderId) {
  var newLinkRef = linksRef.push();
  var recommendationTitle = recommendation.url;

  request(recommendation.url, function (error, response, html) {
    if (!error && response.statusCode == 200) {
      var $ = cheerio.load(html,{ normalizeWhitespace: true, decodeEntities: true });
      var title = $('title').text();
      recommendationTitle = title;
    }
    else {
      console.log("Error parsing URL: " + response.statusCode);
    }
    var newLink = {
      recommenderId: recommenderId,
      url: recommendation.url,
      title: recommendationTitle,
      blurb: recommendation.blurb
    };
    console.log('adding new link to queue');
    console.log(newLink);
    newLinkRef.set(newLink);
  });

  return newLinkRef.key;
};

var addNewUser = function(recommendation) {
  var newUserRef = usersRef.push();
  newUserRef.set({
    name: recommendation.submitterName,
    email: recommendation.submitterEmail.toLowerCase()
  });
  return newUserRef.key;
};

// Return one recommendation from the queue that the submitting user did not recommend
var retrieveFromLinkQueue = function(findForUser,callback) {
  linksRef.once('value',function(snapshot){
    var allLinks = snapshot.val();
    var eligibleLinks = Object.keys(allLinks).filter(function(link) {
      return allLinks[link].recommenderId != findForUser;
    });
    var linkKey = eligibleLinks[Math.floor(Math.random() * eligibleLinks.length)];
    callback(linkKey);
  });
};

/* POST email reception. */
router.post('/', function(req, res) {
  var mailgunBody = req.body;
  var recommendation = parseInboundLink(mailgunBody);
  var recommenderId = '';

  // Is this a valid URL?
  if (validUrl.isWebUri(recommendation.url)) {
    console.log('Valid URL, entering the main loop');
    // check to see if we've seen this recommender before
    usersRef.orderByChild("email").equalTo(recommendation.submitterEmail.toLowerCase()).once('value',function(snapshot){
      var user = snapshot.val();
      if (user) {
        // The user already exists, add a recommendation linked to them
        addToLinkQueue(recommendation,Object.keys(user)[0]);
        recommenderId = Object.keys(user)[0]
      } else {
        // Add the user, and then add the link
        var newUserKey = addNewUser(recommendation);
        recommenderId = newUserKey;
        addToLinkQueue(recommendation,newUserKey);
      }
      var newRecommendation = retrieveFromLinkQueue(recommenderId,function(newRecommendation) {
        var recommendationRef = db.ref("links/" + newRecommendation);
        recommendationRef.once('value',function(snapshot){
          var outboundRecommendation = snapshot.val();
          var outboundBody = 'Thanks for submitting ' + recommendation.url + ' to Link-a-Day. We\'ll get that shared with someone soon and let you know if they want to chat.\n\nIn the meantime, take a look at this great recommendation "' + outboundRecommendation.title + '":\n' + outboundRecommendation.url + '\n\nSomeone loved this link, saying "' + outboundRecommendation.blurb + '"\n\nWant to talk more with them about it? Reply to this email and we\'ll connect you right away.\nThanks - Link-a-Day';
          console.log('Got a good recommendation, sending out a new one.')
          mailgun.messages().send({
            from: 'Link-a-Day <link-a-day@mg.quanticle.co>',
            to: recommendation.submitterEmail,
            subject: outboundRecommendation.title + ' - New Recommendation from Link-a-Day',
            text: outboundBody
          }, function (error, body) {
            var newConnectionRef = connectionsRef.push();
            var connection = {
              from: outboundRecommendation.recommenderId,
              to: recommenderId,
              linkId: newRecommendation,
              messageId: body.id,
              sent: 1,
              replied: 0
            };
            newConnectionRef.set(connection);
            console.log('Added the connection.')
            console.log(connection);
            res.send(body);
          });
        });
      });
    });
  } else {
    console.log('Hit a problem - sending out the failure email');
    // Not a valid URL - send them a reply to re-submit with the proper formatting
    mailgun.messages().send({
      from: 'Link-a-Day <link-a-day@mg.quanticle.co>',
      to: recommendation.submitterEmail,
      subject: 'Failed to add your link',
      text: 'Sorry, we couldn\'t handle your submission. Looks like ' + recommendation.url + ' is not a link?\n\nPlease try again and remember to make the subject of your email a valid URL. Add whatever commentary you\'d like in the email itself.'
    }, function (error, body) {
      res.send(body);
    });
  }
});

module.exports = router;
