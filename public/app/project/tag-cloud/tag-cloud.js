define(["common/autocomplete", "jquery", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete,$, helpers, context, i18n, dialog, http, composition, notification, app, ko, errorhandler, _, utils) {

        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.context = context;
            this.utils = utils;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.projectId = null;
            this.tagCloud = ko.observableArray([]);
            this.sort = ko.observable("count");
            this.subscriptions = [];

            this.filteredTagCloud= ko.pureComputed(function () {
                var sort = _this.sort() || "count";
                
                var result = _.sortBy(_this.tagCloud(), function (a) {
                    if (sort == "count") {
                        return a.doc_count
                    } else if (sort == "name") {
                        return a.key;
                    }
                });

                if(sort==="count"){
                    result = result.reverse();
                }
                
                return result;
            });

        };

        ctor.prototype.changeSort = function (viewModel, event) {
            var _this = this;
            var target = $(event.target);
            if (target) {
                var sort = target.data("sort");
                _this.sort(sort);
            }
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.projectId = settings.projectId;

            return http.get(String.format("/api/projects/{0}/tag-cloud", _this.projectId))
                .then(function (response) {
                    
                    _this.tagCloud(response);
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
