const http = require('http');
const https = require('https');
const zlib = require('zlib');

function proxyRequest(req, res, hostStr, method) {
  let options = optionFactoryWithHost(req, hostStr);
  console.log(options);

  if (method === 'https') {
    doRequestHttps(options, req, res)
      .then(handleRealResponse)
      .then(handleMessage)
      .catch(function (e) {
        console.error(`problem with request: ${e.message}`);
      });
  } else {
    doRequest(options, req, res)
      .then(handleRealResponse)
      .then(handleMessage)
      .catch(function (e) {
        console.error(`problem with request: ${e.message}`);
      });
  }
}

/**
 * 使用http请求接口
 */
function doRequest(options, req, res) {
  return new Promise(function (resolve, reject) {
    // 请求真正的api接口
    const innerReq = http.request(options, (innerRes) => {
      let data = {
        'req': req,
        'res': res,
        'options': options,
        '_res': innerRes
      };
      resolve(data);
    });
    innerReq.on('error', (e) => {
      reject(e);
    });

    // write data to request body
    innerReq.end();
  });
}

/**
 * 使用https请求接口
 */
function doRequestHttps(options, req, res) {
  return new Promise(function (resolve, reject) {
    // 请求真正的api接口
    const innerReq = https.request(options, (innerRes) => {
      let data = {
        'req': req,
        'res': res,
        'options': options,
        '_res': innerRes
      };
      resolve(data);
    });
    innerReq.on('error', (e) => {
      reject(e);
    });

    // write data to request body
    innerReq.end();
  });
}

function handleRealResponse(data) {
  return new Promise(function (resolve, reject) {
    let req = data['req'];
    let res = data['res'];
    let options = data['options'];
    let _res = data['_res'];
    console.log(`STATUS: ${_res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(_res.headers)}`);
    res.writeHead(_res.statusCode, _res.headers);

    let gzip = null;
    let responseData = '';
    if (_res.headers['content-encoding'] == 'gzip') {  // gzip压缩情况下
      console.log('handle gzip response');
      gzip = zlib.createGunzip();
      _res.on('data', (chunk) => {
        res.write(chunk);
        gzip.write(chunk);
      });
      _res.on('end', () => {
        console.log('res complete');
        res.end();
        gzip.end();
      });
      gzip.on('data', (chunk) => {
        responseData += chunk;
      });
      gzip.on('end', () => {  // 由gzip流end向socket.io发送
        let data = {
          'req': req,
          'type': 'request log',
          'message': 'request header: ' + JSON.stringify(options) + ' response data: ' + responseData
        }
        resolve(data);
      });
    } else {  // 未压缩情况下
      console.log('handle normal response');
      _res.on('data', (chunk) => {
        res.write(chunk);
        responseData += chunk;
      });
      _res.on('end', () => {
        console.log('res complete');
        res.end();
        let data = {
          'req': req,
          'type': 'request log',
          'message': 'request header: ' + JSON.stringify(options) + ' response data: ' + responseData
        }
        resolve(data);
      });
    }
  });
}

function handleMessage(data) {
  if (data === null) {
    return;
  }
  let req = data['req'];
  let type = data['type'];
  let message = data['message'];
  emitData(req, type, message);
}

function emitData(req, type, message) {
  let io = req.app.get('logcaster');
  if (io !== null) {
    io.emit(type, message);
  }
}

/**
 * 创建request的option, 用户指定host
 */
function optionFactoryWithHost(req, hostStr) {
  let option = {
    host: hostStr,
    path: req.url,
    method: req.method,
    headers: getHeader(req)
  }
  return option
}

/**
 * 拷贝原request的header字段
 */
function getHeader(req) {
  let ret = {};
  for (let i in req.headers) {
    if (i !== 'host') { // 去掉host
      ret[i] = req.headers[i];
    }
  }
  return ret;
};

exports.proxyRequest = proxyRequest;