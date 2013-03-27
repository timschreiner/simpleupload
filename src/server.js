var http = require('http'),
util = require('util'),
url = require('url'),
uploader = require('./uploader'),
log = console.log,
redis = require("redis"),
redisClient = redis.createClient("6379","127.0.0.1"); //TODO: config setting?

redisClient.on("error", function (err) {
  console.log("Error " + err);
//TODO: what else should happen? reconnect? crash and restart?
});

http.createServer(function(req, res) {
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  var upload_id = query.upload_id;

  //  //make sure upload_id is included
  //  if(upload_id == undefined){
  //    res.writeHead(400, {
  //      'content-type': 'text/plain'
  //    });
  //    res.end("upload_id is a required paramater");
  //    return;
  //  }

  if (/^\/upload/.test(req.url) && req.method.toLowerCase() == 'post') {
    uploader.handleUpload(req, res, upload_id, redisClient);


  } else if ((/^\/progress/.test(req.url))){
    uploader.trackProgress(upload_id, redisClient, function(err, progress){
      res.writeHead(200, {
        'content-type': 'text/html'
      });
      res.end("progress="+ progress);
    });

  } else {
    // show a file upload form
    res.writeHead(200, {
      'content-type': 'text/html'
    });
    res.end(
      '<form action="/upload" enctype="multipart/form-data" method="post">'+
      '<input type="text" name="title"><br>'+
      '<input type="file" name="upload" multiple="multiple"><br>'+
      '<input type="submit" value="Upload">'+
      '</form>'
      );
  }

}).listen(8080);