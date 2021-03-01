define(["common/autocomplete", "common/lookups", "common/helpers", "common/context", "amplify", "plugins/dialog", "i18n", "durandal/events", "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (autocomplete, lookupFactory, helpers, context, amplify, dialog, i18n, events, errorhandler, system, http, router, app, activator, ko, $, _) {

        function SearchInput() {
            var s = this;
            this.taskName = ko.observable("");

            this.projectIds = ko.observableArray([]);
            this.collaborators = ko.observableArray([]);
            this.assignees = ko.observableArray([]);
            this.coassignees = ko.observableArray([]);
            this.owners = ko.observableArray([]);
            this.coowners = ko.observableArray([]);
            this.cat1followers = ko.observableArray([]);
            this.cat2followers = ko.observableArray([]);
            this.cat3followers = ko.observableArray();
            this.taskTypes = ko.observableArray([]);
            this.activityType = ko.observable();
            this.activityPeriodType = ko.observable();
            this.activityPeriodUnit = ko.observable();
            this.activityDateValue = ko.observable().extend({ digit: true });
            this.activityDateStart = ko.observable().extend({
                required: {
                    onlyIf: function () { return s.activityPeriodType() === "Between"; }
                }
            });
            this.activityDateEnd = ko.observable().extend({
                required: {
                    onlyIf: function () { return s.activityPeriodType() === "Between"; }
                }
            });

            this.startDatePeriodType = ko.observable();
            this.startDatePeriodUnit = ko.observable();
            this.startDateValue = ko.observable().extend({ digit: true });
            this.startDateStart = ko.observable().extend({
                required: {
                    onlyIf: function () { return s.startDatePeriodType() === "Between"; }
                }
            });
            this.startDateEnd = ko.observable().extend({
                required: {
                    onlyIf: function () { return s.startDatePeriodType() === "Between"; }
                }
            });

            this.dueDatePeriodType = ko.observable();
            this.dueDatePeriodUnit = ko.observable();
            this.dueDateValue = ko.observable().extend({ digit: true });
            this.dueDateStart = ko.observable().extend({
                required: {
                    onlyIf: function () { return s.dueDatePeriodType() === "Between"; }
                }
            });
            this.dueDateEnd = ko.observable().extend({
                required: {
                    onlyIf: function () { return s.dueDatePeriodType() === "Between"; }
                }
            });

            this.status = ko.observableArray([]);
            this.priorities = ko.observableArray([]);
            this.categories = ko.observableArray([]);
            this.isBlocked = ko.observable(false);

            this.tags = ko.observableArray([]);
            this.tagOperation = ko.observable();
            this.filterName = ko.observable();
            this.selectedCustomFieldIds = ko.observableArray([]);
            this.selectedCustomFields = ko.observableArray([]);
            this.customFieldOperation = ko.observable();

            this.getCustomFieldDetail = function (id) {
                var form = _.find(s.selectedCustomFields(), function (cf) {
                    return ko.unwrap(cf.id) === ko.unwrap(id);
                });
                if (!form) {
                    return null;
                }

                var detail = _.find(context.customFields(), function (cf) {
                    return cf.id === id;
                });

                if (!detail) {
                    return null;
                }
                return {
                    detail: detail,
                    form: form
                };
            };
            this.modifyCustomField = function (cf) {
                if (_.contains(s.selectedCustomFieldIds(), cf.id)) {
                    s.selectedCustomFields.push({
                        id: ko.observable(cf.id),
                        value: ko.observable(),
                        filterType: ko.observable()
                    });

                } else {
                    var customField = _.find(s.selectedCustomFields(), function (c) {
                        return ko.unwrap(c.id) === cf.id;
                    });
                    if (customField) {
                        s.selectedCustomFields.remove(customField);
                    }
                }
                return true;
            };
            var dirtyFlagTrackingVars = [
                this.taskName,
                this.projectIds,
                this.collaborators,
                this.assignees,
                this.coassignees,
                this.owners,
                this.coowners,
                this.cat1followers,
                this.cat2followers,
                this.cat3followers,
                this.taskTypes,
                this.activityType,
                this.status,
                this.priorities,
                this.categories,
                this.isBlocked,
                this.tags,
                this.selectedCustomFieldIds,
                this.startDateStart,
                this.startDateEnd,
                this.dueDateStart,
                this.dueDateEnd
            ];
            this.dirtyFlag = new ko.DirtyFlag(dirtyFlagTrackingVars);
            this.isDirty = ko.computed(function () {
                return s.dirtyFlag().isDirty();
            });


            this.errors = ko.validation.group(this);
        }

        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.context = context;
            this.gridUniqueName = _.uniqueId("grid_");
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.lookups = lookupFactory.create();
            this.filter = new SearchInput();
            this.shouldShowSearchForm = ko.observable(true);
            this.results = ko.observableArray([]);


            this.viewFilter = {
                includeArchivedTasks: ko.observable(false)
            };

            this.hasResults = ko.computed(function () {
                return _this.results().length > 0;
            });


            this.reloadCriteria = function (criteria) {
                this.filter = new SearchInput();
                var mapping = {
                    ignore: ["errors"]
                };

                ko.mapping.fromJS(criteria, mapping, this.filter);
            };
        };

        ctor.prototype.buildCriteriaAndSearch = function () {
            var _this = this;
            if (_this.filter.errors().length > 0) {
                _this.filter.errors.showAllMessages();
                return;
            }

            var criteria = ko.toJS(_this.filter);
            _this.search(criteria);
            var filter = ko.toJS(_this.filter);
            amplify.store("search/recent", filter);
        };

        ctor.prototype.search = function (criteria) {
            var _this = this;
            if (_.isArray(criteria) === false) {
                criteria = [criteria];
            }

            http.post("/api/search/tasks", criteria)
                .then(function (response) {
                    var results = response.results;
                    _this.results([]);
                    _this.results.push.apply(_this.results, results);
                    _this.shouldShowSearchForm(false);
                }).fail(_this.handleError);
        };

        ctor.prototype.clear = function () {
            var _this = this;
            amplify.store("search/recent", null);


            var emptyFilter = new SearchInput();
            _.each(_.keys(_this.filter), function (key) {
                if (ko.isWriteableObservable(_this.filter[key])) {
                    if (_this.filter[key].isArray) {
                        _this.filter[key]([]);
                    } else {
                        _this.filter[key](emptyFilter[key]());
                    }

                }
            });


        };

        ctor.prototype.saveSearch = function () {
            var _this = this;
            var input = ko.mapping.toJS(_this.filter);

            var item = function () {
                this.viewUrl = "search/search-save-modal";
                this.name = ko.observable().extend({
                    required: true
                });
                this.description = ko.observable();
                this.ok = function () {
                    dialog.close(this, {
                        name: this.name(),
                        description: this.description()
                    });
                };
                this.cancel = function () {
                    dialog.close(this);
                };
            };

            dialog.showBsModal(new item()).then(function (response) {
                if (response) {
                    var command = {
                        name: response.name,
                        description: response.description,
                        searchCriteria: [input]
                    };

                    var url = String.format("/api/search?userId={0}", context.user().id);
                    http.post(url, command)
                        .then(function (res) {

                        }).fail(_this.handleError);
                }
            });
        };

        ctor.prototype.attached = function (view) {
            var _this = this;

            $(view).on("click", "[data-export-type]", function (ev) {
                var exportType = $(ev.currentTarget).data("export-type") || "";
                ko.postbox.publish("ExportDataCommand", {
                    exportType: exportType,
                    data: ko.unwrap(_this.results)
                });
            });
        };

        ctor.prototype.activate = function (params) {
            var _this = this;
            var recent = amplify.store("search/recent");
            if (recent) {

                var keys = _.keys(recent);
                _.each(keys, function (k) {
                    var value = recent[k];
                    if (!ko.isWriteableObservable(_this.filter[k])) {
                        return;
                    }
                    if (!value) {
                        // continue;
                    }
                    else if (_.isArray(value)) {
                        _.each(value, function (v) {
                            if (_.isObject(v)) {
                                _this.filter[k].push(ko.mapping.fromJS(v));
                            } else {
                                _this.filter[k].push(v);
                            }
                        });
                    }
                    else {
                        _this.filter[k](value);
                    }
                });
            }
        };


        return ctor;
    });
