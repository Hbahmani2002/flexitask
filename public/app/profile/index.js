define(["config","common/utils","common/prefs", "common/notifications", "common/autocomplete", "common/helpers", "common/context", "amplify", "plugins/dialog", "i18n", "task/task", "durandal/events",
    "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout","jquery", "underscore"
],
function (config,utils,prefs,notifications ,autocomplete, helpers, context, amplify, dialog, i18n, taskVm, events, errorhandler, system, http, router, app, activator, ko, $, _) {


    function PushNotificationSettingsModel(){
        var self = this;

        
    }

    PushNotificationSettingsModel.prototype.subscribeToOneSignal = function () {
        var _this = this;
        if (context.user().oneSignalUserAgentId != null) {
            OneSignal.setSubscription(true);
        } else {
            OneSignal.registerForPushNotifications({
                modalPrompt: true
            });
        }
    }

    PushNotificationSettingsModel.prototype.unsubscribeFromOneSignal = function () {
        var _this = this;
        OneSignal.setSubscription(false);
    }


    function ChangePasswordModel(){
        var self = this;
        errorhandler.includeIn(this);
        this.currentPassword = ko.observable().extend({
            required: true
        });
        this.newPassword = ko.observable().extend({
            required: true,
            validation: {
                validator: function (val, someOtherVal) {
                    return utils.passwordService.isWeak(val)===false
                },
                message: "Password must be stronger",
                params: 1
            }
        });
        this.newPasswordConfirm = ko.observable().extend({
            required: true,
            equal: this.newPassword 
        });
        
        this.errors = ko.validation.group(this);
        
        this.changePasswordCommand = ko.asyncCommand({
            execute: function (callback) {
                var errors = self.errors;
                if (errors().length > 0) {
                    errors.showAllMessages(true);
                    return false;
                }
                var command = {
                    currentPassword: this.currentPassword(),
                    newPassword :this.newPassword()
                };

             
                var  url = String.format("/api/users/{0}/password", context.user().id);
               
                return http.put(url, command)
                    .then(function (response) {
                        notifications.success("Password changed.");
                    }).fail(self.handleError)
                    .always(function () {
                        callback();
                    });
            },
            canExecute: function (isExecuting) {
                return !isExecuting;
            }
        });
    }

    var ctor = function () {
        errorhandler.includeIn(this);
        var _this = this;
        this.config = config;
        this.context = context;
        this.prefs = prefs;
        this.autocomplete = autocomplete;
        this.helpers = helpers;

      
        this.subscriptions = [];
        this.changePasswordModel = new ChangePasswordModel();
        this.pushNotificationSettingsModel = new PushNotificationSettingsModel();
       
    };

    


    return ctor;
});


