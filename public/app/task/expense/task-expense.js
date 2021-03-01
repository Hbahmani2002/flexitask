define(["common/autocomplete", "common/lookups", "config", "common/helpers", "common/context", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, lookupFactory, config, helpers, context, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {

        function ExpenseInput(data) {
            data = data || {};
            var self = this;
            this.id = data.id || null;
            this.taskId = ko.observable().extend({
                required: true
            });
            this.projectId = ko.observable();
            this.userId = ko.observable(context.user().id).extend({
                required: true
            });
            this.currencyCode = ko.observable().extend({
                required: true
            });
            this.amount = ko.observable().extend({
                required: true,
                number: true
            });
            this.status = ko.observable().extend({
                required: true
            });
            this.isBillable = ko.observable();
            this.expenseType = ko.observable().extend({
                required: true
            });
            this.date = ko.observable().extend({
                required: true
            });
            this.description = ko.observable();
            this.attachments = ko.observableArray([]);

            this.errors = ko.validation.group(this);

            this.dirtyFlag = new ko.DirtyFlag([self.userId, self.currencyCode, self.amount, self.status, self.isBillable, self.expenseType, self.date, self.description, self.attachments]);
            this.isDirty = function () {
                return self.dirtyFlag().isDirty();
            };
            this.commit = function () {
                self.dirtyFlag().reset();
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
            this.expenses = ko.observableArray([]);
            this.currentView = ko.observable();
            this.showAllFields = ko.observable();
            this.filter = {
                includeSubTasks: ko.observable(false),
                reset: function () {
                    this.includeSubTasks(false);
                }
            };
            this.subscriptions = [];
            this.subscriptions.push(ko.postbox.subscribe("NewExpenseAdded", function (expense) {
                // _this.expenses.push(expense);
                _this.loadEntries();
            }));
            this.filter.includeSubTasks.subscribe(function (v) {
                _this.loadEntries();
            });

            this.isMultiTaskView = ko.pureComputed(function () {
                var g = _.countBy(_this.expenses(), "taskId");
                return Object.keys(g).length > 1 || Object.keys(g)[0] !== _this.taskId;
            });
        };

        ctor.prototype.isTaskView = function () {
            var _this = this;
            return _this.taskId != null && _this.projectId != null;
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId;
            _this.projectId = settings.projectId;

            return _this.loadEntries();
        };

        ctor.prototype.loadEntries = function () {
            var _this = this;
            var url = "";
            var filters = utils.toQueryString(ko.toJS(_this.filter));
            if (_this.taskId) {
                url = String.format("/api/tasks/{0}/expenses?{1}", _this.taskId, filters);
            } else if (_this.projectId) {
                url = String.format("/api/projects/{0}/expenses?{1}", _this.projectId, filters);
            }

            return http.get(url)
                .then(function (response) {
                    _this.expenses([]);
                    var expenses = [];
                    response.forEach(function (expense) {
                        _this.extendModel(expense);
                        expenses.push(expense);
                    });
                    _this.expenses.push.apply(_this.expenses, expenses);
                }).fail(_this.handleError);
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;

            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };


        ctor.prototype.extendModel = function (model) {

            model.isEditMode = ko.observable(false);
            model.isViewMode = ko.computed(function () {
                return model.isEditMode() == false;
            });
            model.isBillable = ko.revertableObservable(model.isBillable);
            model.status = ko.revertableObservable(model.status);

            _.each(model.attachments, function (a) {
                a.downloadUrl = helpers.createPrivateLink(a.downloadUrl, context);
            });

            model.commit = function () {
                model.isBillable.commit();
                model.status.commit();
            };

            model.reset = function () {
                model.isBillable.revert();
                model.status.revert();
            };
        };


        ctor.prototype.edit = function (model) {
            model.isEditMode(true);
        };

        ctor.prototype.update = function (model) {
            var _this = this;
            var data = ko.toJS(model);
            var command = {
                isBillable: data.isBillable,
                status: data.status
            };

            var url = String.format("/api/tasks/{0}/expenses/{1}", data.taskId, data.id);
            http.put(url, command).then(function (res) {
                model.isEditMode(false);
                model.commit();
            }).fail(_this.handleError);
        };

        ctor.prototype.cancelEdit = function (model) {
            var _this = this;
            model.reset();
            model.isEditMode(false);
        };

        ctor.prototype.view = function (model) {
            var _this = this;
            _this.currentView(model);
        };


        ctor.prototype.newExpense = function () {
            var _this = this;
            var createView = {
                context: context,
                autocomplete: autocomplete,
                helpers: helpers,
                model: new ExpenseInput(),
                handleError: _this.handleError,
                lookups: lookupFactory.create(),
                taskId: _this.taskId,
                projectId: _this.projectId,
                viewUrl: "task/expense/task-expense-create-modal",
                parent: _this,
                removeAttachment: function (model, attachment, event) {
                    var t = this;
                    http.delete(ko.unwrap(attachment.deleteUrl)).then(function () {
                        model.attachments.remove(attachment);
                    }).fail(t.handleError);
                },

             
                activate: function () {

                },
                attached: function (view) {
                    var t = this;
                    t.model.taskId.subscribe(function (taskId) {
                        var url = String.format("{0}/api/tasks/{1}/attachments?type=task/expense&token={2}", config.serviceEndpoints.baseEndpoint, ko.unwrap(taskId), context.authToken());
                        $(view).find(".js--file-upload").fileupload({
                            autoUpload: true,
                            uploadTemplateId: null,
                            downloadTemplateId: null,
                            url: url,
                            dataType: "json",
                            done: function (e, data) {
                                var field = ko.dataFor(this);
                                $.each(data.result.files, function (index, file) {
                                    field.attachments.push({
                                        id: file.id,
                                        name: file.name,
                                        downloadUrl: file.url,
                                        deleteUrl: file.deleteUrl
                                    });
                                });
                            },
                            add: function (e, data) {
                                var el = $(this);
                                if (data.autoUpload || (data.autoUpload !== false && el.fileupload("option", "autoUpload"))) {
                                    var p = $(el.data("progress-selector"));
                                    var pb = p.find(".progress-bar");
                                    p.show();
                                    pb.css("width", "0%");
                                    data.process().done(function () {
                                        data.submit();
                                    });
                                }

                            },
                            progressall: function (e, data) {
                                var el = $(this);
                                var progress = parseInt(data.loaded / data.total * 100, 10);
                                var p = $(el.data("progress-selector"));
                                var pb = p.find(".progress-bar");
                                if (progress >= 100) {
                                    progress = 0;
                                    p.hide();
                                }
                                pb.css("width", progress + "%");
                            },
                            fail: function (e, data) {
                                t.handleError(data.jqXHR);
                            }
                        });
                    });

                    if (t.taskId) {
                        t.model.taskId(t.taskId);
                    }


                },
                canDeactivate: function () {
                    var modal = this;
                    if (modal.model.isDirty()) {
                        var defer = $.Deferred();
                        notifications.confirm({
                            title: i18n.t("app:pages.expense.promptunsavedheader"),
                            text: i18n.t("app:pages.expense.promptunsaved"),
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

                cancel: function () {
                    var t = this;
                    dialog.close(t);
                }
            };

            createView.save  = ko.asyncCommand({
                execute: function (callback) {
                    var t = createView;
                    if (t.model.errors().length > 0) {
                        t.model.errors.showAllMessages();
                        callback();
                        return;
                    }

                    var data = ko.toJS(t.model);
                    data.attachments = _.map(data.attachments, function (a) {
                        return a.id;
                    });
                    var url = String.format("/api/tasks/{0}/expenses", data.taskId);
                    http.post(url, data).then(function (res) {
                        t.model.id = res.expenseId;
                        ko.postbox.publish("NewExpenseAdded", t.model);
                        t.model.commit();
                        dialog.close(t);
                    }).fail(t.handleError).always(callback);
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && createView.model.errors().length === 0;
                }
            });

            return dialog.showBsModal(createView);
        };


        return ctor;

    });
