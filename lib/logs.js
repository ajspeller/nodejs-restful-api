// library for storing and rotating logs

// dependenies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

var lib = {
    // base directory for logs folder
    'baseDir': path.join(__dirname, '/../logs'),
    // append a string to a file. Create the file if it does not exist
    'append': function (file, str, callback) {
        // open the file for appending
        fs.open(`${lib.baseDir}/${file}.log`, 'a', function (err, fileDescriptor) {
            if (!err && fileDescriptor) {
                fs.appendFile(fileDescriptor, `${str}\n`, function (err) {
                    if (!err) {
                        fs.close(fileDescriptor, function (err) {
                            if (!err) {
                                callback(false);
                            } else {
                                callback('Error closing the file');
                            }
                        });
                    } else {
                        callback('Error appending to the file');
                    }
                });
            } else {
                callback('Could not open the file for appending');
            }
        });
    },
    // list all of the logs and optionally include the compressed logs
    'list': function (includeCompressedLogs, callback) {
        fs.readdir(lib.baseDir, function (err, data) {
            if (!err && data & data.length) {
                var trimmedFileNames = [];
                data.forEach(function (fileName) {
                    // add the .log files
                    if (fileName.indexOf('.log') > -1) {
                        trimmedFileNames.push(fileName.replace('.log', ''));
                    }
                    // add on the .gz files
                    if (fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
                        trimmedFileNames.push(fileName.replace('.gz.b64', ''));
                    }
                });
                callback(false, trimmedFileNames);
            } else {
                callback(err, data);
            }
        });
    },
    'truncate': function (logId, callback) {
        fs.truncate(`${lib.baseDir}/${logId}.log`, 0, function (err) {
            if (!err) {
                callback(false);
            } else {
                callback(err);
            }
        });
    },
    'decompress': function (fileId, callback) {
        var fileName = `${fileId}.gz.b64`;
        fs.readFile(`${lib.baseDir}/${fileName}`, 'utf8', function (err, str) {
            if (!err && str) {
                // decompress the data
                var inputBuffer = Buffer.from(str, 'base64');
                zlib.unzip(inputBuffer, function (err, outputBuffer) {
                    if (!err && outputBuffer) {
                        var str = outputBuffer.toString();
                        callback(false, str);
                    } else {
                        callback(err);
                    }
                })
            } else {
                callback(err)
            }
        });
    },
    'compress': function (logId, newFileId, callback) {
        var sourceFile = `${logId}.log`;
        var destFile = `${newFileId}.gz.b64`;
        fs.readFile(`${lib.baseDir}/${sourceFile}`, 'utf8', function (err, inputString) {
            if (!err && inputString) {
                // compress the data using gzip
                zlib.gzip(inputString, function (err, buffer) {
                    if (!err && buffer) {
                        // send the data to the destination file
                        fs.open(`${lib.baseDir}/${destFile}`, 'wx', function (err, fileDescriptor) {
                            if (!err && fileDescriptor) {
                                // write to the destination file
                                fs.writeFile(fileDescriptor, buffer.toString('base64'), function (err) {
                                    if (!err) {
                                        // close the destination file
                                        fs.close(fileDescriptor, function (err) {
                                            if (!err) {
                                                callback(false);
                                            } else {
                                                callback(err);
                                            }
                                        });
                                    } else {
                                        callback(err);
                                    }
                                })
                            } else {
                                callback(err);
                            }
                        });
                    } else {
                        callback(err);
                    }
                });
            } else {
                callback(err);
            }
        })
    }
};


// export module
module.exports = lib;