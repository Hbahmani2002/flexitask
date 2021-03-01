/**
 * Created by Rasih CAGLAYAN on 2.02.2016.
 */
define(["durandal/system", "common/kendolib", "common/errorhandler", "knockout", "plugins/router", "common/helpers", "durandal/activator", "plugins/http", "common/context"],
    function (system, kendo, errorhandler, ko, router, helpers, activator, http, context) {
        var ctor = function () {
            var self = this;
            kendo.culture().calendar.firstDay = 1;
            errorhandler.includeIn(this);
            self.calendarTasks = ko.observableArray([]);
            self.moduleVm = activator.create();
        };

        // comment
        ctor.prototype.attached = function (view, parent) {


            var self = this;
            return true;


        };

        ctor.prototype.activate = function (params) {
            var self = this;
            return this.loadProject(params).then(function (d) {
                system.acquire("search/calendar/task-calendar-fromsearch")
                    .then(function (m) {
                        // deactivatePreviousModule();
                        m = new m(self.calendarTasks());
                        self.moduleVm.activateItem(m, self.calendarTasks());
                        return m;
                    });
            });


            // return this.loadProject(params);
        };


        ctor.prototype.loadProject = function (params) {
            var self = this;


            var url = "";
            if (params.taskId) {
                url = String.format("/api/tasks/{0}/gantt", params.taskId);
            }
            else {
                url = String.format("/api/projects/{0}/gantt", params.projectId);
            }

            return http.get(url).then(function (projectData) {
                // process project data
                var tasks = projectData.tasks;
                self.calendarTasks.push.apply(self.calendarTasks, tasks);


            }).fail(self.handleError);
        };


        return ctor;

    });


