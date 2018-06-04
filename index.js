// depdencies
const server = require('./lib/server');
const workers = require('./lib/workers');

// declare the app
const app = {
    init: function () {
        // start the server
        server.init();
        // start the workers
        workers.init();
    }
};

// execute funtion
app.init();

// export the app
module.exports = app;