define(["i18n", "plugins/dialog", "common/utils", "common/lookups", "durandal/events", "common/errorhandler", "common/autocomplete", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore", "common/context"],
    function (i18n, dialog, utils, lookupFactory, events, errorhandler, autocomplete, system, http, router, app, activator, ko, $, _, context) {

        var ctor = function () {
            errorhandler.includeIn(this);
            var self = this;
            self.savedSearches = ko.observableArray([]);
            self.lookups = lookupFactory.create();
            self.context = context;
            self.results = ko.observableArray();
            self.reportModules = ko.observableArray();
           self.selectedReport= ko.observable();
            self.activeModuleVm = activator.create();
            self.selectedSearchModule = ko.observable(null);
            self.selectedModuleVmData = ko.observable();
            self.selectedSearchModuleName = ko.observable(i18n.t("app:pages.dashboard.title"));
            self.isGanttActive=ko.observable(false);
        
            self.selectedSearchModule.subscribe(function (newValue) {
                if (newValue !== null) {
                    if (newValue.hasOwnProperty("isContainer") && newValue.isContainer !== false) {
                        self.selectedSearchModuleName(newValue.name());
                    }
                    else if (newValue.hasOwnProperty("isContainer") === false) {
                        self.selectedSearchModuleName(newValue.name());
                    }
                    else {
                        self.selectedSearchModuleName(i18n.t("app:pages.dashboard.title"));
                    }

                }
                else {
                    self.selectedSearchModuleName(i18n.t("app:pages.dashboard.title"));
                }
            });

            self.getDefaultSearchModule = function () {
                var result = {};
                var lst = self.savedSearches();
                var defaultSearchList = _.filter(lst, function (s) {
                    if (s && s.hasOwnProperty("isDefault") && s.isDefault === true) {
                        return s;
                    }
                });

                if (defaultSearchList && defaultSearchList.length > 0) {
                    result = defaultSearchList[0];
                }

                return result;
            };


            self.topMenuSearches = ko.computed(function () {
                var topMenuSearchList = _.filter(self.savedSearches(), function (s) {

                    if (s.hasOwnProperty("isContainer") && s.isContainer === true) {
                        return s;
                    }
                    else if (s.hasOwnProperty("isContainer") === false) {
                        return s;
                    }
                });
                return topMenuSearchList;
            });


            self.subMenuSearchList = ko.computed(function () {
                var selectedSearchModule = ko.unwrap(self.selectedSearchModule);
                if (selectedSearchModule !== null && selectedSearchModule.hasOwnProperty("isCustomModule")) {
                    var topMenuSearchList = _.filter(self.savedSearches(), function (s) {

                        if (s.hasOwnProperty("isContainer") && s.isContainer === false) {
                            return s;
                        }

                    });
                    return topMenuSearchList;
                }
                else {
                    return [];
                }
            });


            var dashboardModule = {
                text: i18n.t("app:pages.dashboard.dashboardModuleText"),
                path: "search/report/task-report-module-from-search",
                groupBy: null,
                icon: "icon fa-pie-chart"
            };

            var calendarModule = {
                text: i18n.t("app:pages.dashboard.calendarModuleText"),
                path: "search/calendar/task-calendar-fromsearch",
                groupBy: null,
                icon: "icon fa-calendar"
            };


            var ganttModuleByNone = {
                text: i18n.t("app:pages.dashboard.ganttByNoneModuleText"),
                path: "search/gantt/gantt-from-search",
                groupBy: "none"
            };

            var ganttModuleByProject = {
                text: i18n.t("app:pages.dashboard.ganttByProjectModuleText"),
                path: "search/gantt/gantt-from-search",
                groupBy: "projectId"
            };

            var ganttModuleByStatus = {
                text: i18n.t("app:pages.dashboard.ganttByStatusModuleText"),
                path: "search/gantt/gantt-from-search",
                groupBy: "status"
            };

            var ganttModuleByAssignee = {
                text: i18n.t("app:pages.dashboard.ganttByAssigneeModuleText"),
                path: "search/gantt/gantt-from-search",
                groupBy: "assignee"
            };

            var listModule = {
                text: i18n.t("app:pages.dashboard.listModuleText"),
                path: "search/report/report-list-module",
                groupBy: null,
                icon: "icon fa-list"
            };
            self.reportModules.push.apply(self.reportModules, [dashboardModule, calendarModule, ganttModuleByNone, ganttModuleByProject, ganttModuleByStatus, ganttModuleByAssignee, listModule]);
        };


        ctor.prototype.getReportModulesByTextMatch = function (txt, getContains) {
            var self = this;
            var modules = self.reportModules();

            var filteredModules = _.filter(modules, function (m) {
                var mdlName = m.text.toLowerCase();
                var searchText = txt.toLowerCase();
                var searchResult = mdlName.indexOf(searchText);


                if (getContains === true) {
                    return searchResult >= 0;
                }
                else {
                    return searchResult < 0;
                }
            });

            return filteredModules;
        };

        ctor.prototype.activate = function (parameters) {
            var _this = this;
            var url = String.format("/api/search?userId={0}", context.user().id);
            return http.get(url).then(function (response) {
                _.each(response, function (r) {
                    r.isStarred = ko.observable(r.isStarred);
                    r.name = ko.observable(r.name);
                    r.description = ko.observable(r.description);
                    r.isSelected = ko.observable(false);
                });
                _this.fillSavedSearches(response);

                var getDefaultSearch = _this.getDefaultSearchModule();
                if (getDefaultSearch) {
                    return _this.selectSearchSet(getDefaultSearch);
                }
                return true;
            }).fail(_this.handleError);

        };

        ctor.prototype.fillSavedSearches = function (list) {
            var _this = this;
            _this.savedSearches([]);

            // My DashBoard

            var myDahboardCriteria = _this.criteriaObjectFactory(0);
            var myDashboard = {
                name: ko.observable(i18n.t("app:pages.dashboard.dashboardCriteriaName")),
                criteria: [myDahboardCriteria],
                isCustomModule: true,
                isContainer: true
            };

            // MyTasks
            var myTasksdCriteria = _this.criteriaObjectFactory(0);
            var myTasks = {
                name: ko.observable(i18n.t("app:pages.dashboard.assigneeCriteriaName")),
                criteria: [myTasksdCriteria],
                isCustomModule: true,
                isContainer: false,
                css: "btn-primary",
                isDefault: true
            };

            // Coassignee Contains Me
            var tasksCoassigneeContainsMeCriteria = _this.criteriaObjectFactory(1);
            var tasksCoassigneeContainsMe = {
                name: ko.observable(i18n.t("app:pages.dashboard.coAssigneeCriteriaName")),
                criteria: [tasksCoassigneeContainsMeCriteria],
                isCustomModule: true,
                isContainer: false,
                css: "btn-primary"
            };

            // Task owner me
            var tasksOwnerMeCriteria = _this.criteriaObjectFactory(2);
            var tasksOwnerMe = {
                name: ko.observable(i18n.t("app:pages.dashboard.ownerCriteriaName")),
                criteria: [tasksOwnerMeCriteria],
                isCustomModule: true,
                isContainer: false,
                css: "btn-primary"
            };


            // My Meetings
            var myMeetingsCriteria = _this.criteriaObjectFactory(3);
            var myMeetings = {
                name: ko.observable(i18n.t("app:pages.dashboard.meetingsCriteriaName")),
                criteria: [myMeetingsCriteria],
                isCustomModule: true,
                isContainer: false,
                css: "btn-primary",
                searchSetType: "Meetings"
            };

            _this.savedSearches.push.apply(_this.savedSearches, [myDashboard, myTasks, tasksCoassigneeContainsMe, tasksOwnerMe, myMeetings]);
            _this.savedSearches.push.apply(_this.savedSearches, list);
            var searchList = _this.subMenuSearchList();
        };


        ctor.prototype.setGroupButtonCss=function() {
            var self=this;
            self.isGanttActive(true);
        }
        ctor.prototype.processGanttModuleActiveStatus=function(tempSelectedModuleVmData) {
            var self=this;

            var mdlText = (tempSelectedModuleVmData && tempSelectedModuleVmData.text) ? tempSelectedModuleVmData.text.toLowerCase() : "";
            if (mdlText) {
                var subs = mdlText.indexOf("gantt");
                if (subs > -1) {
                    self.isGanttActive(true);
                }
                else {
                    self.isGanttActive(false);
                }

            }
            else {
                self.isGanttActive(false);
            }
        };

        ctor.prototype.getActiveModuleButtonCss = function (mdl) {

            var self = this;
            var tempSelectedModuleVmData = ko.unwrap(self.selectedModuleVmData);

            if (mdl === tempSelectedModuleVmData) {
                return true;
            }

        }

        ctor.prototype.activateModule = function (mdl) {
            var self = this;
            self.processGanttModuleActiveStatus(mdl);
            if (mdl) {
                self.selectedModuleVmData(mdl);
            }
            var defer = $.Deferred();

            function loadModule(moduleVmName, module) {
                return system.acquire(moduleVmName)
                    .then(function (m) {
                        // deactivatePreviousModule();
                        return m;
                    });
            }

            defer = loadModule(mdl.path).then(function (m) {

                var data = self.results();

                // var myObject = new m(["1"]);
                var myObject = null;

                switch (mdl.groupBy) {
                case "assignee":
                    myObject = new m(data, "assignee");
                    break;
                case "projectId":
                    myObject = new m(data, "projectId");
                    break;
                case "status":
                    myObject = new m(data, "status");
                    break;
                case "none":
                    myObject = new m(data, "none");
                    break;
                default:
                    myObject = new m(data);
                }

                if (myObject === null) {
                    myObject = new m(data);
                }
                // var o = system.resolveObject(m);
                var settings = {
                    dataSet: []
                };
                return self.activeModuleVm.activateItem(myObject, settings);
            });

            defer.then(function () {

            });

            if (defer && defer.resolve) {
                defer.resolve(true);
            }

        };


        ctor.prototype.canActivate = function () {
            return true;
        };

        ctor.prototype.attached = function () {
            var self = this;

            ko.postbox.publish("DashboardActivated", {});
        };


        ctor.prototype.cancel = function () {
            dialog.close(this);
        };


        ctor.prototype.canDeactivate = function (isClose) {
            return true;
        };

        ctor.prototype.deactivate = function (isClose) {

        };

        ctor.prototype.searchData = function (crt, defaultModuleNumber) {
            var _this = this;
            var userId = _this.context.user().id;

            if (defaultModuleNumber === null) {
                defaultModuleNumber = 0;
            }
            var criteria = [];
            if (crt === null) {
                criteria = [{
                    taskName: "",
                    projectName: "",
                    collaborators: [],
                    assignees: [userId],
                    coassignees: [],
                    owners: [],
                    coowners: [],
                    cat1followers: [],
                    cat2followers: [],
                    cat3followers: [],
                    taskTypes: ["0"],
                    activityPeriodType: "WithinLast",
                    startDatePeriodType: "WithinNext",
                    startDatePeriodUnit: "days",
                    dueDatePeriodType: "WithinNext",
                    dueDatePeriodUnit: "days",
                    status: ["64", "8", "4", "2", "1", "0"],
                    priorities: [],
                    categories: [],
                    isBlocked: false,
                    tags: [],
                    tagOperation: "or",
                    selectedCustomFieldIds: [],
                    selectedCustomFields: [],
                    customFieldOperation: "or",
                    isDirty: true
                }];
            }
            else {
                criteria = [crt];
            }


            var url = "/api/search/tasks";

            http.post(url, criteria)
                .then(function (response) {
                    var results = response.results;
                    _this.results([]);
                    _this.results.push.apply(_this.results, results);
                    _this.activateModule(_this.reportModules()[defaultModuleNumber]);
                });
        };


        ctor.prototype.criteriaObjectFactory = function (criteriaId) {
            var self = this;
            var userId = self.context.user().id;
            var chriteriaObject = {};
            var myTasks = 0;
            var tasksCoassigneeContainsMe = 1;
            var tasksOwnerMe = 2;
            var myMeetings = 3;

            switch (criteriaId) {

            case 0:
                chriteriaObject = {
                    taskName: "",
                    projectName: "",
                    collaborators: [],
                    assignees: [userId],
                    coassignees: [],
                    owners: [],
                    coowners: [],
                    cat1followers: [],
                    cat2followers: [],
                    cat3followers: [],
                    taskTypes: ["0"],
                    activityPeriodType: "WithinLast",
                    startDatePeriodType: "WithinNext",
                    startDatePeriodUnit: "days",
                    dueDatePeriodType: "WithinNext",
                    dueDatePeriodUnit: "days",
                    status: ["64", "8", "4", "2", "1", "0"],
                    priorities: [],
                    categories: [],
                    isBlocked: false,
                    tags: [],
                    tagOperation: "or",
                    selectedCustomFieldIds: [],
                    selectedCustomFields: [],
                    customFieldOperation: "or",
                    isDirty: true
                };
                break;
            case 1:
                chriteriaObject = {
                    taskName: "",
                    projectName: "",
                    collaborators: [],
                    assignees: [],
                    coassignees: [userId],
                    owners: [],
                    coowners: [],
                    cat1followers: [],
                    cat2followers: [],
                    cat3followers: [],
                    taskTypes: ["0"],
                    activityPeriodType: "WithinLast",
                    startDatePeriodType: "WithinNext",
                    startDatePeriodUnit: "days",
                    dueDatePeriodType: "WithinNext",
                    dueDatePeriodUnit: "days",
                    status: ["64", "8", "4", "2", "1", "0"],
                    priorities: [],
                    categories: [],
                    isBlocked: false,
                    tags: [],
                    tagOperation: "or",
                    selectedCustomFieldIds: [],
                    selectedCustomFields: [],
                    customFieldOperation: "or",
                    isDirty: true
                };
                break;
            case 2:
                chriteriaObject = {
                    taskName: "",
                    projectName: "",
                    collaborators: [],
                    assignees: [],
                    coassignees: [],
                    owners: [userId],
                    coowners: [],
                    cat1followers: [],
                    cat2followers: [],
                    cat3followers: [],
                    taskTypes: ["0"],
                    activityPeriodType: "WithinLast",
                    startDatePeriodType: "WithinNext",
                    startDatePeriodUnit: "days",
                    dueDatePeriodType: "WithinNext",
                    dueDatePeriodUnit: "days",
                    status: ["64", "8", "4", "2", "1", "0"],
                    priorities: [],
                    categories: [],
                    isBlocked: false,
                    tags: [],
                    tagOperation: "or",
                    selectedCustomFieldIds: [],
                    selectedCustomFields: [],
                    customFieldOperation: "or",
                    isDirty: true
                };
                break;
            case 3:
                chriteriaObject = {
                    taskName: "",
                    projectName: "",
                    collaborators: [userId],
                    assignees: [],
                    coassignees: [],
                    owners: [],
                    coowners: [],
                    cat1followers: [],
                    cat2followers: [],
                    cat3followers: [],
                    taskTypes: [self.lookups.taskType.EVENT.value],
                    activityPeriodType: "WithinLast",
                    startDatePeriodType: "WithinNext",
                    startDatePeriodUnit: "days",
                    dueDatePeriodType: "WithinNext",
                    dueDatePeriodUnit: "days",
                    status: ["64", "8", "4", "2", "1", "0"],
                    priorities: [],
                    categories: [],
                    isBlocked: false,
                    tags: [],
                    tagOperation: "or",
                    selectedCustomFieldIds: [],
                    selectedCustomFields: [],
                    customFieldOperation: "or",
                    isDirty: true
                };
                break;
            default:
                chriteriaObject = {
                    taskName: "",
                    projectName: "",
                    collaborators: [],
                    assignees: [userId],
                    coassignees: [],
                    owners: [],
                    coowners: [],
                    cat1followers: [],
                    cat2followers: [],
                    cat3followers: [],
                    taskTypes: ["0"],
                    activityPeriodType: "WithinLast",
                    startDatePeriodType: "WithinNext",
                    startDatePeriodUnit: "days",
                    dueDatePeriodType: "WithinNext",
                    dueDatePeriodUnit: "days",
                    status: ["64", "8", "4", "2", "1", "0"],
                    priorities: [],
                    categories: [],
                    isBlocked: false,
                    tags: [],
                    tagOperation: "or",
                    selectedCustomFieldIds: [],
                    selectedCustomFields: [],
                    customFieldOperation: "or",
                    isDirty: true
                };
            }

            return chriteriaObject;
        };

        ctor.prototype.selectSearchSet = function (searchSet) {
            var self = this;
            self.activeModuleVm.deactivate(true);

            var requiredIdText = "";
            var dashBoardModuleName = ko.unwrap(self.reportModules()[0].text);
            requiredIdText = "#" + dashBoardModuleName + "ModuleId";
            if (searchSet.hasOwnProperty("searchSetType") === true && ko.unwrap(searchSet.searchSetType) === "Meetings") {
                $(requiredIdText).hide();
            }
            else {
                $(requiredIdText).show();
            }


            if (searchSet && searchSet.hasOwnProperty("criteria") && searchSet.criteria.length > 0) {
                self.selectedSearchModule(searchSet);
                var chriteria = searchSet.criteria[0];

                var searchSetName = ko.unwrap(searchSet.name);
                var searchSetType = "";
                self.selectedReport(searchSetName);
                if (searchSet.hasOwnProperty("searchSetType") === true) {
                    searchSetType = ko.unwrap(searchSet.searchSetType);
                }

                var defaultReportModuleNum = 0;
                if (searchSet.hasOwnProperty("searchSetType") === true && searchSetType === "Meetings") {
                    defaultReportModuleNum = 1;
                }


                return self.searchData(chriteria, defaultReportModuleNum);
            }
            else {
                self.selectedSearchModule(null);
                return self.searchData(null, 0);
            }

        };




        ctor.prototype.getButtonCss = function (subSet) {
            var self = this;
            var selectedData = ko.unwrap(self.selectedSearchModule);
            if (subSet === selectedData) {
                return true;
            }
            else {
                return false;
            }
        };
        return ctor;
    });
