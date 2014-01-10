var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io').listen(http);
var history = {};
var history_num = 50;

http.listen(8080);
app.use(express.bodyParser());

io.enable('browser client minification');
io.enable('browser client etag');
//io.enable('browser client gzip');
io.set('log level', 0);                  
io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
]);

// push消息到socket.io
app.post('/push', function (req, res) {
    if (req.ip != '127.0.0.1') {
        res.send(500, {error: 'This is a local API'});
    }
    if (req.body.room && req.body.data) {
        io.sockets.in(req.body.room).emit('say', req.body.data);
        
        // 记录历史消息
        if (!history[req.body.room]) {
            history[req.body.room] = {data:[], act_time:0}
        }
        history[req.body.room].data.push(req.body.data);
        if (history[req.body.room].data.length > history_num) {
            history[req.body.room].data.shift();
        }
        history[req.body.room].act_time = Date.now();
        
        // 响应http请求
        res.send(200);
    }
});

// 载入历史聊天记录
app.get('/history', function (req, res) {
    var room = req.query.room;
    res.jsonp(history[room] ? history[room].data : []);
});

// 在线人数
app.get('/num', function (req, res) {
    var room = req.query.room;
    res.jsonp({num:io.sockets.clients(room).length});
});

app.use(function(req, res, next){
  res.send(404, 'Sorry cant find that!');
});

io.sockets.on('connection', function (socket) {
    socket.on('online', function (data) {
        socket.join(data.room);
    });
});

// 删除超过2个小时没人说话的房间的历史消息 （60s执行一次）
setInterval(function(){
    for (var room in history) {
        if (history[room].act_time && (Date.now() - history[room].act_time > 7200000)) {
            delete history[room];
        }
    }
}, 60000);

// 10秒广播一次在线人数
setInterval(function(){
    for (var room in io.sockets.manager.rooms) {
        var room = room.substr(1);
        if (room) {
            io.sockets.in(room).emit('online', {num:io.sockets.clients(room).length});
        }
    }
}, 10000);