define(["common/autocomplete", "common/prefs", "common/lookups", "common/utils", "common/helpers", "common/context", "amplify", "durandal/composition", "plugins/dialog", "i18n", "durandal/events", "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (autocomplete, prefs, lookupFactory, utils, helpers, context, amplify, composition, dialog, i18n, events, errorhandler, system, http, router, app, activator, ko, $, _) {


        function getDescendants(task) {
            var descendants = [];
            var flatten = function (node) {
                var row;
                row = node;
                _.each(ko.unwrap(node.childs) || [], function (el) {
                    return flatten(el);
                });
                return descendants.push(row);
            };
            flatten(task);
            return descendants;
        }

        function canHideTask(task,selectedTaskTypeAsValue,selectedStatusAsValue){
            var hideByTaskType = _.contains(selectedTaskTypeAsValue, ko.unwrap(task.taskType)) ===false;
            var hideByTaskStatus = _.contains(selectedStatusAsValue, ko.unwrap(task.status)) ===false;

            if (hideByTaskType || hideByTaskStatus) {
                return false;
            } else {
                return true;
            }
        }

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

            this.settings = null;
            this.subscribers = [];
            this.tasks = ko.observableArray([]);




            this.treeOptions = {
                noDragDrop: !ko.unwrap(prefs.dragDropTaskMove),
                validateDrag: function (rootElement, element, parentElement, target) {
                    var parentTaskId = target.attr("id") || null;
                    var taskId = element.attr("id") || false;
                    if (taskId === false) {
                        return false;
                    }

                    var url = String.format("/api/tasks/{0}/move", taskId);
                    return http.put(url, {
                        parentTaskId: parentTaskId
                    }).fail(_this.returnError);
                },
                beforeBinding: function () {
                    _this.showLoadingIndicator(true);
                },
                afterRender: function (tree) {

                    var key = String.format("project/{0}/tree/collapsed", _this.projectId);
                    var collapsedList = amplify.store(key);
                    if (collapsedList) {
                        _.each(collapsedList, function (id) {
                            var li = tree.find("#" + id) || false;
                            if (li) {
                                tree.nestable("collapseItem", li);
                            }
                        });
                    } else {
                        var li = tree.find(".task-item") || false;
                        if (li) {
                            tree.nestable("collapseItem", li);
                        }
                    }

                    _this.showLoadingIndicator(false);
                },
                expandCollapseHandler: function (action, item, ev, tree) {
                    var id = item.attr("id");
                    if (id === false) {
                        return;
                    }


                    var key = String.format("project/{0}/tree/collapsed", _this.projectId);
                    var collapsedList = amplify.store(key) || [];

                    var allItems = tree.find(".task-item") || false;
                    if (allItems && allItems.length > 0 && collapsedList && collapsedList.length <= 0) {
                        _.each(allItems, function (ai) {
                            if (ai.id) {
                                collapsedList.push(ai.id);
                            }
                        });
                    }


                    if (action === "collapse") {
                        collapsedList.push(id);
                    }
                    if (action === "expand") {
                        collapsedList.remove(id);
                    }

                    amplify.store(key, collapsedList);
                    return true;
                }
            };

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


                        t.subTasks = t.subTasks || ko.pureComputed(function () {
                            return _.sortBy(ko.unwrap(this.childs), function (ta) {
                                return ko.unwrap(ta.order);
                            });
                        }, t).extend({
                            deferred: true
                        });


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

                            var allSubTasks = getDescendants(t);
                            var current = _.find(allSubTasks,function(ta){
                                return ko.unwrap(ta.id) === ko.unwrap(t.id);
                            });

                            if(current){
                                ko.utils.arrayRemoveItem(allSubTasks,current);
                            }
                           
                            if(allSubTasks.length === 0) {
                                return canHideTask(t,selectedTaskTypeAsValue,selectedStatusAsValue);
                            }

                            var hideTasks = {};
                            _.each(allSubTasks,function(subTask){
                                if(_.contains(selectedTaskTypeAsValue, ko.unwrap(subTask.taskType)) === false){
                                    hideTasks[ko.unwrap(subTask.id)] = subTask;
                                }

                                if(_.contains(selectedStatusAsValue, ko.unwrap(subTask.status))=== false){
                                    hideTasks[ko.unwrap(subTask.id)] = subTask;
                                }
                            });

                            var allSubTasksCanHide = _.every(allSubTasks,function(subTask){
                                if(_.has(hideTasks,ko.unwrap(subTask.id))){
                                    return true;
                                }
                                return false;
                            });

                            if(allSubTasksCanHide){
                                return canHideTask(t,selectedTaskTypeAsValue,selectedStatusAsValue);
                            }

                            return true;

                        }).extend({
                            deferred: true
                        });

                        return t;
                    })
                    .map(function (t) {
                        var taskId = ko.unwrap(t.id);
                        var parentTaskIds = ko.unwrap(t.parentTaskIds);
                        var parentTaskId = ko.unwrap(t.parentTaskId);
                        var inconsistentSubTasks = _.filter(t.childs(), function (ct) {
                            return _.contains(ct.parentTaskIds(), t.id()) === false;
                        });

                        t.childs.removeAll(inconsistentSubTasks);


                        var hasParents = parentTaskIds && parentTaskIds.length > 0;
                        if (hasParents) {
                            var parentNotFound = parentTaskIds.every(function (parentTaskId) {
                                var parentTask = _this.taskLookup[parentTaskId] || null;
                                if (parentTask) {
                                    var exists = _.find(parentTask.childs(), function (st) {
                                        return ko.unwrap(st.id) === taskId;
                                    });
                                    if (!exists)
                                        parentTask.childs.push(t);
                                }
                                return parentTask === null; // if parent task is null, try to access parent of parent
                            });
                            if (parentNotFound) {
                                return t;
                            }
                            return null;
                        } else {
                            return t;
                        }
                    })
                    .compact()
                    .sortBy(function (t) {
                        return ko.unwrap(t.order);
                    })
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
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
        };

        ctor.prototype.attached = function (view) {
            var _this = this;

            $(view).off("click").on("click", ".task-link,.dd2-content", function (event) { // click event
                event.preventDefault();
                var task = ko.dataFor(this);

                ko.postbox.publish("TaskSelected", {
                    taskId: ko.unwrap(task.id),
                    projectId: _this.projectId
                });

                return false;
            });

            // expand all - collapse all buttons
            $(view).find(".js--expand-all").on("click", function (ev) {
                var key = String.format("project/{0}/tree/collapsed", _this.projectId);
                $(".dd").nestable("expandAll");
                amplify.store(key, null);
            });
            $(view).find(".js--collapse-all").on("click", function (ev) {
                var key = String.format("project/{0}/tree/collapsed", _this.projectId);
                $(".dd").nestable("collapseAll");
                var ids = $(".task-item").collect("id");
                amplify.store(key, ids);
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

            if (!_this.prefs.dragDropTaskMove()) {
                classes.push("noDragClass");
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