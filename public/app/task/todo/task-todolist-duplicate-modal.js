define(["common/autocomplete", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, helpers, context, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utility) {




        function DuplicateTodoListCommand() {
            var _this = this;

            this.targetProjectId = ko.observable();
            this.targetTaskId = ko.observable();
            this.copyWithItems = ko.observable(true);
            this.sourceListsIds = ko.observableArray([]);

            this.errors = ko.validation.group(this);
            this.dirtyFlag = new ko.DirtyFlag([_this.targetProjectId, _this.targetTaskId, _this.sourceListsIds]);
        }

        var vm = function (taskId, projectId) {
            var _this = this;
            this.autocomplete = autocomplete;
            this.context = context;
            this.helpers = helpers;

            this.taskId = taskId;
            this.projectId = projectId;

            this.command = ko.observable(new DuplicateTodoListCommand());
            this.todoLists = ko.observableArray([]);

      

            this.isDirty = ko.computed(function () {
                return _this.command().dirtyFlag().isDirty();
            });

            this.getTaskTypeahead = ko.computed(function () {
                var projectId = null;
                var command = _this.command();
                if (command) {
                    projectId = command.targetProjectId();
                }
                return  autocomplete.getSelect2OptionsForTasks(projectId || utility.emptyGuid);
            });


            this.duplicateTodoListsCommand = ko.asyncCommand({
                execute: function (callback) {

                    if (_this.command().errors().length > 0) {
                        _this.command().errors.showAllMessages();
                        callback();
                        return;
                    }

                    var data = ko.toJS(_this.command);
                    var deferreds = [];
                    _.each(data.sourceListsIds, function (sourceTodoListId) {
                        var url = String.format("/api/tasks/{0}/todolist?sourceTodoListId={1}", data.targetTaskId, sourceTodoListId);
                        deferreds.push(http.post(url, data)
                            .fail(_this.handleError));
                    });

                    $.when.apply(null, deferreds)
                        .done(function () {
                            _this.command().dirtyFlag().reset();
                            notifications.success(i18n.t("app:pages.todoDuplicate.todoListDuplicationSuccess"));
                            dialog.close(_this);
                        }).always(function () {
                            callback();
                        }).fail(_this.handleError);
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.command() !== null && _this.command().targetTaskId();
                }
            });


            errorhandler.includeIn(this);
        };


        vm.prototype.loadTodoLists = function () {
            var _this = this;

            var url = String.format("/api/tasks/{0}/todolist", _this.taskId);
            return http.get(url)
                .then(function (response) {

                    _.each(response, function (list) {
                        _this.todoLists.push({
                            name: list.name,
                            id: list.id
                        });
                    });

                }).fail(_this.handleError);

        };


        vm.prototype.activate = function () {
            var _this = this;

            return _this.loadTodoLists();
        };


        vm.prototype.canDeactivate = function (force) {
            var _this = this;
            var isDirty = _this.isDirty();
            if (isDirty) {
                var defer = $.Deferred();
                notifications.confirm({
                    title: i18n.t("app:alerts.dirty.title"),
                    text: i18n.t("app:alerts.dirty.text"),
                    type: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#DD6B55",
                    confirmButtonText: i18n.t("app:alerts.dirty.discard"),
                    cancelButtonText: i18n.t("app:alerts.dirty.stay"),
                    closeOnConfirm: true,
                    closeOnCancel: true
                },
                    function (isConfirm) {
                        if (isConfirm) {
                            defer.resolve(true);
                        }
                        defer.reject(false);
                    });
                return defer.promise();
            }
            return true;
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
