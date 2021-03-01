/**
 * Created by Rasih CAGLAYAN on 2.02.2016.
 */

define(["common/errorhandler", "knockout", "plugins/router", "durandal/activator", "plugins/http", "common/context", "moment", "common/utils"],
    function (errorhandler, ko, router, activator, http, context, moment, utils) {
        var ctor = function (requiredData) {
            var self = this;
            var tomorrow = moment().add(1, "days").hours("0").minutes("0").seconds("0").millisecond("0");
            var aWeekLater = moment().add(8, "days").hours("0").minutes("0").seconds("0").millisecond("0");

            var filteredData = _.filter(requiredData, function (t) {
                var startDate = ko.unwrap(t.startDate);
                if (startDate != undefined && startDate != null && ko.unwrap(t.taskType) === 0) {

                    startDate = moment(startDate).hours("0").minutes("0").seconds("0").millisecond("0");

                    if (moment(startDate).diff(tomorrow) > 0 && moment(startDate).diff(aWeekLater) <= 0) {
                        return t;
                    }

                }
            });

            self.tasks = ko.observableArray(filteredData);


            self.pieChartData = ko.observableArray();

            self.pieChartOptions = ko.observable();


            // None Status
            var noneTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 0;
            });
            self.noneTasks = ko.observableArray(noneTasksPrivate);


            // Not Started
            var notStartedTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 1;
            });
            self.notStartedTasks = ko.observableArray(notStartedTasksPrivate);


            // OnHold
            var onHoldTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 2;
            });
            self.onHoldTasks = ko.observableArray(onHoldTasksPrivate);

            // In Progress
            var inProgressTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 4;
            });
            self.inProgressTasks = ko.observableArray(inProgressTasksPrivate);


            // In Planning
            var inPlanningTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 8;
            });
            self.inPlanningTasks = ko.observableArray(inPlanningTasksPrivate);

            // Cancelled
            var cancelledTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 16;
            });
            self.cancelledTasks = ko.observableArray(cancelledTasksPrivate);


            // CompletedStatus
            var completedTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 32 || 0;
            });

            self.completedTasks = ko.observableArray(completedTasksPrivate);

            // Waiting for approval
            var waitingForSpprovalTasksPrivate = _.filter(ko.unwrap(self.tasks), function (t) {
                return ko.unwrap(t.status) === 64;
            });

            self.waitingForSpprovalTasks = ko.observableArray(waitingForSpprovalTasksPrivate);


            // Prepare Data For Chart
            var noneTaskDataPrivate = {
                value: noneTasksPrivate.length,
                color: "gray",
                highlight: "lightgray",
                label: "None"
            };
            self.noneTaskData = ko.observable(noneTaskDataPrivate);

            var notStartedTaskDataPrivate = {
                value: notStartedTasksPrivate.length,
                color: "gray",
                highlight: "lightgray",
                label: "NotStarted"
            };
            self.notStartedTaskData = ko.observable(notStartedTaskDataPrivate);

            var onHoldTaskDataPrivate = {
                value: onHoldTasksPrivate.length,
                color: "gray",
                highlight: "lightgray",
                label: "OnHold"
            };
            self.onHoldTaskData = ko.observable(onHoldTaskDataPrivate);

            var inProgressTaskDataPrivate = {
                value: inProgressTasksPrivate.length,
                color: "blue",
                highlight: "lightblue",
                label: "InProgress"
            };

            self.inProgressTaskData = ko.observable(inProgressTaskDataPrivate);

            var inPlanningTaskDataPrivate = {
                value: inPlanningTasksPrivate.length,
                color: "purple",
                highlight: "lightpurple",
                label: "InPlanning"
            };
            self.inPlanningTaskData = ko.observable(inPlanningTaskDataPrivate);

            var cancelledTaskDataPrivate = {
                value: cancelledTasksPrivate.length,
                color: "#FFFFF0",
                highlight: "#FFFFFF",
                label: "Cancelled"
            };
            self.cancelledTaskData = ko.observable(cancelledTaskDataPrivate);


            var completedTaskDataPrivate = {
                value: completedTasksPrivate.length || 0,
                color: "green",
                highlight: "lightgreen",
                label: "Completed"
            };
            self.completedTaskData = ko.observable(completedTaskDataPrivate);

            var waitingForApprovalTaskDataPrivate = {
                value: waitingForSpprovalTasksPrivate.length || 0,
                color: "green",
                highlight: "lightgreen",
                label: "WaitingForApproval"
            };

            self.waitingForApprovalTaskData = ko.observable(waitingForApprovalTaskDataPrivate);

            self.pieChartData.push(noneTaskDataPrivate);
            self.pieChartData.push(notStartedTaskDataPrivate);
            self.pieChartData.push(onHoldTaskDataPrivate);
            self.pieChartData.push(inProgressTaskDataPrivate);
            self.pieChartData.push(inPlanningTaskDataPrivate);
            self.pieChartData.push(cancelledTaskDataPrivate);
            self.pieChartData.push(waitingForApprovalTaskDataPrivate);
            self.pieChartData.push(completedTaskDataPrivate);


            // GENERATE CHART
            var options = {
                // Boolean - Whether we should show a stroke on each segment
                segmentShowStroke: true,

                // String - The colour of each segment stroke
                segmentStrokeColor: "#fff",

                // Number - The width of each segment stroke
                segmentStrokeWidth: 2,

                // Number - The percentage of the chart that we cut out of the middle
                percentageInnerCutout: 50, // This is 0 for Pie charts

                // Number - Amount of animation steps
                animationSteps: 100,

                // String - Animation easing effect
                animationEasing: "easeOutBounce",

                // Boolean - Whether we animate the rotation of the Doughnut
                animateRotate: true,

                // Boolean - Whether we animate scaling the Doughnut from the centre
                animateScale: false,

                // String - A legend template
                legendTemplate: "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<segments.length; i++){%><li><span style=\"background-color:<%=segments[i].fillColor%>\"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>"

            };

            self.pieChartOptions(options);

        };


        ctor.prototype.attached = function (view, parent) {

            return true;


        };

        ctor.prototype.activate = function (params) {
            return true;
        };


        return ctor;
    });
