define(function (require) {
    
    var http = require("plugins/http");

    var sys = require("durandal/system");
    var _ = require("underscore");
    var ko = require("knockout");
    var $ = require("jquery");

    var context = require("common/context");
    var prefs = require("common/prefs");
    var config = require("config");
    var amplify = require("amplify");


    function extendHttpPlugin(accessToken) {
        http.postSync = function (url, data, headers) {
            var t = this;
            return $.ajax(t.ajaxInterceptor({
                url: url,
                data: ko.toJSON(data),
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                async: false,
                headers: ko.toJS(headers)
            }));
        };
        http.deleteSync = function (url, query, headers) {
            var t = this;
            return $.ajax(t.ajaxInterceptor({
                url: url,
                data: query,
                type: "DELETE",
                contentType: "application/json",
                dataType: "json",
                async: false,
                headers: ko.toJS(headers)
            }));
        };
        $( document ).ajaxError(function( event, request, settings ) {
            if (request && request.status && request.status === 401) {
                ko.postbox.publish("UserNotLoaded");
            }
          });
        http.ajaxInterceptor = function (options) {
            if (options.url && (options.url.startsWith("http://") === false && options.url.startsWith("https://") === false)) {
                options.url = config.serviceEndpoints.baseEndpoint + options.url;
            }

            if (options.headers) {
                options.headers = $.extend(options.headers, {
                    Authorization: "Bearer " + accessToken
                });
            } else {
                options.headers = {
                    Authorization: "Bearer " + accessToken
                };
            }

            // options.ifModified = false;
            options.cache = true;

            return options;
        };
    }

    return {

        init: function () {
            // Initialize authentication...
            // return http.get(config.serviceEndpoints.baseEndpoint + "/api/apps?name=" + config.appName).then(function (response) {
            //     config.appDetails(response);

            return sys.defer(function (dfd) {

                var accessToken = sessionStorage.accessToken || localStorage.accessToken;

                if (accessToken) {
                    var headers = {
                        Authorization: "Bearer " + accessToken
                    };
                    $.ajax(config.serviceEndpoints.userInfoWithSearchUrl, {
                        cache: false,
                        headers: headers
                    }).done(function (data) {
                        if (data.userName) {
                            context.setUser(data);
                            context.authToken(accessToken);
                            extendHttpPlugin(accessToken);
                            //prefs.langCode(ko.unwrap(context.user().uiLanguage))
                            prefs.changeLang(amplify.store("lang"));
                            dfd.resolve(context.user()); // return promise
                        } else {
                            dfd.reject();
                        }
                    }).fail(function (f) {
                        dfd.reject();
                    });
                } else {
                    dfd.reject();
                }
            });
            //});
        },
        logout: function (router) {
            localStorage.removeItem("accessToken");
            sessionStorage.removeItem("accessToken");
            _.each(amplify.store(), function (storeKey) {
                amplify.store(storeKey, null);
            });

            http.ajaxInterceptor = function (options) {
                if (options.url && (options.url.startsWith("http://") === false && options.url.startsWith("https://") === false)) {
                    options.url = config.serviceEndpoints.baseEndpoint + options.url;
                }
                return options;
            };
            context.authToken(null);
            context.user(null);

        },
        login: function (token, persist) {
            var _this = this;
            var deferred = $.Deferred();

            var headers = {
                Authorization: "Bearer " + token
            };

            $.ajax(config.serviceEndpoints.userInfoWithSearchUrl, {
                cache: false,
                headers: headers
            }).done(function (data) {
                if (data.userName) {
                    context.setUser(data);
                    context.authToken(token);
                    extendHttpPlugin(token);

                    if (persist) {
                        localStorage.accessToken = token;
                    } else {
                        sessionStorage.accessToken = token;
                    }

                    return prefs.changeLang(amplify.store("lang")).then(function (r) {
                        //app.setRoot("layout/shell");
                        deferred.resolve(true);
                    });


                } else {
                    deferred.reject();
                }
            }).fail(function (res) {
                if (res && res.status && res.status === 401) {
                    ko.postbox.publish("UserNotLoaded");
                }
                deferred.reject();
            });

            return deferred;
        }
    };
});
