// library for storing and editing data

// dependencies
const fs = require('fs');
const path = require('path');
const helpers = require('./helpers');



// container for the module to be exported
var lib = {
    'baseDir': path.join(__dirname, '/../.data/'),
    // deleting a file
    'delete': function (dir, file, callback) {
        fs.unlink(`${lib.baseDir}${dir}/${file}.json`, function (err) {
            if (!err) {
                callback(false);
            } else {
                callback('Error deleting the file');
            }
        });
    },
    // update data inside a file
    'update': function (dir, file, data, callback) {
        // open the file for writing
        fs.open(`${lib.baseDir}${dir}/${file}.json`, `r+`, function (err, fileDescriptor) {
            if (!err && fileDescriptor) {
                // convert data to a string
                var stringData = JSON.stringify(data);
                // truncate file
                fs.ftruncate(fileDescriptor, function (err) {
                    if (!err) {
                        // write to the file and close it
                        fs.writeFile(fileDescriptor, stringData, function (err) {
                            if (!err) {
                                fs.close(fileDescriptor, function (err) {
                                    if (!err) {
                                        callback(false);
                                    } else {
                                        callback('There was an error closing the file');
                                    }
                                })
                            } else {
                                callback('Error writing to the file');
                            }
                        })
                    } else {
                        callback('Error truncating file');
                    }
                })

            } else {
                callback('Could not open the file for updating, it may not exist yet');
            }
        });
    },
    // read data from a file
    'read': function (dir, file, callback) {
        fs.readFile(`${lib.baseDir}${dir}/${file}.json`, 'utf8', function (err, data) {
            if (!err && data) {
                var parsedData = helpers.parseJsonToObject(data);
                callback(false, parsedData)
            } else {
                callback(err, data);
            }
        });
    },
    'create': function (dir, file, data, callback) {
        // open the file for writing
        fs.open(`${lib.baseDir}${dir}/${file}.json`, `wx`, function (err, fileDescriptor) {
            if (!err & fileDescriptor) {
                // convert data to string
                var stringData = JSON.stringify(data);
                // write to file and close it
                fs.writeFile(fileDescriptor, stringData, function (err) {
                    if (!err) {
                        fs.close(fileDescriptor, function (err) {
                            if (!err) {
                                callback(false);
                            } else {
                                callback('Error closing the file.');
                            }
                        })
                    } else {
                        callback('Error writing to new file');
                    }
                })
            } else {
                callback('Could not create new file, it may already exist');
            }
        });
    }
};


// export the module
module.exports = lib;