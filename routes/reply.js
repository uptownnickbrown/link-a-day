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
  var emailHTML = "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width\"><meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"><title>";
  emailHTML = emailHTML + linkTitle;
  emailHTML = emailHTML + "</title><style>/* -------------------------------------    GLOBAL------------------------------------- */* {  font-family: \"Helvetica Neue\", \"Helvetica\", Helvetica, Arial, sans-serif;  font-size: 100%;  line-height: 1.6em;  margin: 0;  padding: 0;}img {  max-width: 600px;  width: auto;}body {  -webkit-font-smoothing: antialiased;  height: 100%;  -webkit-text-size-adjust: none;  width: 100% !important;}/* -------------------------------------    ELEMENTS------------------------------------- */a {  color: #348eda;}.btn-primary {  Margin-bottom: 10px;  width: auto !important;}.btn-primary td {  background-color: #348eda;  border-radius: 25px;  font-family: \"Helvetica Neue\", Helvetica, Arial, \"Lucida Grande\", sans-serif;  font-size: 14px;  text-align: center;  vertical-align: top;}.btn-primary td a {  background-color: #348eda;  border: solid 1px #348eda;  border-radius: 25px;  border-width: 10px 20px;  display: inline-block;  color: #ffffff;  cursor: pointer;  font-weight: bold;  line-height: 2;  text-decoration: none;}.last {  margin-bottom: 0;}.first {  margin-top: 0;}.padding {  padding: 10px 0;}/* -------------------------------------    BODY------------------------------------- */table.body-wrap {  padding: 20px;  width: 100%;}table.body-wrap .container {  border: 1px solid #f0f0f0;}/* -------------------------------------    FOOTER------------------------------------- */table.footer-wrap {  clear: both !important;  width: 100%;}.footer-wrap .container p {  color: #666666;  font-size: 12px;}table.footer-wrap a {  color: #999999;}/* -------------------------------------    TYPOGRAPHY------------------------------------- */h1,h2,h3 {  color: #111111;  font-family: \"Helvetica Neue\", Helvetica, Arial, \"Lucida Grande\", sans-serif;  font-weight: 200;  line-height: 1.2em;  margin: 10px 0 10px;}h1 {  font-size: 36px;}h2 {  font-size: 28px;}h3 {  font-size: 22px;}p,ul,ol {  font-size: 14px;  font-weight: normal;  margin-bottom: 10px;}ul li,ol li {  margin-left: 5px;  list-style-position: inside;}.quote {  background-color:#f6f6f6;  padding: 5px;  margin: 10px 20px 10px 20px;}/* ---------------------------------------------------    RESPONSIVENESS------------------------------------------------------ *//* Set a max-width, and make it display as block so it will automatically stretch to that width, but will also shrink down on a phone or something */.container {  clear: both !important;  display: block !important;  Margin: 0 auto !important;  max-width: 600px !important;}/* Set the padding on the td rather than the div for Outlook compatibility */.body-wrap .container {  padding: 20px;}/* This should also be a block element, so that it will fill 100% of the .container */.content {  display: block;  margin: 0 auto;  max-width: 600px;}/* Let's make sure tables in the content area are 100% wide */.content table {  width: 100%;}</style></head><body bgcolor=\"#f6f6f6\"><!-- body --><table class=\"body-wrap\" bgcolor=\"#f6f6f6\">  <tr>    <td></td>    <td class=\"container\" bgcolor=\"#FFFFFF\">      <!-- content -->      <div class=\"content\">      <table>        <tr>          <td>            <h3>Hi ";
  emailHTML = emailHTML + sendTo.name;
  emailHTML = emailHTML + ",</h3>            <p>";
  emailHTML = emailHTML + reply.name;
  emailHTML = emailHTML + " + ' had something to say about your link. Reply to this email to keep the conversation going!</p>            <p class=\"quote\">";
  emailHTML = emailHTML + reply.response;
  emailHTML = emailHTML +   "</p>            <p>Thanks!</p>            <p>Link-a-Day</p></td>        </tr>      </table>      </div>      <!-- /content -->    </td>    <td></td>  </tr></table><!-- /body --><!-- footer --><table class=\"footer-wrap\">  <tr>    <td></td>    <td class=\"container\">      <!-- content -->      <div class=\"content\">        <table>          <tr>            <td align=\"center\">              <p><a href=\"https://twitter.com/intent/user?screen_name=uptownnickbrown\">Follow @uptownnickbrown on Twitter</a></p>            </td>          </tr>        </table>      </div>      <!-- /content -->    </td>    <td></td>  </tr></table><!-- /footer --></body></html>";
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
