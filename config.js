// create and export configuration variables

// container for the environments
var environments = {
    staging: {
        httpPort: 3000,
        httpsPort: 3001,
        envName: 'staging'
    },
    production: {
        httpPort: 5000,
        httpsPort: 5001,
        envName: 'production'
    }
};

// determine which environment should be exported bases on the command line argument
var currentEnvironment = typeof (process.env.NODE_ENV) === 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// check that the current environment is of the keys in the environments object
var environmentToExport = environments[currentEnvironment] ? environments[currentEnvironment] : environments.staging;

module.exports = environmentToExport;
