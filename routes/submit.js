var express = require('express');
var router = express.Router();
var firebase = require('firebase');

var api_key = 'key-b9f6ce56812f37467732aaf3097f88f7'; // TODO gen new API key, get this out of git
var domain = 'mg.quanticle.co';

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
  newLinkRef.set({
    recommenderId: recommenderId,
    url: recommendation.url,
    blurb: recommendation.blurb
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
        var outboundBody = 'Thanks for submitting:\n\n' + recommendation.url + '\n\nto Link-a-Day. We\'ll get that shared with someone soon and let you know if they want to chat.\n\nIn the meantime, take a look at this great recommendation:\n\n' + outboundRecommendation.url + '\n\n' + outboundRecommendation.blurb + '\n\nHope you enjoy it!\n- Link-a-Day';

        mailgun.messages().send({
          from: 'Link-a-Day <link-a-day@mg.quanticle.co>',
          to: recommendation.submitterEmail,
          subject: 'New Recommendation from Link-a-Day',
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
          res.send('OK');
        });
      });
    });

  });
});

module.exports = router;
