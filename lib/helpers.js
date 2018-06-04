// helpers for various tasks

// dependencies
const crypto = require('crypto');
const config = require('./config');
const https = require('https');
const querystring = require('querystring');

// container for all of the helpers
var helpers = {

    // create a string of 20 random alphanumeric characters
    'createRandomString': function (strLength) {
        strLength = typeof (strLength) === 'number' && strLength > 0 ? strLength : false;
        if (strLength) {
            // define all the possible characters that could go into a string
            var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

            // start the final string;
            var str = '';
            for (var i = 1; i <= strLength; i++) {
                // get a random character
                var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
                // append character
                str += randomCharacter;
            }
            return str;
        } else {
            return false;
        }
    },
    'parseJsonToObject': function (str) {
        try {
            var obj = JSON.parse(str);
            return obj;
        } catch (error) {
            return {};
        }
    },

    // create a sha256 hash
    'hash': function (str) {
        if (typeof (str) === 'string' && str.length > 0) {
            return crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        } else {
            return false;
        }
    },

    'sendTwilioSms': function (phone, msg, callback) {
        // validate the parameters
        phone = typeof (phone) === 'string' && phone.trim().length === 10 ? phone : false;
        msg = typeof (msg) === 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg : false;

        if (phone && msg) {
            // configure the request pay to be sent to twilio
            var payload = {
                'From': config.twilio.fromPhone,
                'To': `+1${phone}`,
                'Body': msg
            }

            // stringify the payload
            var stringPayload = querystring.stringify(payload);

            // configure the request details
            var requestDetails = {
                'protocol': 'https:',
                'hostname': 'api.twilio.com',
                'method': 'POST',
                'path': `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
                'auth': `${config.twilio.accountSid}:${config.twilio.authToken}`,
                'headers': {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(stringPayload)
                }
            };

            // instantiate the request object
            var req = https.request(requestDetails, function (res) {
                // grab the status of the sent request
                var status = res.statusCode;
                // callback successfully if the request went through
                if (status === 200 || status === 201) {
                    callback(false);
                } else {
                    callback(`Status code returned was ${status}`);
                }
            });

            // bind to the error event so it does not get thrown
            req.on('error', function (e) {
                callback(e);
            });

            // add payload
            req.write(stringPayload);

            // end the request
            req.end();


        } else {
            callback('Given parameters were missing or invalid');
        }

    }
}


module.exports = helpers;