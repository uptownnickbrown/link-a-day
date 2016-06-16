var express = require('express');
var router = express.Router();
var firebase = require('firebase');

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
var parseReply = function(postBody,postHeaders) {
  var messageBody = postBody['stripped-html'];
  if (!(messageBody)) {
    messageBody = postBody['stripped-text'];
  }
  console.log("Got a response");
  console.log(messageBody);
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

var buildResponse = function(reply, sendTo, linkTitle) {
  var emailHTML = "<!DOCTYPE html><html style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"><head><meta name=\"viewport\" content=\"width=device-width\"><meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"><title>";
  emailHTML = emailHTML + linkTitle;
  emailHTML = emailHTML + "</title></head><body bgcolor=\"#f6f6f6\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; -webkit-font-smoothing: antialiased; height: 100%; -webkit-text-size-adjust: none; width: 100% !important; margin: 0; padding: 0;\"><!-- body --><table class=\"body-wrap\" bgcolor=\"#f6f6f6\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; width: 100%; margin: 0; padding: 20px;\">  <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>    <td class=\"container\" bgcolor=\"#FFFFFF\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; clear: both !important; display: block !important; max-width: 600px !important; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0;\">      <!-- content -->      <div class=\"content\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; display: block; max-width: 600px; margin: 0 auto; padding: 0;\">      <table style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; width: 100%; margin: 0; padding: 0;\">        <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">          <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">            <h3 style=\"font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; font-size: 22px; line-height: 1.2em; color: #111111; font-weight: 200; margin: 10px 0; padding: 0;\">Hi ";
  emailHTML = emailHTML + sendTo.name;
  emailHTML = emailHTML + ",</h3>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">";
  emailHTML = emailHTML + reply.name;
  emailHTML = emailHTML + " had something to say about your link. Reply to this email to keep the conversation going!</p>            <div class=\"quote\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; background-color: #f6f6f6; margin: 10px 20px; padding: 5px;\">";
  emailHTML = emailHTML + reply.response;
  emailHTML = emailHTML + "</div>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">Thanks!</p>            <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6em; font-weight: normal; margin: 0 0 10px; padding: 0;\">Link-a-Day</p></td>        </tr>      </table>      </div>      <!-- /content -->    </td>    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>  </tr></table><!-- /body --><!-- footer --><table class=\"footer-wrap\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; clear: both !important; width: 100%; margin: 0; padding: 0;\">  <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>    <td class=\"container\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; clear: both !important; display: block !important; max-width: 600px !important; margin: 0 auto; padding: 0;\">      <!-- content -->      <div class=\"content\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; display: block; max-width: 600px; margin: 0 auto; padding: 0;\">        <table style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; width: 100%; margin: 0; padding: 0;\">          <tr style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">            <td align=\"center\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\">              <p style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6em; color: #666666; font-weight: normal; margin: 0 0 10px; padding: 0;\"><a href=\"https://twitter.com/intent/user?screen_name=uptownnickbrown\" style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; color: #999999; margin: 0; padding: 0;\">Follow @uptownnickbrown on Twitter</a></p>            </td>          </tr>        </table>      </div>      <!-- /content -->    </td>    <td style=\"font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;\"></td>  </tr></table><!-- /footer --></body></html>";
  console.log(emailHTML);
  return emailHTML;
}

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
        var linkTitle = link.title;
        var getInitialSubmitter = db.ref("users/" + link.recommenderId);
        console.log('Get the initial emailer from the link')
        getInitialSubmitter.once('value',function(snapshot) {
          var sendTo = snapshot.val();
          console.log(sendTo);
          mailgun.messages().send({
            from: reply.name + "<" + reply.email + ">",
            to: sendTo.email,
            subject: linkTitle,
            html: buildResponse(reply,sendTo,linkTitle)
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
