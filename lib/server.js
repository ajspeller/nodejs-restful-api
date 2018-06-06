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
const debug = require('debug')('server');

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
            chosenHandler(data, function (statusCode, payload, contentType) {

                // determine the type of response (fallback to JSON)
                contentType = typeof (contentType) === 'string' ? contentType : 'json';

                // use the status code called back from the handler, or default to 200
                // use the payload called back from the handler, or default to an empty object
                statusCode = typeof (statusCode) === `number` ? statusCode : 200;

                // return the response parts that are content specific
                var payloadString = '';
                if (contentType === 'json') {
                    res.setHeader('Content-Type', 'application/json');
                    payloadString = typeof (payload) === `object` ? JSON.stringify(payload) : JSON.stringify({});
                }

                if (contentType === 'html') {
                    res.setHeader('Content-Type', 'text/html');
                    payloadString = typeof (payload) === 'string' ? payload : '';
                }

                // return the response parts that are common to all content-types
                res.writeHead(statusCode);
                res.end(payloadString);

                // log the request path .. 200 green ... otherwise red
                if (statusCode === 200) {
                    debug('\x1b[32m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statusCode}`);
                } else {
                    debug('\x1b[31m%s\x1b[0m', `${method.toUpperCase()} /${trimmedPath} ${statusCode}`);
                }
            });
        });
    },
    // define a request router
    'router': {
        '': handlers.index,
        'account/create': handlers.accountCreate,
        'account/edit': handlers.accountEdit,
        'account/deleted': handlers.accountDeleted,
        'session/create': handlers.sessionCreate,
        'session/deleted': handlers.sessionDeleted,
        'checks/all': handlers.checksList,
        'checks/create': handlers.checksCreate,
        'checks/edit': handlers.checksEdit,
        'ping': handlers.ping,
        'api/users': handlers.users,
        'api/tokens': handlers.tokens,
        'api/checks': handlers.checks
    },

    // init script
    'init': function () {
        // start the HTTP server
        server.httpServer.listen(config.httpPort, function () {
            console.log('\x1b[36m%s\x1b[0m', `The server is listening on port ${config.httpPort} in ${config.envName} mode...`);
        });
        // start the HTTPS server
        server.httpsServer.listen(config.httpsPort, function () {
            console.log('\x1b[35m%s\x1b[0m', `The server is listening on port ${config.httpsPort} in ${config.envName} mode...`);
        });

    }
};


// export the module
module.exports = server;