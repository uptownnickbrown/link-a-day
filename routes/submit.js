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

var buildHTML = function(inbound,outbound) {
  var emailHTML = "<!DOCTYPE html><html style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"><head><meta name=\"viewport\" content=\"width=device-width\"><meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"><title>";
  emailHTML = emailHTML + outbound.title;
  emailHTML = emailHTML + " - New Recommendation from Link-a-Day</title></head><body bgcolor=\"#f6f6f6\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; -webkit-font-smoothing: antialiased; height: 100%; -webkit-text-size-adjust: none; width: 100% !important; margin: 0; padding: 0;\"><!-- body --><table class=\"body-wrap\" bgcolor=\"#f6f6f6\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; width: 100%; margin: 0; padding: 20px;\">  <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>    <td class=\"container\" bgcolor=\"#FFFFFF\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; clear: both !important; display: block !important; max-width: 600px !important; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0;\">      <!-- content -->      <div class=\"content\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; display: block; max-width: 600px; margin: 0 auto; padding: 0;\">      <table style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; width: 100%; margin: 0; padding: 0;\">        <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">          <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">            <h3 style=\"font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; font-size: 22px; line-height: 1.2em; color: #111111; font-weight: 200; margin: 10px 0; padding: 0;\">Hi ";
  emailHTML = emailHTML + inbound.submitterName;
  emailHTML = emailHTML + ",</h3>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">Thanks for submitting<a href=\"";
  emailHTML = emailHTML + inbound.url;
  emailHTML = emailHTML + "\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; color: #348eda; margin: 0; padding: 0;\">";
  emailHTML = emailHTML + inbound.title;
  emailHTML = emailHTML + "</a> to Link-a-Day. We'll get that shared with someone soon and let you know if they want to chat.</p>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">In the meantime, take a look at this great recommendation:</p>            <h3 style=\"font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; font-size: 22px; line-height: 1.2em; color: #111111; font-weight: 200; margin: 10px 0; padding: 0;\">";
  emailHTML = emailHTML + outbound.title;
  emailHTML = emailHTML + "</h3>            <!-- button -->            <table class=\"btn-primary\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; width: auto !important; margin: 0 0 10px; padding: 0;\">            <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">            <td style=\"font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; font-size: 14px; line-height: 1.6em; border-radius: 25px; text-align: center; vertical-align: top; background-color: #348eda; margin: 0; padding: 0;\" align=\"center\" bgcolor=\"#348eda\" valign=\"top\">            <a href=\"";
  emailHTML = emailHTML + outbound.url;
  emailHTML = emailHTML + "\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 2; color: #ffffff; border-radius: 25px; display: inline-block; cursor: pointer; font-weight: bold; text-decoration: none; background-color: #348eda; margin: 0; padding: 0; border-color: #348eda; border-style: solid; border-width: 10px 20px;\">Check it out</a>            </td>            </tr>            </table>            <!-- /button -->            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">Someone loved this link, saying:</p>            <p class=\"quote\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; background-color: #f6f6f6; margin: 10px 20px; padding: 5px;\">";
  emailHTML = emailHTML + outbound.blurb;
  emailHTML = emailHTML + "</p>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">Want to talk more with them about it? Reply to this email and we'll connect you right away.</p>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">Enjoy!</p>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">Link-a-Day</p></td>        </tr>      </table>      </div>      <!-- /content -->    </td>    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>  </tr></table><!-- /body --><!-- footer --><table class=\"footer-wrap\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; clear: both !important; width: 100%; margin: 0; padding: 0;\">  <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>    <td class=\"container\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; clear: both !important; display: block !important; max-width: 600px !important; margin: 0 auto; padding: 0;\">      <!-- content -->      <div class=\"content\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; display: block; max-width: 600px; margin: 0 auto; padding: 0;\">        <table style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; width: 100%; margin: 0; padding: 0;\">          <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">            <td align=\"center\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">              <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6em; color: #666666; font-weight: normal; margin: 0 0 10px; padding: 0;\"><a href=\"https://twitter.com/intent/user?screen_name=uptownnickbrown\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; color: #999999; margin: 0; padding: 0;\">Follow @uptownnickbrown on Twitter</a></p>            </td>          </tr>        </table>      </div>      <!-- /content -->    </td>    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>  </tr></table><!-- /footer --></body></html>";

  return emailHTML;
}

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
          var outboundHTML = buildHTML(recommendation,outboundRecommendation);
          console.log('Got a good recommendation, sending out a new one.')
          mailgun.messages().send({
            from: 'Link-a-Day <link-a-day@mg.quanticle.co>',
            to: recommendation.submitterEmail,
            subject: outboundRecommendation.title + ' - New Recommendation from Link-a-Day',
            html: outboundHTML
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
