var express = require('express');
var router = express.Router();

var api_key = 'key-b9f6ce56812f37467732aaf3097f88f7';
var domain = 'mg.quanticle.co';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

/* POST email reception. */
router.post('/', function(req, res, next) {
  console.log('processing POSTed email');
  console.log('req = ');
  console.log(req);
  console.log('res = ');
  console.log(res);
  var data = {
    from: 'Link-a-Day <link-a-day@mg.quanticle.co>',
    to: 'nicholas.tyler.brown+link-a-day@gmail.com',
    subject: 'Link-a-Day',
    text: 'here is a body:'
  };
  console.log(data);
  mailgun.messages().send(data, function (error, body) {
    console.log(body);
    res.send('OK');
  });
});

module.exports = router;
