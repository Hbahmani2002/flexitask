define(["common/kendolib", "common/prefs", "common/autocomplete", "common/helpers", "common/context", "amplify", "plugins/dialog", "i18n", "task/task", "durandal/events", "common/errorhandler",
    "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", 
    "jquery", "underscore", "search/calendar/task-calendar-fromsearch", "search/gantt/gantt-from-search", "search/report/task-report-module-from-search"],
function (kendo, prefs, autocomplete, helpers, context, amplify, dialog, i18n, taskVm, events, errorhandler, system, http, router, app, activator, ko, $, _, calendarVm, ganttVm, reportVm) {


    var ctor = function () {
        errorhandler.includeIn(this);
        var _this = this;
        this.context = context;
        this.prefs = prefs;
        this.autocomplete = autocomplete;
        this.helpers = helpers;

        this.tabs = {
            SAVED: 1,
            TASK: 2,
            ATTACHMENT: 3
        };
        this.shouldShowSearchForm = ko.observable(true);
        this.activeTab = ko.observable(this.tabs.SAVED);
        this.selectedTask = activator.create();
        this.subscriptions = [];

    };

    ctor.prototype.toggleSearchForm = function () {
        var _this = this;
        var status = _this.shouldShowSearchForm();
        status = !status;
        _this.shouldShowSearchForm(status);
    };

    ctor.prototype.activateTab = function (tab) {
        var _this = this;
        _this.shouldShowSearchForm(true);
        _this.activeTab(tab);
        return true;
    };

    ctor.prototype.showTask = function (taskId) {
        var _this = this;
        var taskView = new taskVm(taskId);
        return _this.selectedTask.activateItem(taskView);
    };

    ctor.prototype.showCalendar = function (params) {
        var _this = this;
        var calendarView = new calendarVm(params);
        return _this.selectedTask.activateItem(calendarView);

    };

    ctor.prototype.showOnGantt = function (params) {
        var _this = this;
        var ganttView = new ganttVm(params, "assignee");
        return _this.selectedTask.activateItem(ganttView);
    };

    ctor.prototype.showOnGanttByStatus = function (params) {
        var _this = this;
        var ganttView = new ganttVm(params, "status");
        return _this.selectedTask.activateItem(ganttView);
    };

    ctor.prototype.showOnGanttByProject = function (params) {
        var _this = this;
        var ganttView = new ganttVm(params, "projectId");
        return _this.selectedTask.activateItem(ganttView);
    };

    ctor.prototype.showOnGanttByNone = function (params) {
        var _this = this;
        var ganttView = new ganttVm(params, "none");
        return _this.selectedTask.activateItem(ganttView);
    };

    ctor.prototype.showOnReportChart = function (searchResult) {
        _this = this;
        var chartView = new reportVm(searchResult);
        return _this.selectedTask.activateItem(chartView);
    };


    ctor.prototype.deactivate = function (taskId) {
        var _this = this;
        _.each(_this.subscriptions, function (subscriber) {
            subscriber.dispose();
        });
    };

    ctor.prototype.subscribeTo = function (name, handler) {
        var _this = this;
        _this.subscriptions.push(ko.postbox.subscribe(name, handler));
    };

    ctor.prototype.attached = function (view) {
        var _this = this;

        _this.subscribeTo("StartBackNavigation", function (ev) {

            if (_this.selectedTask() !== null) {
                _this.selectedTask.deactivate(true);
            }
            ko.postbox.publish("BackNavigationCompleted");
        });

        _this.subscribeTo("SearchFinished", function (params) {
            _this.toggleSearchForm();
        });

        _this.subscribeTo("TaskSelected", function (params) {
            _this.showTask(params.taskId);
        });

        _this.subscribeTo("ExportDataCommand", function (params) {
            var exportType = params.exportType;
            var data = params.data;
            if (exportType === "calendar") {
                _this.showCalendar(data);
                return;
            }

            if (exportType === "ganttByAssignee") {
                _this.showOnGantt(data);
                return;
            }

            if (exportType === "ganttByStatus") {
                _this.showOnGanttByStatus(data);
                return;
            }

            if (exportType === "ganttByProject") {
                _this.showOnGanttByProject(data);
                return;
            }

            if (exportType === "gantt") {
                _this.showOnGanttByNone(data);
                return;
            }

            if (exportType === "report") {
                _this.showOnReportChart(data);
                return;
            }
        });



        // set tab if query string contains tab name
        var params = router.activeInstruction().queryParams;
        if (params && params.t) {
            var tabName = params.t.toString().toUpperCase();
            var tab = _this.tabs[tabName];
            if (tab) {
                _this.activateTab(tab);
                if (tab === _this.tabs.SAVED) {
                    if (params.id) {
                       ko.postbox.publish("SearchBySavedSearchId",{ id: params.id});
                    }
                }
            }
        }

        $(view).on("click", ".js--load-task-show-attachment", function (event) { // click event
            event.preventDefault();
            var a = ko.dataFor(this);
            var taskId = ko.utils.unwrapObservable(a.taskId);

            var taskView = new taskVm(taskId);
            return _this.selectedTask.activateItem(taskView, {
                attachmentId: a.id
            });

        });
    };


    return ctor;
});
