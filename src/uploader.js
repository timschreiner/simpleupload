var formidable = require("formidable"),
        util = require("util"),
        fs = require("fs"),
        redis = require("redis"),
        log = console.log;

var MIN_PROGRESS_UPDATE_INTERVAL = 2000; //only update the upload progress every 2 seconds
var REDIS_KEY_TIMEOUT = 5 * 60; //redis keys expire if they aren"t updated in five minutes

//THESE MUST BE ABSOLUTE PATHS
var UPLOADING_PATH = "/Users/timschreiner/uploads/during"; 
var UPLOAD_FINISHED_PATH = "/Users/timschreiner/uploads/finished";


var REDIS_PORT = "6379";
var REDIS_HOST = "127.0.0.1";
var redisClient = redis.createClient(REDIS_PORT, REDIS_HOST); 

redisClient.on("error", function(err) {
    console.log("Error " + err);
//TODO: what else should happen? reconnect? crash and restart?
});


function getUploadKey(upload_id) {
    return "upl:" + upload_id;
}

function now() {
    return new Date();
}

exports.handleUpload = function(req, res, upload_id, uploadCallback) {
    // parse a file upload
    var form = new formidable.IncomingForm();

    //TODO: make this a config setting
    form.uploadDir = UPLOADING_PATH;

    var theFile;
    form.on("fileBegin", function(name, file) {
        theFile = file;
        log("processing upload (id=" + upload_id + ") of file [" + theFile.name + "] as " + theFile.path);
    });

    var progressLastUpdatedAt = now();

    form.on("progress", function(bytesReceived, bytesExpected) {
        //TODO: if bytesRecieved gets to big, do we abort?
        var currentTime = now();
        var enoughTimeHasPassedSinceLastUpdate = currentTime - progressLastUpdatedAt > MIN_PROGRESS_UPDATE_INTERVAL;
        var uploadFinished = bytesReceived === bytesExpected;
        
        if (enoughTimeHasPassedSinceLastUpdate || uploadFinished) {
            progressLastUpdatedAt = currentTime;
            var progress = bytesReceived / bytesExpected;

            redisClient.setex(getUploadKey(upload_id), REDIS_KEY_TIMEOUT, progress, function(err) {
                if (err) {
                    log(now(), "problem setting progress", err, theFile.toJSON());
                    //TODO: anything else we can do here?
                } else {
                    log("upload (id=" + upload_id + ") progress = " + progress * 100 + "%");
                }
            });
        }
    });

    form.on("end", function() {
        log(now(), "end of upload (id=" + upload_id + ")");
        
        //move the file into the ffmpeg watch directory
        var oldPath = theFile.path;

        var newPath = UPLOAD_FINISHED_PATH + "/" + upload_id;
        fs.renameSync(oldPath, newPath);

        //TODO: forward the query params to php
        uploadCallback(null);
    });

    form.on("error", function(err) {
        log(now(), "error with upload (id=" + upload_id + ")", err, theFile.name, theFile.size, theFile.path);
        //do nothing, the upload folder should be routinely cleaned out of old files
        uploadCallback(err);
    });

    form.on("aborted", function() {
        var errorMessage = "aborted upload (id=" + upload_id + ")";
        log(now(), errorMessage);
        //this automatically deletes the file, so do nothing
        uploadCallback(errorMessage);
    });

    form.parse(req);
};

exports.trackProgress = function(upload_id, progressCallback) {
    //get the progress from redis and then call the progressCallback with that value
    redisClient.get(getUploadKey(upload_id), progressCallback);
};
