define(["common/kendolib","jquery", "common/errorhandler", "knockout", "plugins/router", "durandal/activator", "plugins/http", "common/context", "common/helpers", "i18n"],
    function (kendo,$, errorhandler, ko, router, activator, http, context, helpers, i18n) {
        var ctor = function (searchRslt) {
            var self = this;
            errorhandler.includeIn(this);
            kendo.culture().calendar.firstDay = 1;
            self.context = context;
            self.helpers = helpers;
            self.noAssigneeId = 123;
            self.noAssigneeColor = "#f1c40f";
            self.selectedTaskId = ko.observable();
            self.moduleVm = activator.create();
            self.currentFilter = ko.observable();
            self.searchResults = ko.observableArray([]);
            self.searchResults(searchRslt);
            self.assigneeList = ko.observableArray([]);
            self.resourceList = ko.observableArray([]); // calendar resource array with colors
            self.customSchedulerTasksForButton1 = ko.observableArray([]);
            self.customSchedulerTasksForButton2 = ko.observableArray([]);

            self.currentFilter.subscribe(function (newValue) {
                switch (newValue) {
                case 1:
                    self.filterButton1();
                    break;
                case 2:
                    self.filterButton2();
                    break;
                }
            });
        };


        ctor.prototype.extendTasksForProjectName = function (tasks) {
            tasks = tasks.map(function (t) {
                var prjName = "";
                if (t.project && t.project.name) {
                    prjName = t.project.name;
                }
                else if (t.projectName) {
                    prjName = t.projectName;

                }
                else {
                    prjName = "SearchResult";
                }

                var withProjectName = $.extend(t, { projectName: prjName });
                return withProjectName;

            });
            return tasks;
        };

        ctor.prototype.extendTasksForScheduler = function (tasks) {
            var extendedResult = tasks.map(function (t) {

                $.extend(t, {
                    start: t.startDate,
                    end: t.dueDate,
                    title: t.name
                });
                return t;
            });


            return extendedResult;
        };

        ctor.prototype.generateDataSource = function (sourceData) {
            var calenderDataSource = new kendo.data.SchedulerDataSource({
                data: sourceData,
                schema: {
                    model: {
                        id: "id",
                        fields: {
                            taskId: { from: "id", type: "number" },
                            title: { from: "title", defaultValue: "No title", validation: { required: true } },
                            start: { type: "date", from: "start" },
                            end: { type: "date", from: "end" },
                            isAllDay: { type: "boolean", from: "IsAllDay" },
                            assignee: { type: "string", from: "assignee" }
                        }
                    }
                }
            });
            return calenderDataSource;
        };

        ctor.prototype.bindScheduler = function (view) {
            var self = this;
            var requiredData = [];

            var cFilter = self.currentFilter();
            if (cFilter === 1) {
                requiredData = self.customSchedulerTasksForButton1();
            }
            else {
                requiredData = self.customSchedulerTasksForButton2();
            }


            var calenderDataSource = self.generateDataSource(requiredData);


            var scheduler = $("#scheduler").empty().kendoScheduler({
                editable: false,
                date: new Date(),
                allDayEventTemplate: $("#event-template").html(),
                eventTemplate: $("#event-template").html(),
                dataSource: calenderDataSource,
                toolbar: ["pdf"],
                pdf: {
                    fileName: "CalendarExport.pdf"
                },
                messages: {
                    pdf: i18n.t("app:pages.calendar.exportAsPdf")
                },
                views: [
                    "day",
                    "workWeek",
                    "week",
                    { type: "month", selected: true },
                    "agenda",
                    { type: "timeline", eventHeight: 50 }
                ],
                resources: [
                    {
                        field: "assignee",
                        title: "assignee",
                        dataSource: self.resourceList()
                    }
                ],
                edit: function (e) {
                    e.preventDefault();
                }

            });

            $(document).keyup(function (e) {
                if (e.keyCode == 27) { // escape keycode 27
                    $(".panel-action.icon.wb-contract").click();
                }
            });

            $(view).find("#people :checkbox").change(function (e) {

                var checked = $.map($("#people :checked"), function (checkbox) {
                    return $(checkbox).val();
                });

                var scheduler = $(document).find("#scheduler").data("kendoScheduler");

                scheduler.dataSource.filter({
                    operator: function (task) {
                        return $.inArray(task.assignee, checked) >= 0;
                    }
                });
            });

        };

        ctor.prototype.attached = function (view, parent) {

            var self = this;


            var currFilter = self.currentFilter();
            if (currFilter === undefined || currFilter === null) {
                self.currentFilter(1);
            }
            else {
                this.bindScheduler(view);
            }

            self.filterToggleButton = function () {
                if (self.currentFilter() === 1) {
                    self.currentFilter(2);
                }
                else if (self.currentFilter() === 2) {
                    self.currentFilter(1);
                }
                else {
                    self.currentFilter(1);
                }
            };
        };

        ctor.prototype.activate = function (params) {
            var self = this;

            return self.loadProjectForSearchResult(self.searchResults());
        };


        ctor.prototype.extendTaskForAssigneeName = function (tasksToManipulate) {
            var self = this;
            var result = tasksToManipulate.map(function (t) {
                var tempName = self.context.getUserById(t.assignee);
                if (t.assignee !== null && t.assignee !== undefined && t.assignee !== "") {


                    t = $.extend(t, { assigneeName: " / " + tempName.fullName }, { avatar: tempName.avatar }, { user: tempName });

                }
                else {

                    t = taskModelForScheduler = $.extend(t, { assigneeName: "/ No assignee" }, { avatar: "none.png" }, { user: tempName });
                    t.assignee = self.noAssigneeId;
                }
                return t;
            });

            var assignieGroup = _.groupBy(result, "assigneeName");
            var groupCount = Object.keys(assignieGroup).length;
            if (groupCount <= 1) {
                _.each(result, function (er) {
                    er.assigneeName = "";
                });
            }
            return result;
        };
        ctor.prototype.getColorGroup = function () {
            var colors = [
                "#3498db", "#FFEE7D", "#34495e", "#2ecc71", "#1abc9c", "#e74c3c", "#e67e22", "#9b59b6", "#bdc3c7", "#bdc3c7"
            ];

            return colors;
        };

        ctor.prototype.getRandomColor = function () {
            var randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
            return randomColor;
        };

        ctor.prototype.tasksGroupByAssignees = function (tasks) {
            var self = this;
            var assigneeGroup = _.groupBy(tasks, "assigneeName");

            var objectKeyCount = Object.keys(assigneeGroup);
            var colors = self.getColorGroup();
            var assigneeArray = [];

            var cnt = objectKeyCount.length;
            var i = 0;

            _.each(assigneeGroup, function (a) {
                var selectedColor = "";
                if (a[0].assignee === self.noAssigneeId) {
                    selectedColor = self.noAssigneeColor; // #f1c40f
                }
                else if (i <= colors.length) {
                    selectedColor = colors[i];
                }
                else {
                    selectedColor = self.getRandomColor();
                }

                var tempAssignee = {
                    assigneeId: a[0].assignee,
                    assigneeName: cnt > 1 ? a[0].assigneeName : "",
                    avatar: a[0].avatar ? a[0].avatar : "assets/images/avatars/nooneprofile.png",
                    color: selectedColor,
                    user: self.context.getUserById(a[0].assignee)


                };
                i++;
                assigneeArray.push(tempAssignee);
            });

            assigneeArray.sort();
            assigneeArray = _.sortBy(assigneeArray, function (x) {

                return x.assigneeId;
            });

            return assigneeArray;

        };

        ctor.prototype.generateResourcesWithColor = function (asList) {
            var self = this;


            var resourceArray = [];
            var i = 0;
            _.each(asList, function (assigneeElement) {
                var tempResource = {
                    text: assigneeElement.assigneeName,
                    value: assigneeElement.assigneeId,
                    color: assigneeElement.assigneeId === self.noAssigneeId ? self.noAssigneeColor : assigneeElement.color
                };
                resourceArray.push(tempResource);
                i++;
            });

            resourceArray = _.sortBy(resourceArray, function (x) {
                return x.value;
            });
            return resourceArray;
        };

        ctor.prototype.loadProjectForSearchResult = function (params) {
            var self = this;
            var duplicatedTasksA = $.extend(true, [], params);
            var duplicatedTasksB = $.extend(true, [], params);

            duplicatedTasksA = self.getIncludedTasksForGantt(duplicatedTasksA);
            duplicatedTasksB = self.getIncludedTasksForGantt(duplicatedTasksB);

            duplicatedTasksA = self.excludeSpesificWorkItemTypes(duplicatedTasksA);
            duplicatedTasksB = self.excludeSpesificWorkItemTypes(duplicatedTasksB);


            // process project data
            var tasks = duplicatedTasksA;


            tasks = self.extendTasksForScheduler(tasks);
            tasks = self.extendTasksForProjectName(tasks);
            tasks = self.extendTaskForAssigneeName(tasks);


            var aResult = self.fixDateForButton1(tasks);
            var assignees = self.tasksGroupByAssignees(aResult);
            self.assigneeList(assignees);

            var resourceList = self.generateResourcesWithColor(self.assigneeList());
            self.resourceList(resourceList);

            aResult = self.fixAssignieNameIfSingle(aResult);
            aResult = self.fixProjectNameIfSingle(aResult);
            self.customSchedulerTasksForButton1(aResult);


            // process project data
            var tasksB = duplicatedTasksB;
            tasksB = self.extendTasksForScheduler(tasksB);
            tasksB = self.extendTasksForProjectName(tasksB);

            tasksB = self.extendTaskForAssigneeName(tasksB);

            var bResult = self.fixDateForButton2(tasksB);

            bResult = self.fixAssignieNameIfSingle(bResult);
            bResult = self.fixProjectNameIfSingle(bResult);
            self.customSchedulerTasksForButton2(bResult);


        };


        ctor.prototype.checkDateExceptTime = function (dateA, dateB) {

            if (!dateA || !dateB) {
                return false;
            }

            var dateAYear = dateA.getFullYear();
            var dateAMonth = dateA.getMonth() + 1;
            var dateADay = dateA.getDate();

            var dateBYear = dateB.getFullYear();
            var dateBMonth = dateB.getMonth() + 1;
            var dateBDay = dateB.getDate();

            if (dateAYear === dateBYear && dateAMonth === dateBMonth && dateADay === dateBDay) {
                return true;
            }
            else {
                return false;
            }
        };

        ctor.prototype.checkTimeExceptDate = function (dateA, dateB) {

            if (!dateA || !dateB) {
                return false;
            }

            var dateAHour = dateA.getHours();
            var dateAMinute = dateA.getMinutes();
            var dateASecond = dateA.getSeconds();

            var dateBHour = dateB.getHours();
            var dateBMinute = dateB.getMinutes();
            var dateBSecond = dateB.getSeconds();


            if (dateAHour === dateBHour && dateAMinute === dateBMinute && dateASecond === dateBSecond) {
                return true;
            }
            else {
                return false;
            }
        };


        ctor.prototype.fixDateForButton1 = function (tasks) {


            var self = this;
            var clonedTasks = tasks;


            // IN Case there is no start or end date , discard them, get data only has valid start and end date!
            // Önce DURUM 2 : start date ve due date yoksa gösterme - bu datayı ele
            clonedTasks = clonedTasks.filter(function (t) {
                if (t.start !== null && t.start !== undefined && t.start !== "" && t.end !== null && t.end !== undefined && t.end !== "") {
                    return t;
                }

            });


            var extendedResult = clonedTasks.map(function (t) {

                // Tarihi olmayan veriler elendiğinden , tüm veriyi date e çevirebiliriz
                t.start = new Date(t.start);
                t.end = new Date(t.end);


                var isBothDateEquals = self.checkDateExceptTime(t.start, t.end);
                var isBothTimeEquals = self.checkTimeExceptDate(t.start, t.end);

                // Case1
                // Case 1 - StartDate=DueDate && StartTime != DueTime
                // All day event = false
                // Show as is
                if (isBothDateEquals && !isBothTimeEquals) {
                    $.extend(t, { IsAllDay: false });
                }


                // Case 2 - StartDate=DueDate && StartTime = DueTime            //
                // All day event true
                else if (isBothDateEquals && isBothTimeEquals) {
                    $.extend(t, { IsAllDay: true });
                }
                // Case 3 -StartDate != DueDate
                //
                // All day event = true
                else if (!isBothDateEquals) {
                    $.extend(t, { IsAllDay: true });

                }
                else {
                }

                return t;
            });

            return extendedResult;
        };


        ctor.prototype.fixDateForButton2 = function (tasks) {

            var self = this;
            var clonedTasks = tasks;

            // Button 2 durum 3 - due date yoksa , veriyi hariç tut
            clonedTasks = clonedTasks.filter(function (t) {
                if (t.end !== null && t.end !== undefined && t.end !== "") {
                    return t;
                }
            });


            var extendedResult = clonedTasks.map(function (t) {

                // Durum 1
                if (t.start !== null && t.start !== undefined && t.start !== "" && t.end !== null && t.end !== undefined && t.end !== "") {

                    t.start = new Date(t.start);
                    t.end = new Date(t.end);
                    var isBothDateEquals = self.checkDateExceptTime(t.start, t.end);
                    var isBothTimeEquals = self.checkTimeExceptDate(t.start, t.end);
                    // Case1
                    // Case 1 - StartDate=DueDate && StartTime != DueTime
                    // All day event = false
                    // Show as is
                    if (isBothDateEquals && !isBothTimeEquals) {
                        $.extend(t, { IsAllDay: false });
                    }
                    // Case 2 - StartDate=DueDate && StartTime = DueTime            //
                    // All day event true
                    else if (isBothDateEquals && isBothTimeEquals) {
                        $.extend(t, { IsAllDay: true });
                    }
                    // Case 3 -StartDate != DueDate
                    //
                    // All day event = true
                    else if (!isBothDateEquals) {

                        $.extend(t, { IsAllDay: true });


                        t.start = new Date(t.end);


                    }
                    else {

                    }
                }
                // Durum 2 start date yok due date var
                else if ((t.start === null || t.start === undefined || t.start === "") && t.end !== null && t.end !== undefined && t.end !== "") {
                    $.extend(t, { IsAllDay: true });
                    t.end = new Date(t.end);
                    t.start = t.end;
                }
                // duedate yok
                else {

                }
                return t;
            });

            return extendedResult;
        };

        ctor.prototype.filterButton1 = function () {
            var self = this;

            var requiredData = self.customSchedulerTasksForButton1();

            var assignees = self.tasksGroupByAssignees(requiredData);
            self.assigneeList(assignees);

            var rsList = self.generateResourcesWithColor(self.assigneeList());
            self.resourceList(rsList);
            self.bindScheduler($(document));
        };

        ctor.prototype.filterButton2 = function () {
            var self = this;
            var scheduler = $("#scheduler").data("kendoScheduler");
            var requiredData = self.fixDateForButton2(self.customSchedulerTasksForButton2());


            var assignees = self.tasksGroupByAssignees(requiredData);
            self.assigneeList(assignees);

            var resourceList = self.generateResourcesWithColor(self.assigneeList());
            self.resourceList(resourceList);
            self.bindScheduler($(document));

        };


        ctor.prototype.checkData = function () {
            var self = this;


            var selectedData1 = _.filter(self.customSchedulerTasksForButton1(), function (f) {
                return f.name == "Button 1 Case 3";
            });


            var selectedData2 = _.filter(self.customSchedulerTasksForButton2(), function (f) {
                return f.name == "Button 1 Case 3";
            });


        };

        ctor.prototype.fixAssignieNameIfSingle = function (inputTasks) {
            var assignieGroup = _.groupBy(inputTasks, "assigneeName");
            var groupCount = Object.keys(assignieGroup).length;
            if (groupCount <= 1) {
                _.each(inputTasks, function (er) {
                    er.assigneeName = "";
                });
            }

            return inputTasks;
        };

        ctor.prototype.fixProjectNameIfSingle = function (inputTasks) {
            var prjGroup = _.groupBy(inputTasks, "projectName");
            var groupCount = Object.keys(prjGroup).length;
            if (groupCount <= 1) {
                _.each(inputTasks, function (er) {
                    er.projectName = "";
                });
            }

            return inputTasks;
        };

        ctor.prototype.getIncludedTasksForGantt = function (tasks) {

            var self = this;

            // get discarded work items from gantt
            var discardedTasks = _.filter(tasks, function (t) {
                return t.doNotIncludeToCalendar === true;
            });

            // for each discarded task, check all other tasks and parentIds until parentId array empty or null
            var discardedItemArray = [];

            _.each(discardedTasks, function (dt) {


                discardedItemArray.push(dt);

            });

            // Get only included tasks
            var result = _.filter(tasks, function (ft) {
                var isCurrentTaskInDiscardedArray = self.isIdInTaskArray(ft.id, discardedItemArray);

                // if task is not in discarded array, task shoul be in the list
                return !(isCurrentTaskInDiscardedArray);
            });

            return result;
        };

        ctor.prototype.isIdInTaskArray = function (id, taskArray) {
            var isFound = _.find(taskArray, function (i) {
                return i.id === id;
            });
            if (isFound) {
                return true;
            }
            else {
                return false;
            }
        };

        ctor.prototype.excludeSpesificWorkItemTypes = function (taskArray) {

            var result = _.filter(taskArray, function (t) {
                var unwrapedTask = ko.unwrap(t);
                var unwrapedType = ko.unwrap(unwrapedTask.taskType); // 1 4 5
                return (unwrapedType !== 1 && unwrapedType !== 4 && unwrapedType !== 5);
            });
            return result;
        };


        return ctor;

    });
