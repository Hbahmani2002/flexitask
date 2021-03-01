define(["common/autocomplete", "common/helpers", "common/context","config", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, helpers, context, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utility) {


        var vm = function (projectId) {
            var _this = this;
            errorhandler.includeIn(this);
            this.autocomplete = autocomplete;
            this.context = context;
            this.helpers = helpers;
            this.projectId = projectId;
            this.customFields = ko.observableArray([]);
          
            this.targetProjectId = ko.observable().extend({
                validation: {
                    validator: function (val, params) {
                        if(val === _this.projectId){
                            return false;
                        }

                        return true;
                    },
                    message: i18n.t("app:pages.copyCustomFields.cannotSelectSameProjectForDuplicate"),
                    params: []
                }
            });
            this.hasSelectedAnyField = ko.pureComputed(function () {
                return _.some(_this.customFields(), function (cf) {
                    return cf.copy() === true;
                });
            });
            this.duplicateCustomFields = ko.asyncCommand({
                execute: function (callback) {
                    var selectedCustomFields = _.chain(_this.customFields())
                        .filter(function (f) {
                            return f.copy();
                        })
                        .map(function (f) {
                            return {id: ko.unwrap(f.id), title: ko.unwrap(f.title)};
                        })
                        .value();


                    var requests = [];
                    _.each(selectedCustomFields, function (cf) {
                        var url = config.serviceEndpoints.baseEndpoint +  String.format("/api/projects/{0}/custom-fields?sourceCustomFieldId={1}&sourceProjectId={2}", _this.targetProjectId(), cf.id, _this.projectId);
                        requests.push({
                            type: "POST",
                            url: url,
                            data: {
                                title: cf.title
                            }
                        });
                    });

                    $.ajaxBatch({
                        url: config.serviceEndpoints.baseEndpoint+ "/api/batch",
                        headers: context.getTokenAsHeader(),
                        data: requests,
                        complete: function (xhr, status, data) {
                            _.each(_this.customFields(), function (f) {
                                f.copy(false);
                            });
                            
                            notifications.success(i18n.t("app:pages.customFieldModule.customFieldDuplicationSuccess"));
                            _this.close();
                        }
                    }).always(function () {
                        callback();
                    });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.hasSelectedAnyField() && _this.targetProjectId.isValid();
                }
            });
        };


        vm.prototype.loadCustomFields = function () {
            var _this = this;

            var url = String.format("/api/projects/{0}/custom-fields", _this.projectId);
            return http.get(url)
                .then(function (response) {
                    _this.customFields([]);
                    var customFields = [];
                    response.forEach(function (cf) {
                        cf.copy = ko.observable(false);
                        customFields.push(cf);
                    });
                    _this.customFields.push.apply(_this.customFields, customFields);
                }).fail(_this.handleError);
        };


        vm.prototype.activate = function () {
            var _this = this;

            return _this.loadCustomFields();
        };


        vm.prototype.close = function () {
            dialog.close(this);
        };

        vm.prototype.deactivate = function () {
            var _this = this;
        };


        vm.prototype.attached = function () {
            var _this = this;
        };

        return vm;
    });
