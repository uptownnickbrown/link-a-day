var express = require('express');
var router = express.Router();

var api_key = 'key-b9f6ce56812f37467732aaf3097f88f7';
var domain = 'mg.quanticle.co';


/* POST email reception. */
router.post('/', function(req, res) {
  var mailgunBody = req.body;
  var messageSubject = mailgunBody['subject'];
  var messageBody = mailgunBody['body-plain'];
  var data = {
    from: 'Link-a-Day <link-a-day@mg.quanticle.co>',
    to: 'nicholas.tyler.brown+link-a-day@gmail.com',
    subject: messageSubject,
    text: messageBody
  };
  console.log(data);
  var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});
  console.log('initialized mailgun');
  mailgun.messages().send(data, function (error, body) {
    console.log('attempted to send message');
    console.log(body);
    res.send('OK');
  });
});

module.exports = router;
