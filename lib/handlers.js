// Request handlers

// dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

const protocols = ['http', 'https'];
const methods = ['post', 'get', 'put', 'delete'];

// define the handlers
var handlers = {
    'ping': function (data, callback) {
        callback(200);
    },
    // public handler
    'public': function (data, callback) {
        if (data.method === 'get') {
            // get the filename being requested
            var trimmedAssetName = data.trimmedPath.replace('public/', '').trim();
            if (trimmedAssetName.length) {
                helpers.getStaticAsset(trimmedAssetName, function (err, data) {
                    if (!err && data) {
                        // determine the content type and default to plain text
                        if (trimmedAssetName.indexOf('.css') >= 0) {
                            contentType = 'css';
                        }
                        if (trimmedAssetName.indexOf('.png') >= 0) {
                            contentType = 'png';
                        }
                        if (trimmedAssetName.indexOf('.jpg') >= 0) {
                            contentType = 'jpg';
                        }
                        if (trimmedAssetName.indexOf('.ico') >= 0) {
                            contentType = 'favicon';
                        }
                        callback(200, data, contentType);
                    } else {
                        callback(500);
                    }
                });
            } else {
                callback(404)
            }
        } else {
            callback(405);
        }

    },
    //favicon handler
    'favicon': function (data, callback) {
        if (data.method === 'get') {
            // read in the favicon data
            helpers.getStaticAsset('favicon.ico', function (err, data) {
                if (!err && data) {
                    callback(200, data, 'favicon');
                } else {
                    callback(500);
                }
            });
        } else {
            callback(405);
        }
    },
    // index handler
    'index': function (data, callback) {
        // reject any request that is not a GET
        if (data.method === 'get') {
            // prepare data for interpolation
            var templateData = {
                'head.title': 'This is the title',
                'head.description': 'This is the meta description',
                'body.title': 'template title',
                'body.class': 'index'
            };
            // read in the template as a string
            helpers.getTemplate('index', templateData, function (err, str) {
                if (!err && str) {
                    // the universal header and footer
                    helpers.addUniversalTemplates(str, templateData, function (err, str) {
                        if (!err && str) {
                            callback(200, str, 'html');
                        } else {
                            callback(500, undefined, 'html');
                        }
                    });
                } else {
                    callback(500, undefined, 'html');
                }
            });
        } else {
            callback(405, undefined, 'html');
        }
    },
    '_checks': {
        // required data: protocol, url, method, successCodes, timeoutSeconds
        // optional data: none
        'post': function (data, callback) {
            // validate inputs
            var protocol = data.payload.protocol ? data.payload.protocol.toLowerCase().trim() : false;
            protocol = typeof (protocol) === 'string' && protocols.includes(protocol) ? protocol : false;

            var url = data.payload.url ? data.payload.url.trim() : false;
            url = typeof (url) === 'string' && url.length > 0 ? url : false;

            var method = data.payload.method ? data.payload.method.trim() : false;
            method = typeof (method) === 'string' && methods.includes(method) > 0 ? method : false;

            var successCodes = data.payload.successCodes ? data.payload.successCodes : [];
            successCodes = typeof (successCodes) === 'object' &&
                successCodes instanceof Array &&
                successCodes.length > 0 ? successCodes : false;

            var timeoutSeconds = data.payload.timeoutSeconds ? data.payload.timeoutSeconds : false;
            timeoutSeconds = typeof (timeoutSeconds) === 'number' &&
                timeoutSeconds % 1 === 0 &&
                timeoutSeconds >= 1 &&
                timeoutSeconds <= 5 ? timeoutSeconds : false;

            if (protocol && url && method && successCodes && timeoutSeconds) {
                // the token from the headers
                var tokenId = typeof (data.headers.token) === 'string' ? data.headers.token : false;
                // look up the user by reading the token
                _data.read('tokens', tokenId, function (err, tokenData) {
                    if (!err && tokenData) {
                        var userPhone = tokenData.phone;
                        // look up the user
                        _data.read('users', userPhone, function (err, userData) {
                            if (!err && userData) {
                                var userChecks = typeof (userData.checks) === 'object' && userData.checks instanceof Array ? userData.checks : [];
                                // verify that the user has less than the number of max checks
                                if (userChecks.length < config.maxChecks) {
                                    // create a random id for the check
                                    var checkId = helpers.createRandomString(20);
                                    // create the check object and include the user's phone
                                    var checkObject = {
                                        'id': checkId,
                                        'userPhone': userPhone,
                                        'protocol': protocol,
                                        'url': url,
                                        'method': method,
                                        'successCodes': successCodes,
                                        'timeoutSeconds': timeoutSeconds
                                    };
                                    _data.create('checks', checkId, checkObject, function (err) {
                                        if (!err) {
                                            // add the checkId to the users object
                                            userData.checks = userChecks;
                                            userData.checks.push(checkId);
                                            _data.update('users', userPhone, userData, function (err) {
                                                if (!err) {
                                                    callback(200, checkObject);
                                                } else {
                                                    callback(500, {
                                                        'Error': 'Could not update the user with the new check'
                                                    });
                                                }
                                            })
                                        } else {
                                            callback(500, {
                                                'Error': 'Unable to create the new check'
                                            });
                                        }
                                    })
                                } else {
                                    callback(400, {
                                        'Error': 'The user already has the max number of checks ... (' + config.maxChecks + ')'
                                    });
                                }
                            } else {
                                callback(403);
                            }
                        })
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(400, {
                    'Error': 'Missing required fields or inputs are invalid'
                });
            }
        },
        // required data: id
        // optional data: none
        'get': function (data, callback) { // check that the phone number  is valid
            var id = data.queryStringObject.id.trim();
            var id = typeof (id) === 'string' && id.length === 20 ? id : false;
            if (id) {

                // lookup the check
                _data.read('checks', id, function (err, checkData) {
                    if (!err && checkData) {
                        // get the token from the headers
                        var token = typeof (data.headers.token) === 'string' ? data.headers.token : false;

                        // verify the the given token is valid for the user that created the check
                        handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                            if (tokenIsValid) {
                                // return the check data
                                callback(200, checkData);
                            } else {
                                callback(403, {
                                    'Error': 'Missing required token in header or token is invalid or has expired',
                                    'checkData': checkData
                                });
                            }
                        });

                    } else {
                        callback(404);
                    }
                });


            } else {
                callback(400, {
                    'Error': 'Missing required field',
                    'data': data
                });
            }
        },
        // required data: id
        // optional data: protocol, url, method, successCodes, timeoutSeconds (one must be set)
        'put': function (data, callback) {
            // required field
            var id = data.payload.id ? data.payload.id.toLowerCase().trim() : false;
            id = typeof (id) === 'string' && id.length === 20 ? id : false;

            // validate optionals fields
            var protocol = data.payload.protocol ? data.payload.protocol.toLowerCase().trim() : false;
            protocol = typeof (protocol) === 'string' && protocols.includes(protocol) ? protocol : false;

            var url = data.payload.url ? data.payload.url.trim() : false;
            url = typeof (url) === 'string' && url.length > 0 ? url : false;

            var method = data.payload.method ? data.payload.method.trim() : false;
            method = typeof (method) === 'string' && methods.includes(method) > 0 ? method : false;

            var successCodes = data.payload.successCodes ? data.payload.successCodes : [];
            successCodes = typeof (successCodes) === 'object' &&
                successCodes instanceof Array &&
                successCodes.length > 0 ? successCodes : false;

            var timeoutSeconds = data.payload.timeoutSeconds ? data.payload.timeoutSeconds : false;
            timeoutSeconds = typeof (timeoutSeconds) === 'number' &&
                timeoutSeconds % 1 === 0 &&
                timeoutSeconds >= 1 &&
                timeoutSeconds <= 5 ? timeoutSeconds : false;

            if (id) {
                if (protocol || url || method || successCodes || timeoutSeconds) {
                    _data.read('checks', id, function (err, checkData) {
                        if (!err && checkData) {
                            var token = typeof (data.headers.token) === 'string' ? data.headers.token : false;

                            // verify the the given token is valid for the user that created the check
                            handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                                if (tokenIsValid) {
                                    // update the check where necessary
                                    if (protocol) checkData.protocol = protocol;
                                    if (url) checkData.url = url;
                                    if (method) checkData.method = method;
                                    if (successCodes) checkData.successCodes = successCodes;
                                    if (timeoutSeconds) checkData.timeoutSeconds = timeoutSeconds;

                                    // store
                                    _data.update('checks', id, checkData, function (err) {
                                        if (!err) {
                                            callback(200);
                                        } else {
                                            callback(500, {
                                                'Error': 'Could not update the check'
                                            });
                                        }
                                    })
                                } else {
                                    callback(403, {
                                        'Error': 'Missing required token in header or token is invalid or has expired',
                                        'checkData': checkData
                                    });
                                }
                            });
                        } else {
                            callback(400, {
                                'Error': 'Check ID does not exist'
                            });
                        }
                    })
                } else {
                    callback(400, {
                        'Error': 'Missing filed to update'
                    });
                }
            } else {
                callback(400, {
                    'Error': 'Missing required fields'
                });
            }
        },
        // required data: id
        // optional data: none
        'delete': function (data, callback) {
            // check that the phone number is is valid
            var id = data.queryStringObject.id.trim();
            var id = typeof (id) === 'string' && id.length === 20 ? id : false;
            if (id) {
                // lookup the check
                _data.read('checks', id, function (err, checkData) {
                    if (!err && checkData) {
                        var token = typeof (data.headers.token) === 'string' ? data.headers.token : false;

                        // verify the the given token is valid for the phone number
                        handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                            if (tokenIsValid) {

                                // delete the check data
                                _data.delete('checks', id, function (err) {
                                    if (!err) {
                                        _data.read('users', checkData.userPhone, function (err, userData) {
                                            if (!err && userData) {

                                                var userChecks = typeof (userData.checks) === 'object' && userData.checks instanceof Array ? userData.checks : [];

                                                // remove the deleted check from their list of checks
                                                if (userChecks.some(checkId => checkId === checkData.id)) {
                                                    userData.checks = userChecks.filter(checkId => checkId !== checkData.id)
                                                    // resave the users data
                                                    _data.update('users', checkData.userPhone, userData, function (err) {
                                                        if (!err) {
                                                            callback(200);
                                                        } else {
                                                            callback(500, {
                                                                'Error': 'Unable to update the specified user.'
                                                            });
                                                        }
                                                    });
                                                } else {
                                                    callback(500, {
                                                        'Error': 'Could not find the check on the users object'
                                                    });
                                                }

                                            } else {
                                                callback(500, {
                                                    'Error': 'Could not find the user who created the check, so could not remove the check from the user object'
                                                });
                                            }
                                        });
                                    } else {
                                        callback(500, {
                                            'Error': 'Error could not delete the check data'
                                        });
                                    }
                                })


                            } else {
                                callback(403, {
                                    'Error': 'Missing required token in header or token is invalid'
                                });
                            }
                        });

                    } else {
                        callback(400, {
                            'Error': 'Unable to find the specified id'
                        });
                    }
                });

            } else {
                callback(400, {
                    'Error': 'Missing required field'
                });
            }
        }
    },
    '_users': {
        // required data: firstName, lastName, phone, password, tosAgreement
        // optional data: none
        'post': function (data, callback) {
            // check that all required fields are filled out
            var phone = data.payload.phone.trim();
            phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;

            var firstName = data.payload.firstName ? data.payload.firstName.trim() : false;
            firstName = typeof (firstName) === 'string' && firstName.length > 0 ? firstName : false;

            var lastName = data.payload.lastName ? data.payload.lastName.trim() : false;
            lastName = typeof (lastName) === 'string' && lastName.length > 0 ? lastName : false;

            var password = data.payload.password ? data.payload.password.trim() : false;
            password = typeof (password) === 'string' && password.length > 0 ? password : false;

            var tosAgreement = data.payload.tosAgreement;
            tosAgreement = typeof (tosAgreement) === 'boolean' && tosAgreement ? true : false;

            if (firstName && lastName && phone && password && tosAgreement) {
                // make sure that the user does not already exist
                _data.read('users', phone, function (err, data) {
                    if (err) {
                        // hash the password
                        var hashedPassword = helpers.hash(password);

                        if (hashedPassword) {
                            var userObject = {
                                'firstName': firstName,
                                'lastName': lastName,
                                'phone': phone,
                                'hashedPassword': hashedPassword,
                                'tosAgreement': true
                            };

                            // store the user
                            _data.create('users', phone, userObject, function (err) {
                                if (!err) {
                                    callback(200);
                                } else {
                                    console.log(err);
                                    callback(500, {
                                        'Error': 'Could not create the new user.'
                                    });
                                }
                            });
                        } else {
                            callback(500, {
                                'Error': 'Could not hash the user\'s passowrd'
                            });
                        }

                    } else {
                        // user already exists
                        callback(400, {
                            'Error': 'A user with that phone number already exists'
                        });
                    }
                });
            } else {
                callback(400, {
                    'Error': 'Missing required fields',
                    'data': data
                });
            }

        },
        // required data: phone
        // optional data: none
        'get': function (data, callback) {
            // check that the phone number  is valid
            var phone = data.queryStringObject.phone.trim();
            var phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;
            if (phone) {

                // get the token from the headers
                var token = typeof (data.headers.token) === 'string' ? data.headers.token : false;

                // verify the the given token is valid for the phone number
                handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
                    if (tokenIsValid) {
                        _data.read('users', phone, function (err, data) {
                            if (!err && data) {
                                // remove the hashed password from the user object before returning it to the requestor
                                delete data.hashedPassword;
                                callback(200, data);
                            } else {
                                callback(404, {
                                    'Error': 'Phone number not found'
                                });
                            }
                        });
                    } else {
                        callback(403, {
                            'Error': 'Missing required token in header or token is invalid'
                        });
                    }
                });

            } else {
                callback(400, {
                    'Error': 'Missing required field'
                });
            }
        },
        // required data: phone
        // optional data: firstName, lastName, password (at least one must be specified)
        'put': function (data, callback) {
            // check for the require field
            var phone = data.payload.phone.trim();
            phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;

            // check for the optional fields
            var firstName = data.payload.firstName.trim();
            firstName = typeof (firstName) === 'string' && firstName.length > 0 ? firstName : false;

            var lastName = data.payload.lastName.trim();
            lastName = typeof (lastName) === 'string' && lastName.length > 0 ? lastName : false;

            var password = data.payload.password.trim();
            password = typeof (password) === 'string' && password.length > 0 ? password : false;

            if (phone) {
                if (firstName || lastName || password) {
                    // get the token from the headers
                    var token = typeof (data.headers.token) === 'string' ? data.headers.token : false;

                    // verify the the given token is valid for the phone number
                    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
                        if (tokenIsValid) {
                            // lookup the user
                            _data.read('users', phone, function (err, userData) {
                                if (!err && userData) {
                                    // update the fields necessary
                                    if (firstName) userData.firstName = firstName;
                                    if (lastName) userData.lastName = lastName;
                                    if (password) userData.hashedPassword = helpers.hash(password);

                                    // store the updated data
                                    _data.update('users', phone, userData, function (err) {
                                        if (!err) {
                                            callback(200);
                                        } else {
                                            console.log(err);
                                            callback(500, {
                                                'Error': 'Could not update the user'
                                            });
                                        }
                                    })
                                } else {
                                    callback(400, {
                                        'Error': 'The specified user does not exist'
                                    });
                                }
                            });
                        } else {
                            callback(403, {
                                'Error': 'Missing required token in header or token is invalid'
                            });
                        }
                    });
                } else {
                    callback(400, {
                        'Error': 'Missing fields to update'
                    });
                }
            } else {
                callback(400, {
                    'Error': 'Missing required field'
                });
            }
        },
        // required data: phone
        'delete': function (data, callback) {
            // check that the phone number is is valid
            var phone = data.queryStringObject.phone.trim();
            var phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;
            if (phone) {
                var token = typeof (data.headers.token) === 'string' ? data.headers.token : false;

                // verify the the given token is valid for the phone number
                handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
                    if (tokenIsValid) {
                        _data.read('users', phone, function (err, userData) {
                            if (!err && userData) {
                                _data.delete('users', phone, function (err) {
                                    if (!err) {

                                        // delete each of the checks associated with the user
                                        var userChecks = typeof (userData.checks) === 'object' && userData.checks instanceof Array ? userData.checks : [];
                                        var checksToDelete = userChecks.length;
                                        if (checksToDelete > 0) {
                                            var checksDeleted = 0;
                                            var deletionErrors = false;
                                            // loop through the checks
                                            userChecks.forEach(function (checkId) {
                                                _data.delete('checks', checkId, function (err) {
                                                    if (err) {
                                                        deletionErrors = true;
                                                    }
                                                    checksDeleted++;
                                                    if (checksDeleted === checksToDelete) {
                                                        if (!deletionErrors) {
                                                            callback(200);
                                                        } else {
                                                            callback(500, {
                                                                'Errors': 'Errors attempting to delete user checks'
                                                            });
                                                        }
                                                    }
                                                });
                                            });
                                        } else {
                                            callback(200);
                                        }


                                    } else {
                                        callback(500, {
                                            'Error': 'Unable to delete the specified user.'
                                        })
                                    }
                                })
                            } else {
                                callback(400, {
                                    'Error': 'Could not find the specified user'
                                });
                            }
                        });
                    } else {
                        callback(403, {
                            'Error': 'Missing required token in header or token is invalid'
                        });
                    }
                });
            } else {
                callback(400, {
                    'Error': 'Missing required field'
                });
            }
        }
    },
    // container for all of the tokens methods
    '_tokens': {
        verifyToken: function (id, phone, callback) {
            // look up token
            _data.read('tokens', id, function (err, tokenData) {
                if (!err && tokenData) {
                    // verify that the token had not expired and belongs to the given user
                    if (tokenData.phone === phone && tokenData.expires > Date.now()) {
                        callback(true);
                    } else {
                        callback(false);
                    }
                } else {
                    callback(false);
                }

            });
        },
        // required data: phone, password
        'post': function (data, callback) {
            // check that all required fields are filled out
            var phone = data.payload.phone.trim();
            phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;

            var password = data.payload.password.trim();
            password = typeof (password) === 'string' && password.length > 0 ? password : false;
            if (phone && password) {
                // lookup user based on phone
                _data.read('users', phone, function (err, userData) {
                    if (!err && userData) {
                        // hash the send password and compare to the password in the user object
                        var hashedPassword = helpers.hash(password);
                        if (hashedPassword === userData.hashedPassword) {
                            // if valid, create a new token with a random name. set expiration date 1 hour in the future
                            var tokenId = helpers.createRandomString(20);
                            if (tokenId) {
                                var expires = Date.now() + 1000 * 60 * 60;
                                var tokenObject = {
                                    'phone': phone,
                                    'id': tokenId,
                                    'expires': expires
                                };

                                // store the token
                                _data.create('tokens', tokenId, tokenObject, function (err) {
                                    if (!err) {
                                        callback(200, tokenObject);
                                    } else {
                                        callback(500, {
                                            'Error': 'Unable to create the new token'
                                        });
                                    }
                                });
                            } else {

                            }
                        } else {
                            callback(400, {
                                'Error': 'The password does not match the specified users stored password'
                            });
                        }
                    } else {
                        callback(400, {
                            'Error': 'Could not find the specified user.'
                        });
                    }
                })
            } else {
                callback(400, {
                    'Error': 'Missing required fields'
                })
            }
        },
        // required data: id
        // optional data: none
        'get': function (data, callback) {
            // check that the id is valid
            var id = data.queryStringObject.id.trim();
            var id = typeof (id) === 'string' && id.length === 20 ? id : false;
            if (id) {
                _data.read('tokens', id, function (err, tokenData) {
                    if (!err && tokenData) {
                        callback(200, tokenData);
                    } else {
                        callback(404, {
                            'Error': 'Token not found'
                        });
                    }
                })
            } else {
                callback(400, {
                    'Error': 'Missing required field'
                });
            }
        },
        // required data: id, extend
        // optional data: none
        'put': function (data, callback) {
            var id = data.payload.id.trim();
            id = typeof (id) === 'string' && id.length === 20 ? id : false;

            var extend = data.payload.extend;
            extend = typeof (extend) === 'boolean' && extend ? true : false;

            if (id && extend) {
                // lookup the token
                _data.read('tokens', id, function (err, tokenData) {
                    if (!err && tokenData) {
                        // check for token expiration
                        if (tokenData.expires > Date.now()) {
                            // set the expiration to an hour from now
                            tokenData.expires = Date.now() + 1000 * 60 * 60;
                            _data.update('tokens', id, tokenData, function (err) {
                                if (!err) {
                                    callback(200);
                                } else {
                                    callback(500, {
                                        'Error': 'Unable to update token expiration date'
                                    });
                                }
                            })
                        } else {
                            callback(400, {
                                'Error': 'The token has been expired and cannont be extended'
                            });
                        }
                    } else {
                        callback(400, {
                            'Error': 'Specified token does not exsit'
                        });
                    }
                })
            } else {
                callback(400, {
                    'Error': 'Missing required fields or fields are invalid'
                });
            }
        },
        // required data: id
        // optional data: none
        'delete': function (data, callback) {
            // check that the phone number is is valid
            var id = data.queryStringObject.id.trim();
            var id = typeof (id) === 'string' && id.length === 20 ? id : false;
            if (id) {
                _data.read('tokens', id, function (err, data) {
                    if (!err && data) {
                        _data.delete('tokens', id, function (err) {
                            if (!err) {
                                callback(200);
                            } else {
                                callback(500, {
                                    'Error': 'Unable to delete the specified token.'
                                })
                            }
                        })
                    } else {
                        callback(400, {
                            'Error': 'Could not find the specified token'
                        });
                    }
                })
            } else {
                callback(400, {
                    'Error': 'Missing required field'
                });
            }
        }
    },
    'users': function (data, callback) {
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._users[data.method](data, callback);
        } else {
            callback(405);
        }
    },
    // tokens
    'tokens': function (data, callback) {
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._tokens[data.method](data, callback);
        } else {
            callback(405);
        }
    },
    'checks': function (data, callback) {
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._checks[data.method](data, callback);
        } else {
            callback(405);
        }
    },
    'notfound': function (data, callback) {
        callback(404);
    }
};

module.exports = handlers;