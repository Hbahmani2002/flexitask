define(["common/autocomplete", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, helpers, context, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utility) {



        function DuplicateTableCommand() {
            var _this = this;
            this.name = ko.observable().extend({ required: true });
            this.description = ko.observable();
            this.targetProjectId = ko.observable();
            this.targetProjectName = ko.observable();
            this.targetTaskId = ko.observable();
            this.targetTaskName = ko.observable();
            this.lock = ko.observable();
            this.copyWithData = ko.observable();
            this.sourceTableId = ko.observable();

            this.errors = ko.validation.group(this);
            this.dirtyFlag = new ko.DirtyFlag([_this.targetProjectId, _this.targetTaskId]);
        }

        var vm = function (taskId, projectId, tableId) {
            var _this = this;
            this.autocomplete = autocomplete;
            this.context = context;
            this.helpers = helpers;
            this.tableId = tableId;
            this.taskId = taskId;
            this.projectId = projectId;
            this.table = null;
            this.command = ko.observable(new DuplicateTableCommand());

            this.projectTypeahead = autocomplete.projectsTypeahead;

            this.isDirty = ko.computed(function () {
                return _this.command().dirtyFlag().isDirty();
            });

            this.getTaskTypeahead = ko.computed(function () {
                var projectId = null;
                var command = _this.command();
                if (command) {
                    projectId = command.targetProjectId();
                }

                return autocomplete.getSelect2OptionsForTasks(projectId || utility.emptyGuid,1);
            });


            this.duplicateTableCommand = ko.asyncCommand({
                execute: function (callback) {

                    if (_this.command().errors().length > 0) {
                        _this.command().errors.showAllMessages();
                        callback();
                        return;
                    }

                    var url = String.format("/api/tables/{1}/duplicate?taskId={0}", _this.taskId, _this.tableId);
                    return http.post(url, ko.toJS(_this.command()))
                        .then(function (response) {
                            _this.command().dirtyFlag().reset();
                            notifications.success(i18n.t("app:pages.table.tableDuplicationSuccessfull"));
                            dialog.close(_this);
                        }).fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.command() !== null && _this.command().targetTaskId();
                }
            });



            errorhandler.includeIn(this);
        };


        vm.prototype.loadTable = function () {
            var _this = this;

            var url = String.format("/api/tables/{1}?taskId={0}", _this.taskId, _this.tableId);
            return http.get(url)
                .then(function (response) {
                    var t = response;
                    var command = new DuplicateTableCommand();

                    command.name(t.name);
                    command.description(t.description);
                    command.sourceTableId(t.tableId);
                    _this.command(command);
                }).fail(_this.handleError);

        };


        vm.prototype.activate = function () {
            var _this = this;

            return _this.loadTable();
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
                }, function (isConfirm) {
                    if (isConfirm) {
                        modal.record.reset();
                        return defer.resolve(true);
                    }

                    return defer.reject(false);
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
