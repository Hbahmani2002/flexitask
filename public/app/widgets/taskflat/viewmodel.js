define(["common/autocomplete", "common/prefs", "common/lookups", "common/utils", "common/helpers", "common/context", "amplify", "durandal/composition", "plugins/dialog", "i18n", "durandal/events", "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (autocomplete, prefs, lookupFactory, utils, helpers, context, amplify, composition, dialog, i18n, events, errorhandler, system, http, router, app, activator, ko, $, _) {




        var ctor = function () {
            var _this = this;
            errorhandler.includeIn(this);
            events.includeIn(this);
            this.prefs = prefs;


            this.taskLookup = {};
            var transform = function (evnt) {
                var task = _this.taskLookup[evnt.taskId];
                if (!task) {
                    return null;
                }
                return task.id;
            };

            this.showLoadingIndicator = ko.observable(true);
            this.showLoadingIndicatorThrottled = this.showLoadingIndicator.throttle(250);
            this.projectId = null;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.utils = utils;
            this.context = context;
            this.lookups = lookupFactory.create();
            this.attachedView = null;
            this.previousSelectedTask = null;
            this.selectedTaskId = ko.observable(); // .subscribeTo("TaskActivated", transform);;
            this.groupType = ko.observable("none");
            this.settings = null;
            this.subscribers = [];
            this.tasks = ko.observableArray([]);

            this.groupedTasks = ko.pureComputed(function () {
                var tasks = _this.filteredTasks();


                var groupBy = function (task) {
                    return ko.unwrap(task.id)
                };
                var groupSortBy = function(task){
                    return ko.unwrap(task.id);
                }
                var itemSortBy = function (task) {
                    return ko.unwrap(task.name);
                };
                var groupSortType = "desc";
                var itemSortType = "asc";

                var groupType = _this.groupType();
                if (groupType === "none") {
                    groupBy = function (task) {
                        return -1;
                    };
                    groupSortBy = function(task){
                        return -1;
                    };
                    itemSortBy = function (task) {
                        return ko.unwrap(task.name);
                    };
                    groupSortType = "asc";
                    itemSortType = "asc";
                } else if (groupType === "status") {
                    groupBy = function (task) {
                        return ko.unwrap(task.status)
                    };
                    groupSortBy = function(task){
                        return ko.unwrap(task.status)
                    };
                    groupSortType = "asc";
                    itemSortBy = function (task) {
                        return ko.unwrap(task.dueDate);
                    };
                    itemSortType = "desc";
                } else if (groupType === "assignee") {
                    groupBy = function (task) {
                        return ko.unwrap(task.assignee)
                    };
                    groupSortBy = function(group){
                        var user = _this.context.getUserById(group.key);
                        if (!user) {
                            return "-";
                        }

                        return user.fullName
                    };
                    groupSortType = "asc";
                    itemSortBy = function (task) {
                        return _this.utils.formatDate(ko.unwrap(task.dueDate));
                    };
                    itemSortType = "desc";
                } else if (groupType === "dueDateAsc") {
                    groupBy = function (task) {
                        return _this.utils.formatDate(ko.unwrap(task.dueDate));
                    };
                    groupSortBy = function(group){
                        return _this.utils.formatDate(group.key);
                    };
                    groupSortType = "asc";
                    itemSortBy = function (task) {
                        return _this.lookups.taskPriority.get(ko.unwrap(task.priority));
                    };
                    itemSortType = "desc";
                } else if (groupType === "dueDateDesc") {
                    groupBy = function (task) {
                        return _this.utils.formatDate(ko.unwrap(task.dueDate));
                    };
                    groupSortBy = function(group){
                        return _this.utils.formatDate(group.key);
                    };
                    groupSortType = "desc";
                    itemSortBy = function (task) {
                        return _this.lookups.taskPriority.get(ko.unwrap(task.priority));
                    };
                    itemSortType = "desc";
                } else if (groupType === "startDateAsc") {
                    groupBy = function (task) {
                        return _this.utils.formatDate(ko.unwrap(task.startDate));
                    };
                    groupSortBy = function(group){
                        return _this.utils.formatDate(group.key);
                    };
                    groupSortType = "asc";
                    itemSortBy = function (task) {
                        return _this.lookups.taskPriority.get(ko.unwrap(task.priority));
                    };
                    itemSortType = "desc";
                } else if (groupType === "startDateDesc") {
                    groupBy = function (task) {
                        return _this.utils.formatDate(ko.unwrap(task.startDate));
                    };
                    groupSortBy = function(group){
                        return _this.utils.formatDate(group.key);
                    };
                    groupSortType = "desc";
                    itemSortBy = function (task) {
                        return _this.lookups.taskPriority.get(ko.unwrap(task.priority));
                    };
                    itemSortType = "desc";
                }


                var groups = _.groupBy(tasks, function (t) {
                    return groupBy(t);
                });


                var collection = _.chain(groups)
                    .keys()
                    .map(function (key) {
                        var items = groups[key];
                        var sortedItems = _.sortBy(items, function (item) {
                            return itemSortBy(item);
                        });
                        if (itemSortType === "desc") {
                            sortedItems = sortedItems.reverse();
                        }
                        return {
                            key: key === "null" ? null : key,
                            type: "date",
                            items: sortedItems
                        };
                    })
                    .sortBy(function (t) {
                        return groupSortBy(t);
                    })
                    .compact()
                    .value()

                if (groupSortType === "desc") {
                    collection = collection.reverse();
                }

                return collection;
            });

            this.filteredTasks = ko.pureComputed(function () {
                var allTasks = ko.unwrap(_this.tasks);

                _this.taskLookup = _.object(_.map(allTasks, function (item) {
                    return [ko.unwrap(item.id), item];
                }));

                var tasks = _.chain(allTasks)
                    .map(function (t) {
                        t.getVm = function () {
                            return _this;
                        };
                        t.isDeleted = t.isDeleted || ko.observable(false);
                        t.childs = t.childs || ko.observableArray([]).trackHasItems();

                        t.visibleState = ko.computed(function () {
                            if (t.isDeleted()) {
                                return false;
                            }
                            var selectedStatusList = ko.unwrap(_this.settings.filter.selectedStatus);

                            if (t.isArchived() && _.contains(selectedStatusList, "archived") === false) {
                                return false;
                            }

                            var selectedTaskType = _this.settings.filter.selectedTaskType();
                            var tType = ko.unwrap(t.taskType);

                            var selectedTaskTypeAsValue = _.map(selectedTaskType, function (x) {
                                return parseInt(x, 10);
                            });


                            var selectedStatusAsValue = _.map(selectedStatusList, function (x) {
                                return parseInt(x, 10);
                            });

                            var taskTypeFilterVisiblityResult = _.contains(selectedTaskTypeAsValue, ko.unwrap(t.taskType))
                            if (taskTypeFilterVisiblityResult === false) {
                                return false;
                            }

                            var tStatusResult = _.contains(selectedStatusAsValue, ko.unwrap(t.status));
                            if (tStatusResult === true && taskTypeFilterVisiblityResult === true) {
                                return true;
                            } else {
                                return false;
                            }



                        }).extend({
                            deferred: true
                        });

                        return t;
                    })
                    .compact()

                    .toArray()
                    .value();
                //     // create lookup
                return tasks;


            }).extend({
                deferred: true
            });
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            this.settings = settings;
            this.projectId = settings.projectId;
            this.customFields = settings.customFields;
            this.viewOptions = settings.viewOptions;
            this.selectedTaskId = settings.selectedTask;
            this.viewOptions.canShowCustomFields = ko.pureComputed(function () {
                return _this.viewOptions.selectedCustomFields().length > 0;
            }, this.viewOptions);


            this.tasks = settings.tasks;


            this.viewOptions.showTags(amplify.store(String.format("projects/{0}/tree/showTags", this.projectId)) || false);
            this.viewOptions.showStartDate(amplify.store(String.format("projects/{0}/tree/showStartDate", this.projectId)) || false);
            this.viewOptions.showCompletionPercentage(amplify.store(String.format("projects/{0}/tree/showCompletionPercentage", this.projectId)) || false);
            this.viewOptions.showOwner(amplify.store(String.format("projects/{0}/tree/showOwner", this.projectId)) || false);
            this.viewOptions.showIsBlocked(amplify.store(String.format("projects/{0}/tree/showIsBlocked", this.projectId)) || false);
            this.viewOptions.selectedCustomFields(amplify.store(String.format("projects/{0}/tree/selectedCustomFields", this.projectId)) || []);

        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
        };

        ctor.prototype.attached = function (view) {
            var _this = this;

            $(view).off("click").on("click", ".task-link", function (event) { // click event
                event.preventDefault();
                var task = ko.dataFor(this);

                ko.postbox.publish("TaskSelected", {
                    taskId: ko.unwrap(task.id),
                    projectId: _this.projectId
                });

                return false;
            });



            // custom fields filter
            $(view).find(".dropdown-menu").on("click", function (e) {
                if ($(this).hasClass("dropdown-menu-form")) {
                    var target = $(e.target);
                    if ($(e.target).prop("type") !== "checkbox") {
                        e.stopPropagation();
                        return;
                    }

                    var $li = target.closest("li");
                    $li.toggleClass("active");

                    e.stopPropagation();
                }
            });


            _this.showLoadingIndicator(false);
        };

        ctor.prototype.createNewTask = function (taskDetails) {
            var _this = this;
            ko.postbox.publish("CreateTaskCommand", {
                projectId: _this.projectId
            });
        };

        ctor.prototype.detached = function (settings) {
            var _this = this;


            $(document).off("click", "[data-action='expand'],[data-action='collapse']");
            _.each(_this.subscribers, function (subscriber) {
                subscriber.dispose();
            });
        };

        ctor.prototype.showTaskAttributes = function (task) {
            var _this = this;
            return ko.unwrap(task.taskType) === _this.lookups.taskType.TASK.value || ko.unwrap(task.taskType) === _this.lookups.taskType.EVENT.value || ko.unwrap(task.taskType) === _this.lookups.taskType.MILESTONE.value;
        };

        ctor.prototype.getTaskTypeInfo = function (task) {
            var _this = this;

            return _this.lookups.taskType.get(ko.unwrap(task.taskType));
        };


        ctor.prototype.getTaskCssClasses = function (task) {
            var _this = this;
            var classes = [];

            var priorityClass = helpers.getTaskPriorityClass(task, _this.lookups);
            classes.push(priorityClass);

            if (_this.isSelectedTask(task)) {
                classes.push("active");
            }



            return classes.join(" ");
        };


        ctor.prototype.getAssigneeName = function (task, property) {
            var u = ko.unwrap(task.assignee) || ko.unwrap(task.coAssignees)[0];

            if (!u) {
                return "-";
            }

            var user = context.getUserById(u);
            if (!user) {
                return "-";
            }

            property = property || "alias";
            return user[property];
        };


        ctor.prototype.getUserName = function (userId, property) {
            var user = context.getUserById(userId);
            if (!user) {
                return "";
            }

            property = property || "alias";
            return user[property];
        };

        ctor.prototype.getUser = function (userId, property) {
            var _this = this;
            var user = context.getUserById(ko.unwrap(userId));
            if (!user) {
                return null;
            }
            return user;
        };

        ctor.prototype.getCustomFieldDefination = function (id) {
            if (!field) {
                return null;
            }
            return field;
        };

        ctor.prototype.isSelectedTask = function (task) {
            var _this = this;
            return _this.selectedTaskId() === ko.unwrap(task.id);
        };

        ctor.prototype.getCustomFieldsDataList = function (task) {
            var _this = this;
            var customFields = ko.unwrap(task.customFields);
            if (!customFields || customFields.length === 0) {
                return null;
            }
            var selectedCustomFields = _this.viewOptions.selectedCustomFields();
            var r = _.chain(customFields)
                .filter(function (cf) {
                    return _.contains(selectedCustomFields, ko.unwrap(cf.id));
                })
                .map(function (cf) {
                    var field = _.find(_this.customFields, function (f) {
                        return f.id === ko.unwrap(cf.id);
                    });
                    if (!field) {
                        return false;
                    }
                    return {
                        title: ko.unwrap(field.title),
                        value: helpers.getFormattedCustomFieldValue(context, field, ko.unwrap(cf.value), _this.lookups)
                    };
                })
                .filter(function (cf) {
                    return cf !== false;
                })
                .value();
            return r;
        };


        return ctor;


    });