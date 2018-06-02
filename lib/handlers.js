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

            var firstName = data.payload.firstName.trim();
            firstName = typeof (firstName) === 'string' && firstName.length > 0 ? firstName : false;

            var lastName = data.payload.lastName.trim();
            lastName = typeof (lastName) === 'string' && lastName.length > 0 ? lastName : false;

            var password = data.payload.password.trim();
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
                    'Error': 'Missing required fields'
                });
            }

        },
        // required data: phone
        // optional data: none
        // TODO: only let an authenticated user access their object
        get: function (data, callback) {
            // check tha tthe phone number  is valid
            var phone = data.queryStringObject.phone.trim();
            var phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;
            if (phone) {
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
                })
            } else {
                callback(400, {
                    'Error': 'Missing required field'
                });
            }
        },
        // required data: phone
        // optional data: firstName, lastName, password (at least one must be specified)
        // TODO: only authenticated users can update their own object
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
        // TODO: only let the authenticated user delete their object
        // TODO: clean up othe data files associated with this user
        delete: function (data, callback) {
            // check that the phone number is is valid
            var phone = data.queryStringObject.phone.trim();
            var phone = typeof (phone) === 'string' && phone.length === 10 ? phone : false;
            if (phone) {
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
    notfound: function (data, callback) {
        callback(404);
    }
};

// container for the users sub-methods

module.exports = handlers;