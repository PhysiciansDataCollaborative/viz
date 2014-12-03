'use strict';
var async = require('async'),
    _ = require('lodash'),
    logger = require('./logger');

/**
 * Middleware for requests to the provider.
 * @param  {Function} next The async callback. Signature (error, result)
 * @param  {Object}   data async object which contains the results of `validators`
 */
function middleware(next, data) {
    /**
     * Make a request to the provider.
     * @param {Object}   req      The express `req` object.
     * @param {String}   path     The desired URI on the provider.
     * @param {Function} callback The callback of the function. Signature (error, request)
     */
    function providerGet(req, path, callback) {
        require('request').get({ url: process.env.PROVIDER_URL + path, json: true }, function (error, request, body) {
            callback(error, request);
        });
        // Callback should be (error, request)
    }

    function providerPost(req, path, data, callback) {
        require('request').post({ url: process.env.PROVIDER_URL + path, json: true, form: data }, function (error, request, body) {
            callback(error, request);
        });
        // Callback should be (error, request)
    }
    /**
     * Makes a request to the provider API for a list of visualizations and attaches it to `req.visualizations`.
     * @param {Object}   req      The Express req object.
     * @param {Object}   res      The Express res object.
     * @param {Function} callback The next middleware to invoke.
     */
    function populateVisualizationList(req, res, callback) {
        // TODO: Cache this per user.
        providerGet(req, '/api', function validation(error, request) {
            if (error) { return callback(error); }
            var validated = data.validators.list(request.body);
            // console.log(validated.valid);
            if (validated.valid === true) {
                req.visualizations = request.body.visualizations;
                callback();
            } else {
                callback(new Error(JSON.stringify(validated, 2)));
            }
        });
    }
    /**
     * Makes a request to the provider API for a single visualization and attaches it to `req.visualization`.
     * @param {Object}   req      The Express req object.
     * @param {Object}   res      The Express res object.
     * @param {Function} callback The next middleware to invoke.
     */
    function populateVisualization(req, res, callback) {
        if (!req.params.title) { return res.redirect('/'); }
        providerGet(req, '/api/' + req.params.title, function validation(error, request) {
            if (error) { return next(error); }
            var validated = data.validators.item(request.body);
            if (validated.valid === true) {
                req.visualization = request.body;
                callback();
            } else {
                callback(new Error(JSON.stringify(validated, 2)));
            }
        });
    }

    function authenticateUser(req, res, callback) {
        if (!req.body.user && !req.body.password) {
            req.session.message = "Please provide a username and password in the request body.";
            res.status(401).redirect('/auth');
        } else {
            providerPost(req, '/auth', {username: req.body.username, password: req.body.password}, function result(error, response) {
                console.log(response.body);
                console.log(response.statusCode);
                if (response.statusCode === 200) {
                    req.session.user = response.body;
                    callback();
                } else {
                    req.session.message = response.body.error;
                    res.status(401).redirect('/auth');
                }
            });
        }
    }
    function checkAuthentication(req, res, callback) {
        if (!req.session && !req.session.user) { // No session on record.
            req.session.message = "No User found... Please log in.";
            res.status(401).redirect('/auth');
        } else { // Session must exist.
            callback();
        }
    }
    return next(null, {
        populateVisualizationList: populateVisualizationList,
        populateVisualization: populateVisualization,
        providerGet: providerGet,
        authenticateUser: authenticateUser,
        checkAuthentication: checkAuthentication
    });
}

// This task depends on the `validators` task.
module.exports = ['validators', middleware];