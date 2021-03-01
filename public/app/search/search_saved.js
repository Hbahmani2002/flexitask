define(["common/autocomplete", "common/helpers", "common/context", "amplify", "plugins/dialog", "i18n", "durandal/events", "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (autocomplete, helpers, context, amplify, dialog, i18n, events, errorhandler, system, http, router, app, activator, ko, $, _) {


        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.context = context;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.gridUniqueName = _.uniqueId("grid_");
            this.shouldShowSearchForm = ko.observable(true);
            this.results = ko.observableArray([]);
            this.savedSearches = ko.observableArray([]);
            this.templateSearches = [];
            this.subscriptions = [];
            this.viewFilter = {
                includeArchivedTasks: ko.observable(false)
            };

            this.allSearchTemplates = ko.computed(function () {
                var records = _.sortBy(_this.savedSearches(), function (i) {
                    return ko.unwrap(i.name);
                });
                return this.templateSearches.concat(records);

            }, this);

            this.load = function () {
                var _this = this;
                var url = String.format("/api/search?userId={0}", context.user().id);
                return http.get(url).then(function (response) {
                    _.each(response, function (r) {
                        r.isStarred = ko.observable(r.isStarred);
                        r.name = ko.observable(r.name);
                        r.description = ko.observable(r.description);
                        r.isSelected = ko.observable(false);
                    });
                    _this.savedSearches([]);
                    _this.savedSearches.push.apply(_this.savedSearches, response);
                }).fail(_this.handleError);
            };
        };

        ctor.prototype.runSelectedSavedSearch = function () {
            var _this = this;
            var selectedSearch = _.filter(_this.savedSearches(), function (r) {
                return ko.unwrap(r.isSelected);
            });
            if (selectedSearch.length === 0)
                return;

            // var selectedSearchIds = ko.unwrap(t.selectedSearchIds);
            var allCriteria = _.flatten(_.map(selectedSearch, function (s) {
                return s.criteria;
            }));

            http.post("/api/search/tasks", allCriteria)
                .then(function (response) {
                    var results = response.results;
                    _this.results([]);
                    _this.results.push.apply(_this.results, results);
                    _this.shouldShowSearchForm(false);
                }).fail(_this.handleError);
        };


        ctor.prototype.selectSavedSearch = function (search) {
            search.isSelected(true);
        };

        ctor.prototype.unselectSavedSearch = function (search) {
            search.isSelected(false);
        };


        ctor.prototype.starSearch = function (search) {
            var _this = this;
            var url = "/api/stars";
            http.post(url, {
                objectId: search.id,
                design: "design1",
                type: "search"
            }).then(function (response) {
                search.isStarred(true);


                ko.postbox.publish("UserSettingsChanged", {
                    type: "search",
                    objectId: search.id,
                    name: ko.unwrap(search.name)
                });

            }).fail(_this.handleError);
        };

        ctor.prototype.unstarSearch = function (search) {
            var _this = this;
            var url = String.format("/api/stars?type=search&objectId={0}", search.id);
            http.delete(url).then(function (response) {
                search.isStarred(false);

                ko.postbox.publish("UserSettingsChanged", {
                    type: "search",
                    objectId: search.id
                });
            }).fail(_this.handleError);
        };

        ctor.prototype.deleteSavedSearch = function (item) {
            var _this = this;
            var url = String.format("/api/search/{1}?userId={0}", context.user().id, item.id);
            http.delete(url).then(function (response) {
                _this.savedSearches.remove(item);
            }).fail(_this.handleError);
        };

        ctor.prototype.editSavedSearch = function (item) {
            var _this = this;
            var mvm = {
                viewUrl: "search/search-save-modal",
                id: item.id,
                name: ko.observable(ko.unwrap(item.name)).extend({
                    required: true
                }),
                description: ko.observable(ko.unwrap(item.description)),
                ok: function () {
                    var t = this;

                    if (t.errors().length > 0) {
                        t.errors.showAllMessages();
                        return;
                    }

                    var command = {
                        name: ko.unwrap(t.name),
                        description: ko.unwrap(t.description)
                    };

                    var url = String.format("/api/search/{1}?userId={0}", context.user().id, t.id);
                    http.put(url, command)
                        .then(function (res) {
                            dialog.close(t, {
                                status: 1
                            });
                        }).fail(_this.handleError);
                },
                cancel: function () {
                    dialog.close(this);
                }
            };
            mvm.errors = ko.validation.group(mvm);

            dialog.showBsModal(mvm).then(function (response) {
                if (response && response.status === 1) {
                    item.name(mvm.name());
                    item.description(mvm.description());
                }
            });
        };


        ctor.prototype.useSavedSearch = function (item) {
            var _this = this;
            var criteria = item.criteria || item;
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

        ctor.prototype.createMergedSearchFromSelected = function () {
            var _this = this;
            var selectedSearch = _.filter(_this.savedSearches(), function (r) {
                return ko.unwrap(r.isSelected);
            });
            if (selectedSearch.length === 0)
                return;
            var mvm = {
                viewUrl: "search/create-merged-search-modal",
                name: ko.observable().extend({
                    required: true
                }),
                description: ko.observable(),
                selectedSearch: selectedSearch,
                //  selectedSearchIds: ko.observableArray([]),
                ok: function () {
                    var t = this;

                    if (t.errors().length > 0) {
                        t.errors.showAllMessages();
                        return;
                    }

                    // var selectedSearchIds = ko.unwrap(t.selectedSearchIds);
                    var allCriteria = _.flatten(_.map(selectedSearch, function (s) {
                        return s.criteria;
                    }));

                    var command = {
                        name: ko.unwrap(t.name),
                        description: ko.unwrap(t.description),
                        searchCriteria: allCriteria
                    };

                    var url = "/api/search";
                    http.post(url, command)
                        .then(function (res) {
                            _.each(selectedSearch, function (search) {
                                search.isSelected(false);
                            });
                            dialog.close(t, {
                                res: res,
                                command: command
                            });
                        }).fail(_this.handleError);
                },
                cancel: function () {
                    dialog.close(this);
                },
                attached: function (view) {
                    var $view = $(view);

                    $view.find(".list-group a").click(function (e) {
                        e.stopPropagation();
                        var $this = $(this).find("[type=checkbox]");
                        $this.trigger("click");
                        if ($this.is(":checked")) {
                            $this.prop("checked", false).change();
                        } else {
                            $this.prop("checked", true).change();
                        }

                        return false;
                    });


                }
            };
            mvm.errors = ko.validation.group(mvm);

            dialog.showBsModal(mvm).then(function (response) {
                if (response && response.command) {
                    var command = response.command;
                    _this.savedSearches.push({
                        id: response.res.searchId,
                        isStarred: ko.observable(false),
                        name: ko.observable(command.name),
                        description: ko.observable(command.description),
                        isSelected: ko.observable(false)
                    });
                }
            });
        };


        ctor.prototype.activate = function () {
            var _this = this;
            return _this.load();
        };


        ctor.prototype.subscribeTo = function (name, handler) {
            var _this = this;
            _this.subscriptions.push(ko.postbox.subscribe(name, handler));
        };


        ctor.prototype.deactivate = function (taskId) {
            var _this = this;
            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
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

            _this.subscribeTo("SearchBySavedSearchId", function (params) {
                var search= _.find(_this.savedSearches(),function(s){
                    return ko.unwrap(s.id) === params.id;
                });
                if(search){
                    _this.useSavedSearch(search);
                }
            });
        };




        return ctor;
    });