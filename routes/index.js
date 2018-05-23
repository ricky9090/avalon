const express = require('express');
const router = express.Router();
const proxyRequest = require('../proxyHelper').proxyRequest;

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/api/v1/user/alsotang', function (req, res, next) {
  proxyRequest(req, res, 'cnodejs.org', 'https');
});

router.get('/api/topics/latest.json', function (req, res, next) {
  proxyRequest(req, res, 'www.v2ex.com', 'https');
});

router.get('/api/nodes/show.json', function (req, res, next) {
  proxyRequest(req, res, 'www.v2ex.com', 'https');
});

module.exports = router;
