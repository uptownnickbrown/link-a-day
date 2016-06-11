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

  console.log(recommendation);

  return recommendation;
};

var addToLinkQueue = function(recommendation,recommenderId) {
  linksRef.push().set({
    recommenderId: recommenderId,
    url: recommendation.url,
    blurb: recommendation.blurb
  });
};

var addNewUser = function(recommendation) {
  var newUserRef = usersRef.push();
  newUserRef.set({
    name: recommendation.submitterName,
    email: recommendation.submitterEmail
  });
  return newUserRef.key;
};

var retrieveFromLinkQueue = function() {

};

var sendOutboundLink = function(linkObject) {

};


/* POST email reception. */
router.post('/', function(req, res) {
  var mailgunBody = req.body;
  var recommendation = parseInboundLink(mailgunBody);

  // check to see if we've seen this recommender before
  usersRef.orderByChild("email").equalTo(recommendation.submitterEmail.toLowerCase()).once('value',function(snapshot){
    var user = snapshot.val();
    if (user) {
      // The user already exists, add a recommendation linked to them
      addToLinkQueue(recommendation,Object.keys(user)[0]);
    } else {
      // Add the user, and then add the link
      var newUserKey = addNewUser(recommendation);
      addToLinkQueue(recommendation,newUserKey);
    }
  });

  //mailgun.messages().send(linkData, function (error, body) {
  //  console.log('attempted to send message');
  //  console.log(body);
  //  res.send('OK');
  //});
  res.send('OK');
});

module.exports = router;
