define(["moment", "common/lang", "plugins/router", "durandal/events", "durandal/app", "jquery", "plugins/http", "underscore", "common/errorhandler", "common/utils", "knockout", "i18n"],
    function(moment, lang, router, events, app, $, http, _, errorHandler, utils, ko, i18n) {



        var getAll = function(values) {
            return _.filter(_.values(values), function(v) {
                return _.isFunction(v) === false;
            });
        };


        var ctor = function() {
            var _this = this;
            this.languages = [
                { text: i18n.t("app:lookups.languages.turkish"), lang: "tr-tr",code:"tr" ,icon:"flag-icon flag-icon-tr"},
                { text: i18n.t("app:lookups.languages.english"), lang: "en-us",code:"en",icon:"flag-icon flag-icon-gb"}
            ];
            this.taskConstraintTypes = {
                AsSoonAsPossible: { text: i18n.t("app:lookups.taskConstraintType.asSoonAsPossible"), value: 0 },
                AsLateAsPossible: { text: i18n.t("app:lookups.taskConstraintType.asLateAsPossible"), value: 1 },
                FinishNoEarlierThan: { text: i18n.t("app:lookups.taskConstraintType.finishNoEarlierThan"), value: 2 },
                FinishNoLaterThan: { text: i18n.t("app:lookups.taskConstraintType.finishNoLaterThan"), value: 3 },
                MustStartOn: { text: i18n.t("app:lookups.taskConstraintType.mustStartOn"), value: 4 },
                MustFinishOn: { text: i18n.t("app:lookups.taskConstraintType.mustFinishOn"), value: 5 },
                StartNoEarlierThan: { text: i18n.t("app:lookups.taskConstraintType.startNoEarlierThan"), value: 6 },
                StartNoLaterThan: { text: i18n.t("app:lookups.taskConstraintType.startNoLaterThan"), value: 7 },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };

            this.getDefaultCurrencyType = function() {
                var t = this;
                return _.first(_.where(t.currencyTypes, { isDefault: true }));
            };

            this.currencyTypes = [{
                id: 1,
                exchangeRate: 0.00000,
                currencyCode: "TL",
                isDefault: true
            }, {
                id: 2,
                exchangeRate: 2.70000,
                currencyCode: "$",
                isDefault: false
            }, {
                id: 3,
                exchangeRate: 3.02000,
                currencyCode: "€",
                isDefault: false
            }];

            this.commentVoteStatus = {
                ON: { text: i18n.t("app:lookups.commentVoteStatus.on"), value: 1 },
                OFF: { text: i18n.t("app:lookups.commentVoteStatus.off"), value: 0 },
                READONLY: { text: i18n.t("app:lookups.commentVoteStatus.readOnly"), value: 2 },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };

            this.commentViewModes = {
                CHRONOLOGICAL: { text: i18n.t("app:lookups.commentViewMode.chronological"), value: 0, name: "chronological" },
                HIERARCHICAL: { text: i18n.t("app:lookups.commentViewMode.hierarchical"), value: 1, name: "hierarchical" },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };
            this.commentVoteModes = {
                UP: { text: i18n.t("app:lookups.commentVoteMode.up"), value: 0 },
                UpDown: { text: i18n.t("app:lookups.commentVoteMode.upDown"), value: 1 },
                UpWithAnonymous: { text: i18n.t("app:lookups.commentVoteMode.upWithAnonymous"), value: 2 },
                UpDownWithAnonymous: { text: i18n.t("app:lookups.commentVoteMode.upDownWithAnonymous"), value: 4 },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };
            this.commentSortModes = {
                Newest: { text: i18n.t("app:lookups.commentSortModes.newest"), value: 0 },
                Oldest: { text: i18n.t("app:lookups.commentSortModes.oldest"), value: 1 },
                Best: { text: i18n.t("app:lookups.commentSortModes.best"), value: 2 },
                Position: { text: i18n.t("app:lookups.commentSortModes.position"), value: 4 },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };
            this.customFieldTypes = {
                TEXT: { text: i18n.t("app:lookups.customFieldType.text"), value: 1, canUseDefaultValue: true },
                NUMBER: { text: i18n.t("app:lookups.customFieldType.number"), value: 2, canUseDefaultValue: true },
                DATE: { text: i18n.t("app:lookups.customFieldType.date"), value: 3 },
                DROPDOWN: { text: i18n.t("app:lookups.customFieldType.dropdown"), value: 4, canUseDefaultValue: true },
                USER: { text: i18n.t("app:lookups.customFieldType.user"), value: 5 },
                TASK: { text: i18n.t("app:lookups.customFieldType.task"), value: 6 },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };
            this.projectModules = {
                DETAIL: {
                    text: i18n.t("app:lookups.projectModules.detail"),
                    order: 0,
                    value: 1,
                    defaultActive: true,
                    isModule: false,
                    icon: "icon fa-info-circle",
                    fakeModule: true,
                    queryStringValue:"DETAIL"
                },
                TASKS: {
                    text: i18n.t("app:lookups.projectModules.tasks"),
                    order: 1,
                    value: 100,
                    icon: "icon fa-sitemap",
                    defaultActive: true,
                    fakeModule: true,
                    queryStringValue:"TASKS"
                },
                LINKED_TASKS: {
                    text: i18n.t("app:lookups.projectModules.linkedTasks"),
                    order: 2,
                    value: 200,
                    icon: "icon fa-link",
                    defaultActive: true,
                    queryStringValue:"LINKEDTASKS"
                },
                TIMELOGS: {
                    text: i18n.t("app:lookups.projectModules.timeLogs"),
                    order: 3,
                    value: 900,
                    icon: "icon fa-clock-o",
                    defaultActive: true,
                    queryStringValue:"TIMELOGS"
                },
                ATTACHMENTS: {
                    text: i18n.t("app:lookups.projectModules.attachments"),
                    order: 3,
                    value: 600,
                    icon: "icon fa-paperclip",
                    defaultActive: true,
                    queryStringValue:"ATTACHMENTS"
                },
                TODOS: {
                    text: i18n.t("app:lookups.projectModules.todos"),
                    order: 3,
                    value: 400,
                    icon: "icon fa-check-circle",
                    defaultActive: true,
                    queryStringValue:"TODOS"
                },
                EXPENSE_TRACKING: {
                    text: i18n.t("app:lookups.projectModules.expenseTracking"),
                    order: 4,
                    value: 1000,
                    icon: "icon fa-money",
                    defaultActive: true,
                    queryStringValue:"EXPENSELIST"
                },
                CUSTOM_FIELDS: {
                    text: i18n.t("app:lookups.projectModules.customFields"),
                    order: 5,
                    value: 1100,
                    icon: "icon fa-plug",
                    defaultActive: true,
                    queryStringValue:"CUSTOMFIELDS"
                },
                GANTT: {
                    text: i18n.t("app:lookups.projectModules.gantt"),
                    order: 6,
                    value: 1200,
                    icon: "icon fa-bar-chart",
                    defaultActive: true,
                    queryStringValue:"GANTTCHART"
                },
                CALENDAR: {
                    text: i18n.t("app:lookups.projectModules.calendar"),
                    order: 7,
                    value: 1300,
                    icon: "icon fa-calendar",
                    defaultActive: true,
                    queryStringValue:"CALENDAR"
                },
                PROJECT_REPORT: {
                    text: i18n.t("app:lookups.projectModules.projectReport"),
                    order: 8,
                    value: 1400,
                    icon: "icon fa-pie-chart",
                    defaultActive: true,
                    queryStringValue:"REPORT"
                },
                HISTORY: {
                    text: i18n.t("app:lookups.projectModules.history"),
                    order: 10,
                    value: 800,
                    icon: "icon fa-history",
                    defaultActive: true,
                    queryStringValue:"HISTORY"
                },
                TABLES: {
                    text: i18n.t("app:lookups.projectModules.tables"),
                    order: 8,
                    value: 700,
                    icon: "icon fa-table",
                    defaultActive: true,
                    queryStringValue:"TABLES"
                },
                ACCESS_LIST: {
                    text: i18n.t("app:lookups.projectModules.accessList"),
                    order: 10,
                    value: 200,
                    icon: "icon fa-shield",
                    defaultActive: true,
                    queryStringValue:"ACCESSLIST"
                },
                TAG_CLOUD: {
                    text: i18n.t("app:lookups.projectModules.accessList"),
                    order: 10,
                    value: 780,
                    icon: "icon fa-tags",
                    defaultActive: true,
                    queryStringValue:"TAGS"
                },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                },
                getOnlyNonDefaults: function() {
                    return getAll(_.filter(this, function(m) {
                        return (m.defaultActive || false) === false;
                    }));
                }
            };
            this.taskModules = {
                DETAIL: {
                    text: i18n.t("app:lookups.taskModules.detail"),
                    order: 0,
                    value: 1,
                    defaultActive: true,
                    isModule: false,
                    icon: "icon fa-info-circle",
                    fakeModule: true,
                    queryStringValue:"DETAIL"
                },
                ACCESS_LIST: {
                    text: i18n.t("app:lookups.taskModules.accessList"),
                    order: 10,
                    value: 200,
                    icon: "icon fa-shield",
                    selectOnTaskCreation: true,
                    queryStringValue:"ACCESSLIST"
                },
                SUB_TASKS: {
                    text: i18n.t("app:lookups.taskModules.subTasks"),
                    order: 7,
                    value: 100,
                    icon: "icon fa-sitemap",
                    selectOnTaskCreation: true,
                    queryStringValue:"SUBTASKS"
                },
                LINKED_TASKS: {
                    text: i18n.t("app:lookups.taskModules.linkedTasks"),
                    order: 6,
                    value: 150,
                    icon: "icon fa-link",
                    defaultActive: true,
                
                    queryStringValue:"LINKEDTASKS"
                },
                COMMENTS: {
                    text: i18n.t("app:lookups.taskModules.comments"),
                    order: 1,
                    value: 300,
                    selectOnTaskCreation: true,
                    icon: "icon wb-chat",
                    queryStringValue:"COMMENTS"
                },
                TODOS: {
                    text: i18n.t("app:lookups.taskModules.todos"),
                    value: 400,
                    order: 3,
                    selectOnTaskCreation: true,
                    icon: "icon fa-check-circle",
                    queryStringValue:"TODOS"
                },
                NOTES: {
                    text: i18n.t("app:lookups.taskModules.notes"),
                    order: 5,
                    value: 500,
                    selectOnTaskCreation: true,
                    icon: "icon fa-file-text",
                    queryStringValue:"NOTES"
                },
                ATTACHMENTS: {
                    text: i18n.t("app:lookups.taskModules.attachments"),
                    order: 2,
                    value: 600,
                    selectOnTaskCreation: true,
                    icon: "icon fa-paperclip",
                    queryStringValue:"ATTACHMENTS"
                },
                TABLES: {
                    text: i18n.t("app:lookups.taskModules.tables"),
                    order: 4,
                    value: 700,
                    selectOnTaskCreation: true,
                    icon: "icon fa-table",
                    queryStringValue:"TABLES"
                },
                HISTORY: {
                    text: i18n.t("app:lookups.taskModules.history"),
                    order: 10,
                    value: 800,
                    icon: "icon fa-history",
                    selectOnTaskCreation: true,
                    queryStringValue:"HISTORY"
                },
                TIMELOGS: {
                    text: i18n.t("app:lookups.taskModules.timeLogs"),
                    order: 8,
                    value: 900,
                    icon: "icon fa-clock-o",
                    queryStringValue:"TIMELOGS"
                },
                EXPENSE_TRACKING: {
                    text: i18n.t("app:lookups.taskModules.expenseTracking"),
                    order: 9,
                    value: 1000,
                    icon: "icon fa-money",
                    queryStringValue:"EXPENSELIST"
                },
                GANTT_CHART: {
                    text: i18n.t("app:lookups.taskModules.ganttChart"),
                    order: 10,
                    value: 1200,
                    icon: "icon fa-bar-chart",
                    queryStringValue:"GANTTCHART"
                },
                CALENDAR: {
                    text: i18n.t("app:lookups.taskModules.calendar"),
                    order: 11,
                    value: 1300,
                    icon: "icon fa-calendar",
                    queryStringValue:"CALENDAR"
                },
                TASK_REPORT: {
                    text: i18n.t("app:lookups.taskModules.taskReport"),
                    order: 12,
                    value: 1400,
                    icon: "icon fa-pie-chart",
                    queryStringValue:"REPORT"
                },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                },
                getOnlyNonDefaults: function() {
                    return getAll(_.filter(this, function(m) {
                        return (m.defaultActive || false) === false;
                    }));
                },
                getDefaultSelecteds: function() {
                    return getAll(_.where(this, { selectOnTaskCreation: true }));
                }
            };


            this.taskSubscriptionTypes = {
                NONE: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.none.text"),
                    value: 0,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.none.alias"),
                    includeSubTasks: false,
                    icon: "icon fa-circle-o"
                },
                LOW: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.low.text"),
                    value: 1,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.low.alias"),
                    includeSubTasks: false,
                    icon: "icon wb-small-point"
                },
                MEDIUM: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.medium.text"),
                    isDefault: true,
                    value: 2,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.medium.alias"),
                    includeSubTasks: false,
                    icon: "icon wb-medium-point"
                },
                HIGH: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.high.text"),
                    value: 4,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.high.alias"),
                    includeSubTasks: false,
                    icon: "icon wb-large-point"
                },

                NONE_WITHSUBTASK: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.noneWithSubTasks.text"),
                    value: 0,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.noneWithSubTasks.alias"),
                    includeSubTasks: true,
                    icon: "icon fa-circle-o"
                },
                LOW_WITHSUBTASK: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.lowWithSubTasks.text"),
                    value: 1,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.lowWithSubTasks.alias"),
                    includeSubTasks: true,
                    icon: "icon wb-medium-point"
                },
                MEDIUM_WITHSUBTASK: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.mediumWithSubTasks.text"),
                    isDefault: true,
                    value: 2,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.mediumWithSubTasks.alias"),
                    includeSubTasks: true
                },
                HIGH_WITHSUBTASK: {
                    text: i18n.t("app:lookups.taskSubscriptionTypes.highWithSubTasks.text"),
                    value: 4,
                    alias: i18n.t("app:lookups.taskSubscriptionTypes.highWithSubTasks.alias"),
                    includeSubTasks: true,
                    icon: "icon wb-large-point"
                },
                getAll: function() {
                    return getAll(this);
                },
                isSelected: function(value) {
                    value = ko.unwrap(value) || false;
                    if (value === false)
                        return false;
                    else {
                        var all = getAll(this);
                        var s = _.find(all, function(item) {
                            return item.value == value;
                        });
                        if (s)
                            return true;
                        return false;
                    }
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };


            this.categories = {
                NONE: { text: "<i class=\"fa fa-bookmark-o\"></i>", value: 0 },
                CATEGORY1: { text: "<i class=\"text-warning fa fa-bookmark\"></i>", value: 1 },
                CATEGORY2: { text: "<i class=\"text-danger fa fa-bookmark\"></i>", value: 2 },
                CATEGORY3: { text: "<i class=\"text-info fa fa-bookmark\"></i>", value: 3 },
                CATEGORY4: { text: "<i class=\"text-success fa fa-bookmark\"></i>", value: 4 },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };


            this.starDesigns = {
                DEFAULT: { text: "<span class=\"icon fa-star-o\"></span>", value: "default" },
                DESIGN1: { text: "<span class=\"text-success icon fa-star\"></span>", value: "design1" },
                DESIGN2: { text: "<span class=\"text-warning icon fa-star\"></span>", value: "design2" },
                DESIGN3: { text: "<span class=\"text-danger  icon fa-star\"></span>", value: "design3" },
                getAll: function() {
                    return getAll(this);
                }
            };


            this.taskStatus = {
                NONE: { text: i18n.t("app:lookups.taskStatus.none"), value: 0, color: "gri", icon: "icon fa-circle-o" },
                NOTSTARTED: {
                    text: i18n.t("app:lookups.taskStatus.notStarted"),
                    value: 1,
                    color: "sari",
                    icon: "icon fa-step-forward"
                },
                ONHOLD: { text: i18n.t("app:lookups.taskStatus.onHold"), value: 2, color: "gri", icon: "icon fa-pause" },
                INPROGRESS: {
                    text: i18n.t("app:lookups.taskStatus.inProgress"),
                    value: 4,
                    color: "mavi",
                    icon: "icon fa-hourglass-2"
                },
                INPLANNING: {
                    text: i18n.t("app:lookups.taskStatus.inPlanning"),
                    value: 8,
                    color: "sari",
                    icon: "icon fa-pencil"
                },
                CANCELLED: {
                    text: i18n.t("app:lookups.taskStatus.cancelled"),
                    value: 16,
                    color: "gri",
                    icon: "icon fa-close"
                },
                COMPLETED: {
                    text: i18n.t("app:lookups.taskStatus.completed"),
                    value: 32,
                    color: "yesil",
                    icon: "icon fa-check"
                },
                WAITINGFORAPPROVAL: {
                    text: i18n.t("app:lookups.taskStatus.waitingForApproval"),
                    value: 64,
                    color: "yesil",
                    icon: "icon fa-pencil-square-o"
                },
                getTextOrDefault: function(v) {
                    var v = this.get(v);
                    if (v) {
                        return v.text;
                    }
                    return "";
                },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    v = typeof v === "string" ? parseInt(v, 10) : v;
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };

            this.projectTypes = {
                HIE: { text: i18n.t("app:lookups.projectType.hie"), value: 1, isTeamBased: false },
                HIE2: { text: i18n.t("app:lookups.projectType.hie2"), value: 2, isTeamBased: false },
                TEAM: { text: i18n.t("app:lookups.projectType.team"), value: 3, isTeamBased: true },
                TEAM2: { text: i18n.t("app:lookups.projectType.team2"), value: 4, isTeamBased: true },
                MAIL_LIKE: { text: i18n.t("app:lookups.projectType.mailLike"), value: 5, isTeamBased: false },
                PERSONAL: { text: i18n.t("app:lookups.projectType.personal"), value: 6, isTeamBased: false },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };
            this.taskType = {
                TASK: { text: i18n.t("app:lookups.taskType.task"), value: 0, icon: "icon fa-list", name: "task", style: { backgroundColor: "" } },
                SECTION: { text: i18n.t("app:lookups.taskType.section"), value: 1, icon: "icon fa-bars", name: "section", style: { backgroundColor: "" } },
                EVENT: { text: i18n.t("app:lookups.taskType.event"), value: 2, icon: "icon fa-calendar-plus-o", name: "event", style: { backgroundColor: "#f7fae1" } },
                MILESTONE: { text: i18n.t("app:lookups.taskType.milestone"), value: 3, icon: "icon fa-square",iconStyle: {transform: "rotate(45deg)"}, style: { backgroundColor: "#edf0ff"  }, name: "milestone" },
                ONGOINGTASK: { text: i18n.t("app:lookups.taskType.ongoingTask"), value: 4, icon: "icon fa-refresh", name: "ongoingtask", style: { backgroundColor: "#f8f0de" } },
                INFO: { text: i18n.t("app:lookups.taskType.info"), value: 5, icon: "icon fa-info-circle", name: "info", style: { backgroundColor: "#f1fcf2" } },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };

            this.taskPriority = {
                LOW: { value: 0, text: i18n.t("app:lookups.taskPriority.low") },
                NORMAL: { value: 1, text: i18n.t("app:lookups.taskPriority.normal") },
                HIGH: { value: 2, text: i18n.t("app:lookups.taskPriority.high") },
                CRITICAL: { value: 4, text: i18n.t("app:lookups.taskPriority.critical") },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };

            this.projectStatus = {
                NONE: { text: i18n.t("app:lookups.projectStatus.none"), value: 0, color: "gri", icon: "icon fa-circle-o" },
                NOTSTARTED: {
                    text: i18n.t("app:lookups.projectStatus.notStarted"),
                    value: 1,
                    color: "sari",
                    icon: "icon fa-step-forward"
                },
                ONHOLD: { text: i18n.t("app:lookups.projectStatus.onHold"), value: 2, color: "gri", icon: "icon fa-pause" },
                INPROGRESS: {
                    text: i18n.t("app:lookups.projectStatus.inProgress"),
                    value: 4,
                    color: "mavi",
                    icon: "icon fa-hourglass-2"
                },
                INPLANNING: {
                    text: i18n.t("app:lookups.projectStatus.inPlanning"),
                    value: 8,
                    color: "sari",
                    icon: "icon fa-pencil"
                },
                CANCELLED: {
                    text: i18n.t("app:lookups.projectStatus.cancelled"),
                    value: 16,
                    color: "gri",
                    icon: "icon fa-close"
                },
                COMPLETED: {
                    text: i18n.t("app:lookups.projectStatus.completed"),
                    value: 32,
                    color: "yesil",
                    icon: "icon fa-check"
                },
                getTextOrDefault: function(v) {
                    var v = this.get(v);
                    if (v) {
                        return v.text;
                    }
                    return "";
                },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    v = typeof v === "string" ? parseInt(v, 10) : v;
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };




            this.mandatoryOptions = {
                YES: { text: i18n.t("app:lookups.mandatoryOptions.yes"), value: true },
                getAll: function() {
                    return getAll(this);
                }
            };
            this.booleanOptions = {
                YES: { text: i18n.t("app:lookups.booleanOptions.yes"), value: true },
                NO: { text: i18n.t("app:lookups.booleanOptions.no"), value: false },
                getAll: function() {
                    return getAll(this);
                }
            };
            this.dependencies = {
                FINISHTOSTART: { text: i18n.t("app:lookups.dependencies.finishToStart"), value: 1 },
                STARTTOSTART: { text: i18n.t("app:lookups.dependencies.startToStart"), value: 2 },
                FINISHTOFINISH: { text: i18n.t("app:lookups.dependencies.finishToFinish"), value: 4 },
                STARTTOFINISH: { text: i18n.t("app:lookups.dependencies.startToFinish"), value: 8 },
                RELATION: { text: i18n.t("app:lookups.dependencies.relation"), value: 0 },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };
            this.tableFieldTypes = {
                TEXT: { text: i18n.t("app:lookups.tableFieldTypes.text"), value: 0 },
                NUMBER: { text: i18n.t("app:lookups.tableFieldTypes.number"), value: 1 },
                BOOLEAN: { text: i18n.t("app:lookups.tableFieldTypes.boolean"), value: 3 },
                LINK: { text: i18n.t("app:lookups.tableFieldTypes.link"), value: 4 },
                SELECTION: { text: i18n.t("app:lookups.tableFieldTypes.selection"), value: 5 },
                USER: { text: i18n.t("app:lookups.tableFieldTypes.user"), value: 6 },
                ATTACHMENT: { text: i18n.t("app:lookups.tableFieldTypes.attachment"), value: 7 },
                DATE: { text: i18n.t("app:lookups.tableFieldTypes.date"), value: 8 },
                TASK: { text: i18n.t("app:lookups.tableFieldTypes.task"), value: 9 },
                getAll: function() {
                    return getAll(this);
                }
            };

            this.tableSourcesTypes = {
                Project: { text: i18n.t("app:lookups.tableSourcesTypes.project"), value: "project" },
                System: { text: i18n.t("app:lookups.tableSourcesTypes.system"), value: "system" },
                getAll: function() {
                    return getAll(this);
                },
                get: function(v) {
                    return _.first(getAll(_.where(this, { value: ko.unwrap(v) })));
                }
            };
            this.expenseStatus = {
                WAITINGFORAPPROVAL: { text: i18n.t("app:lookups.expenseStatus.waitingForApproval"), value: 0 },
                REJECTED: { text: i18n.t("app:lookups.expenseStatus.rejected"), value: 1 },
                APPROVED: { text: i18n.t("app:lookups.expenseStatus.approved"), value: 2 },
                CANCELLED: { text: i18n.t("app:lookups.expenseStatus.cancelled"), value: 3 },
                getAll: function() {
                    return getAll(this);
                }
            };
            this.timeLogStatus = {
                WAITINGFORAPPROVAL: { text: i18n.t("app:lookups.timeLogStatus.waitingForApproval"), value: 0 },
                REJECTED: { text: i18n.t("app:lookups.timeLogStatus.rejected"), value: 1 },
                APPROVED: { text: i18n.t("app:lookups.timeLogStatus.approved"), value: 2 },
                CANCELLED: { text: i18n.t("app:lookups.timeLogStatus.cancelled"), value: 3 },
                getAll: function() {
                    return getAll(this);
                }
            };
            this.getItem = function(property, value) {
                var vv = ko.unwrap(value);
                var item = _.find(this[property], function(v) {
                    return v.value == vv;
                });
                return item;
            };
            this.getAll = function(lookup) {
                return _.values(this[lookup]);
            };
        };

        var instance = null;


        return {
            create: function() {
                if (instance === null) {
                    instance = new ctor();
                }
                return instance;
            },
            reset: function() {
                instance = null;
            }
        };


        // return new ctor ();
    });
