// helpers for various tasks

// dependencies
const crypto = require('crypto');
const config = require('./config');

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
    }
}


module.exports = helpers;