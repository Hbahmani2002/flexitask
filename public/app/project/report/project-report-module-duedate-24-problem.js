/**
 * Created by Rasih CAGLAYAN on 2.02.2016.
 */
// PART 2 - 2 Start Date Problem
define(["common/errorhandler", "common/helpers", "knockout", "plugins/router", "durandal/activator", "plugins/http", "common/context", "moment", "common/utils"],
    function (errorhandler, helpers, ko, router, activator, http, context, moment, utils) {
        var ctor = function (requiredData) {
            var self = this;

            var today = moment().hours("0").minutes("0").seconds("0").millisecond("0");
            var filteredData = _.filter(requiredData, function (t) {
                var dueDate = ko.unwrap(t.dueDate);

                var uwstatus = ko.unwrap(t.status);
                if (dueDate != undefined && dueDate != null && ko.unwrap(t.taskType) === 0 && (uwstatus === 0 || uwstatus === 1 || uwstatus === 4 || uwstatus === 8 || uwstatus === 64)) {

                    dueDate = moment(dueDate).hours("0").minutes("0").seconds("0").millisecond("0");

                    if (moment(today).diff(dueDate) > 0) {
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

            self.waitingForApprovalTasks = ko.observableArray(waitingForSpprovalTasksPrivate);


            // Prepare Data For Chart
            var noneTaskDataPrivate = {
                value: noneTasksPrivate.length,
                color: helpers.getColorByStatus(0),
                highlight: helpers.getColorByStatus(0),
                label: String.format(i18n.t("app:lookups.taskStatus.none") + " ({0})", noneTasksPrivate.length)
            };
            self.noneTaskData = ko.observable(noneTaskDataPrivate);

            var notStartedTaskDataPrivate = {
                value: notStartedTasksPrivate.length,
                color: helpers.getColorByStatus(2),
                highlight: helpers.getColorByStatus(2),
                label: String.format(i18n.t("app:lookups.taskStatus.notStarted") + " ({0})", notStartedTasksPrivate.length)
            };
            self.notStartedTaskData = ko.observable(notStartedTaskDataPrivate);


            var inProgressTaskDataPrivate = {
                value: inProgressTasksPrivate.length,
                color: helpers.getColorByStatus(4),
                highlight: helpers.getColorByStatus(4),
                label: String.format(i18n.t("app:lookups.taskStatus.inProgress") + " ({0})", inProgressTasksPrivate.length)
            };

            self.inProgressTaskData = ko.observable(inProgressTaskDataPrivate);

            var inPlanningTaskDataPrivate = {
                value: inPlanningTasksPrivate.length,
                color: helpers.getColorByStatus(8),
                highlight: helpers.getColorByStatus(8),
                label: String.format(i18n.t("app:lookups.taskStatus.inPlanning") + " ({0})", inPlanningTasksPrivate.length)
            };
            self.inPlanningTaskData = ko.observable(inPlanningTaskDataPrivate);


            var completedTaskDataPrivate = {
                value: completedTasksPrivate.length || 0,
                color: helpers.getColorByStatus(32),
                highlight: helpers.getColorByStatus(32),
                label: String.format(i18n.t("app:lookups.taskStatus.completed") + " ({0})", completedTasksPrivate.length)
            };
            self.completedTaskData = ko.observable(completedTaskDataPrivate);

            var waitingForApprovalTaskDataPrivate = {
                value: waitingForSpprovalTasksPrivate.length || 0,
                color: helpers.getColorByStatus(64),
                highlight: helpers.getColorByStatus(64),
                label: String.format(i18n.t("app:lookups.taskStatus.waitingForApproval") + " ({0})", waitingForSpprovalTasksPrivate.length)
            };

            self.waitingForApprovalTaskData = ko.observable(waitingForApprovalTaskDataPrivate);

            self.pieChartData.push(noneTaskDataPrivate);
            self.pieChartData.push(notStartedTaskDataPrivate);
            // self.pieChartData.push(onHoldTaskDataPrivate);
            self.pieChartData.push(inProgressTaskDataPrivate);
            self.pieChartData.push(inPlanningTaskDataPrivate);
            // self.pieChartData.push(cancelledTaskDataPrivate);
            self.pieChartData.push(waitingForApprovalTaskDataPrivate);
            // self.pieChartData.push(completedTaskDataPrivate);


            // GENERATE CHART
            var options = {
                // Boolean - Whether we should show a stroke on each segment
                segmentShowStroke: true,

                // String - The colour of each segment stroke
                segmentStrokeColor: "#fff",

                responsive: true,

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


            self.barChartData = {
                labels: ["None", "NotStarted", "OnHold", "InProgress", "InPlanning", "Cancelled", "WaitingForApproval", "Completed"],
                datasets: [
                    {
                        label: "My First dataset",
                        fillColor: "rgba(141,237,142,0.5)",
                        strokeColor: "rgba(141,237,100,0.6)",
                        highlightFill: "rgba(250,220,220,0.75)",
                        highlightStroke: "rgba(250,220,220,1)",
                        data: [self.noneTasks().length, self.notStartedTasks().length, self.onHoldTasks().length, self.inProgressTasks().length, self.inPlanningTasks().length, self.cancelledTasks().length, self.waitingForApprovalTasks().length, self.completedTasks().length]
                    }
                ]
            };

        };


        ctor.prototype.attached = function (view, parent) {

            return true;


        };

        ctor.prototype.activate = function (params) {
            return true;
        };


        return ctor;

    });
