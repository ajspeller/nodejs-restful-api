// these are worker related tasks

// dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const http = require('http');
const https = require('https');
const helpers = require('./helpers');
const url = require('url');
const config = require('./config');
const _logs = require('./logs');
const util = require('util');
const debug = require('debug')('workers');

// instantiate the worker object
var workers = {
    'init': function () {
        // send to console, in yellow
        console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');
        // execute all the checks immediately
        workers.gatherAllChecks()
        // call the loop so that the checks continue to execute on their own
        workers.loop();
        // compress all the logs immediately
        workers.rotateLogs();
        // call the compression loop so logs will be compressed later on
        workers.logRotationLoop();
    },
    // compress the log files
    'rotateLogs': function () {
        // listing all the non-compressed log files
        _logs.list(false, function (err, logs) {
            if (!err && logs && logs.length) {
                logs.forEach(function (logName) {
                    // compress the data to a different file
                    var logId = logName.replace('.log', '');
                    var newFileId = `${logId}-${Date.now()}`;
                    _logs.compress(logId, newFileId, function (err) {
                        if (!err) {
                            // truncate the log
                            _logs.truncate(logId, function (err) {
                                if (!err) {
                                    debug('Success truncating the logfile');
                                } else {
                                    debug('Error truncting the logfile');
                                }
                            })
                        } else {
                            debug('Error compressing one of the log files', err);
                        }
                    });
                });
            } else {

            }
        });
    },
    // timer to execute the log-rotation process once per day
    'logRotationLoop': function () {
        setInterval(function () {
            workers.rotateLogs();
        }, config.rotateLogsInterval);
    },
    // lookup all checks, get their data, send to a validator
    'gatherAllChecks': function () {
        // get all the checks that exist in the system
        _data.list('checks', function (err, checks) {
            if (!err && checks && checks.length > 0) {
                checks.forEach(function (check) {
                    // read in the the check data
                    _data.read('checks', check, function (err, originalCheckData) {
                        if (!err && originalCheckData) {
                            // pass the data to the check validator, and let that method continue or log errors and needed
                            workers.validateCheckData(originalCheckData);
                        } else {
                            debug('Error reading on of the checks data');
                        }
                    });
                });
            } else {
                debug("Error: Could not find any checks to process");
            }
        });
    },
    // timer to execute the worker process once per minute
    'loop': function () {
        setInterval(function () {
            workers.gatherAllChecks();
        }, config.checkInterval);
    },
    // sanity check the check-data
    'validateCheckData': function (originalCheckData) {
        originalCheckData = typeof (originalCheckData) === 'object' &&
            originalCheckData ? originalCheckData : {};

        originalCheckData.id = typeof (originalCheckData.id) === 'string' &&
            originalCheckData.id.trim().length === 20 ? originalCheckData.id.trim() : false;

        originalCheckData.userPhone = typeof (originalCheckData.userPhone) === 'string' &&
            originalCheckData.userPhone.trim().length === 10 ? originalCheckData.userPhone.trim() : false;

        originalCheckData.protocol = typeof (originalCheckData.protocol) === 'string' && ['http', 'https'].includes(originalCheckData.protocol.trim()) ? originalCheckData.protocol.trim() : false;

        originalCheckData.url = typeof (originalCheckData.url) === 'string' &&
            originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;

        originalCheckData.method = typeof (originalCheckData.method) === 'string' && ['post', 'put', 'get', 'delete'].includes(originalCheckData.method.trim()) ? originalCheckData.method.trim() : false;

        originalCheckData.successCodes = typeof (originalCheckData.successCodes) === 'object' &&
            originalCheckData.successCodes instanceof Array &&
            originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;

        originalCheckData.timeoutSeconds = typeof (originalCheckData.timeoutSeconds) === 'number' &&
            originalCheckData.timeoutSeconds % 1 === 0 &&
            originalCheckData.timeoutSeconds >= 1 &&
            originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

        // set the keys that my not be set if the workers have not seen this check before
        originalCheckData.state = typeof (originalCheckData.state) === 'string' && ['up', 'down'].includes(originalCheckData.state.trim()) ? originalCheckData.state.trim() : 'down';

        originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) === 'number' &&
            originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

        // if all the checks pass then pass the data on to the next step in the process
        if (originalCheckData.id &&
            originalCheckData.userPhone &&
            originalCheckData.protocol &&
            originalCheckData.url &&
            originalCheckData.method &&
            originalCheckData.successCodes &&
            originalCheckData.timeoutSeconds) {
            workers.performCheck(originalCheckData);
        } else {
            debug('Error: One of the checks is not properly formmated. Skipping it');
        }
    },
    // perform the check, send the original check data and the outcome of the check process to the next step in the process
    'performCheck': function (originalCheckData) {
        // prepare the initial check outcome
        var checkOutcome = {
            'error': false,
            'responseCode': false
        };

        // mark that the outcome has not been sent yet
        var outcomeSent = false;

        // parse the hostname and the path out of the original check data
        var parseUrl = url.parse(`${originalCheckData.protocol}://${originalCheckData.url}`, true);
        var hostName = parseUrl.hostname;
        var path = parseUrl.path; // using path and not pathname because we want the query string

        // construct the request
        var requestDetails = {
            'protocol': `${originalCheckData.protocol}:`,
            'hostname': hostName,
            'method': originalCheckData.method.toUpperCase(),
            'path': path,
            'timeout': originalCheckData.timeoutSeconds * 1000
        };

        // instantiate the request object using http or https module
        var _moduleToUse = originalCheckData.protocol === 'http' ? http : https;
        var req = _moduleToUse.request(requestDetails, function (res) {
            // get the status of the sent request
            var status = res.statusCode;

            // update the checkOutcome and pass the data along
            checkOutcome.responseCode = status;
            if (!outcomeSent) {
                workers.processCheckOutcome(originalCheckData, checkOutcome);
                outcomeSent = true;
            }
        });

        // bind to the error event so that it doesnt get thrown
        req.on('error', function (e) {
            // update the checkoutcome and pass the data along
            checkOutcome.error = {
                'error': true,
                'value': e
            };
            if (!outcomeSent) {
                workers.processCheckOutcome(originalCheckData, checkOutcome);
                outcomeSent = true;
            }
        });

        // bind to the timeout event
        req.on('timeout', function (e) {
            // update the checkoutcome and pass the data along
            checkOutcome.error = {
                'error': true,
                'value': 'timeout'
            };
            if (!outcomeSent) {
                workers.processCheckOutcome(originalCheckData, checkOutcome);
                outcomeSent = true;
            }
        });

        // end the request
        req.end();
    },
    // process the check out and update the check data as need and trigger an alert to the user if needed
    // special log to accomodating a check taht has never been tested before, do not alert on those
    'processCheckOutcome': function (originalCheckData, checkOutcome) {
        workers.processCheckOutcome = function (originalCheckData, checkOutcome) {
            // decide if the check is considerd up or down
            var state = !checkOutcome.error &&
                checkOutcome.responseCode &&
                originalCheckData.successCodes.includes(checkOutcome.responseCode) ? 'up' : 'down';

            // decide if an alert in warranted
            var alertWarranted = originalCheckData.lastChecked &&
                originalCheckData.state !== state ? true : false;

            // log the outcome
            var timeOfCheck = Date.now();
            workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

            // update the check data
            var newCheckData = originalCheckData;
            newCheckData.state = state;
            newCheckData.lastChecked = timeOfCheck;


            // save the update
            _data.update('checks', newCheckData.id, newCheckData, function (err) {
                if (!err) {
                    // send the new check data to the next phase in the process if needed
                    if (alertWarranted) {
                        workers.alertUserToStatusChange(newCheckData);
                    } else {
                        debug('Check outcome has not changed, no alert needed');
                    }
                } else {
                    debug('Error trying to save updates to one of the checks')
                }
            });
        };
    },
    // alert the user to a change in their check status
    'alertUserToStatusChange': function (newCheckData) {
        var msg = `Alert: Your check for 
        ${newCheckData.method.toUpperCase()} 
        ${newCheckData.protocol}://${newCheckData.url} is currently 
        ${newCheckData.state}
        `;
        helpers.sendTwilioSms(newCheckData.userPhone, msg, function (err) {
            if (!err) {
                debug('Success: User alerted to a status change in their check', msg);
            } else {
                debug('Error: Counld not send SMS alert to user who had a state change to their check', msg);
            }
        });
    },
    'log': function (originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
        // form the log data
        var logData = {
            'check': originalCheckData,
            'outcome': checkOutcome,
            'state': state,
            'alert': alertWarranted,
            'time': timeOfCheck
        };
        // convert data to a string
        var logString = JSON.stringify(logData);

        // determine the name of the log file
        var logFileName = originalCheckData.id;

        // append the log string to the file
        _logs.append(logFileName, logString, function (err) {
            if (!err) {
                debug('Logging to file succeeded');
            } else {
                debug('Logging to file failed');
            }
        })
    }
};


// export module
module.exports = workers;