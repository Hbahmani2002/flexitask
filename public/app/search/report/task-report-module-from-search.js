/**
 * Created by Rasih CAGLAYAN on 2.02.2016.
 */
define(["common/errorhandler", "knockout", "plugins/router", "common/lookups", "durandal/activator", "plugins/http",
        "common/context", "common/utils",
        "project/report/project-report-module-by-status", "project/report/project-report-module-by-assignee", "project/report/project-report-module-startdate-21-problem",
        "project/report/project-report-module-startdate-22-problem", "project/report/project-report-module-duedate-23-problem",
        "project/report/project-report-module-duedate-24-problem", "project/report/project-report-module-3dt", "project/report/project-report-module-4dt",
        "project/report/project-report-module-5dt", "project/report/project-report-module-6dt", "project/report/project-report-module-62dt",
        "project/report/project-report-module-7dt", "project/report/project-report-module-8dt", "project/report/project-report-module-9dt",
        "project/report/project-report-module-10dt", "project/report/project-report-module-10-2dt", "common/helpers"],
    function (errorhandler, ko, router, lookupFactory, activator, http, context, utils, reportByStatus, reportByAssignee, reportByStartdate21problem, reportByStartdate22problem, reportByDueDate23Problem, reportByDueDate24Problem, reportByOverDue3Date, reportByDueDate4Today, reportByDueDate5Today, reportByDueDate6InAWeek, reportByDueDate62InDays, reportByStartDate7Problematic, reportByStartDate4Today, reportByStartDateTomorrow, reportByStartDateInAWeek, reportByStartDateInDays, helpers) {
        var ctor = function (projectTasks) {
            var self = this;
            self.utils = utils;

            self.context = context;
            self.pieChartData = ko.observableArray();
            self.helpers = helpers;
            self.lookups = lookupFactory.create();
            self.details = null;
            self.report1Source = ko.observable();
            self.report12Source = ko.observable();
            self.report21Source = ko.observable();
            self.report22Source = ko.observable();
            self.report23Source = ko.observable();
            self.report24Source = ko.observable();
            self.report3Source = ko.observable();
            self.report4Source = ko.observable();
            self.report5Source = ko.observable();
            self.report6Source = ko.observable();
            self.report62Source = ko.observable();
            self.report62SourceDays = ko.observable(7);
            self.report7Source = ko.observable();
            self.report8Source = ko.observable();
            self.report9Source = ko.observable();
            self.report10Source = ko.observable();
            self.report102Source = ko.observable();
            self.report102SourceDays = ko.observable(7);
            self.helpers = helpers;
            self.currentProject = ko.observable();
            self.dashBoardTasks = ko.observableArray([]);

            self.dashBoardTasks.push.apply(self.dashBoardTasks, projectTasks);


            self.taskId = ko.observable();

            self.getReport1SourceAllTasksLength = function () {
                if (self.report1Source() && self.report1Source().allTasks) {
                    console.log(self.report1Source().allTasks());
                    return self.report1Source().allTasks().length;
                }
                else {
                    return 0;
                }
            };

            self.getOpacityLevel = function () {
                var opacityLevel=0.4;
                return opacityLevel;
            }
        };


        ctor.prototype.attached = function (view, parent) {
            var self = this;


            // Report 1 - byStatus ------------------------------------
            var report1 = new reportByStatus(self.dashBoardTasks());
            var report1data = report1.pieChartData();
            var report1options = report1.pieChartOptions();
            var report1ChartContext = $(view).find("#mypie").get(0).getContext("2d");
            var report1pieChart = new Chart(report1ChartContext).Pie(report1data, report1options);
            var report1pieChartlgnd = report1pieChart.generateLegend();
            var gvPc = document.getElementById("project-pie-chart-legend");
            document.getElementById("project-pie-chart-legend").innerHTML = report1pieChartlgnd;
            self.report1Source(report1);


            // Report 1 - 2  start date problem-------------------------
            var report12 = new reportByAssignee(self.dashBoardTasks());
            var report12data = report12.pieChartData();
            var report12Options = report12.pieChartOptions();
            var report12Context = $("#reportAllTasksByAssignee").get(0).getContext("2d");
            var report12PieChart = new Chart(report12Context).Pie(report12data, report12Options);
            var report12pieChartlgnd = report12PieChart.generateLegend();
            document.getElementById("reportAllTasksByAssignee-legend").innerHTML = report12pieChartlgnd;
            self.report12Source(report12);


            // Report 2 - 1  start date problem-------------------------
            var report21 = new reportByStartdate21problem(self.dashBoardTasks());
            var report21data = report21.pieChartData();
            var report21Options = report21.pieChartOptions();
            var report21Context = $("#reportByStartDate21Problem").get(0).getContext("2d");
            var report21PieChart = new Chart(report21Context).Pie(report21data, report21Options);
            var report21pieChartlgnd = report21PieChart.generateLegend();
            document.getElementById("reportByStartDate21Problem-legend").innerHTML = report21pieChartlgnd;
            self.report21Source(report21);


            // Report 2 - 2  start date problem-------------------------
            var report22 = new reportByStartdate22problem(self.dashBoardTasks());
            var report22data = report22.pieChartData();
            var report22Options = report22.pieChartOptions();
            var report22Context = $("#reportByStartDate22Problem").get(0).getContext("2d");
            var report22PieChart = new Chart(report22Context).Pie(report22data, report22Options);
            var report22pieChartlgnd = report22PieChart.generateLegend();
            document.getElementById("reportByStartDate22Problem-legend").innerHTML = report22pieChartlgnd;
            self.report22Source(report22);


            // ----------------------
            // Report 2 - 3  due date problem bu user-------------------------
            var report23 = new reportByDueDate23Problem(self.dashBoardTasks());
            var report23data = report23.pieChartData();
            var report23Options = report23.pieChartOptions();
            var report23Context = $("#reportByDueDate23Problem").get(0).getContext("2d");
            var report23PieChart = new Chart(report23Context).Pie(report23data, report23Options);
            var report23pieChartlgnd = report23PieChart.generateLegend();
            document.getElementById("reportByDueDate23Problem-legend").innerHTML = report23pieChartlgnd;
            self.report23Source(report23);
            // ----------------------


            // Report 2 - 4  due date problem-------------------------
            var report24 = new reportByDueDate24Problem(self.dashBoardTasks());
            var report24data = report24.pieChartData();
            var report24Options = report24.pieChartOptions();
            var report24Context = $("#reportByDueDate24Problem").get(0).getContext("2d");


            var report24PieChart = new Chart(report24Context).Pie(report24data, report24Options);
            var report24pieChartlgnd = report24PieChart.generateLegend();


            document.getElementById("reportByDueDate24Problem-legend").innerHTML = report24pieChartlgnd;
            self.report24Source(report24);


            // Report 3
            var report3 = new reportByOverDue3Date(self.dashBoardTasks());
            self.report3Source(report3);

            // Report 4
            var report4 = new reportByDueDate4Today(self.dashBoardTasks());
            self.report4Source(report4);

            // Report 5
            var report5 = new reportByDueDate5Today(self.dashBoardTasks());
            self.report5Source(report5);

            // Report 6
            var report6 = new reportByDueDate6InAWeek(self.dashBoardTasks());
            self.report6Source(report6);

            // Report 6 - 2
            var report62 = new reportByDueDate62InDays(self.dashBoardTasks(), self.report62SourceDays());
            self.report62Source(report62);

            self.report62SourceDays.subscribe(function (t) {
                report62 = new reportByDueDate62InDays(self.dashBoardTasks(), self.report62SourceDays());
                self.report62Source(report62);
            });

            // Report 7
            var report7 = new reportByStartDate7Problematic(self.dashBoardTasks());
            self.report7Source(report7);

            // Report 8
            var report8 = new reportByStartDate4Today(self.dashBoardTasks());
            self.report8Source(report8);

            // Report 9
            var report9 = new reportByStartDateTomorrow(self.dashBoardTasks());
            self.report9Source(report9);

            // Report 10
            var report10 = new reportByStartDateInAWeek(self.dashBoardTasks());
            self.report10Source(report10);


            // Report 10 - 2
            var report102 = new reportByStartDateInDays(self.dashBoardTasks(), self.report102SourceDays());
            self.report102Source(report102);

            self.report102SourceDays.subscribe(function (t) {
                report102 = new reportByStartDateInDays(self.dashBoardTasks(), self.report102SourceDays());
                self.report102Source(report102);
            });


            return true;


        };


        ctor.prototype.compositionComplete = function (child, parent, settings) {


        };

        ctor.prototype.activate = function () {
            return true;
        };

        ctor.prototype.getSelectedItemAndItsSubItems = function (selectedItemId, allItems) {
            var filteredItems = _.filter(allItems, function (t) {

                if (t.id() === selectedItemId || _.contains(t.parentTaskIds(), selectedItemId)) {
                    return t;
                }
            });
            return filteredItems;
        };


        return ctor;

    });
