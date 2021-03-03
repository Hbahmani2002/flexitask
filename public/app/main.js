"use strict";
requirejs.config({
    waitSeconds: 200,
    paths: {
        text: "../assets/vendor/requirejs-text/text",
        durandal: "../assets/vendor/durandal",
        plugins: "../assets/vendor/durandal/plugins",
        knockout: "../assets/vendor/knockout/knockout",
        "knockout.postbox": "../assets/vendor/knockout-postbox/knockout-postbox",
        "knockout.punches": "../assets/vendor/knockout-extensions/knockout.punches",
        "knockout.mapping": "../assets/vendor/knockout-extensions/knockout.mapping-latest",
        "knockout.validation": "../assets/vendor/knockout-extensions/knockout.validation",
        "knockout.validation.localizations": "../assets/vendor/knockout-extensions/localization",
        "knockout.dirtyFlag": "../assets/vendor/knockout-extensions/knockout.dirtyFlag",
        "knockout.activity": "../assets/vendor/knockout-extensions/knockout.activity",
        "knockout.command": "../assets/vendor/knockout-extensions/knockout.command",

        transitions: "../assets/vendor/durandal/transitions",
        underscore: "../assets/vendor/underscore/underscore",
        library: "../assets/vendor",
        i18n: "../assets/vendor/i18next/i18next.amd.withJQuery",
        amplify: "../assets/vendor/amplify/amplify",
        moment: "../assets/vendor/moment/moment-with-locales",
        summernote: "../assets/vendor/summernote/summernote",
        "jquery.scrollto": "../assets/vendor/jquery-scrollto/jquery.scrollto",
        "jquery.caret": "../assets/vendor/caret-js/jquery.caret",
        "jquery.atwho": "../assets/vendor/jquery-atwho/jquery.atwho",
        highlightjs: "../assets/vendor/highlight/highlight.pack",
        kendo: "../assets/kendo/js/kendo.all.min",
        JSZip: "../assets/kendo/js/jszip.min",
        datetimepicker: "../assets/vendor/bootstrap-datetimepicker/bootstrap-datetimepicker",
        datepicker: "../assets/vendor/bootstrap-datepicker/bootstrap-datepicker",
        typeahead: "../assets/vendor/typeahead-js/typeahead.jquery",
        bloodhound: "../assets/vendor/typeahead-js/bloodhound",
        "twitter-text":"../assets/vendor/twitter-text/twitter-text",
        punycode:"../assets/vendor/twitter-text/punycode",
        select2: "../assets/vendor/select2/select2",
        stacktrace : "../assets/vendor/stacktrace/stacktrace"
    },
    shim: {
        knockout: {
            exports: "knockout"
        },
        typeahead: {
            deps: ["jquery"],
            init: function ($) {
                return require.s.contexts._.registry["typeahead.js"].factory($);
            }
        },
        "twitter-text":{
            deps:["punycode"],
            exports:"twitter-text"
        },
        bloodhound: {
            deps: ["jquery"],
            exports: "Bloodhound"
        },
        kendo: {
            deps: ["jquery", "JSZip"],
            exports: "kendo"
        },
        highlightjs: {
            exports: "hljs"
        },
        amplify: {
            deps: ["jquery"],
            exports: "amplify"
        },
        underscore: {
            exports: "_"
        },
        "jquery.caret": {
            deps: ["jquery"]
        },
        "jquery.scrollto": {
            deps: ["jquery"],
            exports: "jQuery.fn.scroll"
        },
        "jquery.atwho": {
            deps: ["jquery", "jquery.caret"],
            exports: "jQuery.fn.atwho"
        },
        datetimepicker: {
            deps: ["jquery", "moment"]
        },
        datepicker: {
            deps: ["jquery"]
        },
        "knockout.punches": {
            deps: ["knockout"]
        },
        "knockout.activity": {
            deps: ["knockout"],
            exports: "ko.activity"
        },
        "knockout.command": {
            deps: ["knockout"],
            exports: "ko.command"
        },
        "knockout.dirtyFlag": {
            deps: ["knockout"],
            exports: "ko.dirtyFlag"
        },
        "ko.mapping": {
            deps: ["knockout"],
            exports: "ko.mapping"
        }
    }
});

define("fifi",["twitter-text"],function(t){

});


define("markdown", function () {
    return window.Markdown;
});

define("jquery", function () {
    return jQuery;
});

define("config", ["fifi","moment","jquery" ,"knockout", "amplify", "underscore"], function (fifi,moment, $, ko, amplify, _) {
    window.ko = ko;
    var config = window.FT.config;
    moment.locale(amplify.store("lang") || config.moment_locale);
    function FlexiTaskConfig() {
        var _this = this;
        this.appName = "default";
        this.appId = 0;
        this.useOneSignal=false;
        this.facebookAppId="";
        this.twitterAppId="";
        this.appDetails = ko.observable();
        this.title = "PEM";
        this.emojiPath = "";
        this.dateFormat = moment().localeData()._longDateFormat["L"];
        this.dateTimeFormat = moment().localeData()._longDateFormat["L"] + " " + moment().localeData()._longDateFormat["LT"];

        this.backgroundImagePath = "";
        this.getBackgroundImage = function () {
            if (!_this.backgroundImagePath) {
                return "../images/login.jpg";
            }

            return _this.backgroundImagePath;
        };
    }

    var instance = new FlexiTaskConfig();
    function createEndpointsConfigSection(baseUrl) {
        var baseEndpoint = baseUrl;
        return {
            serviceEndpoints: {
                baseEndpoint: baseEndpoint,
                baseUrl: baseEndpoint,
                userInfoWithSearchUrl: baseEndpoint + "/api/users/me?includes=search,notifications,stars",
                loginUrl: baseEndpoint + "/token",
                signalR: baseEndpoint + "/signalr/hubs",
                attachmentUrlForDownload: baseEndpoint + "/api/tasks/{0}/attachments/{1}/download?action=download&version={2}",
                attachmentUrlForView: baseEndpoint + "/api/tasks/{0}/attachments/{1}/download?action=view&version={2}"

            },
            cdnEndpoints: {
                baseEndpoint: baseEndpoint,
                avatarPath:  "/assets/images/avatars"
            }
        };
    }

    config = $.extend(true, instance,config, createEndpointsConfigSection(config.base_url));
    return config;
});


define(["config","durandal/binder", "common/lang","common/diag", "knockout", "common/extensions", "require", "moment", "common/utils", "plugins/router", "plugins/http", - "plugins/dialog", "plugins/observable", "durandal/system", "durandal/app", "durandal/viewLocator"],
    function (config, binder,lang,diag, ko, extensions, require, moment, utils, router, http, dialog, observable, system, app, viewLocator) {
    //binder.throwOnErrors = true;
        window.FT.utils = utils;

        system.debug(config.debug);
        app.title = config.title;
        app.configurePlugins({
            router: true,
            dialog: true,
            widget: true,
            bsModal: true
        });

        router.updateDocumentTitle = function (instance, instruction) {
            if (instance.getTitle) {
                document.title = instance.getTitle(instruction, app);
            }
            else if (instruction.config.title) {
                if (app.title) {
                    document.title = instruction.config.title + " | " + app.title;
                } else {
                    document.title = instruction.config.title;
                }
            } else if (app.title) {
                document.title = app.title;
            }
        };

        // ko.options.deferUpdates = true;
        extensions.install();
        if (config.debug) {
            diag.enableKnockoutPerformanceReport();
        }
        //diag.enableClientSideErrorLogging();


        system.acquire("common/auth").then(function (auth) {
            return app.start().then(function () {
                return lang.init().then(function(){
                    app.setRoot("layout/super_shell", "entrance");
                });
            });
        });
    });
