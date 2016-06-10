var express = require('express');
var router = express.Router();

var api_key = 'key-b9f6ce56812f37467732aaf3097f88f7';
var domain = 'mg.quanticle.co';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

/* GET to send email . */
router.get('/', function(req, res, next) {
  var data = {
    from: 'Link-a-Day <link-a-day@mg.quanticle.co>',
    to: 'nicholas.tyler.brown+link-a-day@gmail.com',
    subject: 'Link-a-Day',
    text: 'Testing some Mailgun awesomness!'
  };
  mailgun.messages().send(data, function (error, body) {
    res.send(body);
  });
});

module.exports = router;
