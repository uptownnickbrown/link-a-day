var express = require('express');
var router = express.Router();

/* POST email reception. */
router.post('/', function(req, res, next) {
  console.log('processing POSTed email');
  console.log(req);
  console.log(res);
  res.send('OK');
});

module.exports = router;
