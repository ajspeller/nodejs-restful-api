// helpers for various tasks

// dependencies
const crypto = require('crypto');
const config = require('./config');

// container for all of the helpers
var helpers = {

    'parseJsonToObject': function(str) {
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