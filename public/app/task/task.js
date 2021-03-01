define(["jquery", "common/prefs", "common/notifications", "common/utils", "common/lookups", "common/autocomplete", "moment", "common/helpers", "common/context", "markdown", "amplify", "i18n", "plugins/dialog", "durandal/events", "plugins/router", "durandal/composition", "durandal/activator", "plugins/http", "durandal/app", "durandal/system", "knockout", "common/errorhandler", "underscore"],
    function ($, prefs, notifications, utils, lookupFactory, autocomplete, moment, helpers, context, markdown, amplify, i18n, dialog, events, router, composition, activator, http, app, system, ko, errorhandler, _) {




        var ctor = function (taskId, projectId) {
            errorhandler.includeIn(this);
            var _this = this;

            this.options = {};
            this.context = context;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.lookups = lookupFactory.create();
            this.utils = utils;

            this.runInit = true;
            this.activeModuleVm = activator.create();
            this.activeModule = ko.observable();
            this.taskId = taskId;
            this.projectId = projectId;
            this.details = null;

            this.showTags = ko.observable(false);
            this.editTags = ko.observable(false);
            this.tagList = ko.observableArray([]);
           
            this.descriptionSectionVisibility = ko.observable(true);
            this.descriptionEditStatus = ko.observable(false);
            this.showDescription = ko.observable(false);
            this.customFields = null;
            this.showCustomFields = ko.observable(false);
            this.editingCustomField = ko.observable();
            this.descriptionSectionVisibility.subscribe(function (newValue) {
                amplify.store("options/descriptionSectionVisibility", newValue);
            });

            this.editTags.subscribe(function (v) {
                if (!v) {
                    _this.details.tags.revert();
                }
            });


            this.activeModules = ko.pureComputed(function () {
                if (!_this.details) {
                    return [{
                        detail: _this.lookups.taskModules.DETAIL,
                        isEnabled: true,
                        isActive: ko.pureComputed(function () {
                            return _this.activeModule() === _this.lookups.taskModules.DETAIL;
                        })
                    }];
                }

                var activeModules = ko.unwrap(_this.details.activeModules.cached);
                return _.chain(_this.lookups.taskModules.getAll())
                    .filter(function (module) {
                        return _.contains(activeModules, module.value) || module.defaultActive;
                    })
                    .sortBy(function (module) {
                        return module.order;
                    })
                    .map(function (module) {
                        return {
                            detail: module,
                            isEnabled: true,
                            isActive: ko.pureComputed(function () {
                                return _this.activeModule() === module;
                            }),
                            execute: function () {
                                var m = this;
                                var module = m.detail;
                                _this.activateModule(module, true);
                            }
                        };
                    })
                    .value();
            }, this, {
                deferEvaluation: true
            }).extend({
                deferred: true
            });





            this.saveCustomFieldCommand = ko.asyncCommand({
                execute: function (callback) {
                    var customField = _this.editingCustomField();
                    if (!customField) {
                        callback();
                        return;
                    }

                    if (!customField.value.isValid()) {
                        callback();
                        return;
                    }

                    var url = String.format("/api/tasks/{0}/custom-fields/{1}", _this.taskId, ko.unwrap(customField.id));
                    var command = {
                        value: customField.value()
                    };
                    return http.put(url, command)
                        .then(function () {
                            customField.value.commit();
                            _this.editingCustomField(null);

                            var requestId = utils.getRequestIdFromXhr(arguments);
                            ko.postbox.publish("TaskCustomFieldUpdated", {
                                taskId: _this.taskId,
                                id: ko.unwrap(customField.id),
                                value: command.value,
                                requestId: requestId
                            });
                        })
                        .fail(_this.handleError)
                        .always(callback);
                },
                canExecute: function (isExecuting) {
                    var customField = _this.editingCustomField();
                    return !isExecuting && customField && customField.value.isValid();
                }
            });

            this.showActionDivider = ko.pureComputed(function () {
                return !_this.showDescription() || !_this.showTags() || !_this.showCustomFields();
            }).extend({
                throttle: 500
            }).extend({
                deferred: true
            });


            this.isCompleted = ko.pureComputed(function () {
                if (!_this.details) {
                    return false;
                }
                return _this.details.status.value() === 32;

            }, null, {
                deferEvaluation: true
            }).extend({
                deferred: true
            });



            this.selectableModuleList = ko.pureComputed(function () {
                return _.filter(_this.lookups.taskModules.getAll(), function (f) {
                    return typeof f.isModule === "undefined" || f.isModule === null || f.isModule;
                });
            });
        };



        ctor.prototype.activateModule = function (selectedModule, deactivatePrevious, firstLoad) {
            var _this = this;
            var defer = $.Deferred();


            function loadModule(moduleVmName, module) {
                var dfd = $.Deferred();

                if (module.fakeModule) {
                    if (deactivatePrevious) {
                        _this.activeModuleVm.deactivate(true).then(function (v) {
                            if (!v) {
                                dfd.reject();
                                return;
                            }
                            _this.activeModuleVm(null);
                            dfd.resolve(true);
                        });
                    } else {
                        dfd.resolve(true);
                    }

                    return dfd.promise();
                } else {
                    system.acquire(moduleVmName)
                        .then(function (m) {
                            if (deactivatePrevious) {
                                _this.activeModuleVm.deactivate(true).then(function (v) {
                                    if (!v) {
                                        dfd.reject();
                                        return;
                                    }
                                    _this.activeModuleVm(null);
                                    dfd.resolve(m);
                                });
                            } else {
                                dfd.resolve(m);
                            }

                        });
                    return dfd.promise();
                }
            }

            if (selectedModule === _this.lookups.taskModules.DETAIL) {
                defer = loadModule("task-details", selectedModule);
            } else if (selectedModule === _this.lookups.taskModules.ACCESS_LIST) {
                defer = loadModule("task/access-list/task-access-list", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.COMMENTS) {
                defer = loadModule("task/comment/task-comments", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId,
                        options: _this.details.options,
                        allowedCommentReplyLevel: ko.unwrap(_this.details.moduleOptions.commentReplyLevel.cached),
                        voteStatus: _this.lookups.commentVoteStatus.get(_this.details.moduleOptions.commentVoteStatus.cached),
                        votingMode: _this.lookups.commentVoteModes.get(_this.details.moduleOptions.commentVoteMode.cached),
                        defaultSorting: _this.lookups.commentSortModes.get(_this.details.moduleOptions.commentSortMode.cached),
                        viewMode: _this.lookups.commentViewModes.get(_this.details.moduleOptions.commentViewMode.cached)
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.ATTACHMENTS) {
                defer = loadModule("task/attachment/task-attachments", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId,
                        attachmentId: _this.options.attachmentId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.TODOS) {
                defer = loadModule("task/todo/task-todos", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.NOTES) {
                defer = loadModule("task/note/task-notes", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.TIMELOGS) {
                defer = loadModule("task/timelog/task-timelogs", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.TABLES) {
                defer = loadModule("task/table/task-tables", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.EXPENSE_TRACKING) {
                defer = loadModule("task/expense/task-expense", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.HISTORY) {
                defer = loadModule("task/history/task-history", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.SUB_TASKS) {
                defer = loadModule("task/sub-tasks/sub-tasks", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId,
                        projectName: _this.details.projectName
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.LINKED_TASKS) {
                defer = loadModule("task/dependency/task-dependencies", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId,
                        projectName: _this.details.projectName
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.GANTT_CHART) {
                defer = loadModule("task/gantt/task-gantt", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId,
                        projectName: ko.unwrap(_this.details.projectName)
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.CALENDAR) {
                defer = loadModule("task/calendar/task-calendar", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            } else if (selectedModule === _this.lookups.taskModules.TASK_REPORT) {
                defer = loadModule("task/report/task-report-module", selectedModule).then(function (module) {
                    var o = system.resolveObject(module);
                    var settings = {
                        taskId: _this.taskId,
                        projectId: _this.projectId
                    };
                    return _this.activeModuleVm.activateItem(o, settings);
                });
            }

            defer.then(function () {
                amplify.store("LastActiveTaskModule", selectedModule.value);
                _this.activeModule(selectedModule);
                var activeRoute = router.activeInstruction();
                if (!activeRoute) {
                    return false;
                }
                if (activeRoute.config.moduleId === "project/project") {
                    var hash = String.format("#projects/{0}/tasks/{1}?m={2}", _this.projectId, _this.taskId, selectedModule.queryStringValue);
                    var taskIdParameter = activeRoute.params[1];
                    if (firstLoad) {
                        router.navigate(hash, false);
                    } else {
                        router.navigate(hash, {
                            replace: true,
                            trigger: false
                        });
                    }



                }

            });

            if (defer && defer.resolve) {
                defer.resolve(true);
            }
        };


        ctor.prototype.addDescriptionField = function () {
            var _this = this;
            _this.showDescription(true);
            _this.descriptionEditStatus(true);
        };


        ctor.prototype.onDescriptionCancel = function (editor, api) {
            var _this = this;
           
        };

        ctor.prototype.onDescriptionSave = function (editor, api) {

            var content = editor.getContent();
            var _this = this;
            if (!editor.isDirty() && !(content.length === 0)) {
                api.dispose();
                return;
            }

            var url = String.format("/api/tasks/{0}/description", _this.taskId);
            return http.put(url, {
                description: content
            }).then(function () {
                _this.details.description(content);
              
                api.dispose();
            }).fail(_this.handleError);
        };


        ctor.prototype.saveTags = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/tags", _this.taskId);
            var command = {
                tags: _this.details.tags()
            };
            http.put(url, command)
                .then(function (response) {
                    _this.details.tags.commit();
                    _this.editTags(false);

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.tags,
                        requestId: requestId,
                        property: "tags"
                    });
                })
                .fail(_this.handleError);
        };

        ctor.prototype.editCustomField = function (customField, ev) {
            var _this = this;
            _this.editingCustomField(customField);
        };
        ctor.prototype.resetCustomFieldForm = function () {
            var _this = this;
            var customField = _this.editingCustomField();
            if (!customField) {
                return;
            }

            customField.value.revert();
            _this.editingCustomField(null);
        };


        ctor.prototype.deleteCustomField = function () {
            var _this = this;
            var customField = _this.editingCustomField();
            if (!customField) {
                return;
            }

            notifications.confirm({
                title: i18n.t("app:pages.task.promptDeleteCustomFieldHeader"),
                text: i18n.t("app:pages.task.promptDeleteCustomFieldContent"),
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: i18n.t("app:alerts.delete.confirm"),
                cancelButtonText: i18n.t("app:alerts.delete.cancel"),
                closeOnConfirm: true,
                closeOnCancel: true
            }, function (isConfirm) {
                if (isConfirm) {
                    var url = String.format("/api/tasks/{0}/custom-fields/{1}", _this.taskId, ko.unwrap(customField.id));
                    http.delete(url).then(function (response) {
                        _this.details.customFields.remove(customField);
                        _this.editingCustomField(null);
                        var requestId = utils.getRequestIdFromXhr(arguments);
                        ko.postbox.publish("TaskCustomFieldUpdated", {
                            taskId: _this.taskId,
                            id: ko.unwrap(customField.id),
                            requestId: requestId
                        });
                    }).fail(_this.handleError);
                }
            });


        };


        ctor.prototype.getCustomFieldDetails = function (id) {
            var _this = this;
            if (!_this.customFields) {
                return null;
            }

            var f = _.find(_this.customFields, function (field) {
                return field.id === ko.unwrap(id);
            });

            return f;
        };
        ctor.prototype.addNewCustomField = function (field) {
            var _this = this;
            var url = String.format("/api/tasks/{0}/custom-fields", _this.taskId);
            http.post(url, {
                id: field.id
            }).then(function (response) {
                var f = {
                    id: field.id,
                    value: ko.revertableObservable(),
                    detail: field,
                    type: _this.lookups.customFieldTypes.get(field.type)
                };
                ko.validatedObservable(f);
                _this.details.customFields.push(f);
            }).fail(_this.handleError);
        };

        ctor.prototype.canShowThisFieldForAddNew = function (field) {
            var _this = this;
            var f = _.find(ko.unwrap(_this.details.customFields), function (cf) {
                return ko.unwrap(cf.id) === field.id;
            }) || false;
            return f === false;
        };

        ctor.prototype.canAddNewField = function () {
            var _this = this;
            return _this.details.customFields().length !== _this.customFields.length;
        };

        ctor.prototype.setDropdownItem = function (dropdownItem, customField) {
            var _this = this;
            customField.value(dropdownItem);
        };


        ctor.prototype.onTaskModuleScroll = function (ev, el, scrollTop) {
            var _this = this;
            var api = $("#task-header-panel").data("panel-api");

            if (scrollTop > 300) {
                api.hideContent();
            } else if (scrollTop <= 0) {
                // api.showContent();
            }

        };

        ctor.prototype.navigateToTask = function (task) {
            var _this = this;
            var hash = String.format("#projects/{0}/tasks/{1}", ko.unwrap(task.projectId), ko.unwrap(task.id));
            router.navigate(hash, true);


        };

        ctor.prototype.getStatusText = function (status) {
            var _this = this;
            var statusValue = ko.utils.unwrapObservable(status.value);
            var s = _.find(_this.lookups.taskStatus.getAll(), function (item) {
                return item.value === statusValue;
            });
            if (s) {
                return s.text;
            } else {
                return "";
            }
        };


        ctor.prototype.getUserFullName = function (userId, property) {
            var _this = this;
            var user = context.getUserById(ko.unwrap(userId));
            if (!user) {
                return "";
            }

            property = property || "fullName";
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


        ctor.prototype.starTask = function (params) {
            var _this = this;
            var id = _this.taskId;
            var url = String.format("/api/stars");
            http.post(url, {
                objectId: id,
                type: "task"
            }).then(function (response) {
                _this.details.isStarred(true);
                ko.postbox.publish("UserSettingsChanged", {
                    type: "task",
                    objectId: id,
                    name: _this.details.name(),
                    projectId: _this.projectId
                });
            }).fail(_this.handleError);
        };

        ctor.prototype.unstarTask = function (params) {
            var _this = this;
            var id = _this.taskId;
            var url = String.format("/api/stars?type=task&objectId={0}", id);
            http.delete(url).then(function (response) {
                _this.details.isStarred(false);
                ko.postbox.publish("UserSettingsChanged", {
                    type: "task",
                    objectId: id
                });
            }).fail(_this.handleError);
        };

        ctor.prototype.saveReportingOptions = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/options/reporting", _this.taskId);
            var command = ko.toJS(_this.details.reportingOptions);
            http.put(url, command)
                .then(function () {

                })
                .fail(_this.handleError);
        };

        ctor.prototype.getTaskAutocomplete = function () {
            var _this = this;
            return autocomplete.getSelect2OptionsForTasks(_this.projectId,1)
        };



        ctor.prototype.loadTask = function (taskId) {
            var _this = this;


            return http.get("/api/tasks/" + taskId).then(function (taskData) {
                var url = String.format("/api/projects/{0}/custom-fields", taskData.projectId);
                return http.get(url).then(function (customFieldData) {
                    _this.customFields = customFieldData;
                }).always(function () {
                    // mapping settings

                    function extendTask(task) {
                        task.assignee = ko.revertableObservable(task.assignee);
                        task.owner = ko.revertableObservable(task.owner);
                        task.coAssignees = ko.revertableObservableArray(task.coAssignees);
                        task.coOwners = ko.revertableObservableArray(task.coOwners);
                        task.category1Followers = ko.revertableObservableArray(task.category1Followers);
                        task.category2Followers = ko.revertableObservableArray(task.category2Followers);
                        task.category3Followers = ko.revertableObservableArray(task.category3Followers);

                        task.description = ko.observable(task.description || "");
                        task.status = ko.revertableObservable(task.status);
                        task.priority = ko.revertableObservable(task.priority);
                        task.taskType = ko.revertableObservable(task.taskType);
                        task.dueDate = ko.revertableObservable(task.dueDate);
                        task.startDate = ko.revertableObservable(task.startDate);
                        task.name = ko.revertableObservable(task.name);
                        task.name2 = ko.observable(task.name());
                        task.estimatedDurationDays = ko.revertableObservable(task.estimatedDurationDays);
                        task.completionPercentage = ko.revertableObservable(task.completionPercentage);
                        task.estimatedEffordHours = ko.revertableObservable(task.estimatedEffordHours);
                        task.estimatedBudget = ko.revertableObservable(task.estimatedBudget);
                        task.tags = ko.revertableObservableArray(task.tags);
                        task.estimatedBudgetCurrencyCode = ko.revertableObservable(task.estimatedBudgetCurrencyCode);
                        task.moduleOptions.commentReplyLevel = ko.revertableObservable(task.moduleOptions.commentReplyLevel);
                        task.moduleOptions.commentVoteStatus = ko.revertableObservable(task.moduleOptions.commentVoteStatus);
                        task.moduleOptions.commentVoteMode = ko.revertableObservable(task.moduleOptions.commentVoteMode);
                        task.moduleOptions.commentSortMode = ko.revertableObservable(task.moduleOptions.commentSortMode);
                        task.moduleOptions.commentViewMode = ko.revertableObservable(task.moduleOptions.commentViewMode);
                        task.parentTaskId = ko.revertableObservable(task.parentTaskId);
                        task.parentTaskName = ko.revertableObservable(task.parentTask ? task.parentTask.name : null);
                        task.activeModules = ko.revertableObservableArray(task.activeModules);

                        task.dueDateText = ko.pureComputed(function () {
                            var d = ko.unwrap(task.dueDate.cached);
                            return d ? utils.formatDateTime(d, prefs.dateTimeFormat()) : "";
                        }, task);
                        task.startDateText = ko.pureComputed(function () {
                            var d = ko.unwrap(task.startDate.cached);
                            return d ? utils.formatDateTime(d, prefs.dateTimeFormat()) : "";
                        }, task);


                        task.constraints = task.constraints || {};
                        task.constraints = {
                            deadline: ko.revertableObservable(task.constraints.deadline),
                            constraintDate: ko.revertableObservable(task.constraints.constraintDate),
                            constraintType: ko.revertableObservable(task.constraints.constraintType)
                        };
                        task.reportingOptions = task.reportingOptions || {};
                        task.reportingOptions = {
                            doNotIncludeToGanttChart: ko.observable(task.reportingOptions.doNotIncludeToGanttChart).publishOn("taskReportingOptionsChanged"),
                            doNotIncludeToCalendar: ko.observable(task.reportingOptions.doNotIncludeToCalendar).publishOn("taskReportingOptionsChanged")
                        };
                        task.customFields = ko.observableArray(_.filter(_.map(task.customFields, function (cf) {
                            var detail = _this.getCustomFieldDetails(cf.id);
                            if (!detail) {
                                return null;
                            }
                            cf.detail = detail;
                            cf.type = _this.lookups.customFieldTypes.get(cf.detail.type);
                            cf.value = ko.revertableObservable(cf.value);
                            ko.validatedObservable(cf);
                            return cf;
                        }), function (cf) {
                            return cf && cf.type;
                        }));
                        task.isArchived = ko.observable(task.isArchived);
                        task.isStarred = ko.observable(task.isStarred);
                        task.isBlocked = ko.observable(task.isBlocked);
                        task.category = ko.observable(task.category);
                        task.order = ko.observable(task.order);

                        task.taskSubscriptionType = ko.observable(task.taskSubscriptionType);
                        task.audit = {
                            createdBy: context.getUserById(task.audit.createdBy),
                            createdAt: task.audit.createdAt,
                            updatedBy: context.getUserById(task.audit.updatedBy),
                            updatedAt: task.audit.updatedAt
                        };
                    }

                    extendTask(taskData);
                    _this.details = taskData;

                    _this.taskId = taskData.id;
                    var taskProjectId = ko.unwrap(_this.details.projectId);
                    if (!_this.projectId || _this.projectId !== taskProjectId) {
                        _this.projectId = taskProjectId;
                    }
                    if (_this.details.tags().length > 0) {
                        _this.showTags(true);
                    }

                    if (_this.details.description().length > 0) {
                        _this.showDescription(true);
                    }

                    if (_this.details.customFields().length > 0) {
                        _this.showCustomFields(true);
                    }

                });


            }).fail(_this.handleError).fail(function () {
                return false;
            });
        };

        ctor.prototype.isConstraintDateVisible = function (selectedValue) {
            var _this = this;
            var selectedConsType = _this.lookups.taskConstraintTypes.get(ko.unwrap(selectedValue));
            if (!selectedConsType) {
                return false;
            }

            return selectedConsType === _this.lookups.taskConstraintTypes.FinishNoEarlierThan ||
                selectedConsType === _this.lookups.taskConstraintTypes.FinishNoLaterThan ||
                selectedConsType === _this.lookups.taskConstraintTypes.StartNoEarlierThan ||
                selectedConsType === _this.lookups.taskConstraintTypes.StartNoLaterThan ||
                selectedConsType === _this.lookups.taskConstraintTypes.MustStartOn ||
                selectedConsType === _this.lookups.taskConstraintTypes.MustFinishOn;
        };

        ctor.prototype.changeTaskSubscription = function (params) {
            var _this = this;
            var id = _this.taskId;
            var url = String.format("/api/tasks/{0}/subscription", id);
            return http.put(url, {
                taskSubscriptionType: params.value,
                includeSubTasks: params.includeSubTasks
            }).then(function () {
                _this.details.taskSubscriptionType.value(params.value);
            });
        };

        ctor.prototype.changeTaskModuleOptions = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/options/module", _this.taskId);
            var command = {
                options: {
                    commentVoteStatus: _this.details.moduleOptions.commentVoteStatus(),
                    commentReplyLevel: _this.details.moduleOptions.commentReplyLevel(),
                    commentVoteMode: _this.details.moduleOptions.commentVoteMode(),
                    commentSortMode: _this.details.moduleOptions.commentSortMode(),
                    commentViewMode: _this.details.moduleOptions.commentViewMode()
                }
            };
            http.put(url, command).then(function () {
                _this.details.moduleOptions.commentVoteStatus.commit();
                _this.details.moduleOptions.commentReplyLevel.commit();
                _this.details.moduleOptions.commentVoteMode.commit();
                _this.details.moduleOptions.commentSortMode.commit();
                _this.details.moduleOptions.commentViewMode.commit();
            }).fail(_this.handleError);
        };

        ctor.prototype.changeTaskCategory = function (params) {
            var _this = this;
            var id = _this.taskId;
            var url = String.format("/api/tasks/{0}/category", id);
            return http.put(url, {
                category: params.value
            }).then(function (response) {
                _this.details.category(params.value);
                ko.postbox.publish("UserSettingsChanged", response);
            });
        };





        ctor.prototype.saveStatusCommand = function (selectedStatus, ev) {
            var _this = this;

            var url = String.format("/api/tasks/{0}/status", _this.taskId);
            var command = {
                status: selectedStatus.value
            };


            return http.put(url, command)
                .then(function (response) {
                    _this.details.status(command.status);
                    _this.details.status.commit();


                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.status,
                        requestId: requestId,
                        property: "status"
                    });
                })
                .fail(_this.handleError);
        };



        ctor.prototype.getTextOrEmptyText = function (type) {
            var _this = this;
            var v = null;
            if (type === "status") {
                return _this.lookups.taskStatus.get(_this.details.status.cached).text;
            } else if (type === "priority") {
                v = _this.lookups.taskPriority.get(_this.details.priority.cached) || false;
                if (!v) {
                    return "Empty";
                }
                return v.text;
            } else if (type === "tasktype") {
                return _this.lookups.taskType.get(_this.details.taskType.cached).text;
            } else if (type === "taskmodules") {
                return "";
            } else if (type === "commentvoting") {
                return _this.lookups.commentVoteStatus.get(_this.details.moduleOptions.commentVoteStatus.cached).text;
            } else if (type === "commentvotemode") {
                return _this.lookups.commentVoteModes.get(_this.details.moduleOptions.commentVoteMode.cached).text;
            } else if (type === "commentsortmodes") {
                return _this.lookups.commentSortModes.get(_this.details.moduleOptions.commentSortMode.cached).text;
            } else if (type === "commentviewmode") {
                return _this.lookups.commentViewModes.get(_this.details.moduleOptions.commentViewMode.cached).text;
            } else if (type === "estimateddurationdays") {
                return ko.unwrap(_this.details.estimatedDurationDays.cached) || "";
            } else if (type === "completionpercentage") {
                return ko.unwrap(_this.details.completionPercentage.cached) || "";
            } else if (type === "estimatedefford") {
                return ko.unwrap(_this.details.estimatedEffordHours.cached) || "";
            } else if (type === "estimatedbudget") {
                return (ko.unwrap(_this.details.estimatedBudget.cached) + ko.unwrap(_this.details.estimatedBudgetCurrencyCode.cached)) || "";
            } else if (type === "parenttask") {
                v = ko.unwrap(_this.details.parentTaskId);
                if (!v) {
                    return "";
                }

                return ko.unwrap(_this.details.parentTaskName.cached);
            } else if (type === "duedate") {
                v = ko.unwrap(_this.details.dueDate.cached);
                if (!v) {
                    return "";
                }

                return utils.formatDateTime(v);
            } else if (type === "startdate") {
                v = ko.unwrap(_this.details.startDate.cached);
                if (!v) {
                    return "";
                }

                return utils.formatDateTime(v);
            }
        };

        ctor.prototype.changeParentTask = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/move", _this.taskId);
            var oldParentTaskId = _this.details.parentTaskId.cached();
            var command = {
                parentTaskId: _this.details.parentTaskId()  ? _this.details.parentTaskId() : null
            };
            http.put(url, command).then(function () {
                    _this.details.parentTaskId.commit();
                    _this.details.parentTaskName.commit();

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskMoved", {
                        taskId: _this.taskId,
                        parentTaskId: command.parentTaskId,
                        oldParentTaskId: oldParentTaskId,
                        requestId: requestId
                    });

                    // todo : remove for eventual consistency client
                    return _this.loadTask(_this.taskId);
                })
                .fail(_this.handleError);
        };

        ctor.prototype.changeTaskStatus = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/status", _this.taskId);
            var command = {
                status: _this.details.status()
            };
            http.put(url, command)
                .then(function () {
                    _this.details.status.commit();

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.status,
                        requestId: requestId,
                        property: "status"
                    });
                })
                .fail(_this.handleError);
        };

        ctor.prototype.changeTaskType = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/type", _this.taskId);
            var command = {
                taskType: _this.details.taskType()
            };
            http.put(url, command)
                .then(function () {
                    _this.details.taskType.commit();

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.taskType,
                        requestId: requestId,
                        property: "taskType"
                    });
                })
                .fail(_this.handleError);
        };

        ctor.prototype.changeTaskPriority = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/priority", _this.taskId);
            var command = {
                priority: _this.details.priority()
            };
            http.put(url, command)
                .then(function () {
                    _this.details.priority.commit();

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.priority,
                        requestId: requestId,
                        property: "priority"
                    });
                })
                .fail(_this.handleError);
        };

        ctor.prototype.changeTaskEstimations = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/estimations", _this.taskId);
            var currencyCode = _this.details.estimatedBudgetCurrencyCode();

            var command = {
                effordHours: _this.details.estimatedEffordHours(),
                currencyCode: currencyCode,
                budgetAmount: _this.details.estimatedBudget(),
                durationDays: _this.details.estimatedDurationDays()
            };
            http.put(url, command).then(function () {
                    _this.details.estimatedEffordHours.commit();
                    _this.details.estimatedBudgetCurrencyCode.commit();
                    _this.details.estimatedBudget.commit();
                    _this.details.estimatedEffordHours.commit();
                })
                .fail(_this.handleError);
        };

        ctor.prototype.reschedule = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/schedule", _this.taskId);
            var command = {
                dueDate: _this.details.dueDate(),
                startDate: _this.details.startDate()
            };
            http.put(url, command)
                .then(function () {
                    _this.details.dueDate.commit();
                    _this.details.startDate.commit();


                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.duedate,
                        requestId: requestId,
                        property: "dueDate"
                    });
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.startDate,
                        requestId: requestId,
                        property: "startDate"
                    });
                })
                .fail(_this.handleError);
        };



        ctor.prototype.changeTaskName = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/name", _this.taskId);
            var command = {
                name: _this.details.name2()
            };
            http.put(url, command).then(function () {
                    _this.details.name(command.name);
                    _this.details.name.commit();

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.name,
                        requestId: requestId,
                        property: "name"
                    });
                })
                .fail(_this.handleError);
        };




        ctor.prototype.changeCompletionPercentage = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/completion-percentage", _this.taskId);
            var command = {
                completionPercentage: _this.details.completionPercentage()
            };
            http.put(url, command).then(function () {
                    _this.details.completionPercentage.commit();

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.completionPercentage,
                        requestId: requestId,
                        property: "completionPercentage"
                    });
                })
                .fail(_this.handleError);
        };

        ctor.prototype.clearCompletionPercentage = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/completion-percentage", _this.taskId);
            var command = {
                completionPercentage: null
            };
            http.put(url, command).then(function () {
                    _this.details.completionPercentage(null);
                    _this.details.completionPercentage.commit();
                })
                .fail(_this.handleError);
        };


        ctor.prototype.changeTaskModules = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/modules", _this.taskId);
            var command = {
                modules: _this.details.activeModules()
            };
            http.put(url, command).then(function () {
                _this.details.activeModules.commit();
            }).fail(_this.handleError);
        };




        ctor.prototype.changeTaskConstraints = function (params) {
            var _this = this;
            var url = String.format("/api/tasks/{0}/constraints", _this.taskId);
            var command = {
                deadline: _this.details.constraints.deadline(),
                constraintType: _this.details.constraints.constraintType(),
                constraintDate: _this.details.constraints.constraintDate()
            };
            http.put(url, command).then(function () {
                    _this.details.constraints.deadline.commit();
                    _this.details.constraints.constraintType.commit();
                    _this.details.constraints.constraintDate.commit();
                })
                .fail(_this.handleError);
        };




        ctor.prototype.clearTaskAssignee = function () {
            var _this = this;
            _this.details.assignee(null);
            _this.changeTaskAssignee();
        };

        ctor.prototype.assignTaskTo = function (selectedUser, ev) {
            var _this = this;
            var user = selectedUser && ko.unwrap(selectedUser.id) || null;
            _this.details.assignee(user);
            _this.changeTaskAssignee();
        };

        ctor.prototype.changeTaskAssignee = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/assignee", _this.taskId);
            var command = {
                collaboratorId: _this.details.assignee() || null
            };
            http.put(url, command).then(function () {
                    _this.details.assignee.commit();

                    var btn = $("#btn-task-assignee");
                    if (btn.parent().hasClass("open")) {
                        $("#btn-task-assignee").dropdown("toggle"); // big shame
                    }

                    var requestId = utils.getRequestIdFromXhr(arguments);
                    ko.postbox.publish("TaskPropertiesUpdated", {
                        taskId: _this.taskId,
                        value: command.collaboratorId,
                        requestId: requestId,
                        property: "assignee"
                    });
                })
                .fail(_this.handleError);
        };

        ctor.prototype.changeTaskOwner = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/owner", _this.taskId);
            var command = {
                collaboratorId: _this.details.owner() || null
            };
            http.put(url, command).then(function () {
                    _this.details.owner.commit();
                })
                .fail(_this.handleError);
        };

        ctor.prototype.updateCollaborators = function (property, url, extraUrl) {
            var _this = this;
            extraUrl = extraUrl || "";
            var cachedList = ko.unwrap(_this.details[property].cached);
            var currentList = ko.unwrap(_this.details[property]);
            var insertedCollaborators = _.difference(currentList, cachedList);
            var deletedCollaboratos = _.difference(cachedList, currentList);

            var toDeleteAjaxTasks = [];
            _.each(deletedCollaboratos, function (collaboratorId) {
                toDeleteAjaxTasks.push(http.deleteSync(url + "/" + collaboratorId + extraUrl)
                    .then(function () {

                    })
                    .fail(_this.handleError));
            });

            $.when.apply($, toDeleteAjaxTasks).then(function () {
                var toInsertAjaxTasks = [];
                _.each(insertedCollaborators, function (collaboratorId) {
                    toInsertAjaxTasks.push(http.postSync(url + extraUrl, {
                            userId: collaboratorId
                        })
                        .then(function () {

                        })
                        .fail(_this.handleError));
                });

                return $.when.apply($, toInsertAjaxTasks).then(function () {
                    _this.details[property].commit();
                });
            });
        };

        ctor.prototype.changeTaskCoAssignees = function () {
            var _this = this;
            _this.updateCollaborators("coAssignees", String.format("/api/tasks/{0}/coassignees", _this.taskId));
        };

        ctor.prototype.changeTaskCoOwners = function () {
            var _this = this;
            _this.updateCollaborators("coOwners", String.format("/api/tasks/{0}/coowners", _this.taskId));
        };

        ctor.prototype.changeTaskFollowers1 = function () {
            var _this = this;
            _this.updateCollaborators("category1Followers", String.format("/api/tasks/{0}/followers", _this.taskId), "?category=1");
        };

        ctor.prototype.changeTaskFollowers2 = function () {
            var _this = this;
            _this.updateCollaborators("category2Followers", String.format("/api/tasks/{0}/followers", _this.taskId), "?category=2");
        };

        ctor.prototype.changeTaskFollowers3 = function () {
            var _this = this;
            _this.updateCollaborators("category3Followers", String.format("/api/tasks/{0}/followers", _this.taskId), "?category=3");
        };


        ctor.prototype.getOnlyEnabledModules = function () {
            var _this = this;
            var modules = _this.lookups.taskModules.getOnlyNonDefaults();
            var selectedModules = _this.details.activeModules.cached() || [];
            if (selectedModules.length === 0)
                return modules;

            var selectableModules = _.filter(modules, function (m) {
                return _.contains(selectedModules, m.value) === false;
            });
            return selectableModules;
        };


        ctor.prototype.deleteTask = function () {
            var _this = this;
            notifications.confirm({
                    title: i18n.t("app:pages.task.promptDeleteTaskHeader"),
                    text: i18n.t("app:pages.task.promptDeleteTaskContent"),
                    type: "warning",
                    showCancelButton: true,
                    confirmButtonText: i18n.t("app:alerts.delete.confirm"),
                    cancelButtonText: i18n.t("app:alerts.delete.cancel"),
                    closeOnConfirm: true,
                    closeOnCancel: true
                },
                function (isConfirm) {
                    if (isConfirm) {
                        var url = String.format("/api/tasks/{0}", _this.taskId);

                        http.delete(url).then(function () {
                            var h = String.format("#projects/{0}", _this.projectId);
                            router.navigate(h, {
                                replace: false,
                                trigger: false,
                                change: true
                            });
                            ko.postbox.publish("TaskDeleted", {
                                taskId: _this.taskId
                            });
                        }).fail(_this.handleError);
                    }
                });



        };

        ctor.prototype.blockTask = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/block", _this.taskId);
            http.put(url).then(function () {
                _this.details.isBlocked(true);
            }).fail(_this.handleError);
        };


        ctor.prototype.unblockTask = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/block", _this.taskId);
            http.delete(url).then(function () {
                _this.details.isBlocked(false);
            }).fail(_this.handleError);
        };

        ctor.prototype.archiveTask = function () {
            var _this = this;
            notifications.confirm({
                    title: i18n.t("app:pages.task.promptArchiveTaskHeader"),
                    text: i18n.t("app:pages.task.promptArchiveTaskContent"),
                    type: "warning",
                    showCancelButton: true,
                    confirmButtonText: i18n.t("app:alerts.delete.confirm"),
                    cancelButtonText: i18n.t("app:alerts.delete.cancel"),
                    closeOnConfirm: true,
                    closeOnCancel: true
                },
                function (isConfirm) {
                    if (isConfirm) {
                        var url = String.format("/api/tasks/{0}/archive", _this.taskId);
                        http.put(url).then(function () {
                            _this.details.isArchived(false);
                            ko.postbox.publish("TaskArchived", {
                                taskId: _this.taskId,
                                archived: true
                            });
                        }).fail(_this.handleError);
                    }
                });
        };

        ctor.prototype.unarchiveTask = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/archive", _this.taskId);
            http.delete(url).then(function () {
                _this.details.isArchived(false);
            }).fail(_this.handleError);
        };

        ctor.prototype.duplicateTask = function () {
            var _this = this;
            var handleError = _this.handleError;
            var modalVm = {
                handleError: handleError,
                viewUrl: "task/duplicate/task-duplicate-modal",
                taskId: null,
                projectId: null,
                taskName: ko.observable().extend({
                    required: true
                }),
                taskNamePrefix: ko.observable(""),
                targetProjectId: ko.observable().extend({
                    required: true
                }),
                targetProjectName: ko.observable(),
                targetParentTaskId: ko.observable(),
                includeCollaborators: ko.observable(true),
                includeDependedTasks: ko.observable(),
                includeRelatedTasks: ko.observable(),
                includeArchivedTasks: ko.observable(),
                includeDates: ko.observable(true),
                includeStatus: ko.observable(true),
                includeTags: ko.observable(true),
                includeNotes: ko.observable(),
                includeTodos: ko.observable(),
                includeComments: ko.observable(true),
                includeCustomFields: ko.observable(),
                includeAttachments: ko.observable(),
                includeExpenses: ko.observable(),
                includeTimeLogs: ko.observable(),
                includeTables: ko.observable(),
                includeSubtasks: ko.observable(true),
                projectAutocomplete: autocomplete.getSelect2OptionsForProjects(1),
                shiftDates: ko.observable(),
                dateShiftingValueAsDay: ko.observable().extend({
                    number: true
                }),
                targetProject: ko.observable(),
                attached: function () {
                    var t = this;
                    var lastValueOfTaskName = t.taskName();
                    var merge = false;
                    t.taskName.subscribe(function (v) {
                        if (merge)
                            lastValueOfTaskName = v;
                    });
                    t.taskNamePrefix.subscribe(function (v) {
                        merge = false;
                        t.taskName(v + lastValueOfTaskName);
                        merge = true;
                    });
                },
                cancel: function () {
                    dialog.close(this);
                },
                activate: function (parameters) {
                    var _this = this;
                    _this.targetProjectId(parameters.targetProjectId);
                    _this.targetProjectName(parameters.targetProjectName);
                    _this.taskName(parameters.taskName);
                    _this.projectId = parameters.projectId;
                    _this.taskId = parameters.taskId;
                    _this.targetProjectId.subscribe(function(){
                        _this.targetParentTaskId(null);
                    });
                }
            };

            var subscription = modalVm.targetProjectId.subscribe(function (projectId) {
                if (!projectId) {
                    modalVm.targetProject(null);
                    return;
                }
                var excludeFields = "tasks,subscriptions";
                var url = String.format("/api/projects/{0}?excludeFields={1}", projectId, excludeFields);
                http.get(url).then(function (targetProjectResponse) {
                    modalVm.targetProject(targetProjectResponse);
                }).fail(modalVm.handleError);
            });

            modalVm.errors = ko.validation.group(modalVm);

            modalVm.startTaskDuplication = ko.asyncCommand({
                execute: function (callback) {
                    var parent = modalVm;
                    if (parent.errors().length > 0) {
                        parent.errors.showAllMessages();
                        callback();
                        return;
                    }
                    var input = {
                        targetProjectId: parent.targetProjectId(),
                        targetParentTaskId: parent.targetParentTaskId(),
                        includeCollaborators: parent.includeCollaborators(),
                        includeDependedTasks: parent.includeDependedTasks(),
                        projectId: parent.projectId,
                        includeRelatedTasks: parent.includeRelatedTasks(),
                        includeDates: parent.includeDates(),
                        includeStatus: parent.includeStatus(),
                        includeTags: parent.includeTags(),
                        includeNotes: parent.includeNotes(),
                        includeTodos: parent.includeTodos(),
                        includeArchivedTasks: parent.includeArchivedTasks(),
                        includeComments: parent.includeComments(),
                        includeAttachments: parent.includeAttachments(),
                        includeExpenses: parent.includeExpenses(),
                        includeTimeLogs: parent.includeTimeLogs(),
                        includeTables: parent.includeTables(),
                        includeCustomFields: parent.includeCustomFields(),
                        taskName: parent.taskName(),
                        taskNamePrefix: parent.taskNamePrefix(),
                        includeSubTasks: parent.includeSubtasks(),
                        dateShiftingValueAsDay: parent.shiftDates() ? parent.dateShiftingValueAsDay() : null
                    };

                    var url = String.format("/api/tasks/{0}/duplicate?async=false", parent.taskId);
                    http.put(url, input).then(function (response) {
                            dialog.close(parent);
                        }).fail(parent.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && modalVm.errors().length === 0;
                }
            });

            modalVm.getTaskTypeahead = ko.pureComputed(function () {
                var parent = this;
                var projectId = parent.targetProjectId() || null;
                return autocomplete.getSelect2OptionsForTasks(projectId,1);
            }, modalVm);

            modalVm.hasAnyCustomFieldInConflictState = ko.pureComputed(function () {
                var parent = this;
                var targetProject = parent.targetProject();
                if (!targetProject) {
                    return false;
                }

                return parent.includeCustomFields() && targetProject.customFieldDefinations().length > 0;
            }, modalVm);

            modalVm.canDuplicateCollaborators = ko.pureComputed(function () {
                var parent = this;
                var targetProject = parent.targetProject();
                if (!targetProject) {
                    return false;
                }

                var can = targetProject.projectType === _this.lookups.projectTypes.HIE.value || targetProject.projectType === _this.lookups.projectTypes.HIE2.value;
                parent.includeCollaborators(can);
                return can;
            }, modalVm);

            dialog.showBsModal(modalVm, {
                projectId: ko.unwrap(_this.projectId),
                taskName: "(Copy of) " + _this.details.name.cached(),
                targetProjectId: ko.unwrap(_this.projectId),
                targetProjectName: ko.unwrap(_this.details.projectName),
                taskId: _this.taskId
            }).then(function (response) {
                subscription.dispose();
            });
        };

        ctor.prototype.showTaskDateShiftingWindow = function () {
            _this =this;
            system.acquire("task/shift-dates/task-shift-date-modal").then(function (instance) {
                var modal = system.resolveObject(instance);
                modal.taskId = _this.taskId;
                dialog.showBsModal(modal);
            });
        };

        ctor.prototype.createNewTask = function () {
            var _this = this;

            ko.postbox.publish("CreateTaskCommand", {
                parentTaskId: ko.unwrap(_this.details.id),
                parentTaskName: ko.unwrap(_this.details.name),
                projectId: ko.unwrap(_this.details.projectId)
            });
        };




        ctor.prototype.isModuleEnabled = function (module) {
            var _this = this;
            if (module === false) {
                return false;
            }

            var v = _.find(ko.unwrap(_this.details.activeModules.cached), function (m) {
                return ko.unwrap(m) === module.value;
            });
            if (v) {
                return true;
            }

            return false;
        };

        ctor.prototype.activate = function (params) {
            var _this = this;
            if (params)
                this.options = params;

            var descriptionSectionVisibility = amplify.store("options/descriptionSectionVisibility");
            this.descriptionSectionVisibility((typeof typedescriptionSectionVisibility !== "undefined") ? descriptionSectionVisibility : true);

            return this.loadTask(this.taskId);
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;

            this.activeModuleVm.deactivate(true);
            return true;
        };

        ctor.prototype.canDeactivate = function (close) {
            var _this = this;
            if (!_this.activeModuleVm)
                return true;

            return _this.activeModuleVm.canDeactivate(close);
        };

        ctor.prototype.canActivate = function (taskId) {
            if (this.runInit) {
                this.runInit = false;
                return true;
            }

            return false;

        };

        ctor.prototype.getTitle = function (instruction, app) {
            var _this = this;
            return ko.unwrap(_this.details.name);
        };


        ctor.prototype.attached = function (view) {
            var _this = this;




            $(view).find("#dropdown-description").click(function () {
                var button = $(this);
                var dropdown = $(".dropdown-menu-description");

                var dropDownTop = (button.offset().top - window.scrollY) + button.outerHeight();
                dropdown.css("position", "fixed");
                dropdown.css("top", dropDownTop + "px");
                dropdown.css("left", button.offset().left + "px");
            });


            var activeModules = ko.unwrap(_this.details.activeModules.cached);

            function getDefaultModule() {
                var v = _.find(activeModules, function (m) {
                    return ko.unwrap(m) === _this.lookups.taskModules.COMMENTS.value;
                });
                if (v) {
                    return _this.lookups.taskModules.COMMENTS;
                } else {
                    return _this.lookups.taskModules.DETAIL;
                }
            }

            var activeModule = ctor.getModuleFromQueryString() || amplify.store("LastActiveTaskModule");
            if (activeModule) {
                var module = _this.lookups.taskModules.get(activeModule);

                if (module && (_.contains(activeModules, module.value) || !module.isModule)) {
                    _this.activateModule(module, true, true);
                } else {
                    _this.activateModule(getDefaultModule(), true, true);
                }
            } else {
                _this.activateModule(getDefaultModule(), true, true);
            }


            ko.postbox.publish("TaskActivated", {
                taskId: _this.taskId,
                taskName: ko.unwrap(_this.details.name),
                projectId: _this.projectId
            });
        };


        ctor.getModuleFromQueryString = function () {
            if (window.location.href.indexOf("/tasks/") === -1) {
                return null;
            }
            var moduleParam = utils.getUrlVars()["m"];
            if (!moduleParam) {
                return null;
            }

            var m = _.find(lookupFactory.create().taskModules.getAll(), function (v) {
                return v.queryStringValue === moduleParam;
            });
            if (!m) {
                return null;
            }

            return m.value;
        };


        return ctor;


    });