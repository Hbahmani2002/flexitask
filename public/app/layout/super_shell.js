define(function (require) {

    var router = require("plugins/router");
    var http = require("plugins/http");
    var app = require("durandal/app");
    var system = require("durandal/system");
    var events = require("durandal/events");
    var activator = require("durandal/activator");
    var composition = require("durandal/composition");
    var dialog = require("plugins/dialog");
    var i18n = require("i18n");
    var amplify = require("amplify");
    var config = require("config");
    var $ = require("jquery");
    var _ = require("underscore");
    var ko = require("knockout");

    var auth = require("common/auth");
    var context = require("common/context");
    var errorhandler = require("common/errorhandler");
    var utils = require("common/utils");
    


    var notifier = require("common/notifier");
    var prefs = require("common/prefs");
    var lookupFactory = require("common/lookups");
    var lang = require("common/lang");

    var dynamicHeightBindingHandler = require("common/dynamicHeightBindingHandler");



    function activateShell(vm,defer){
        var _this = vm;
        return system.acquire("layout/shell")
            .then(function (module) {
                var o = system.resolveObject(module);
                return _this.currentShell.activateItem(o);

            }).then(function(){
                defer.resolve();
            });
    }

    function activateLogin(vm,defer){
        var _this = vm;
        return system.acquire("login/account_login")
            .then(function (module) {
                var o = system.resolveObject(module);
                return _this.currentShell.activateItem(o);
            }).then(function(){
                defer.resolve();
            });
    }

    var shell = function() {
        var _this = this;

        errorhandler.includeIn(this);
        this.router = router;
        this.config = config;
        this.showNavbar = ko.computed(function () {
            return context.user() && context.user().id.length > 0;
        });
        this.prefs = prefs;
        this.signalRInitialized = false;
        this.currentShell =  activator.create();

        dynamicHeightBindingHandler.install();
    }






    shell.prototype.canActivate = function (args) {
        return true;
    };

    shell.prototype.activate = function (args) {
        var _this = this;

        

        return system.defer(function (dfd) {
            auth.init()
                .then(function (user) {
                    return activateShell(_this,dfd);
                })
                .fail(function (result) {
                    return activateLogin(_this,dfd);
                });
        });
    };

    shell.prototype.deactivate = function (close) {
        return true;
    };

    shell.prototype.detached = function () {

    };

    shell.prototype.logout = function(){
        var _this=this;
        var currentShell = _this.currentShell();
        if(currentShell && currentShell.deactivate){
            currentShell.deactivate(true);
            _this.currentShell(null);
        }

        return system.defer(function (dfd) {
            activateLogin(_this,dfd);
        });
    };

    shell.prototype.login = function () {
        var _this=this;
        var currentShell = _this.currentShell();
        if(currentShell && currentShell.deactivate){
            currentShell.deactivate(true);
            _this.currentShell(null);
        }

        return system.defer(function (dfd) {
            activateShell(_this,dfd);
        });
    };

    shell.prototype.canDeactivate = function (close) {
        return true;
    };

    shell.prototype.attached = function (view) {
        var _this =this;
        if(_this.config.customScriptFile){
            var s = document.createElement("script");
            s.type = "text/javascript";
            s.src = _this.config.customScriptFile;
            $("head").append(s);
        }

        if(_this.config.customCssFile){
            var c = document.createElement("link");
            c.type = "text/css";
            c.href = _this.config.customCssFile;
            c.rel ="stylesheet";
            $("head").append(c);
        }

    };

    return new shell();
});
