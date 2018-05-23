var express = require('express');
var path = require('path');
var router = express.Router();

/* GET log page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname, '../pages', 'log_page.html'));
});

module.exports = router;