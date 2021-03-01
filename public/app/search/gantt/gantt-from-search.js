define(["common/kendolib","jquery", "common/lookups", "common/helpers", "common/errorhandler", "knockout", "plugins/router", "plugins/http", "durandal/activator", "common/context", "underscore", "moment", "i18n"],
    function (kendo,$, lookupFactory, helpers, errorhandler, ko, router, http, activator, context, _, moment, i18n) {


        var ctor = function (inBoundTasks, byWhat) {
            var self = this;


            self.noDateColor = "#eee5e6";
            self.rootTaskColor = "#8baecd";

            errorhandler.includeIn(this);
            self.customRefresh = function () {
                var gantt = $(document).find("#gantt").data("kendoGantt");
                gantt.destroy();
                self.bindGantt($(document));
            };

            self.lookups = lookupFactory.create();

            self.context = context;
            self.customGanttTasks = ko.observableArray([]);
            self.customGanttTasks(inBoundTasks);
            inBoundTasks = self.filterTasksByType(0);
            self.customGanttTasks(inBoundTasks);
            self.groupBySpec = ko.observable(byWhat);


            self.customGanttTasks.extend({ rateLimit: 50 });
            self.moduleVm = activator.create();
            self.title = ko.observable("Gantt Chart");
            self.projectName = "";


        };


        ctor.prototype.extendTasksForDoNotIncludeProperty = function (tasks) {
             // Extend model ifDoNotInclude prop does not exist
            _.extendCollection(tasks, function (t) {
                return {
                    doNotIncludeToGanttChart: t.doNotIncludeToGanttChart || false
                };
            });

            return tasks;
        };

        ctor.prototype.getIncludedTasksForGantt = function (tasks) {

            var self = this;

            // get discarded work items from gantt
            var discardedTasks = _.filter(tasks, function (t) {
                return t.doNotIncludeToGanttChart === true;
            });

            // for each discarded task, check all other tasks and parentIds until parentId array empty or null
            var discardedItemArray = [];

            _.each(discardedTasks, function (dt) {

                var itemAndAllSubItems = self.getSelectedItemAndItsSubItems(dt.id, tasks);
                discardedItemArray = discardedItemArray.concat(itemAndAllSubItems);

            });

            // Get only included tasks
            var result = _.filter(tasks, function (ft) {
                var isCurrentTaskInDiscardedArray = self.isIdInTaskArray(ft.id, discardedItemArray);

                // if task is not in discarded array, task shoul be in the list
                return !(isCurrentTaskInDiscardedArray);
            });

            return result;
        };

        ctor.prototype.extendTasksForGantt = function (tasks) {
            var self = this;


            return _.extendCollection(tasks, function (t) {

                var e = {
                    start: t.startDate,
                    end: t.dueDate,
                    title: t.name,
                    parentId: t.parentTaskId,
                    color: helpers.generateColorByTaskType(t.taskType),
                    percentComplete:t.completionPercentage > 0  ? t.completionPercentage / 100 : 0,
                    assigneeName: t.assignee && context.getUserFullNameOrDefaultById(t.assignee)
                };
                if (t.parentTaskId === null) {
                    e.summary = true;
                }

                return e;
            });
        };


        // For task type work items
        ctor.prototype.fixDatesForGanttChartTasks = function (tasks) {
            var self = this;
            // Extend tasks for colorize problematic tasks
            $.extend(tasks, { startDateBgColor: null, dueDateBgColor: null });
            tasks = _.each(tasks, function (t) {

                if (t.startDate) {
                    t.startDate = new Date(t.startDate);
                }

                if (t.dueDate) {
                    t.dueDate = new Date(t.dueDate);
                }


                // Set start date - dueDate Colors
                if (t.taskType !== 3) {


                    if (!t.startDate) {
                        t.startDateBgColor = self.noDateColor;
                    }
                    if (!t.dueDate) {
                        t.dueDateBgColor = self.noDateColor;
                    }

                }
                //

            });


            var resultTasks = _.each(tasks, function (t) {

                if (t.taskType === 3) {


                    // Case 1 - Milestone ise
                    if (t.dueDate !== null) {
                        if (!t.startDate) {
                            t.startDate = new Date();
                        }
                        t.startDate.setTime(new Date(t.dueDate).getTime());
                    }
                    else {

                    }
                }
                else {



                    // case 1 - Milestone değilse
                    if (t.startDate !== null && t.dueDate !== null && t.startDate.getTime() === t.dueDate.getTime()) {
                        // t.dueDate.setTime(new Date(t.startDate).getTime() + (23 * 60 * 60 * 1000));

                        t.dueDate = moment(t.startDate).add(23, "hours").add(59, "minutes")._d;
                        if (t.end) {
                            t.end = t.dueDate;
                        }
                    }


                    // case 2
                    if (t.startDate && !t.dueDate) {
                        t.dueDate = new Date();
                        t.dueDate.setTime(new Date(t.startDate).getTime() + (12 * 60 * 60 * 1000));
                        $.extend(t, { ganttTaskColor: "#FF0000" });
                    }

                    // case 3

                    if (t.dueDate && !t.startDate) {

                        t.startDate = new Date();
                        t.startDate.setTime((new Date(t.dueDate)).getTime() - (12 * 60 * 60 * 1000));
                        $.extend(t, { ganttTaskColor: "#FF0000" });
                    }
                    else if (t.dueDate && !t.startDate && t.taskType === 3) {
                        t.startDate = moment(t.dueDate)._d;
                        $.extend(t, { ganttTaskColor: "#FF0000" });
                    }
                    else {

                    }

                }
                return t;

            });

            // Case 4 :  seçili task ve subtask larında  en az 1 tane start date belirtilmiş veri varsa
            if (!_.isEmpty(resultTasks)) {


                var foundMinDate = _.min(resultTasks, function (t) {
                    if (t.startDate !== null && t.startDate !== undefined) {
                        return t.startDate;
                    }
                });

                var dResult = "";
                var isFirst = true;
                var foundMinDateWithEach = _.each(resultTasks, function (t) {


                    if (t.startDate !== null && t.startDate !== undefined) {

                        if (isFirst) {
                            dResult = t.startDate;
                        }
                        else {
                            if (t.startDate < dResult) {
                                dResult = t.startDate;
                            }

                        }

                    }

                });


                foundMinDate = foundMinDate.startDate;

                // en az bir start date var ise
                if (isFinite(foundMinDate)) {
                    _.each(resultTasks, function (t) {

                        // Baslangic ve bitis tarihi belirtilmemis ise

                        // Milestone ise
                        if (t.taskType === 3 && !t.startDate && !t.dueDate && foundMinDate !== undefined) {

                            t.startDate = new Date();
                            t.dueDate = new Date();

                            t.startDate.setTime(foundMinDate.getTime());
                            t.dueDate.setTime((new Date(t.startDate)).getTime());
                        }
                        else if (!t.startDate && !t.dueDate && foundMinDate !== undefined) {  // milestone degilse

                            t.startDate = new Date();
                            t.dueDate = new Date();

                            t.startDate.setTime(foundMinDate.getTime());
                            t.dueDate.setTime((new Date(t.startDate)).getTime() + (1 * 60 * 60 * 1000));
                        }
                    });
                }
                // en az 1 due date var ise
                else {
                    foundMinDate = _.min(resultTasks, function (t) {
                        if (t.dueDate !== null && t.dueDate !== undefined) {
                            return t.dueDate;
                        }
                    });
                    foundMinDate = foundMinDate.dueDate;
                    if (isFinite(foundMinDate)) {
                        _.each(resultTasks, function (t) {
                            // milestone ise
                            if (t.taskType === 3 && !t.startDate && !t.dueDate && foundMinDate !== undefined) {
                                t.startDate = new Date();
                                t.dueDate = new Date();
                                t.startDate.setTime(foundMinDate.getTime());
                                t.dueDate.setTime((new Date(t.startDate)).getTime());
                            }
                            // milestone degilse
                            else if (!t.startDate && !t.dueDate && foundMinDate !== undefined) {
                                t.startDate = new Date();
                                t.dueDate = new Date();
                                t.startDate.setTime(foundMinDate.getTime());
                                t.dueDate.setTime((new Date(t.startDate)).getTime() + (12 * 60 * 60 * 1000));
                            }
                        });
                    }
                }

            }

            return resultTasks;
        };

        ctor.prototype.setSummaryTreeForGanttTasks = function (tasks) {

            var self = this;
            /*
             * 1- Get current task id
             * 2- Search all parentId s for this id
             * 3- If any , set summary=true for this ta
             * */


            _.each(tasks, function (t) {

                var getCurrentTaskId = t.id;

                var isIdExistOnOtherParents = _.find(tasks, function (searchTask) {
                    return searchTask.parentTaskId === getCurrentTaskId;
                });

                if (isIdExistOnOtherParents !== undefined) {
                    t.summary = true;
                }
                else {
                    t.summary = false;
                }

            });

            var extendedResult = tasks.map(function (t) {

                var taskModelForGantt = $.extend(t, {
                    start: t.startDate,
                    end: t.dueDate,
                    title: t.name,
                    parentId: t.parentTaskId
                });

                var getItemAndSubItems = self.getSelectedItemAndItsSubItems(t.id, tasks);

                if (t.parentTaskId === null && getItemAndSubItems.length > 1) {
                    $.extend(taskModelForGantt, { summary: true });
                }

                if (t.parentTaskId === null && getItemAndSubItems.length === 1) {
                    $.extend(taskModelForGantt, { summary: false });
                }

                return taskModelForGantt;
            });
            return extendedResult;
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

        ctor.prototype.setTaskParentIdForNotAccesableTasks = function (tasks) {
            var self = this;
            var tasksWithStableParents = _.each(tasks, function (t) {
                if (t.parentTaskId) {
                    // Diğer task ların id lerinden birisi  mi ?
                    var isTaskParentInTheList = false;
                    isTaskParentInTheList = self.isIdInTaskArray(tasks, t.parentTaskId);


                    // Eğer parent id , diğer task id lerinden biri değilse
                    if (!isTaskParentInTheList) {
                        var parentTaskIds = t.parentTaskIds;

                        // tüm parent id leri gez
                        var shouldCountinue = true;
                        parentTaskIds.forEach(function (element, index, arr) {
                            if (shouldCountinue === true) {
                                var currentParentTaskId = element;
                                var isCurrentParentTaskIdInList = false;

                                isCurrentParentTaskIdInList = self.isIdInTaskArray(currentParentTaskId, tasks);
                                if (isCurrentParentTaskIdInList === true) {
                                    t.parentTaskId = currentParentTaskId;
                                    t.parentId = currentParentTaskId;
                                    shouldCountinue = false;
                                }
                            }
                        });
                    }
                }
                return t;
            });

            return tasksWithStableParents;
        };


        ctor.prototype.getSelectedItemAndItsSubItems = function (selectedItemId, allItems) {
            var filteredItems = _.filter(allItems, function (t) {
                if (t.id === selectedItemId || _.contains(t.parentTaskIds, selectedItemId)) {
                    return t;
                }
            });
            return filteredItems;
        };


        ctor.prototype.filterTasksByType = function (taskType) {
            // task type modelde bulunmadığı için bu filtrelemeyi yapamıyoruz. Bu prop eklenince bu bölümü aktif et ve ctor dan çağır.
            var self = this;
            return self.customGanttTasks();
        };

        ctor.prototype.bindGantt = function (view) {
            var self = this;
            var tArray = self.customGanttTasks();

            if (tArray.length === 1) {
                tArray[0].summary = false;
                tArray[0].parentId = null;

            }

            var tasksDataSource = new kendo.data.GanttDataSource({
                data: tArray,
                schema: {
                    model: {
                        expanded: false,
                        id: "id",
                        fields: {
                            id: { from: "id", type: "string" },
                            parentId: { from: "parentId", type: "string", defaultValue: null },
                            start: { from: "start", type: "date" },
                            end: { from: "end", type: "date" },
                            title: { from: "title", defaultValue: "", type: "string" },
                            assignee: { from: "assignee", defaultValue: "", type: "string" },
                            percentComplete: { from: "percentComplete", type: "number" }

                        }
                    }
                }


            });

            var gantt = $("#gantt").empty().kendoGantt({
                date: new Date(),
                height: 800,
                dataSource: tasksDataSource,
                selectable: false,
                editable: false,
                columns: [
                    { field: "title", title: i18n.t("app:pages.gantt.taskHeader"), width: 300 },
                    {
                        field: "start",
                        title: i18n.t("app:pages.gantt.startTimeHeader"),
                        format: "{0:yyyy-MM-dd HH:mm}",
                        width: 140,
                        resizable: true


                    },
                    {
                        field: "end",
                        title: i18n.t("app:pages.gantt.endTimeHeader"),
                        format: "{0:yyyy-MM-dd HH:mm}",
                        width: 140,
                        resizable: true


                    },
                    {
                        field: "assigneeName",
                        title: i18n.t("app:pages.gantt.assigneeNameHeader"),
                        width: 110,
                        resizable: true
                    },
                    { field: "projectName", title: i18n.t("app:pages.gantt.projectNameHeader"), width: 100 }


                ],
                views: [
                    {
                        type: "day",
                        dayHeaderTemplate: kendo.template("#=kendo.toString(start, 'dddd-dd/MM/yyyy')#"),
                        timeHeaderTemplate: kendo.template("#=kendo.toString(start, 'hh:mm')#")


                    },
                    {
                        type: "week",
                        weekHeaderTemplate: "#=kendo.toString(start, 'dddd/dd/MM/yyyy')# - #=kendo.toString(kendo.date.addDays(end, -1), 'dddd/dd/MM/yyyy')#",
                        dayHeaderTemplate: kendo.template("#=kendo.toString(start, 'dddd-dd')#")
                    },
                    {
                        type: "month",
                        monthHeaderTemplate: "#=kendo.toString(start, 'MM, yyyy')#",
                        weekHeaderTemplate: "#=kendo.toString(start, 'dd')# - #=kendo.toString(kendo.date.addDays(end, -1), 'dd/MMMM')#",
                        selected: true
                    }


                ],
                showWorkHours: false,
                showWorkDays: false,
                snap: false,
                toolbar: ["pdf",
                    { template: kendo.template($("#expandAllTemplate").html()) }
                ],
                pdf: {
                    fileName: "FlexiTaskGantt.pdf"
                },
                messages: {
                    actions: {
                        pdf: i18n.t("app:pages.gantt.exportAsPdf")
                    },
                    views: {
                        day: i18n.t("app:pages.gantt.day"),
                        week: i18n.t("app:pages.gantt.week"),
                        month: i18n.t("app:pages.gantt.month")
                    }
                },
                moveStart: function (e) {
                    e.preventDefault();
                },
                save: function (e) {
                    var values = e.values;
                    if (values.parentId && values.parentId !== e.task.get("parentId")) {
                        e.preventDefault();
                    }
                },
                dataBound: function () {

                    var gantt = this;
                    self.gantt = gantt;
                    // var l = this.list.content.find("tr");

                    gantt.list.content.find("tr").each(function () {
                        var row = $(this);
                        var currentData = gantt.dataSource.getByUid($(this).attr("data-uid"));


                        var taskColor = currentData.color;

                        if (row.length && row.length > 0) {
                            var currentRow = row[0];
                            var res = $(currentRow).find("td:eq(0)");// Task name row td is indexed with 0

                            if (res && res.length && res.length > 0) {
                                res[0].bgColor = taskColor;
                            }
                        }

                        if (currentData.startDateBgColor) {
                            var res = $(currentRow).find("td:eq(1)");
                            if (res && res.length && res.length > 0) {
                                res[0].bgColor = currentData.startDateBgColor;
                                res[0].style.color = currentData.startDateBgColor;
                            }

                        }
                        if (currentData.dueDateBgColor) {
                            var res = $(currentRow).find("td:eq(2)");
                            if (res && res.length && res.length > 0) {
                                res[0].bgColor = currentData.dueDateBgColor;
                                res[0].style.color = currentData.dueDateBgColor;
                            }
                        }


                        gantt.element.find(".k-task").each(function (e) {
                            var dtItem = gantt.dataSource.getByUid($(this).attr("data-uid"));


                            if (dtItem.percentComplete !== 0) {
                                $(this).find(".k-task-complete").css("backgroundColor", "lightgreen");
                            }
                        });

                        $(".i18-translation-required").i18n();

                    });
                },
                resizable: true
            }).data("kendoGantt");

            if (gantt && gantt.footer && gantt.footer.find) {
                gantt.footer.find(".k-button").css("visibility", "hidden");
            }


            // gantt.refresh();


            $("#expandGanttButton").click(function () {

                var findGanttForExpand = $(document).find("#gantt").data("kendoGantt");
                var ganttArr = findGanttForExpand.dataSource.view();
                for (var i = 0; i < ganttArr.length; i++) {
                    if (ganttArr[i].hasOwnProperty("summary")) {
                        ganttArr[i].set("expanded", true);
                    }
                }
            });

            $("#collapseGanttButton").click(function () {

                var findGanttForCollapse = $(document).find("#gantt").data("kendoGantt");
                var ganttArr = findGanttForCollapse.dataSource.view();
                for (var i = 0; i < ganttArr.length; i++) {
                    if (ganttArr[i].hasOwnProperty("summary")) {
                        ganttArr[i].set("expanded", false);
                    }
                }
            });


            $(document).keyup(function (e) {
                if (e.keyCode == 27) { // escape keycode 27
                    $(".panel-action.icon.wb-contract").click();
                }
            });

        };


        ctor.prototype.attached = function (view, parent) {
            var _this = this;


            _.each(_this.customGanttTasks(), function (t) {
                if (t.taskType !== 3) {
                    var currentDueDate = t.dueDate;
                    var mDueDate = moment(t.dueDate);
                    if (t.name === "Eto") {
                        var here = "";
                    }
                    if (mDueDate.hours() === 0 && mDueDate.minutes() === 0) {
                        mDueDate = mDueDate.hours(23).minutes(59);
                        t.dueDate = mDueDate._d;
                        t.end = mDueDate._d;

                    }
                }
            });


            _this.bindGantt(view);


        };


        // Composition lifecycle
        ctor.prototype.activate = function (params) {
            var _this = this;


            // _this.projectName = params.projectName || "";
            return this.loadProject(_this.customGanttTasks());
            // kendo.culture("tr-TR");
        };


        ctor.prototype.isAllStartAndDueDatesNull = function (tasks) {
            var isAllDatesNull = _.every(tasks, function (t) {
                return t.startDate === null && t.dueDate === null;
            });

            return isAllDatesNull;


        };

        ctor.prototype.loadProject = function (resultTasks) {
            var self = this;


            // process project data
            var tasks = resultTasks;

            tasks = _.map(tasks, function (t) {
                return $.extend(t, { projectName: t.project.name });
            });


            var isAllDatesHaveProblems = self.isAllStartAndDueDatesNull(tasks);

            if (isAllDatesHaveProblems) {
                return;
            }


            var tasksFixedByDate = self.fixDatesForGanttChartTasks(tasks);

            var extendedTasks = self.extendTasksForGantt(tasksFixedByDate);


            var discardExcludedTasksAndSubTasks = self.extendTasksForDoNotIncludeProperty(extendedTasks);

            var includedTasks = self.getIncludedTasksForGantt(discardExcludedTasksAndSubTasks);

            self.customGanttTasks(includedTasks);

            if (self.groupBySpec() !== "none" && self.groupBySpec() !== null) {
                var groupTasksByAssignee = _.groupBy(self.customGanttTasks(), function (t) {
                    return t[self.groupBySpec()];
                });
                _.each(groupTasksByAssignee, function (v, k) {

                    v = _.sortBy(v, function (x) {
                        return x.dueDate;
                    });
                    v = v.reverse();
                    self.generateRootTaskByTaskGroup(v, k);
                });
            }
            else {

                self.generateRootTaskByProject("SearchResult");
            }

        };


        ctor.prototype.generateRootTaskByTaskGroup = function (taskGroup, groupName, start, end) {
            var self = this;
            if (taskGroup.length > 0) {

                var resultStartDateBgColor = "";
                var resultEndDateBgColor = "";

                if (start === null || start === undefined || start === "") {
                    var foundMinDate = _.min(taskGroup, function (t) {
                        if (t.startDate !== null && t.startDate !== undefined) {
                            return t.startDate;
                        }
                    });

                    foundMinDate = foundMinDate.start;
                    if (isFinite(foundMinDate)) {
                        start = foundMinDate;
                        resultStartDateBgColor = self.noDateColor;
                    }
                }
                else {
                    start = new Date(start);
                }


                if (end === null || end === undefined || end === "") {
                    var foundMaxDate = _.max(taskGroup, function (t) {
                        if (t.dueDate !== null && t.dueDate !== undefined) {
                            return t.dueDate;
                        }
                    });

                    foundMaxDate = foundMaxDate.end;

                    if (isFinite(foundMaxDate)) {
                        end = foundMaxDate;
                        resultEndDateBgColor = self.noDateColor;
                    }
                }
                else {
                    end = new Date(end);
                }


                /*
                 * 1- Generate root task and set properties
                 * 2- If project start and due date specified, use them
                 * 3- Other date cases
                 *
                 Case 1 - Project Start Date ve Due Date Belirtilmiş
                 O halde start ve due date, gantt chart taki project i temsil eden ilgili task ın ilgili alanlarına yazılacak

                 Case 2 - Project StartDate var, DueDate yok
                 Start date olduğu gibi yazılacak. DueDate , diğer tüm task lar için hesaplanmış tarihlerinden (max Due Date) alınarak ilgili alana eklenecek

                 Case 3 - DueDate var , StartDate yok
                 DueDate olduğu gibi yazılır. StartDate, diğer task ların hesaplanmış tarihlerinden (min StartDate) alınarak ilgili alana eklenecek


                 4 - For all other tasks with null parent , set parent as this task (root is project) */

                var userName = self.context.getUserFullNameOrDefaultById(groupName);
                var statusName = groupName;
                if (userName === "" || userName === "NULL" || userName === null) {
                    userName = "No Assignee";
                }
                var projectName = taskGroup[0].project.name;
                var tempGuid = self.generateGuid();


                var rootName = "";

                switch (self.groupBySpec()) {
                case "assignee":
                    rootName = userName;
                    break;
                case "status":
                    rootName = self.lookups.taskStatus.getTextOrDefault(statusName);
                    break;
                case "projectId":
                    rootName = projectName;
                    break;
                default:
                    "None";
                }
                // 1- Generate Root Task
                var rootTask = {
                    id: tempGuid,
                    title: rootName,
                    startDate: start,
                    dueDate: end,
                    start: start,
                    end: end,
                    parentTaskId: null,
                    parentId: null,
                    taskType: 0,
                    summary: true,
                    assignee: "",
                    percentComplete: 0,
                    color: self.rootTaskColor,
                    startDateBgColor: resultStartDateBgColor,
                    dueDateBgColor: resultEndDateBgColor
                };

                self.customGanttTasks().push(rootTask);


                _.each(taskGroup, function (cgt) {
                    if (cgt.id !== tempGuid) {
                        cgt.parentId = tempGuid;
                    }
                });
            }

        };

        ctor.prototype.generateGuid = function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + "-" + s4() + "-" + s4() + "-" +
                s4() + "-" + s4() + s4() + s4();
        };

        ctor.prototype.generateRootTaskByProject = function (prjName, start, end) {
            var self = this;
            if (self.customGanttTasks().length > 0) {

                var resultStartDateBgColor = "";
                var resultEndDateBgColor = "";

                if (start === null || start === undefined || start === "") {
                    var foundMinDate = _.min(self.customGanttTasks(), function (t) {
                        if (t.startDate !== null && t.startDate !== undefined) {
                            return t.startDate;
                        }
                    });

                    foundMinDate = foundMinDate.start;
                    if (isFinite(foundMinDate)) {
                        start = foundMinDate;
                        resultStartDateBgColor = self.noDateColor;
                    }
                }
                else {
                    start = new Date(start);
                }


                if (end === null || end === undefined || end === "") {
                    var foundMaxDate = _.max(self.customGanttTasks(), function (t) {
                        if (t.dueDate !== null && t.dueDate !== undefined) {
                            return t.dueDate;
                        }
                    });

                    foundMaxDate = foundMaxDate.end;

                    if (isFinite(foundMaxDate)) {
                        end = foundMaxDate;
                        resultEndDateBgColor = self.noDateColor;
                    }
                }
                else {
                    end = new Date(end);
                }


                /*
                 * 1- Generate root task and set properties
                 * 2- If project start and due date specified, use them
                 * 3- Other date cases
                 *
                 Case 1 - Project Start Date ve Due Date Belirtilmiş
                 O halde start ve due date, gantt chart taki project i temsil eden ilgili task ın ilgili alanlarına yazılacak

                 Case 2 - Project StartDate var, DueDate yok
                 Start date olduğu gibi yazılacak. DueDate , diğer tüm task lar için hesaplanmış tarihlerinden (max Due Date) alınarak ilgili alana eklenecek

                 Case 3 - DueDate var , StartDate yok
                 DueDate olduğu gibi yazılır. StartDate, diğer task ların hesaplanmış tarihlerinden (min StartDate) alınarak ilgili alana eklenecek


                 4 - For all other tasks with null parent , set parent as this task (root is project) */

                // 1- Generate Root Task
                var rootTask = {
                    id: 1,
                    title: prjName,
                    startDate: start,
                    dueDate: end,
                    start: start,
                    end: end,
                    parentTaskId: null,
                    parentId: null,
                    taskType: 0,
                    summary: true,
                    assignee: "",
                    percentComplete: 0,
                    color: self.rootTaskColor,
                    startDateBgColor: resultStartDateBgColor,
                    dueDateBgColor: resultEndDateBgColor
                };

                self.customGanttTasks().push(rootTask);

                _.each(self.customGanttTasks(), function (cgt) {
                    if (cgt.id !== 1) {
                        cgt.parentId = 1;
                    }
                });
            }

        };


        return ctor;

    });
