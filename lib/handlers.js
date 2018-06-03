// Request handlers

// dependencies
const _data = require('./data');
const helpers = require('./helpers');

// define the handlers
var handlers = {
    ping: function (data, callback) {
        callback(200);
    },
    _users: {
        // required data: firstName, lastName, phone, password, tosAgreement
        // optional data: none
        post: function (data, callback) {
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
        get: function (data, callback) {
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
        put: function (data, callback) {
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
        // TODO: clean up othe data files associated with this user
        delete: function (data, callback) {
            // check that the phone number is is valid
            var phone = data.queryStringObject.phone.trim();
            var phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;
            if (phone) {
                var token = typeof (data.headers.token) === 'string' ? data.headers.token : false;

                // verify the the given token is valid for the phone number
                handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
                    if (tokenIsValid) {
                        _data.read('users', phone, function (err, data) {
                            if (!err && data) {
                                _data.delete('users', phone, function (err) {
                                    if (!err) {
                                        callback(200);
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
    _tokens: {
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
        post: function (data, callback) {
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
                                }

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
        get: function (data, callback) {
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
        put: function (data, callback) {
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
        delete: function (data, callback) {
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
    users: function (data, callback) {
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._users[data.method](data, callback);
        } else {
            callback(405);
        }
    },
    // tokens
    tokens: function (data, callback) {
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if (acceptableMethods.includes(data.method)) {
            handlers._tokens[data.method](data, callback);
        } else {
            callback(405);
        }
    },

    notfound: function (data, callback) {
        callback(404);
    }
};

// container for the users sub-methods

module.exports = handlers;