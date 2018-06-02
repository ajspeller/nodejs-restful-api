// dependencies
const http = require('http');
const url = require('url');
const StringDecode = require('string_decoder').StringDecoder;
const config = require('./config');

// server responds to all request
var server = http.createServer(function (req, res) {
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
        var chosenHandler = router[trimmedPath] ? router[trimmedPath] : handlers.notfound;

        // construct the data object to send to the handler
        var data = {
            trimmedPath,
            queryStringObject,
            method,
            headers,
            buffer
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

});


server.listen(config.port, function () {
    console.log(`The server is listening on port ${config.port} in ${config.envName} mode...`);
});

// define the handlers
var handlers = {
    sample: function (data, callback) {
        // callback http status code and a payload object
        callback(406, {
            name: 'sample handler'
        });
    },
    notfound: function (data, callback) {
        callback(404);
    }
};

// define a request router
var router = {
    'sample': handlers.sample
}