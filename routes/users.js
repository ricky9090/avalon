var express = require('express');
var router = express.Router();

var result = {
  "data": {
    "location": "北京",
    "lat": "39.90498734",
    "lon": "116.40528870"
  },
  "status": "ok"
};

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send(result);
});

module.exports = router;
