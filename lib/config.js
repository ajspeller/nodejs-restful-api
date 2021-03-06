// create and export configuration variables

var numSeconds = function (seconds) {
    return seconds * 1000;
};

var numDays = function (days) {
    return days * 1000 * 60 * 60 * 24;
};

// container for the environments
var environments = {
    staging: {
        'httpPort': 3000,
        'httpsPort': 3001,
        'envName': 'staging',
        'hashingSecret': 'clearBlueWater!@#',
        'maxChecks': 5,
        'twilio': {
            'accountSid': 'AC60e2a008fd743eb00daacb4598d3e4a0',
            'authToken': '246b561f4ad28ba61b05123b07c1ef75',
            'fromPhone': '17576006781'
        },
        'checkInterval': numSeconds(10),
        'rotateLogsInterval': numDays(1),
        'templateGlobals': {
            'appName': 'UpTimeChecker',
            'companyName': 'NotARealCompany, Inc',
            'yearCreated': '2018',
            'baseUrl': `http://localhost:3000/`
        }
    },
    production: {
        'httpPort': 5000,
        'httpsPort': 5001,
        'envName': 'production',
        'hashingSecret': 'freshAir!@#',
        'maxChecks': 5,
        'twilio': {
            'accountSid': 'AC60e2a008fd743eb00daacb4598d3e4a0',
            'authToken': '246b561f4ad28ba61b05123b07c1ef75',
            'fromPhone': '17576006781'
        },
        'checkInterval': numSeconds(10),
        'rotateLogsInterval': numDays(1),
        'templateGlobals': {
            'appName': 'UpTimeChecker',
            'companyName': 'NotARealCompany, Inc',
            'yearCreated': '2018',
            'baseUrl': `http://localhost:5000/`
        }
    }
};

// determine which environment should be exported bases on the command line argument
var currentEnvironment = typeof (process.env.NODE_ENV) === 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// check that the current environment is of the keys in the environments object
var environmentToExport = environments[currentEnvironment] ? environments[currentEnvironment] : environments.staging;

module.exports = environmentToExport;