define(["common/autocomplete", "common/lookups", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, lookupFactory, helpers, context, i18n, dialog, http, composition, notification, app, ko, errorhandler, _, utility) {


        function DependencyModel() {
            var _this = this;


            this.description = ko.observable("");
            this.dependencyType = ko.observable().extend({ required: true });
            this.dependencyId = ko.observable(false);
            this.taskId = ko.observable();
            this.predecessorProjectId = ko.observable().extend({ required: true });
            this.predecessorProjectName = ko.observable();

            this.predecessorTaskName = ko.observable();
            this.lagDate = ko.observable().extend({ number: true });
            this.successorObjectType = ko.observable("task");
            this.predecessorTaskId = ko.observable().extend({
                required: {
                    onlyIf: function () {
                        return _this.successorObjectType() === "task";
                    }
                }
            });
            this.errors = ko.validation.group(this, { deep: true });
        }


        var modal = function (taskId, projectId, dependencyId, projectName) {
            errorhandler.includeIn(this);
            var _this = this;
            this.autocomplete = autocomplete;
            this.context = context;
            this.helpers = helpers;
            this.dependencyId = dependencyId;
            this.taskId = taskId;
            this.projectId = projectId;
            this.projectName = projectName;
            this.dependency = ko.observable();
            this.mode = ko.observable("");
            this.lookups = lookupFactory.create();
            this.type = ko.observable();

            this.dependencyTypes = function () {
                return _.filter(_this.lookups.dependencies.getAll(), function (i) {
                    return i !== _this.lookups.dependencies.RELATION;
                });
            };

      

            this.createDependencyCommand = ko.asyncCommand({
                execute: function (callback) {
                    if (_this.dependency().errors().length > 0) {
                        _this.dependency().errors.showAllMessages();
                        callback();
                        return;
                    }

                    var data = ko.toJS(_this.dependency());
                    var url = "";
                    if (_this.taskId) {
                        url = String.format("/api/tasks/{0}/dependencies", _this.taskId);
                    } else {
                        url = String.format("/api/projects/{0}/dependencies", _this.projectId);
                    }

                    if (_this.type() === "relation") {
                        data.dependencyType = _this.lookups.dependencies.RELATION.value;
                    }

                    return http.post(url, {
                        taskId: _this.taskId,
                        projectId: _this.projectId,
                        predecessorProjectId: data.predecessorProjectId,
                        predecessorTaskId: data.predecessorTaskId,
                        dependencyType: data.dependencyType,
                        description: data.description,
                        lagDate: data.lagDate
                    })
                        .then(function (response) {
                            // _this.dependency().dirtyFlag().reset();
                            // notification.log(" duplication successfully completed.");
                            dialog.close(_this);
                        }).fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.dependency() && _this.dependency().errors().length === 0;
                }
            });

            this.updateDependencyCommand = ko.asyncCommand({
                execute: function (callback) {
                    if (_this.dependency().errors().length > 0) {
                        _this.dependency().errors.showAllMessages();
                        callback();
                        return;
                    }

                    var data = ko.toJS(_this.dependency());
                    var url = "";
                    if (_this.taskId) {
                        url = String.format("/api/tasks/{0}/dependencies/{1}", _this.taskId, data.dependencyId);
                    } else {
                        url = String.format("/api/projects/{0}/dependencies/{1}", _this.projectId, data.dependencyId);
                    }

                    if (_this.type() === "relation") {
                        data.dependencyType = _this.lookups.dependencies.RELATION.value;
                    }

                    return http.put(url, {
                        taskId: _this.taskId,
                        projectId: _this.projectId,
                        dependencyType: data.dependencyType,
                        description: data.description,
                        lagDate: data.lagDate
                    })
                        .then(function (response) {
                            // _this.dependency().dirtyFlag().reset();
                            // notification.log(" duplication successfully completed.");
                            dialog.close(_this);
                        }).fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.dependency() && _this.dependency().errors().length === 0;
                }
            });

            this.removeDependencyCommand = ko.asyncCommand({
                execute: function (callback) {
                    if (_this.dependency().errors().length > 0) {
                        _this.dependency().errors.showAllMessages();
                        callback();
                        return;
                    }


                    var url = "";
                    var data = ko.toJS(_this.dependency());
                    if (_this.taskId) {
                        url = String.format("/api/tasks/{0}/dependencies/{1}", _this.taskId, data.dependencyId);
                    } else {
                        url = String.format("/api/projects/{0}/dependencies/{1}", _this.projectId, data.dependencyId);
                    }

                    return http.delete(url)
                        .then(function (response) {
                            dialog.close(_this);
                        }).fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.dependency();
                }
            });


        };



        modal.prototype.activate = function () {
            var _this = this;

            if (_this.dependencyId) {
                return _this.loadDependency(_this.dependencyId);
            } else {
                _this.dependency(new DependencyModel());
                _this.dependency().successorObjectType(_this.taskId ? "task" : "project");
                _this.dependency().predecessorProjectId(_this.projectId);
                _this.dependency().predecessorProjectName(_this.projectName);

                if (_this.type() === "relation") {
                    _this.dependency().dependencyType(_this.lookups.dependencies.RELATION.value);
                }
                _this.mode("new");
            }
        };



        modal.prototype.loadDependency = function (dependencyId) {
            var _this = this;

            var url = String.format("/api/dependencies/{0}", dependencyId);
            return http.get(url)
                .then(function (response) {
                    var t = response[0];
                    var dep = new DependencyModel();
                    dep.successorObjectType(_this.taskId ? "task" : "project");
                    dep.dependencyId(t.dependencyId);
                    dep.dependencyType(t.dependencyType);
                    dep.predecessorProjectId(t.project.id);
                    dep.predecessorProjectName(t.project.name);
                    if (t.task) {
                        dep.predecessorTaskId(t.task.id);
                        dep.predecessorTaskName(t.task.name);
                    }
                    dep.description(t.description);
                    dep.lagDate(t.lagDate);
                    _this.dependency(dep);
                    _this.mode("view");
                }).fail(_this.handleError);

        };

        modal.prototype.cancel = function () {
            dialog.close(this);
        };

        modal.prototype.deactivate = function () {
            var _this = this;
        };




        return modal;
    });
