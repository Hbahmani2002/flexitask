define(["common/autocomplete", "common/lookups", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, lookupFactory, helpers, context, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {
        function TimeLogInput(data) {
            data = data || {};
            var _this = this;
            this.id = data.id || null;
            this.taskId = ko.observable().extend({
                required: true
            });
            
            this.projectId = ko.observable();
            this.userId = ko.observable(context.user().id).extend({
                required: true
            });

            this.durationMinutes = ko.observable().extend({
                required: true,
                number: true
            });
            this.status = ko.observable().extend({
                required: true
            });
            this.isBillable = ko.observable();
            this.date = ko.observable().extend({
                required: true
            });
            this.description = ko.observable();
            this.errors = ko.validation.group(this);

            this.dirtyFlag = new ko.DirtyFlag([_this.userId, _this.durationMinutes, _this.status, _this.isBillable, _this.date, _this.description]);
            this.isDirty = function () {
                return _this.dirtyFlag().isDirty();
            };
            this.commit = function () {
                _this.dirtyFlag().reset();
            };
        }


        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.context = context;
            this.utils = utils;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.lookups = lookupFactory.create();
            this.taskId = null;
            this.projectId = null;
            this.timeLogs = ko.observableArray([]);
            this.filter = {
                includeSubTasks: ko.observable(false),
                reset: function () {
                    this.includeSubTasks(false);
                }
            };
            this.subscriptions = [];
            this.subscriptions.push(ko.postbox.subscribe("TimeLogAdded", function (timeLog) {
                _this.loadTimeLogs();
            }));
            this.filter.includeSubTasks.subscribe(function (v) {
                _this.loadTimeLogs();
            });

            this.isMultiTaskView = ko.pureComputed(function () {
                var g = _.countBy(_this.timeLogs(), "taskId");
                return Object.keys(g).length > 1 || Object.keys(g)[0] !== _this.taskId;
            });
        };

        ctor.prototype.isTaskView = function () {
            var _this = this;
            return _this.taskId != null && _this.projectId != null;
        };

        ctor.prototype.humanizeDuration = function (totalMinutes) {
            var _this = this;
            if (totalMinutes) {
                var hour = parseInt(totalMinutes / 60, 10);
                var minutes = totalMinutes - hour * 60;
                if (hour > 0 && minutes <= 0) {
                    return i18n.t("app:pages.timeLogs.duration.hour", {
                        hour: hour
                    });
                } else if (hour > 0 && minutes > 0) {
                    return i18n.t("app:pages.timeLogs.duration.hour_with_minute", {
                        hour: hour,
                        min: minutes
                    });
                } else if (hour == 0 && minutes > 0) {
                    return i18n.t("app:pages.timeLogs.duration.minute", {
                        min: minutes
                    });
                }
            } else {
                return i18n.t("app:pages.timeLogs.duration.empty", {
                    value: totalMinutes
                });
            }
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId;
            _this.projectId = settings.projectId;

            return _this.loadTimeLogs();
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;

            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };

        ctor.prototype.loadTimeLogs = function () {
            var _this = this;
            var filters = utils.toQueryString(ko.toJS(_this.filter));
            var url = "";
            if (_this.taskId) {
                url = String.format("/api/tasks/{0}/timelogs?{1}", _this.taskId, filters);
            } else if (_this.taskId == null && _this.projectId) {
                url = String.format("/api/projects/{0}/timelogs?{1}", _this.projectId, filters);
            }
            return http.get(url)
                .then(function (response) {
                    _this.timeLogs([]);
                    var timeLogs = [];
                    response.data.forEach(function (timeLog) {
                        _this.extendModel(timeLog);
                        timeLogs.push(timeLog);
                    });
                    _this.timeLogs.push.apply(_this.timeLogs, timeLogs);
                }).fail(_this.handleError);
        };

        ctor.prototype.extendModel = function (model) {

            model.isEditMode = ko.observable(false);
            model.isViewMode = ko.computed(function () {
                return model.isEditMode() == false;
            });

            model.isBillable = ko.revertableObservable(model.isBillable);
            model.status = ko.revertableObservable(model.status);

            model.commit = function () {
                model.isBillable.commit();
                model.status.commit();
            };

            model.reset = function () {
                model.isBillable.revert();
                model.status.revert();
            };
        };

        ctor.prototype.newTimeLog = function () {
            var _this = this;

            var createView = {
                autocomplete: autocomplete,
                helpers: helpers,
                context: context,
                lookups: lookupFactory.create(),
                model: new TimeLogInput(),
                handleError: _this.handleError,
                taskId: _this.taskId,
                projectId: _this.projectId,
                viewUrl: "task/timelog/task-timelogs-create-modal",
                parent: _this,
                autoComplete4Task: function () {
                    var modal = this;
                    return autocomplete.getSelect2OptionsForTasks(modal.projectId);
                },
                activate: function () {

                },
                attached: function (view) {
                    var modal = this;
                    if (modal.taskId) {
                        modal.model.taskId(modal.taskId);
                    }
                },
                canDeactivate: function () {
                    var modal = this;
                    if (modal.model.isDirty()) {
                        var defer = $.Deferred();
                        notifications.confirm({
                            title: i18n.t("app:pages.timeLogs.promptunsavedheader"),
                            text: i18n.t("app:pages.timeLogs.promptunsaved"),
                            type: "warning",
                            showCancelButton: true,
                            confirmButtonColor: "#DD6B55",
                            confirmButtonText: "Discard changes",
                            cancelButtonText: "Stay on this page",
                            closeOnConfirm: true,
                            closeOnCancel: true
                        },
                            function (isConfirm) {
                                if (isConfirm) {
                                    // modal.model.reset();
                                    defer.resolve(true);
                                }

                                defer.reject(false);
                            });
                        return defer.promise();
                    }
                    return true;
                },
                deactivate: function (close) {
                    // deactivating
                },
                save: function () {

                },
                cancel: function () {
                    var modal = this;
                    dialog.close(modal);
                }
            };

            createView.save  = ko.asyncCommand({
                execute: function (callback) {
                    var modal = createView;
                    if (modal.model.errors().length > 0) {
                        modal.model.errors.showAllMessages();
                        callback();
                        return;
                    }
                    var data = ko.toJS(modal.model);
                    var hour = Math.floor(data.durationMinutes);
                    var minutes = (data.durationMinutes % 1) * 60;

                    data.durationMinutes = parseInt(hour * 60 + minutes, 10);
                    var url = String.format("/api/tasks/{0}/timelogs", data.taskId);
                    http.post(url, data).then(function (res) {
                        modal.model.id = res.timeLogId;
                        ko.postbox.publish("TimeLogAdded", modal.model);
                        modal.model.commit();
                        dialog.close(modal);
                    }).fail(modal.handleError).always(callback);
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && createView.model.errors().length === 0;
                }
            });

            return dialog.showBsModal(createView);
        };

        ctor.prototype.edit = function (model) {
            model.isEditMode(true);
        };

        ctor.prototype.cancelEdit = function (model) {
            var _this = this;
            model.reset();
            model.isEditMode(false);
        };

        ctor.prototype.update = function (model) {
            var _this = this;
            var data = ko.toJS(model);
            var command = {
                status: data.status,
                isBillable: data.isBillable
            };

            var url = String.format("/api/tasks/{0}/timelogs/{1}", data.taskId, data.id);
            http.put(url, command).then(function (res) {
                model.isEditMode(false);
                model.commit();
            }).fail(_this.handleError);
        };

        return ctor;

    });
