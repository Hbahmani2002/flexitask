define(["durandal/events", "common/lookups", "common/utils", "plugins/dialog", "common/errorhandler", "common/helpers", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore", "common/autocomplete", "common/context"],
    function (events, lookupFactory, utils, dialog, errorhandler, helpers, system, http, router, app, activator, ko, $, _, autocomplete, context) {

        var ctor = function () {
            var _this = this;
            this.lookups = lookupFactory.create();
            errorhandler.includeIn(this);

            this.name = ko.observable().extend({
                required: true
            });

            this.customFieldDefinations = ko.observableArray([]);
            this.tags = ko.observableArray([]);
            this.selectedCustomFields = ko.observableArray([]);
            this.helpers = helpers;
            this.autocomplete = autocomplete;
            this.coowners = ko.observableArray([]);
            this.coassignees = ko.observableArray([]);
            this.followers1 = ko.observableArray([]);
            this.followers2 = ko.observableArray([]);
            this.followers3 = ko.observableArray([]);
            this.description = ko.observable();

            this.assigneeUserId = ko.observable();
            this.parentTask = ko.observable();
            this.parentTaskId = ko.observable();
            this.taskType = ko.observable().extend({
                required: true
            });
            this.dueDate = ko.observable(null);
            this.startDate = ko.observable(null);
            this.status = ko.observable();
            this.estimatedDurationDays = ko.observable(null);
            this.estimatedEffordHours = ko.observable(null);
            this.completionPercentage = ko.observable(null);
            this.estimatedBudget = ko.observable(null);
            this.estimatedBudgetCurrencyCode = ko.observable(null);
            this.commentReplyLevel = ko.observable(3);
            this.commentVoteStatus = ko.observable(_this.lookups.commentVoteStatus.ON.value);
            this.commentVoteMode = ko.observable(_this.lookups.commentVoteModes.UpDown.value);
            this.commentDefaultSortingMode = ko.observable(null);
            this.commentViewMode = ko.observable(null);
            this.priority = ko.observable(1);
            this.errors = ko.validation.group(this);
            this.projectId = ko.observable();
            this.context = context;
            this.taskModules = _this.lookups.taskModules.getOnlyNonDefaults();
            this.selectedModules = ko.observableArray(_.map(_.pluck(_this.lookups.taskModules.getDefaultSelecteds(), "value"), function (num) {
                return num.toString();
            }));
            this.tasksForCreateTasksScreen = ko.observableArray();

            this.selectedTaskForOrder = ko.observable();
            this.calculatedOrder = ko.pureComputed(function () {
                var selectedIndexOfAboveTask = _.indexOf(_this.tasksForCreateTasksScreen(), _this.selectedTaskForOrder());
                var taskAboveSelectedTaskIndex = selectedIndexOfAboveTask - 1;
                if (_this.selectedTaskForOrder()) {
                    var selectedTaskOrder = _this.selectedTaskForOrder().order;
                    var taskAboveSelectedTaskOrder = 0;

                    if (selectedIndexOfAboveTask <= 0) {
                        taskAboveSelectedTaskOrder = _this.tasksForCreateTasksScreen()[0].order;
                        var calculatedResult = taskAboveSelectedTaskOrder / 2;
                        return calculatedResult;
                    } else {
                        taskAboveSelectedTaskOrder = _this.tasksForCreateTasksScreen()[taskAboveSelectedTaskIndex].order;
                        var calculatedResult = (selectedTaskOrder + taskAboveSelectedTaskOrder) / 2;
                        return calculatedResult;
                    }


                } else {
                    if (_this.tasksForCreateTasksScreen().length > 0) {
                        var lastItemIndex = _this.tasksForCreateTasksScreen().length - 1;
                        var calculatedOrderAsLastItem = (_this.tasksForCreateTasksScreen()[lastItemIndex]).order + 1000;
                        return calculatedOrderAsLastItem;
                    }
                    return -1;
                }
            });

            this.parentTaskId.subscribe(function (val) {

                if (val) {

                    var subTasksUrl = "/api/tasks/" + val + "/subtasks";
                    return http.get(subTasksUrl).then(function (subTasksData) {
                        var sortedSubTasksData = _.sortBy(subTasksData, function (t) {
                            return t.order;
                        });
                        _this.tasksForCreateTasksScreen(sortedSubTasksData);
                    }).fail(_this.handleError);
                } else {
                    var rootTasksUrl = String.format("/api/projects/{0}/roottasks", _this.projectId());

                    if (!_this.parentTaskId()) {
                        return http.get(rootTasksUrl).then(function (rootTasksData) {

                            var sortedRootTasksData = _.sortBy(rootTasksData, function (t) {
                                return t.order;
                            });
                            _this.tasksForCreateTasksScreen(sortedRootTasksData);
                        }).fail(_this.handleError);
                    }
                }
            });

           


        };

        ctor.prototype.createTask = function () {
            var _this = this;
            if (_this.errors().length > 0) {
                _this.errors.showAllMessages();
                return;
            }

            var url = String.format("/api/projects/{0}/tasks", _this.projectId());
            var command = {
                projectId: _this.projectId(),
                description: _this.description,
                name: _this.name(),
                status: _this.status(),
                taskType: _this.taskType(),
                dueDate: _this.dueDate(),
                assignee: _this.assigneeUserId(),
                coOwners: _this.coowners(),
                coAssignees: _this.coassignees(),
                followers1: _this.followers1(),
                followers2: _this.followers2(),
                followers3: _this.followers3(),
                startDate: _this.startDate(),
                estimatedDurationDays: _this.estimatedDurationDays(),
                estimatedEffordHours: _this.estimatedEffordHours(),
                completionPercentage: _this.completionPercentage(),
                estimatedBudgetAmount: _this.estimatedBudget(),
                estimatedBudgetCurrencyCode: _this.estimatedBudgetCurrencyCode(),
                priority: _this.priority(),
                parentTaskId: _this.parentTaskId(),
                modules: _this.selectedModules(),
                order: _this.calculatedOrder(),
                customFields: _this.selectedCustomFields(),
                tags: _this.tags(),
                moduleOptions: {
                    commentReplyLevel: _this.commentReplyLevel(),
                    commentVoteStatus: _this.commentVoteStatus(),
                    commentVoteMode: _this.commentVoteMode(),
                    commentDefaultSortingMode: _this.commentDefaultSortingMode(),
                    commentViewMode: _this.commentViewMode()
                }
            };
            http.post(url, command).then(function (response) {
                _.extendOwn(command, {
                    id: response.taskId
                });
                var requestId = utils.getRequestIdFromXhr(arguments);
                ko.postbox.publish("NewTaskCreated", {
                    taskData: command,
                    requestId: requestId
                });
                dialog.close(_this);
            }).fail(_this.handleError);
        };

        ctor.prototype.cancel = function () {
            dialog.close(this);
        };


        ctor.prototype.canActivate = function () {

            return true;
        };

        ctor.prototype.attached = function (view) {
            var _this = this;


            ko.postbox.publish("TaskWindowLoaded");
        };

        ctor.prototype.activate = function (parameters) {
            var _this = this;
            _this.projectId(parameters.projectId);
            if (parameters.parentTaskId && ko.unwrap(parameters.parentTaskId)) {
                _this.parentTaskId(ko.utils.unwrapObservable(parameters.parentTaskId));
                _this.parentTask(ko.utils.unwrapObservable(parameters.parentTaskName));
            }

            function getRootTasks() {
                if (!_this.parentTaskId()) {
                    return http.get(String.format("/api/projects/{0}/roottasks", _this.projectId()))
                        .then(function (rootTasksData) {
                            var sortedRootTasksData = _.sortBy(rootTasksData, function (t) {
                                return t.order;
                            });
                            _this.tasksForCreateTasksScreen(sortedRootTasksData);
                        }).fail(_this.handleError);
                }
                return true;
            }

            function getCustomFields() {
                return http.get(String.format("/api/projects/{0}/custom-fields", _this.projectId()))
                    .then(function (customFieldDefinations) {
                        _this.customFieldDefinations(customFieldDefinations);

                        _.each(customFieldDefinations, function (cfd) {
                            if (cfd.addAutomatically) {
                                _this.selectedCustomFields.push(cfd.id);
                            }
                        });

                    }).fail(_this.handleError);
            }

            return $.when(getRootTasks(), getCustomFields());
        };

        ctor.prototype.canDeactivate = function (isClose) {
            return true;
        };

        ctor.prototype.deactivate = function (isClose) {

        };

        return ctor;
    });