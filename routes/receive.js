var express = require('express');
var router = express.Router();

/* POST email reception. */
router.post('/', function(req, res, next) {
  res.send(req, res);
});

module.exports = router;
