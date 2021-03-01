
define(["durandal/system","layout/super_shell","jquery", "knockout", "plugins/router", "common/errorhandler", "common/notifications", "common/utils",  "config", "common/context", "common/auth", "i18n"],
function (system,superShell,$, ko, router, errorhandler, notification, utils, config, context, auth, i18n) {

    var handleauthenticationerrors = function (errors) {
        if (errors.responseText !== "") {
            var data = $.parseJSON(errors.responseText);
            if (data && data.error_description) {
                notification.error(data.error_description, null, errors, true);
            } else {
                if (data.message) {
                    notification.error(data.message, null, errors, true);
                }
            }
        }
    };

    var ctor = function(){
        var _this = this;
        this.config = config;
        this.username = ko.observable().extend({ required: true });
        this.password = ko.observable().extend({ required: true });
        this.rememberMe = ko.observable(false);
        this.returnUrl = ko.observable(null);
        this.isAuthenticated = ko.observable(false);
        this.errors = ko.validation.group(_this);
        errorhandler.includeIn(this);
    };

    ctor.prototype.logout = function () {
        context.logout();
    };

    ctor.prototype.login = function () {
        var self = this;

        if (this.errors().length !== 0) {
            this.errors.showAllMessages();
            return;
        }
        return $.ajax(config.serviceEndpoints.loginUrl, {
            type: "POST",
            data: {
                grant_type: "password",
                username: self.username(),
                password: self.password()
            }
        }).then(function (payload) {
            if (payload.userName && payload.access_token) {

                return system.defer(function (dfd) {
                    return auth.login(payload.access_token, true).then(function () {
                        dfd.resolve(true);
                    });
                })
                .promise()
                .then(function (res) {
                    self.errors.showAllMessages(false);

                    // Avoid redirect attacks
                    if (self.returnUrl() && utils.isExternal(self.returnUrl())) {
                        notification.error("Can´t redirect to external urls", self.returnUrl(), null, true);
                        return false;
                    }

                    superShell.login().then(function(){
                        if (self.returnUrl()) {
                            router.navigate(self.returnUrl());

                        } else {
                            router.navigate("#activities");
                        }
                    })


                });
            }
        }).fail(handleauthenticationerrors);
    };

    ctor.prototype.attached = function () {
        $("body").addClass("body-outside-shell");
    };

    return ctor;
});
