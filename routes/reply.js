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
var parseReply = function(postBody,postHeaders) {
  var messageBody = postBody['stripped-text'];
  var messageSender = postBody['sender'];
  var messageID = postBody['In-Reply-To'];

  var messageFrom = postBody['From'];
  messageFrom = messageFrom.replace(/ \<.*\>/,'');

  var reply = {
    email: messageSender,
    name: messageFrom,
    response: messageBody,
    id: messageID
  };
  return reply;
};

/* POST email reception. */
router.post('/', function(req, res) {
  var mailgunBody = req.body;
  var mailgunHeaders = req.headers;
  var reply = parseReply(mailgunBody,mailgunHeaders);

  if (reply.id) {
    console.log('we have a message ID!')
    connectionsRef.orderByChild("messageId").equalTo(reply.id).once('value',function(snapshot){
      var connection = snapshot.val();
      var connectionId = Object.keys(connection)[0];
      var getInitialLink = db.ref("links/" + connection[connectionId]['linkId']);
      console.log('go get the link!')
      getInitialLink.once('value',function(snapshot) {
        var link = snapshot.val();
        var linkURL = link.url;
        var getInitialSubmitter = db.ref("users/" + link.recommenderId + "/email");
        console.log('Get the initial emailer from the link')
        getInitialSubmitter.once('value',function(snapshot) {
          var sendTo = snapshot.val();
          console.log(sendTo);
          var outboundSubject = reply.name + ' wants to talk about ' + linkURL;
          var outboundBody = 'Must have been a cool article / video / link / whatever...' + reply.name + ' wants to chat. Reply to this email to keep the conversation going!\n\n' + reply.response;
          mailgun.messages().send({
            from: reply.email,
            to: sendTo,
            subject: outboundSubject,
            text: outboundBody
          }, function (error, body) {
            res.send(body);
          });
        });
      });
    });
  } else {
    res.status(406).send({ error: "no message id!:" });
  }
});

module.exports = router;
