// these are server related tasks


// dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecode = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');

//instantiate server module object
var server = {
    // instantiate the HTTP server 
    'httpServer': http.createServer(function (req, res) {
        server.unifiedServer(req, res);
    }),
    // instantiate the HTTPS server
    'httpsServer': https.createServer({
        key: fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
    }, function (req, res) {
        server.unifiedServer(req, res);
    }),
    // all the server logic for both the http and https server
    'unifiedServer': function (req, res) {
        // get the url and parse it
        var parsedUrl = url.parse(req.url, true);
        // get the path
        var path = parsedUrl.pathname;
        var trimmedPath = path.replace(/^\/+|\/+$/g, '');

        // get the query string as an object
        var queryStringObject = parsedUrl.query;

        // get the HTTP method
        var method = req.method.toLowerCase();

        // get the headers
        var headers = req.headers;

        // get the payload
        var decoder = new StringDecode(`utf-8`);
        var buffer = ``;

        req.on('data', (data) => {
            buffer += decoder.write(data);
        });

        req.on('end', () => {
            buffer += decoder.end();

            // choose the handler this request should go to
            var chosenHandler = server.router[trimmedPath] ? server.router[trimmedPath] : handlers.notfound;

            // construct the data object to send to the handler
            var data = {
                trimmedPath,
                queryStringObject,
                method,
                headers,
                'payload': helpers.parseJsonToObject(buffer)
            };

            // route the request to the handler specified in the router
            chosenHandler(data, function (statusCode, payload) {

                // use the status code called back from the handler, or default to 200
                // use the payload called back from the handler, or default to an empty object

                var response = {
                    statusCode: typeof (statusCode) === `number` ? statusCode : 200,
                    payload: typeof (payload) === `object` ? JSON.stringify(payload) : JSON.stringify({})
                };

                // return the response
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(response.statusCode);
                res.end(response.payload);

                // log the request path
                console.log('Returning: >> ', response);
            });
        });
    },
    // define a request router
    'router': {
        'ping': handlers.ping,
        'users': handlers.users,
        'tokens': handlers.tokens,
        'checks': handlers.checks
    },

    // init script
    'init': function () {
        // start the HTTP server
        server.httpServer.listen(config.httpPort, function () {
            console.log(`The server is listening on port ${config.httpPort} in ${config.envName} mode...`);
        });
        // start the HTTPS server
        server.httpsServer.listen(config.httpsPort, function () {
            console.log(`The server is listening on port ${config.httpsPort} in ${config.envName} mode...`);
        });

    }
};


// export the module
module.exports = server;