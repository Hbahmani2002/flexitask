define(["common/autocomplete", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, helpers, context, i18n, dialog, http, composition, notification, app, ko, errorhandler, _, utils) {

        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.context = context;
            this.utils = utils;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.projectId = null;
            this.accessList = ko.observableArray([]);

            this.subscriptions = [];

        };

        ctor.prototype.showUserProjectAccessDetails = function (user) {
            var userId = user.id;

            http.get(String.format("/api/user/{0}/access?projectId={1}", userId, _this.projectId))
                .then(function (response) {

                }).fail(_this.handleError);
        };


        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.projectId = settings.projectId;

            return http.get(String.format("/api/projects/{0}/access", _this.projectId))
                .then(function (response) {
                    var list = _.map(response, function (u) {
                        return {
                            user: context.getUserById(u.id)
                        };
                    });
                    _this.accessList(list);
                }).fail(_this.handleError);
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;

            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };

        return ctor;

    });
