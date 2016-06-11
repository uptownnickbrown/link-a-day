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

// Parse POST request body into fields we care about
var parseReply = function(postBody) {
  console.log(postBody);
  var messageSubject = postBody['subject'];
  var messageBody = postBody['stripped-text'];
  var messageSender = postBody['sender'];

  var messageFrom = postBody['From'];
  messageFrom = messageFrom.replace(/ \<.*\>/,'');

  var reply = {
    email: messageSender,
    name: messageFrom,
    url: messageSubject,
    response: messageBody
  };

  return reply;
};

/* POST email reception. */
router.post('/', function(req, res) {
  var mailgunBody = req.body;
  var reply = parseReply(mailgunBody);

  //var outboundSubject = reply.name + ' wants to talk about ' + reply.url;
  //var outboundBody = 'Must have been a cool article / video / link - ' + reply.name + ' wants to chat. Reply to this email to keep the conversation going!\n\n' + reply.response;
  //mailgun.messages().send({
  //  from: reply.sender,
  //  to: recommendation.submitterEmail,
  //  subject: 'New Recommendation from Link-a-Day',
  //  text: outboundBody
  //}, function (error, body) {
  //  res.send('OK');
  //});

});

module.exports = router;
