/**
 * Created by Rasih CAGLAYAN on 2.02.2016.
 */
// PART 2 - 2 Start Date Problem
define(["common/errorhandler", "knockout", "plugins/router", "durandal/activator", "plugins/http", "common/context", "underscore", "moment", "common/utils"],
    function (errorhandler, ko, router, activator, http, context, _, moment, utils) {
        var ctor = function (requiredData) {
            var self = this;


            self.context = context;
            var today = moment().hours("0").minutes("0").seconds("0").millisecond("0");
            var filteredData = _.filter(requiredData, function (t) {
                var startDate = ko.unwrap(t.startDate);
                if (startDate != undefined && startDate != null && ko.unwrap(t.taskType) === 0 && (ko.unwrap(t.status) === 0 || ko.unwrap(t.status) === 1 || ko.unwrap(t.status) === 8)) {
                    startDate = moment(startDate).hours("0").minutes("0").seconds("0").millisecond("0");

                    if (moment(today).diff(startDate) > 0) {
                        return t;
                    }
                }
            });




            self.tasks = ko.observableArray(filteredData);

            self.pieChartData = ko.observableArray();

            self.pieChartOptions = ko.observable();


            /*
             1. Kişiye göre grupla
             2. Data part oluştur  value, color, highligt label
             value : sayısal değer
             label : user name
             color : color helper dan sırsaıyla aldığımız değer

             */

            var tasksGroupByUserId = _.groupBy(self.tasks(), function (t) {

                return ko.unwrap(t.assignee);
            });

            self.getRandomColor = function () {
                var randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
                return randomColor;
            };


            _.each(tasksGroupByUserId, function (v, k) {
                var currentAssignee = i18n.t("app:pages.report.noAssigneeText");
                if (k != null && k != "null" && k != "NULL") {
                    currentAssignee = self.context.getUserById(k).fullName;
                }
                var randomColor = self.getRandomColor();
                var tempPieChartData = {
                    value: v.length,
                    color: randomColor,
                    highlight: randomColor,
                    label: String.format("{0}   ({1})", currentAssignee, v.length)
                };
                self.pieChartData.push(tempPieChartData);


            });


            // GENERATE CHART
            var options = {
                // Boolean - Whether we should show a stroke on each segment
                segmentShowStroke: true,

                responsive: true,

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
