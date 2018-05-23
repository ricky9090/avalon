
# 使用Node.js+Express.js搭建App调试Server

在开发手机端App时，通常会出现移动端新页面开发的差不多了，后台接口还没Ready，导致前后端联调浪费了大量时间。
联调过程中又往往涉及到测试服务的切换、抓包验证以及测试异常数据等测试。进而涉及到App重新打包，配置Charles等抓包工具，后台改数据等等工作，非常麻烦。

今天就使用Node.js实现一个用来调试的server，简化这些调试工作。<br>
这个server涉及到以下几个功能：
1. 接口数据的Mock。访问接口即返回我们定义好的假数据，便于在服务端开发完成前就可以测试接口效果。也便于异常值的验证。
2. 接口转发。在联调阶段不需要Mock数据时，可将请求转发给真正的后台接口。这样无需App更改url打包。
3. 抓包打印。将App发给调试Server的请求以及服务端返回的数据输出在Web页面上。这可以满足最基本的抓包需求。

这样我们就可以把调试当中大部分配置工作都放在这个Server上。在Server上做了更改，重启就可生效，省时省力。

## 服务搭建

### 安装Node与Express框架
首先安装好Node.js，这个比较简单，用官网的安装包就搞定了。
接下来配置Express，使用npm命令
```
npm install express-generator -g
```
安装好以后使用Express的命令行工具生成Server框架。

给server起个名字，比如 **avalon**<br>
运行命令
```
express -e avalon
```
暂时还用不到页面模板的功能，这里就使用 **-e** 参数用ejs作为页面模板。<br>
Express的工具会生成一个默认的目录结构，我们在此基础上开发就可以。<br>
默认的目录结构大概如下：
```
.
├── app.js
├── bin
│   └── www
├── package.json
├── public
│   ├── images
│   ├── javascripts
│   └── stylesheets
│       └── style.css
├── routes
│   ├── index.js
│   └── users.js
└── views
    ├── error.ejs
    └── index.ejs
```
bin下的www是启动脚本;public用来提供web页面的静态资源;routes文件夹下是请求路由的代码;views是页面模板文件。<br>

接下来进入到server目录安装依赖
```
cd avalon
npm install save
```

### 启动server
在server目录下运行命令就可以启动服务了。
```
node ./bin/www
```

## Mock接口数据

Mock数据的功能是最好实现的，单纯使用Node.js就可以了。引入Express框架可以更方便的配置路由。
假设我们的接口路径是：
> www.test.com/api/business_one/some.action

修改的步骤如下：<br>

### 添加接口的路由配置
在app.js中
```javascript
var businessOneRouter = require('./routes/router_one');

app.use('/api', businessOneRouter);
```
### 添加路由代码
接下来在routes文件夹下添加名为router_one.js的文件
```javascript
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

router.get('/business_one/some.action', function(req, res, next) {
  res.send(result);
});

module.exports = router;
```
这样就完成了接口数据的mock。

## 接口转发
### 接口转发流程
接下来实现接口的转发。<br>
为了避免其他应用也通过调试server转发，带来大量无效数据。因此与通用的抓包工具不同，我们仅让待开发的App请求调试server——通过更改debug版本中的服务器host实现。这样也就不需要手机或PC端配置代理了。<br>
手机端发来请求以后，server向后端发起真正的请求，保持Header及参数与客户端完全一致，将host替换为真正的服务器地址。接收到服务端返回结果后，同样将Header与数据原样返回给客户端。

这一大致流程如下：
> 客户端发起请求-->调试server接收-->调试server向后端发起真正请求-->后端返回结果-->调试server将结果返回给客户端

为了方便描述，下面我们使用 **cnodejs.org** 与 **v2ex.com** 两个网站公开的api作为测试接口。

### 封装转发模块
我们将转发封装为模块，向外暴露一个接口即可。在项目下创建文件 `proxyHelper.js`。
首先定义一个转发的入口方法，供我们在路由中调用：
```javascript
function proxyRequest(req, res, hostStr, method) {
  let options = optionFactoryWithHost(req, hostStr);  // 生成请求配置

  if (method === 'https') {
    // https的转发
  } else {
    // http的转发
  }
}
```
**req** 与 **res** 均为router回调传递进来的参数。考虑到后台接口的服务可能不同，在这里需要提供服务器地址。此外为支持http与https两种方式访问，这里也通过参数来进行处理。<br>
这个接口对外暴露，直接在 `router` 里使用：
```javascript
router.get('/api/nodes/show.json', function (req, res, next) {
  proxyRequest(req, res, 'www.v2ex.com', 'https');
});
```
在node中发起请求需要使用 `http.request` 方法，这个接口的第一个参数为请求的配置。因此在转发前，先根据传递进来的参数生成请求配置
```javascript
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
```
请求中的 **host** 与 **path** 分别来自 `proxyRequest` 的 **hostStr** 与 **req** 参数。`getHeader` 函数遍历并复制客户端请求中的header字段。<br>
获取header后，就可以请求真正的服务端了。我们通过 `http.request` 发起异步请求，返回结果后主要做两件事：<br>
1. 将结果原样返回给客户端。
2. 分别抽取请求头与响应，把数据发送给指定页面打log。

第二步稍后再做。考虑到整个操作是异步的，我们可以使用Promise来封装，让代码更利于维护。调用时就是这个形式：
```javascript
doRequest(options, req, res)
  .then(handleRealResponse)  // 响应服务端返回结果
  .then(handleMessage)  // 向页面发送数据
  .catch(function (e) {
    console.error(`request error: ${e.message}`);
});
```
完整的 `proxyRequest` 函数如下：
```javascript
function proxyRequest(req, res, hostStr, method) {
  let options = optionFactoryWithHost(req, hostStr);
  console.log(options);

  if (method === 'https') {
    doRequestHttps(options, req, res)
      .then(handleRealResponse)
      .then(handleMessage)
      .catch(function (e) {
        console.error(`request error: ${e.message}`);
      });
  } else {
    doRequest(options, req, res)
      .then(handleRealResponse)
      .then(handleMessage)
      .catch(function (e) {
        console.error(`request error: ${e.message}`);
      });
  }
}
```
接下来是 `doRequest` 的实现( `doRequestHttps` 替换为 `https.request` 即可，其余一致)：
```javascript
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
    innerReq.end();
  });
}
```
**Promise** 的 `resolve` 只有一个参数，因此将所有需要的参数封装到对象中。这里的 `resolve` 对应 `handleRealResponse` 函数：
```javascript
function handleRealResponse(data) {
  return new Promise(function (resolve, reject) {
    let req = data['req'];  // 客户端请求
    let res = data['res'];  // 返回给客户端的response
    let options = data['options'];  // 请求参数
    let _res = data['_res'];  // 服务端的返回
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
```
`handleRealResponse` 中 **res** 是要给客户端返回的结果， **_res** 是服务端返回给调试server的结果。在这里有以下几步处理
1. 把要返回的header复制给客户端
2. 判断服务端是否使用gzip对数据进行了压缩，若有压缩创建一个gzip数据流还原数据
3. 在服务端 **_res** 的 **data** 事件中向客户端 **res** 与 **gzip流**（数据压缩的情况下）复制数据
4. 在 **_res** 或 **gzip流** 的 **end** 事件中调用 `resolve` 触发下一步处理

## 抓包打印

客户端每请求一次接口，就向指定页面发送请求数据。这与聊天软件的场景比较相似，因此可以使用socket.io库来实现这个功能。恰好socket.io官网的demo就是聊天室服务，直接在这个demo基础上做更改就可以了。参考地址( https://socket.io/get-started/chat/ )

### 添加log查看页面
首先把Socket.io 官网Demo中的页面文件复制到项目下，做一些更改（把聊天发送消息相关代码删掉）：
```html
<!doctype html>
<html>

<head>
    <title>Avalon Test Page</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font: 13px Helvetica, Arial;
        }
        #messages {
            list-style-type: none;
            margin: 0;
            padding: 0;
        }
        #messages div {
            padding: 5px 10px;
        }
        #messages div:nth-child(odd) {
            background: #eee;
        }
    </style>
    <script src="/javascripts/socket.io.dev.js"></script>
    <script src="https://code.jquery.com/jquery-1.11.1.js"></script>
    <script>
        $(function () {
            var socket = io();
            socket.on('request log', function (msg) {
                $('#messages').append($('<div>')).text(msg));
            });
        });
    </script>
</head>

<body>
    <div id="messages"></div>
</body>

</html>
```
页面文件在用户访问特定url时通过浏览器载入，因此需要在express配置一个路由。<br>
`app.js` 中添加
```javascript
var logRouter = require('./routes/log_page');
app.use('/avalon_log', logRouter);
```
routes文件夹下添加 `log_page.js` 文件
```javascript
var express = require('express');
var path = require('path');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname, '../pages', 'log_page.html'));
});

module.exports = router;
```
需要注意express的router中必须使用绝对路径，因此通过 `path.join`生成。

在页面载入时就会初始化客户端的 **socket.io** ，我们定义接收消息的名称是**request log**。相应的，转发模块下添加发送消息的函数 `handleMessage`
```javascript
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
```
内部调用 `emitData` 发送数据。这里的socket.io对象是通过下面这条语句获取的。
```javascript
let io = req.app.get('logcaster');
```


### 引入socket.io库
服务端的socket.io需要在服务端启动时初始化。在bin/www文件中添加初始化代码：
```javascript
var server = http.createServer(app);
var io = require('socket.io')(server);
app.set('logcaster', io);
io.on('connection', function(socket){
  console.log('a user connected');  // 客户端有连接上后，打印一条语句
});
```
这样socket.io相关的代码就编写完成了。<br>
但此时项目中还没有socket.io的库文件。向package.json中添加依赖
```json
"dependencies": {
    "socket.io": "^2.1.0"
  }
```
并使用npm命令安装
```
npm install save
```
刚才我们在页面文件中指定了客户端载入socket.io代码的路径，
> src="/javascripts/socket.io.dev.js"

因此我们需要把socket.io的库文件拷贝到 **javascripts** 文件夹下。库文件在安装完socket.io后，可在 **node_modules** 文件夹里找到。

## 使用server
现在调试server的基本功能就开发完成了。可以简单使用几个接口测试一下。<br>
直接在 `index.js` 里添加几个路由：
```javascript
const express = require('express');
const router = express.Router();
const proxyRequest = require('../proxyHelper').proxyRequest;  // 引入转发模块

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
```
在命令行下启动server
```
node ./bin/www
```
打开浏览器访问页面 http://127.0.0.1:3000/avalon_log <br>
我们在socket.io中配置了connection事件的处理，因此node的控制台上会输出 **a user connected** <br>

然后打开新的浏览器窗口作为“客户端”（或在App代码里写几个请求），访问这三个连接<br>
http://127.0.0.1:3000/api/v1/user/alsotang <br>
http://127.0.0.1:3000/api/topics/latest.json <br>
http://127.0.0.1:3000/api/nodes/show.json <br>

应该可以看到浏览器显示了正确的json数据，同时log页面上刷新出了最新的请求数据信息。

### 总结
每次添加新的接口，需要以下几步<br>
1. 添加一个router
2. 在router中添加转发或mock数据逻辑
3. 重启服务器
4. 打开log页面，以便查看请求抓包结果

## TODO
目前这个调试Server基本能用，但非常简陋，有很多可以完善的地方：<br>
1. 完善post接口的转发
2. 请求log是实时发送到连接了服务端的页面，可以使用数据库持久化存储
3. 一些特殊请求，数据中的特殊字符的处理
4. Mock数据需要每次更改server源码并重启，可以添加上传mock数据或从文件读取的功能
5. log查看页面的优化