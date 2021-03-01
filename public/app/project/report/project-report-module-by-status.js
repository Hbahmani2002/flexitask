/**
 * Created by Rasih CAGLAYAN on 2.02.2016.
 */
// PART 1
define(["common/errorhandler", "common/helpers", "knockout", "plugins/router", "durandal/activator", "plugins/http", "common/context", "i18n"],
    function (errorhandler, helpers, ko, router, activator, http, context, i18n) {
        var ctor = function (requiredData) {
            var self = this;


            self.pieChartData = ko.observableArray();
            self.details = requiredData;
            self.pieChartOptions = ko.observable();
            self.allTasks = ko.observableArray();


            self.filteredTasksArray = ko.observableArray();
            var filteredTasks = _.filter(self.details, function (t) {
                var uwrap = ko.unwrap(t.taskType);
                return uwrap === 0;
            });
            self.filteredTasksArray(filteredTasks);


            // None Status
            var noneTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {

                var uwrap = ko.unwrap(t.status);
                return uwrap === 0;

            });
            self.noneTasks = ko.observableArray(noneTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.noneTasks());


            // Not Started
            var notStartedTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {

                var uwrap = ko.unwrap(t.status);
                return uwrap === 1;

            });
            self.notStartedTasks = ko.observableArray(notStartedTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.notStartedTasks());

            // OnHold
            var onHoldTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {
                var uwrap = ko.unwrap(t.status);
                return uwrap === 2;

            });
            self.onHoldTasks = ko.observableArray(onHoldTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.onHoldTasks());

            // In Progress
            var inProgressTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {
                var uwrap = ko.unwrap(t.status);
                return uwrap === 4;

            });
            self.inProgressTasks = ko.observableArray(inProgressTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.inProgressTasks());


            // In Planning
            var inPlanningTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {
                var uwrap = ko.unwrap(t.status);
                return uwrap === 8;

            });
            self.inPlanningTasks = ko.observableArray(inPlanningTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.inPlanningTasks());

            // Cancelled
            var cancelledTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {

                var uwrap = ko.unwrap(t.status);
                return uwrap === 16;
            });
            self.cancelledTasks = ko.observableArray(cancelledTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.cancelledTasks());

            // CompletedStatus
            var completedTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {
                var uwrap = ko.unwrap(t.status);
                return uwrap === 32 || 0;
            });
            self.completedTasks = ko.observableArray(completedTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.completedTasks());

            // Waiting for approval
            var waitingForApprovalTasksPrivate = _.filter(self.filteredTasksArray(), function (t) {
                var uwrap = ko.unwrap(t.status);
                return uwrap === 64;

            });

            self.waitingForApprovalTasks = ko.observableArray(waitingForApprovalTasksPrivate);
            self.allTasks.push.apply(self.allTasks, self.waitingForApprovalTasks());

            // Prepare Data For Chart
            var noneTaskDataPrivate = {
                value: noneTasksPrivate.length,
                color: helpers.getColorByStatus(0),
                highlight: helpers.getColorByStatus(0),
                label: String.format(i18n.t("app:lookups.taskStatus.none") + "({0})", noneTasksPrivate.length)
            };
            self.noneTaskData = ko.observable(noneTaskDataPrivate);

            var notStartedTaskDataPrivate = {
                value: notStartedTasksPrivate.length,
                color: helpers.getColorByStatus(1),
                highlight: helpers.getColorByStatus(1),
                label: String.format(i18n.t("app:lookups.taskStatus.notStarted") + " ({0})", notStartedTasksPrivate.length)
            };
            self.notStartedTaskData = ko.observable(notStartedTaskDataPrivate);

            var onHoldTaskDataPrivate = {
                value: onHoldTasksPrivate.length,
                color: helpers.getColorByStatus(2),
                highlight: helpers.getColorByStatus(2),
                label: String.format(i18n.t("app:lookups.taskStatus.onHold") + " ({0})", onHoldTasksPrivate.length)
            };
            self.onHoldTaskData = ko.observable(onHoldTaskDataPrivate);

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

            var cancelledTaskDataPrivate = {
                value: cancelledTasksPrivate.length,
                color: helpers.getColorByStatus(16),
                highlight: helpers.getColorByStatus(16),
                label: String.format(i18n.t("app:lookups.taskStatus.cancelled") + " ({0})", cancelledTasksPrivate.length)
            };
            self.cancelledTaskData = ko.observable(cancelledTaskDataPrivate);


            var completedTaskDataPrivate = {
                value: completedTasksPrivate.length || 0,
                color: helpers.getColorByStatus(32),
                highlight: helpers.getColorByStatus(32),
                label: String.format(i18n.t("app:lookups.taskStatus.completed") + " ({0})", completedTasksPrivate.length)
            };
            self.completedTaskData = ko.observable(completedTaskDataPrivate);

            var waitingForApprovalTaskDataPrivate = {
                value: waitingForApprovalTasksPrivate.length || 0,
                color: helpers.getColorByStatus(64),
                highlight: helpers.getColorByStatus(64),
                label: String.format(i18n.t("app:lookups.taskStatus.waitingForApproval") + " ({0})", waitingForApprovalTasksPrivate.length)
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
