define(["common/context", "durandal/system","common/helpers", "common/lookups", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (context,system, helpers, lookupFactory, i18n, dialog, http, composition, notification, app, ko, errorhandler, _, utils) {

        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.context = context;
            this.helpers = helpers;
            this.lookups = lookupFactory.create();
            this.taskId = null;
            this.projectId = null;
            this.projectName = null;
            this.predecessors = ko.observableArray([]);
            this.successors = ko.observableArray([]);
            var filters = {

            };
            this.showSuccessors = ko.observable(false);
            this.showDependedTasksToThisTask = ko.observable(false);
            this.subscriptions = [];
            this.dependedObjects = ko.pureComputed(function () {
                var result = _.filter(_this.predecessors(), function (d) {
                    return d.dependencyType !== _this.lookups.dependencies.RELATION.value;
                });
                return result;
            });

            this.relatedObjects = ko.pureComputed(function () {
                return _.filter(_this.predecessors(), function (d) {
                    return d.dependencyType === _this.lookups.dependencies.RELATION.value;
                });
            });

            this.successorDependedObjects = ko.pureComputed(function () {
                return _.filter(_this.successors(), function (d) {
                    return d.dependencyType !== _this.lookups.dependencies.RELATION.value;
                });
            });

            this.successorRelatedObjects = ko.pureComputed(function () {
                return _.filter(_this.successors(), function (d) {
                    return d.dependencyType === _this.lookups.dependencies.RELATION.value;
                });
            });

            this.showSuccessors.subscribe(function (v) {
                if (v) {
                    return _this.loadSuccessors();
                } else {
                    _this.successors([]);
                }
            });

            this.showDependedTasksToThisTask.subscribe(function (v) {
                if (v) {
                    return _this.loadSuccessors();
                } else {
                    _this.successors([]);
                }
            });


            this.subscriptions.push(ko.postbox.subscribe("EventHappend", function (evDetail) {

            }));
        };



        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId;
            _this.projectId = settings.projectId;
            _this.projectName = settings.projectName;

            return _this.loadRecords();
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };


        ctor.prototype.loadSuccessors = function () {
            var _this = this;
            if (_this.taskId) {
                url = String.format("/api/tasks/{0}/successors", _this.taskId);
            } else {
                url = String.format("/api/projects/{0}/successors", _this.projectId);
            }

            return http.get(url)
                .then(function (response) {
                    _this.successors([]);
                    var successors = [];
                    response.forEach(function (dep) {
                        successors.push(dep);
                    });
                    _this.successors.push.apply(_this.successors, successors);
                }).fail(_this.handleError);
        };

        ctor.prototype.loadRecords = function () {
            var _this = this;
            var url = "";
            var filters = utils.toQueryString(ko.toJS(_this.filter));

            if (_this.taskId) {
                url = String.format("/api/tasks/{0}/predecessors?{1}", _this.taskId, filters);
            } else {
                url = String.format("/api/projects/{0}/predecessors?{1}", _this.projectId, filters);
            }

            return http.get(url)
                .then(function (response) {
                    _this.predecessors([]);
                    var predecessors = [];
                    response.forEach(function (dep) {
                        // createNoteModel(note);
                        predecessors.push(dep);
                    });
                    _this.predecessors.push.apply(_this.predecessors, predecessors);
                }).fail(_this.handleError);
        };

        ctor.prototype.addNewDependency = function () {
            var _this = this;
            system.acquire("task/dependency/task-dependency-edit-create-modal").then(function (modal) {
                var m = new modal(_this.taskId, _this.projectId, null, _this.projectName);
                m.type("dependency");
                dialog.showBsModal(m).then(function (response) {
                    return _this.loadRecords();
                });
            });
        };

        ctor.prototype.editDependency = function (dep) {
            var _this = this;
            system.acquire("task/dependency/task-dependency-edit-create-modal").then(function (modal) {
                var m = new modal(_this.taskId, _this.projectId, dep.dependencyId);
                m.type("dependency");
                dialog.showBsModal(m).then(function (response) {
                    return _this.loadRecords();
                });
            });
        };

        ctor.prototype.addNewRelation = function () {
            var _this = this;
            system.acquire("task/dependency/task-dependency-edit-create-modal").then(function (modal) {
                var m = new modal(_this.taskId, _this.projectId);
                m.type("relation");
                dialog.showBsModal(m).then(function (response) {
                    return _this.loadRecords();
                });
            });
        };

        ctor.prototype.editRelation = function (dep) {
            var _this = this;
            system.acquire("task/dependency/task-dependency-edit-create-modal").then(function (modal) {
                var m = new modal(_this.taskId, _this.projectId, dep.dependencyId);
                m.type("relation");
                dialog.showBsModal(m).then(function (response) {
                    return _this.loadRecords();
                });
            });
        };

        return ctor;

    });
