define(["require", "common/notifications", "common/lookups", "common/prefs", "moment", "common/autocomplete", 
    "common/helpers", "common/context", "common/utils", "i18n", "amplify", "plugins/dialog", "durandal/events",
    "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator",
    "knockout", "jquery", "underscore", "task/task"],
function (require, notifications, lookupFactory, prefs, moment, autocomplete, helpers, context, utils, i18n, amplify, dialog, events, errorhandler, system, http, router, app, activator, ko, $, _, task) {

    var TaskViewTypes = {
        TREE_VIEW: "tree_view",
        GRID_VIEW: "grid_view",
        FLATTEN_VIEW: "flatten_view"
    };


    var ctor = function () {
        var _this = this;
        this.subscribers = [];
        errorhandler.includeIn(this);
        this.isOtherToolsFilterInUseVar = ko.observable(false);
        this.context = context;
        this.autocomplete = autocomplete;
        this.lookups = lookupFactory.create();
        this.helpers = helpers;
        this.prefs = prefs;
        this.isLoaded = ko.observable(false);
        this.details = null;
        this.projectId = null;
        this.taskView = ko.observable(TaskViewTypes.TREE_VIEW);
        this.selectedTab = activator.create();
        this.selectedTaskView = activator.create();
        this.selectedTaskId = ko.observable();
        this.newTask = activator.create();
        this.currentProjectView = activator.create();
        this.loadingTask = ko.observable(false);
        this.projectView = ko.observable(false);
        this.displayTasks = ko.observable();
        this.displayFilters = ko.observable();

       
        this.descriptionSectionVisibility = ko.observable(true);
        this.descriptionEditStatus = ko.observable(false);
        this.showDescription = ko.observable(false);
        this.descriptionSectionVisibility.subscribe(function (newValue) {
            amplify.store("options/descriptionSectionVisibility", newValue);
        });
        this.subscriptions = [];
        this.showActionDivider = ko.pureComputed(function () {
            return !_this.showDescription();
        }).extend({
            throttle: 500
        }).extend({deferred: true});

        this.activeModule = ko.observable();
        this.activeModuleVm = activator.create();

        this.customFieldDefinations = ko.pureComputed(function () {
            var result = _.filter(context.customFields(), function (cf) {
                return _.contains(cf.projects, _this.projectId);
            });
            return result;
        }).extend({deferred: true});

        this.viewOptions = {
            showTags: ko.observable(amplify.store(String.format("projects/{0}/tree/showTags", _this.projectId) || false)),
            showStartDate: ko.observable(amplify.store(String.format("projects/{0}/tree/showStartDate", _this.projectId)) || false),
            showCompletionPercentage: ko.observable(amplify.store(String.format("projects/{0}/tree/showCompletionPercentage", _this.projectId)) || false),
            showOwner: ko.observable(amplify.store(String.format("projects/{0}/tree/showOwner", _this.projectId)) || false),
            showIsBlocked: ko.observable(amplify.store(String.format("projects/{0}/tree/showIsBlocked", _this.projectId)) || false),
            selectedCustomFields: ko.observableArray([])
        };

        this.activeModules = ko.pureComputed(function () {
            if (!_this.details) {
                return [{
                    detail: _this.lookups.projectModules.DETAIL,
                    isEnabled: true,
                    isActive: ko.computed(function () {
                        return _this.activeModule() === _this.lookups.projectModules.DETAIL;
                    })
                }];
            }


            return _.chain(_this.lookups.projectModules.getAll())
                .filter(function (module) {
                    return module.defaultActive;
                })
                .sortBy(function (module) {
                    return module.order;
                })
                .map(function (module) {
                    return {
                        detail: module,
                        isEnabled: true,
                        isActive: ko.computed(function () {
                            return _this.activeModule() === module;
                        }),
                        activate: function () {
                            var m = this;
                            var module = m.detail;
                            _this.activateModule(module, true);
                        }
                    };
                })
                .value();
        }, this, {
            deferEvaluation: true
        }).extend({deferred: true});


        this.headerCollapseStatus = ko.pureComputed({
            read: function () {
                var v = amplify.store("projects/headerCollapseStatus");
                if (typeof v === "undefined" || v === null) {
                    return true;
                }
                return v;
            },
            write: function (value) {
                amplify.store("projects/headerCollapseStatus", value);
            },
            owner: this
        });

        this.projectTypeahead = autocomplete.projectTypeahead;

        this.filter = {
            includeArchivedTasks: ko.observable(false),
            selectedStatus: ko.observableArray(["0", "1", "2", "4", "8", "16", "32", "64"]).extend({
                rateLimit: 500
            }), // default 'None' status always
            selectedTaskType: ko.observableArray(["0", "1", "2", "3", "4", "5"]).extend({
                rateLimit: 500
            }) // default 'None' status always
        };

        this.taskView.subscribe(function(v){
            var selectedTaskType = amplify.store(String.format("projects/{0}/tree/{1}/selectedTaskType", _this.projectId,v));
            if (selectedTaskType) {
                _this.filter.selectedTaskType(selectedTaskType);
            }
        });
        this.filter.selectedStatus.subscribe(function (v) {
            if (_.contains(v, "archived")) {
                _this.filter.includeArchivedTasks(true);
            } else {
                _this.filter.includeArchivedTasks(false);
            }

            amplify.store(String.format("projects/{0}/tree/selectedStatus", _this.projectId), v);
        });

        this.filter.selectedTaskType.subscribe(function (v) {
            if (_.contains(v, "archived")) {
                _this.filter.includeArchivedTasks(true);
            } else {
                _this.filter.includeArchivedTasks(false);
            }

            amplify.store(String.format("projects/{0}/tree/{1}/selectedTaskType", _this.projectId,_this.taskView()), v);
        });

        this.filter.includeArchivedTasks.subscribe(function (v) {

            amplify.store(String.format("projects/{0}/tree/includeArchivedTasks", _this.projectId), v);
            if (_this.projectId) {
                return _this.loadProject(_this.projectId);
            }
        });
        this.tasks = ko.pureComputed(function () {
            if (_this.isLoaded() === false || _this.details === null) {
                return [];
            }
            return _this.details.tasks();
        }, this).extend({deferred: true});

        this.completedTasks = ko.pureComputed(function () {
            return _.filter(_this.tasks(), function (t) {
                return ko.unwrap(t.status) === _this.lookups.taskStatus.COMPLETED.value;
            }).length;
        }).extend({deferred: true});
        this.cancelledTasks = ko.pureComputed(function () {
            return _.filter(_this.tasks(), function (t) {
                return ko.unwrap(t.status) === _this.lookups.taskStatus.CANCELLED.value;
            }).length;
        }).extend({deferred: true});
        this.myTasks = ko.pureComputed(function () {
            return _.filter(_this.tasks(), function (t) {
                return ko.unwrap(t.assignee) === ko.unwrap(context.user().id);
            }).length;
        }).extend({deferred: true});

        this.overdueTasks = ko.pureComputed(function () {
            var now = moment();
            return _.filter(_this.tasks(), function (t) {
                var dueDate = ko.unwrap(t.dueDate);
                if (!dueDate) {
                    return false;
                }
                var diff = moment(dueDate).diff(now, "days");
                return (ko.unwrap(t.status) !== _this.lookups.taskStatus.COMPLETED.value) && diff <= 0;
            }).length;
        }).extend({deferred: true});
        this.rootTasks = ko.pureComputed(function () {
            if (_this.isLoaded() === false || _this.details === null) {
                return [];
            }
            return _.sortBy(_.filter(_this.tasks(), function (t) {
                return !t.parentTaskId();
            }), function (t) {
                return t.order();
            });
        }).extend({deferred: true});

        this.lastProcessedEventRequestId = null;

        this.loadProjectDebounced = _.debounce(function () {
            _this.loadProject(_this.projectId);
        }, 1000);


        var isOtherToolsInUseResult = ko.computed(function () {
            var isInUseTags = _this.viewOptions.showTags();
            var isInUsePercentage = _this.viewOptions.showCompletionPercentage();
            var isInUseshowOwner = _this.viewOptions.showOwner();
            var isInUseshowIsBlocked = _this.viewOptions.showIsBlocked();
            var isInUseselectedShowStartDate = _this.viewOptions.showStartDate();


            var result = isInUseTags === false || isInUsePercentage === false || isInUseshowOwner === false || isInUseshowIsBlocked === false || isInUseselectedShowStartDate === false;
            _this.isOtherToolsFilterInUseVar(result);
            return _this.isOtherToolsFilterInUseVar();
        });

    };

    ctor.prototype.findTask = function (taskId) {
        var _this = this;
        return _.find(ko.unwrap(_this.details.tasks), function (t) {
            return ko.unwrap(t.id) === ko.unwrap(taskId);
        }) || null;
    };


    ctor.prototype.activateModule = function (selectedModule, deactivatePrevious, afterActivate) {
        var _this = this;
        var defer = $.Deferred();

        function loadModule(moduleVmName, module) {
            var dfd = $.Deferred();

            if(module.fakeModule){
                if(deactivatePrevious){
                    _this.activeModuleVm.deactivate(true).then(function(v){
                        if(!v){
                            dfd.reject();
                            return;
                        }
                        _this.activeModuleVm(null);
                        dfd.resolve(true);
                    });
                }else{
                    dfd.resolve(true);
                }

                return dfd.promise();
            }else{
                system.acquire(moduleVmName)
                    .then(function (m) {
                        if(deactivatePrevious){
                            _this.activeModuleVm.deactivate(true).then(function(v){
                                if(!v){
                                    dfd.reject();
                                    return;
                                }
                                _this.activeModuleVm(null);
                                dfd.resolve(m);
                            });
                        }else{
                            dfd.resolve(m);
                        }

                    });
                return dfd.promise();
            }
        }


        if (selectedModule === _this.lookups.projectModules.DETAIL) {
            defer = loadModule("project-details", selectedModule);


        } else if (selectedModule === _this.lookups.projectModules.TASKS) {
            defer = loadModule("tasks", selectedModule);
        } else if (selectedModule === _this.lookups.projectModules.ATTACHMENTS) {
            defer = loadModule("task/attachment/task-attachments", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        }
        else if (selectedModule === _this.lookups.projectModules.TODOS) {
            defer = loadModule("task/todo/task-todos", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        }
        else if (selectedModule === _this.lookups.projectModules.TABLES) {
            defer = loadModule("project/table/project-tables", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } else if (selectedModule === _this.lookups.projectModules.ACCESS_LIST) {
            defer = loadModule("project/access-list/project-access-list", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        }
        else if (selectedModule === _this.lookups.projectModules.TIMELOGS) {
            defer = loadModule("task/timelog/task-timelogs", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } else if (selectedModule === _this.lookups.projectModules.EXPENSE_TRACKING) {
            defer = loadModule("task/expense/task-expense", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } else if (selectedModule === _this.lookups.projectModules.HISTORY) {
            defer = loadModule("task/history/task-history", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } else if (selectedModule === _this.lookups.projectModules.LINKED_TASKS) {
            defer = loadModule("task/dependency/task-dependencies", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } else if (selectedModule === _this.lookups.projectModules.CUSTOM_FIELDS) {
            defer = loadModule("project/custom-fields/project-module-custom-fields", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } else if (selectedModule === _this.lookups.projectModules.GANTT) {
            defer = loadModule("task/gantt/task-gantt", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId,
                    projectName: ko.unwrap(_this.details.name)
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        }
        else if (selectedModule === _this.lookups.projectModules.CALENDAR) {
            defer = loadModule("task/calendar/task-calendar", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } 
        else if (selectedModule === _this.lookups.projectModules.TAG_CLOUD) {
            defer = loadModule("project/tag-cloud/tag-cloud", selectedModule).then(function (module) {
                var o = system.resolveObject(module);
                var settings = {
                    projectId: _this.projectId
                };
                return _this.activeModuleVm.activateItem(o, settings);
            });
        } else if (selectedModule === _this.lookups.projectModules.PROJECT_REPORT) {
            defer = loadModule("search/report/task-report-module-from-search", selectedModule).then(function (module) {

                var o = new module(_this.tasks());

                _.each(_this.tasks(), function (eTask) {

                    $.extend(eTask, {projectId: ko.observable(_this.projectId)});

                });

                var settings = {
                    projectId: _this.projectId,
                    tasks: _this.tasks()
                };


                return _this.activeModuleVm.activateItem(o, settings);
            });
        }


        defer.then(function () {
            _this.activeModule(selectedModule);
            var activeRoute = router.activeInstruction();
            if (activeRoute.config.moduleId !== "activity/activities") {
                var hash = String.format("#projects/{0}?m={1}", _this.projectId, selectedModule.queryStringValue);
                router.navigate(hash, {replace: true, trigger: false});
            }

            ko.postbox.publish("ProjectActivated", {
                projectId: _this.projectId,
                projectName: ko.unwrap(_this.details.name)
            });

        });

        if (defer && defer.resolve) {
            defer.resolve(true);
        }
    };

    ctor.prototype.createNewTask = function (taskDetails) {
        var _this = this;
        ko.postbox.publish("CreateTaskCommand", {
            projectId: _this.projectId
        });
    };

    ctor.prototype.addDescriptionField = function () {
        var _this = this;
        _this.showDescription(true);
        _this.descriptionEditStatus(true);
    };

   

    ctor.prototype.onDescriptionSave = function (editor, api) {
        var _this = this;
        if (!editor.isDirty()) {
            api.dispose();
            return;
        }
        var content = editor.getContent();
        var url = String.format("/api/projects/{0}/description", _this.projectId);
        return http.put(url, {
            description: content
        }).then(function () {
            _this.details.description(content);
         
            api.dispose();
        }).fail(_this.handleError);
    };

    ctor.prototype.isPersonalProject = function () {
        var _this = this;
        var pt = _this.lookups.projectTypes.get(_this.details.projectType);
        return pt && pt === _this.lookups.projectTypes.PERSONAL;
    };

    ctor.prototype.isHierarcialProject = function () {
        var _this = this;
        var pt = _this.lookups.projectTypes.get(_this.details.projectType);
        return pt && (pt === _this.lookups.projectTypes.HIE || pt === _this.lookups.projectTypes.HIE2);
    }

    ctor.prototype.isTeamBasedProject = function () {
        var _this = this;
        var pt = _this.lookups.projectTypes.get(_this.details.projectType);
        return pt.isTeamBased;
    };

    ctor.prototype.getTextOrEmptyText = function (type) {
        var _this = this;
        var v = null;
        if (type === "status") {
            return _this.lookups.projectStatus.get(_this.details.status.cached).text;
        } else if (type === "priority") {
            v = _this.lookups.taskPriority.get(_this.details.priority.cached) || false;
            if (!v) {
                return "Empty";
            }
            return v.text;
        } else if (type === "type") {
            return _this.details.projectType ? _this.lookups.projectTypes.get(_this.details.projectType).text : "";
        } else if (type === "commentvoting") {
            return _this.lookups.commentVoteStatus.get(_this.details.moduleOptions.commentVoteStatus.cached).text;
        } else if (type === "commentvotemode") {
            return _this.lookups.commentVoteModes.get(_this.details.moduleOptions.commentVoteMode.cached).text;
        } else if (type === "commentsortmodes") {
            return _this.lookups.commentSortModes.get(_this.details.moduleOptions.commentDefaultSortingMode.cached).text;
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
        }
    };

    ctor.prototype.reschedule = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/schedule", _this.projectId);
        var command = {
            dueDate: _this.details.dueDate(),
            startDate: _this.details.startDate()
        };
        http.put(url, command)
            .then(function () {
                _this.details.dueDate.commit();
                _this.details.startDate.commit();
            })
            .fail(_this.handleError);
    };


    ctor.prototype.changeProjectEstimations = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/estimations", _this.projectId);
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
        

    ctor.prototype.changeProjectStatus = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/status", _this.projectId);
        var command = {
            status: _this.details.status()
        };
        http.put(url, command)
            .then(function () {
                _this.details.status.commit();
            })
            .fail(_this.handleError);
    };

    ctor.prototype.changeProjectName = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/name", _this.projectId);
        var command = {
            name: _this.details.name()
        };
        http.put(url, command).then(function () {
            _this.details.name.commit();
        })
            .fail(_this.handleError);
    };

    ctor.prototype.changeProjectManager = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/manager", _this.projectId);
        var command = {
            collaboratorId: _this.details.manager() || null
        };
        http.put(url, command).then(function () {
            _this.details.manager.commit();
        })
            .fail(_this.handleError);
    };

    ctor.prototype.changeProjectOwner = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/owner", _this.projectId);
        var command = {
            newOwnerId: _this.details.owner() || null
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
        }).fail(_this.handleError);
    };

    ctor.prototype.changeProjectCoManagers = function () {
        var _this = this;
        _this.updateCollaborators("coManagers", String.format("/api/projects/{0}/comanagers", _this.projectId));
    };

    ctor.prototype.changeProjectCoOwners = function () {
        var _this = this;
        _this.updateCollaborators("coOwners", String.format("/api/projects/{0}/coowners", _this.projectId));
    };

    ctor.prototype.changeProjectFollowers1 = function () {
        var _this = this;
        _this.updateCollaborators("category1Followers", String.format("/api/projects/{0}/followers", _this.projectId), "?category=1");
    };

    ctor.prototype.changeProjectFollowers2 = function () {
        var _this = this;
        _this.updateCollaborators("category2Followers", String.format("/api/projects/{0}/followers", _this.projectId), "?category=2");
    };

    ctor.prototype.changeProjectFollowers3 = function () {
        var _this = this;
        _this.updateCollaborators("category3Followers", String.format("/api/projects/{0}/followers", _this.projectId), "?category=3");
    };

    ctor.prototype.changeProjectMembers = function () {
        var _this = this;
        _this.updateCollaborators("members", String.format("/api/projects/{0}/members", _this.projectId));
    };

    ctor.prototype.changeProjectStopHierarchyUsers = function () {
        var _this = this;
        _this.updateCollaborators("stopHierarchyUsers", String.format("/api/projects/{0}/stop-hierarchy-users", _this.projectId));
    };

    ctor.prototype.changeProjectExternalUsers = function () {
        var _this = this;
        _this.updateCollaborators("externalUsers", String.format("/api/projects/{0}/external-users", _this.projectId));
    };

    ctor.prototype.changeProjectExcludedUsers = function () {
        var _this = this;
        _this.updateCollaborators("excludedUsers", String.format("/api/projects/{0}/excluded-users", _this.projectId));
    };


    ctor.prototype.starProject = function () {
        var _this = this;
        var id = _this.projectId;
        var url = String.format("/api/stars");
        http.post(url, {
            objectId: id,
            design: "design1",
            type: "project"
        }).then(function (response) {
            _this.details.isStarred(true);
            ko.postbox.publish("UserSettingsChanged", {
                type: "project",
                objectId: id,
                name: _this.details.name()
            });
        }).fail(_this.handleError);
    };
    ctor.prototype.unstarProject = function () {
        var _this = this;
        var id = _this.projectId;
        var url = String.format("/api/stars?type=project&objectId={0}", id);
        http.delete(url).then(function (response) {
            _this.details.isStarred(false);
            ko.postbox.publish("UserSettingsChanged", {
                type: "project",
                objectId: id
            });
        }).fail(_this.handleError);
    };
    ctor.prototype.unmute = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/mute", _this.projectId);
        http.delete(url).then(function () {
            _this.details.hasMuted(false);
        }).fail(_this.handleError);
    };
    ctor.prototype.mute = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/mute", _this.projectId);
        http.put(url).then(function () {
            _this.details.hasMuted(true);
        }).fail(_this.handleError);
    };
    ctor.prototype.deleteProject = function () {
        var _this = this;
        notifications.confirm({
            title: i18n.t("app:pages.project.promptdeleteprojectheader"),
            text: i18n.t("app:pages.project.promptdeleteproject"),
            type: "warning",
            showCancelButton: true,
            confirmButtonText: i18n.t("app:alerts.delete.confirm"),
            cancelButtonText: i18n.t("app:alerts.delete.cancel"),
            closeOnConfirm: true,
            closeOnCancel: true
        },
        function (isConfirm) {
            if (isConfirm) {
                var url = String.format("/api/projects/{0}", _this.projectId);
                http.delete(url).then(function () {
                    notifications.success(i18n.t("app:pages.project.promptdeleteprojectconfirmtext"));
                    router.navigate("#projects");
                }).fail(_this.handleError);
            }
        });
    };

    ctor.prototype.archiveProject = function () {
        var _this = this;
        notifications.confirm({
            title: i18n.t("app:pages.project.promptarchiveprojectheader"),
            text: i18n.t("app:pages.project.promptarchiveproject"),
            type: "warning",
            showCancelButton: true,
            confirmButtonText: i18n.t("app:pages.project.archiveConfirm"),
            cancelButtonText: i18n.t("app:pages.project.archiveCancel"),
            closeOnConfirm: true,
            closeOnCancel: true
        },
        function (isConfirm) {
            if (isConfirm) {
                var url = String.format("/api/projects/{0}/archive", _this.projectId);
                http.put(url).then(function () {
                    _this.details.isArchived(true);
                    notifications.success(i18n.t("app:pages.project.promptarchiveprojectconfirmtext"));
                }).fail(_this.handleError);
            }
        });
    };
    ctor.prototype.unarchiveProject = function () {
        var _this = this;
        var url = String.format("/api/projects/{0}/unarchive", _this.projectId);
        http.put(url).then(function () {
            _this.details.isArchived(false);
        }).fail(_this.handleError);
    };

    ctor.prototype.unpublishProject = function () {
        var _this = this;

        notifications.confirm({
            title: i18n.t("app:pages.project.promptunpublishprojectheader"),
            text: i18n.t("app:pages.project.promptunpublishproject"),
            type: "warning",
            showCancelButton: true,
            confirmButtonText: i18n.t("app:alerts.prompt.yes"),
            cancelButtonText: i18n.t("app:alerts.prompt.cancel"),
            closeOnConfirm: true,
            closeOnCancel: true
        },
        function (isConfirm) {
            if (isConfirm) {
                var url = String.format("/api/projects/{0}/unpublish", _this.projectId);
                http.put(url).then(function () {
                    _this.details.isPublished(false);
                    notifications.success(i18n.t("app:pages.project.promptunpublishconfirmtext"));
                }).fail(_this.handleError);
            }
        });
    };
    ctor.prototype.publishProject = function () {
        var _this = this;

        notifications.confirm({
            title: i18n.t("app:pages.project.promptpublishprojectheader"),
            text: i18n.t("app:pages.project.promptpublishproject"),
            type: "warning",
            showCancelButton: true,
            confirmButtonText: i18n.t("app:alerts.prompt.yes"),
            cancelButtonText: i18n.t("app:alerts.prompt.cancel"),
            closeOnConfirm: true,
            closeOnCancel: true
        },
        function (isConfirm) {
            if (isConfirm) {
                var url = String.format("/api/projects/{0}/publish", _this.projectId);
                var command = {};
                http.put(url).then(function () {
                    _this.details.isPublished(true);
                    notifications.success(i18n.t("app:pages.project.promptpublishconfirmtext"));
                }).fail(_this.handleError);
            }
        });
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


    ctor.prototype.loadProject = function (projectId) {
        var _this = this;
        var criteria = ko.toJS(_this.filter);
        criteria.status = criteria.selectedStatus.join();
        delete criteria.selectedStatus;
        var filters = utils.toQueryString(criteria);

        var url = String.format("/api/projects/{0}?{1}", projectId, filters);
        return http.get(url)
            .then(function (projectData) {
                function extendProjectTasks(project) {
                    project.tasks = ko.observableArray(_.map(project.tasks, function (task) {
                        var t = ko.mapping.fromJS(task);
                        t.isDeleted = ko.observable(false); // extebd
                        return t;
                    })).extend({deferred: true});

                }

                function extendProject(project) {
                    // project.id = project.id;
                    project.startDate = ko.revertableObservable(project.startDate);
                    project.dueDate = ko.revertableObservable(project.dueDate);
                    project.name = ko.revertableObservable(project.name);
                    project.description = ko.revertableObservable(project.description);
                    project.status = ko.revertableObservable(project.status);
                    project.owner = ko.revertableObservable(project.owner);
                    project.manager = ko.revertableObservable(project.manager);
                    project.coOwners = ko.revertableObservableArray(project.coOwners);
                    project.coManagers = ko.revertableObservableArray(project.coManagers);
                    project.category1Followers = ko.revertableObservableArray(project.category1Followers);
                    project.category2Followers = ko.revertableObservableArray(project.category2Followers);
                    project.category3Followers = ko.revertableObservableArray(project.category3Followers);
                    project.members = ko.revertableObservableArray(project.members);
                    project.excludedUsers = ko.revertableObservableArray(project.excludedUsers);
                    project.stopHierarchyUsers = ko.revertableObservableArray(project.stopHierarchyUsers);
                    project.externalUsers = ko.revertableObservableArray(project.externalUsers);
                    project.tags = ko.revertableObservableArray(project.tags);
                    project.hasMuted = ko.revertableObservable(project.hasMuted);
                    project.audit = ko.revertableObservable(project.audit);
                    project.isOnlyForMembers = ko.revertableObservable(project.isOnlyForMembers);
                    project.estimatedDurationDays = ko.revertableObservable(project.estimatedDurationDays);
                    project.estimatedEffordHours = ko.revertableObservable(project.estimatedEffordHours);
                    project.estimatedBudget = ko.revertableObservable(project.estimatedBudget);
                    project.estimatedBudgetCurrencyCode = ko.revertableObservable(project.estimatedBudgetCurrencyCode);
                    project.isPublished = ko.revertableObservable(project.isPublished);
                    project.isArchived = ko.revertableObservable(project.isArchived);
                    project.taskCount = ko.revertableObservable(project.taskCount);
                    project.isStarred = ko.revertableObservable(project.isStarred);
                    project.category = ko.revertableObservable(project.category);

                    project.dueDateText = ko.pureComputed(function () {
                        var d = ko.unwrap(project.dueDate.cached);
                        return d ? utils.formatDateTime(d, prefs.dateTimeFormat()) : "";
                    }, project);
                    project.startDateText = ko.pureComputed(function () {
                        var d = ko.unwrap(project.startDate.cached);
                        return d ? utils.formatDateTime(d, prefs.dateTimeFormat()) : "";
                    }, project);


                    // ko.observableArray(project.customFieldDefinations).subscribeTo("CustomFieldsChanged");
                    extendProjectTasks(project);
                }


                if (!_this.details || ko.unwrap(_this.details.id) !== projectId) {
                    extendProject(projectData);
                    _this.details = projectData;
                } else {
                    extendProjectTasks(projectData);
                    _this.details.tasks([]);
                    _this.details.tasks.push.apply(_this.details.tasks, projectData.tasks());
                }


                // _this.details = projectData;
                _this.projectId = _this.details.id;

                if (_this.details.description()) {
                    _this.showDescription(true);
                }

                _this.isLoaded(true);

            }).fail(_this.handleError);
    };

    ctor.prototype.selectTask = function (taskId) {
        var _this = this;
        _this.projectView(false);
        _this.newTask.deactivateItem(true);
        _this.selectedTaskView.deactivateItem(true);
        var taskView = new task(taskId, _this.projectId, this);
        return _this.selectedTaskView.activateItem(taskView).then(function () {
            _this.selectedTaskId(taskId);
        });
    };

    ctor.prototype.getTitle = function (instance, instruction) {
        var _this = this;
        return ko.unwrap(_this.details.name);
    };


    ctor.prototype.loadProjectDetail = function () {
        var _this = this;
        _this.selectedTaskView.deactivate(true);
        _this.projectView(true);
        var hash = "#projects/" + _this.projectId;

        var activeRoute = router.activeInstruction();

        return _this.activateModule(_this.lookups.projectModules.DETAIL, true);


    };

    ctor.prototype.loadSettings = function (projectId) {
        var _this = this;

        var selectedStatus = amplify.store(String.format("projects/{0}/tree/selectedStatus", projectId));
        if (selectedStatus) {
            _this.filter.selectedStatus(selectedStatus);
        }

        var selectedTaskType = amplify.store(String.format("projects/{0}/tree/{1}/selectedTaskType", projectId,_this.taskView()));
        if (selectedTaskType) {
            _this.filter.selectedTaskType(selectedTaskType);
        }

        var getSelectedStatusSet = amplify.store(String.format("projects/{0}/tree/selectedStatus", _this.projectId));
        var getSelectedTaskTypeSet = amplify.store(String.format("projects/{0}/tree/selectedTaskType", _this.projectId));

        _this.filter.includeArchivedTasks(amplify.store(String.format("projects/{0}/tree/includeArchivedTasks", projectId)) || false);

    };

    ctor.prototype.onTaskTreeScroll = function (ev, el, scrollTop) {
        var _this = this;
        var api = $("#project-tree-header-panel").data("panel-api");

        // if (scrollTop > 300) {
        //     api.hideContent();
        // }
    };

    ctor.prototype.duplicateProject = function () {
        var _this = this;
        var errorHandler = _this.handleError;
        var modalVm = {
            errorHandler: errorHandler,
            viewUrl: "project/duplicate/project-duplicate-modal",
            projectId: _this.projectId,

            taskNamePrefix: ko.observable(),
            includeCollaborators: ko.observable(true),
            includeDependedTasks: ko.observable(),
            includeRelatedTasks: ko.observable(),
            includeDates: ko.observable(true),
            includeStatus: ko.observable(true),
            includeTags: ko.observable(true),
            includeNotes: ko.observable(),
            includeTodos: ko.observable(),
            includeComments: ko.observable(),
            includeAttachments: ko.observable(),
            includeExpenses: ko.observable(),
            includeTimeLogs: ko.observable(),
            includeTables: ko.observable(),
            newProjectFolderId: ko.observable().extend({required: true}),
            newProjectName: ko.observable(i18n.t("app:pages.projectDuplicate.newProjectNamePrefix") + " " + _this.details.name()).extend({required: true}),

            projectStartDate: ko.observable(),
            projectDueDate: ko.observable(),
            includeArchivedTasks: ko.observable(),
            dateShiftingValueAsDay: ko.observable(),

            calculateDates: ko.observable(),
            calculateMethod: ko.observable().extend({
                validation: {
                    validator: function (val, params) {
                        if (val === "shift") {
                            return true;
                        }

                        if (val === "startdate" && !_this.details.startDate.cached()) {
                            params[0] = "start";
                            return false;
                        }


                        params[0] = "end";
                        if (val === "enddate" && !_this.details.dueDate.cached()) {
                            return false;
                        }

                        return true;
                    },
                    message: i18n.t("app:pages.projectduplicate.dateCalculateValidationMessage"),
                    params: []
                }
            }),
            calculateByDate: ko.observable(),
            folders: [],
            cancel: function () {
                dialog.close(this);
            },
            activate: function () {
                var parent = this;
                return http.get("/api/projects")
                    .then(function (response) {

                        parent.folders = helpers.groupProjectFolders(response.folderTree);
                    });
            }
        };

        modalVm.calculateMethod.subscribe(function (val) {
            modalVm.dateShiftingValueAsDay(0);
        });

        modalVm.calculateByDate.subscribe(function (val) {
            if (!val) {
                return;
            }
            if (modalVm.calculateMethod() === "startdate") {
                var startDate = _this.details.startDate.cached();
                modalVm.dateShiftingValueAsDay(moment(val).diff(moment(startDate), "days"));
            }
            else if (modalVm.calculateMethod() === "enddate") {
                var endDate = _this.details.dueDate.cached();
                modalVm.dateShiftingValueAsDay(moment(val).diff(moment(endDate), "days"));
            }
        });

        modalVm.errors = ko.validation.group(modalVm);
        modalVm.startProjectDuplication = ko.asyncCommand({
            execute: function (callback) {
                var parent = modalVm;

                if (parent.errors().length > 0) {
                    parent.errors.showAllMessages();
                    return;
                }

                var input = {
                    newProjectName: parent.newProjectName(),
                    newProjectFolderId: parent.newProjectFolderId(),
                    taskNamePrefix: parent.taskNamePrefix(),
                    includeCollaborators: parent.includeCollaborators(),
                    includeDependedTasks: parent.includeDependedTasks(),
                    includeRelatedTasks: parent.includeRelatedTasks(),
                    includeDates: parent.includeDates(),
                    includeStatus: parent.includeStatus(),
                    includeTags: parent.includeTags(),
                    includeNotes: parent.includeNotes(),
                    includeTodos: parent.includeTodos(),
                    includeComments: parent.includeComments(),
                    includeAttachments: parent.includeAttachments(),
                    includeExpenses: parent.includeExpenses(),
                    includeTimeLogs: parent.includeTimeLogs(),
                    includeTables: parent.includeTables(),
                    includeArchivedTasks: parent.includeArchivedTasks(),
                    projectStartDate: parent.projectStartDate(),
                    projectDueDate: parent.projectDueDate(),
                    dateShiftingValueAsDay: parent.calculateDates() ? parent.dateShiftingValueAsDay() : null
                };


                var url = String.format("/api/projects/{0}/duplicate?async=false", parent.projectId);
                http.post(url, input).then(function (response) {
                    dialog.close(parent);
                }).fail(parent.errorHandler)
                    .always(function () {
                        callback();
                    });
            },
            canExecute: function (isExecuting) {
                return !isExecuting && modalVm.errors().length === 0;
            }
        });

        dialog.showBsModal(modalVm).then(function (response) {

        });


    };

    ctor.prototype.onProjectModuleScroll = function (ev, el, scrollTop) {
        var _this = this;
        var api = $("#project-header-panel").data("panel-api");

        if (scrollTop > 300) {
            api.hideContent();
        } else if (scrollTop <= 0) {
            api.showContent();
        }
    };


    ctor.prototype.changeTaskOrder = function (order, task, ev) {
        var _this = this;
        var pos = helpers.orderTaskGetPosition(_this.rootTasks(), task, order);

        if (pos === -1) {
            return;
        }

        var command = {
            order: pos
        };
        var url = String.format("/api/tasks/{0}/order", ko.unwrap(task.id));
        return http.put(url, command).then(function (response) {
            task.order(pos);
        });
    };

    ctor.prototype.getTaskStatusText = function (status) {
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


    ctor.prototype.deactivate = function (close) {
        var _this = this;

        _this.selectedTaskView.deactivate(true);
        _.each(_this.subscriptions, function (subscriber) {
            subscriber.dispose();
        });

        //    _this.details.customFieldDefinations.unsubscribeFrom("CustomFieldsChanged");
    };

    ctor.prototype.subscribeTo = function (name, handler) {
        var _this = this;
        _this.subscriptions.push(ko.postbox.subscribe(name, handler));
    };

    ctor.prototype.canDeactivate = function (v1, v2) {
        var _this = this;
        // don't refresh when navigating in same project
        var activeRoute = router.activeInstruction();
        if (!activeRoute) {
            return true;
        }
        var moduleId = system.getModuleId(_this);
        if (moduleId !== activeRoute.config.moduleId) {
            return true;
        }
        if (_this.projectId !== activeRoute.params[0]) {
            return true;
        }
        if (activeRoute.params.length >= 2) {
            var taskId = activeRoute.params[1];
            return _this.selectTask(taskId);
        }

        return true;
    };

    ctor.prototype.containsValue = function (data, arr) {
        return ko.unwrap(arr).indexOf(data) > -1;
    };

    ctor.prototype.activate = function (projectId, taskId) {
        var _this = this;
        //
        if (typeof taskId === "object") {
            taskId = null;
        }

        var loadProject = true;
        if (_this.details && _this.projectId === projectId) {
            loadProject = false;
        }

        _this.loadSettings(projectId);

        if (loadProject) {
            return _this.loadProject(projectId)
                .then(function () {
                    if (taskId) {
                        return _this.selectTask(taskId);
                    }
                    return true;
                });
        } else {
            if (taskId) {
                return _this.selectTask(taskId);
            } else {
                return _this.selectedTaskView.deactivate(true);
            }
        }
    };

    ctor.prototype.attached = function (view) {
        var _this = this;

        //
        _this.subscribers.push(_this.viewOptions.showTags.subscribe(function (v) {
            amplify.store(String.format("projects/{0}/tree/showTags", _this.projectId), v);
        }));

        _this.subscribers.push(_this.viewOptions.showStartDate.subscribe(function (v) {
            amplify.store(String.format("projects/{0}/tree/showStartDate", _this.projectId), v);
        }));

        _this.subscribers.push(_this.viewOptions.showCompletionPercentage.subscribe(function (v) {
            amplify.store(String.format("projects/{0}/tree/showCompletionPercentage", _this.projectId), v);
        }));

        _this.subscribers.push(_this.viewOptions.showOwner.subscribe(function (v) {
            amplify.store(String.format("projects/{0}/tree/showOwner", _this.projectId), v);
        }));

        _this.subscribers.push(_this.viewOptions.showIsBlocked.subscribe(function (v) {
            amplify.store(String.format("projects/{0}/tree/showIsBlocked", _this.projectId), v);
        }));

        _this.subscribers.push(_this.viewOptions.selectedCustomFields.subscribe(function (v) {
            amplify.store(String.format("projects/{0}/tree/selectedCustomFields", _this.projectId), v);
        }));
        //

        _this.subscribeTo("StartBackNavigation", function (ev) {
            if (_this.selectedTaskView() !== null) {
                _this.selectedTaskView.deactivate(true);
            }
            _this.projectView(null);
            ko.postbox.publish("BackNavigationCompleted");
        });

        _this.subscribeTo("TaskDeleted", function (data) {
            var task = _.find(_this.details.tasks(), function (t) {
                return t.id() === ko.unwrap(data.taskId);
            });
            if (!task) {
                return;
            }
            task.isDeleted(true);
            return _this.loadProjectDetail();
        });

        _this.subscribeTo("TaskArchived", function (data) {
            var task = _.find(_this.details.tasks(), function (t) {
                return t.id() === ko.unwrap(data.taskId);
            });
            if (!task) {
                return;
            }
            task.isArchived(true);
            return _this.loadProjectDetail();
        });

        _this.subscribeTo("TaskMoved", function (data) {
            var taskId = ko.unwrap(data.taskId);
            var task = _.find(_this.details.tasks(), function (t) {
                return t.id() === taskId;
            });
            if (!task) {
                return;
            }
            task.parentTaskId(data.parentTaskId);
            task.parentTaskIds.replace(data.oldParentTaskId, data.parentTaskId);
            var childTasks = [];
            if (!data.oldParentTaskId) { // is root level
                task.parentTaskIds.push(data.parentTaskId);
                childTasks = _.filter(_this.details.tasks(), function (t) {
                    return _.contains(t.parentTaskIds(), taskId);
                });
                if (!childTasks) {
                    return;
                }
                _.each(childTasks, function (t) {
                    t.parentTaskIds.push(data.parentTaskId);
                });
            } else {

                childTasks = _.filter(_this.details.tasks(), function (t) {
                    return _.contains(t.parentTaskIds(), taskId);
                });
                if (!childTasks) {
                    return;
                }
                _.each(childTasks, function (t) {
                    t.parentTaskIds.replace(data.oldParentTaskId, data.parentTaskId);
                });
            }


        });

        _this.subscribeTo("NewTaskCreated", function (data) {
            _this.lastProcessedEventRequestId = data.requestId;
            window.setTimeout(function () {
                var taskData = data.taskData;
                var requestId = data.requestId;
                var parentTask = _.find(_this.details.tasks(), function (t) {
                    return t.id() === taskData.parentTaskId;
                });
                taskData.isBlocked = false;
                taskData.isArchived = false;
                var mapped;
                if (parentTask) {
                    mapped = ko.mapping.fromJS(taskData);
                    mapped.parentTaskIds = ko.observableArray([]);
                    mapped.parentTaskIds.push(parentTask.id());
                    _.each(parentTask.parentTaskIds(), function (p) {
                        mapped.parentTaskIds.push(p);
                    });

                    _this.details.tasks.push(mapped);
                } else {
                    mapped = ko.mapping.fromJS(taskData);
                    mapped.parentTaskIds = ko.observableArray([]);
                    _this.details.tasks.push(mapped);
                }
            }, 100);
        });

        _this.subscribeTo("TaskCustomFieldUpdated", function (data) {
            if (!data) {
                return;
            }
            var task = _this.findTask(data.taskId);
            if (!task) {
                return;
            }

            var el = _.find(ko.unwrap(task.customFields), function (it) {
                return ko.unwrap(it.id) === data.id;
            });
            if (el) {
                if (typeof data.value === "undefined") {
                    task.customFields.remove(el);
                } else {
                    el.value(data.value); //
                }
            } else {
                task.customFields.push({
                    id: data.id,
                    value: ko.observable(data.value)
                });
            }
            _this.lastProcessedEventRequestId = data.requestId;
        });

        _this.subscribeTo("TaskPropertiesUpdated", function (data) {
            if (!data) {
                return;
            }
            var task = _this.findTask(data.taskId);
            if (!task) {
                return;
            }

            var val = ko.unwrap(data.value);
            var property = data.property;

            if (!task[property]) {
                return;
            }

            task[property](val);
            _this.lastProcessedEventRequestId = data.requestId;
        });


        _this.subscribeTo("ProjectUpdated", function (parameters) {
            _this.loadProjectDebounced();
        });

        _this.subscribeTo("TaskCreated", function (data) {
            var taskId = data.taskId;
            var requestId = data.requestId;
            if (_this.lastProcessedEventRequestId !== data.requestId) {
                return;
            }
            _this.lastProcessedEventRequestId = null; // set to empty for prevent duplicate event handling
            _this.loadingTask(true);
            if (_this.selectedTaskId() === taskId) {
                return false;
            }
            if (_this.selectedTaskView && _this.selectedTaskView.canDeactivate(true) === false) {
                return false;
            }

            var hash = String.format("#projects/{0}/tasks/{1}", _this.projectId, taskId);
            router.navigate(hash, false);

            return _this.selectTask(taskId);
        });

        _this.subscribeTo("TaskSelected", function (evnt) {
            var hash = String.format("#projects/{0}/tasks/{1}", evnt.projectId, evnt.taskId);
            _this.selectTask(evnt.taskId);
        });

        var v = amplify.store(String.format("project/{0}/tree/visibility", _this.projectId));
        _this.displayTasks(typeof v === "undefined" ? true : v);

        var activeRoute = router.activeInstruction();
        var isActivities = activeRoute.config.moduleId === "activity/activities";
        if (!_this.selectedTaskId()) {
            if (!utils.browser.isXsMobileScreen() || isActivities) {
                _this.loadProjectDetail();
            }
        }
    };

    ctor.prototype.detached = function () {
        var _this = this;
        _.each(_this.subscribers, function (subscriber) {
            subscriber.dispose();
        });
    }

    ctor.prototype.compositionComplete = function (child, parent, settings) {
        // after composition complete
        $(parent).find("#dropdown-description").click(function () {
            var button = $(this);
            var dropdown = $(".dropdown-description-menu");

            var dropDownTop = (button.offset().top - window.scrollY) + button.outerHeight();
            dropdown.css("position", "fixed");
            dropdown.css("top", dropDownTop + "px");
            dropdown.css("left", button.offset().left + "px");
        });


    };

    ctor.prototype.isStatusFilterInUse = function () {
        var _this = this;
        return _this.filter.selectedStatus().length === _this.lookups.taskStatus.getAll().length;
    }

    ctor.prototype.isWorkItemFilterInUse = function () {
        var _this = this;
        return _this.filter.selectedTaskType().length === _this.lookups.taskType.getAll().length;
    }

    ctor.prototype.isCustomFieldFilterInUse = function () {
        var _this = this;
        return _this.viewOptions.selectedCustomFields().length === _this.customFieldDefinations().length;
    }


    return ctor;


});

//
// showTags: ko.observable(false),
//     showStartDate: ko.observable(false),
//     showCompletionPercentage: ko.observable(false),
//     showOwner: ko.observable(false),
//     showIsBlocked: ko.observable(false),
//     selectedCustomFields: ko.observableArray([])
