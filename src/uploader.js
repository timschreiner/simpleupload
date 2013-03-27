var formidable = require('formidable'),
util = require('util'),
log = console.log;

var MIN_PROGRESS_UPDATE_INTERVAL = 2000; //seconds (in ms)
var REDIS_KEY_TIMEOUT = 60*60; //one hour

function getUploadKey(upload_id){
  return "upl:"+upload_id;
}

function now(){
  return new Date();
}

exports.handleUpload = function (req, res, upload_id, redisClient) {
  // parse a file upload
  var form = new formidable.IncomingForm();

  //TODO: make this a config setting
  form.uploadDir = "/Users/albrooksfan/uploads";

  var theFile;
  form.on('fileBegin', function(name, file) {
    theFile = file;
  });

  var progressLastUpdatedAt = now();

  form.on('progress', function(bytesReceived, bytesExpected) {
    //TODO: if bytesRecieved gets to big, do we abort?
    var currentTime = now();
    if(currentTime - progressLastUpdatedAt > MIN_PROGRESS_UPDATE_INTERVAL || bytesReceived == bytesExpected){
      progressLastUpdatedAt = currentTime;

      redisClient.setex(getUploadKey(upload_id), REDIS_KEY_TIMEOUT, bytesReceived / bytesExpected, function(err){
        if(err){
          log(now(), "problem setting progress", err, theFile.toJSON());
        //TODO: anything else we can do here?
        }
      });
    }
  });

  form.on('end', function() {
    log(now(), 'end')
  //move the file into the ffmpeg watch directory and forward the query params to php
  //    fs.renameSync(oldPath, newPath);
  //TODO: make sure if this is called once per file or once ever


  });

  form.on('error', function(err) {
    log(now(), 'error', err, theFile.name, theFile.size, theFile.path);
  //do nothing, the upload folder should be routinely cleaned out of old files
  });

  form.on('aborted', function() {
    log(now(), 'aborted')
  //this automatically deletes the file, so do nothing
  });

  form.parse(req);
}

exports.trackProgress = function(upload_id, redisClient, cb) {
  redisClient.get(getUploadKey(upload_id), cb);
}
