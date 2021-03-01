/**
 * Durandal 2.0.1 Copyright (c) 2012 Blue Spire Consulting, Inc. All Rights Reserved.
 * Available via the MIT license.
 * see: http://durandaljs.com or https://github.com/BlueSpire/Durandal for details.
 */
/**
 * Enables common http request scenarios.
 * @module http
 * @requires jquery
 * @requires knockout
 */
define(['jquery', 'knockout'], function($, ko) {
    /**
     * @class HTTPModule
     * @static
     */
    return {
        ajaxInterceptor:function(options) {
            return options;
        },
        /**
         * The name of the callback parameter to inject into jsonp requests by default.
         * @property {string} callbackParam
         * @default callback
         */
        callbackParam: 'callback',
        /**
         * Converts the data to JSON.
         * @method toJSON
         * @param {object} data The data to convert to JSON.
         * @return {string} JSON.
         */
        toJSON: function (data) {
            return ko.toJSON(data);
        },
        /**
         * Makes an HTTP GET request.
         * @method get
         * @param {string} url The url to send the get request to.
         * @param {object} [query] An optional key/value object to transform into query string parameters.
         * @return {Promise} A promise of the get response data.
         */
        get: function (url, query, headers) {
             var t = this;
            var options = t.ajaxInterceptor({url:url, data: query, headers: ko.toJS(headers),type:'GET'  });
            return $.ajax(options);
        },
        /**
         * Makes an JSONP request.
         * @method jsonp
         * @param {string} url The url to send the get request to.
         * @param {object} [query] An optional key/value object to transform into query string parameters.
         * @param {string} [callbackParam] The name of the callback parameter the api expects (overrides the default callbackParam).
         * @return {Promise} A promise of the response data.
         */
        jsonp: function (url, query, callbackParam) {
            if (url.indexOf('=?') == -1) {
                callbackParam = callbackParam || this.callbackParam;

                if (url.indexOf('?') == -1) {
                    url += '?';
                } else {
                    url += '&';
                }

                url += callbackParam + '=?';
            }

            return $.ajax({
                url: url,
                dataType:'jsonp',
                data:query
            });
        },
        /**
         * Makes an HTTP POST request.
         * @method post
         * @param {string} url The url to send the post request to.
         * @param {object} data The data to post. It will be converted to JSON. If the data contains Knockout observables, they will be converted into normal properties before serialization.
         * @return {Promise} A promise of the response data.
         */
        post: function (url, data,headers) {
            var t = this;
            return $.ajax(t.ajaxInterceptor({
                url: url,
                data: ko.toJSON(data),
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                headers:ko.toJS(headers)
            }));
        },
        put: function (url, data,headers) {
            var t = this;
            return $.ajax(t.ajaxInterceptor({
                url: url,
                data: ko.toJSON(data),
                type: 'PUT',
                contentType: 'application/json',
                dataType: 'json',
                headers:ko.toJS(headers)
            }));
        },
        delete: function (url,query,headers) {
            var t = this;
            return $.ajax(t.ajaxInterceptor({
                url: url,
                data: query,
                type: 'DELETE',
                contentType: 'application/json',
                dataType: 'json',
                headers:ko.toJS(headers)
            }));
        }
    };
});
