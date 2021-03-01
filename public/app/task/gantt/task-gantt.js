define(["common/kendolib", "common/helpers","jquery", "common/errorhandler", "knockout", "plugins/router", "plugins/http", "durandal/activator", "common/context", "underscore", "moment", "i18n"],
    function (kendo, helpers, $,errorhandler, ko, router, http, activator, context, _, moment, i18n) {


        var ctor = function () {
            var self = this;


            self.noDateColor = "#eee5e6";
            self.rootTaskColor = "#8baecd";
            errorhandler.includeIn(this);
            self.customRefresh = function () {
                var gantt = $(document).find("#gantt").data("kendoGantt");
                gantt.destroy();
                self.bindGantt($(document));
            };


            self.dependencyData = ko.observableArray();
            self.context = context;
            self.customGanttTasks = ko.observableArray([]);

            self.customGanttTasks.extend({ rateLimit: 50 });
            self.moduleVm = activator.create();
            self.title = ko.observable("Gantt Chart");
            self.projectName = "";
            self.isProject = ko.observable(false);


        };


        ctor.prototype.extendTasksForDoNotIncludeProperty = function (tasks) {

            // Extend model ifDoNotInclude prop does not exist
            _.each(tasks, function (t) {
                if (!(t.hasOwnProperty("doNotIncludeToGanttChart"))) {
                    $.extend(t, { doNotIncludeToGanttChart: false });
                }
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
            var extendedResult = tasks.map(function (t) {


                // extend properties for kendo gantt schema
                var taskModelForGantt = $.extend(t, {
                    start: t.startDate,
                    end: t.dueDate,
                    title: t.name,
                    parentId: t.parentTaskId,
                    color: helpers.generateColorByTaskType(t.taskType)
                });

                if (t.parentTaskId === null) {
                    $.extend(taskModelForGantt, { summary: true });
                }

                // Add required percentComplete for kendo schema - completionPercentage
                if (t.completionPercentage) {
                    $.extend(taskModelForGantt, { percentComplete: t.completionPercentage / 100 });
                }
                else {
                    $.extend(taskModelForGantt, { percentComplete: 0 });
                }

                if (t.assignee) {
                    var tempName = context.getUserById(t.assignee);


                    $.extend(taskModelForGantt, { assigneeName: tempName.fullName });
                }

                return taskModelForGantt;
            });
            return extendedResult;
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
                if (!t.startDate) {
                    t.startDateBgColor = self.noDateColor;
                }
                if (!t.dueDate) {
                    t.dueDateBgColor = self.noDateColor;
                }
                //


            });


            var resultTasks = _.each(tasks, function (t) {

                // case 1
                if (t.taskType !== 3 && t.startDate !== null && t.dueDate !== null && t.startDate.getTime() === t.dueDate.getTime()) {

                    // t.dueDate.setTime(new Date(t.startDate).getTime() + (23 * 60 * 60 * 1000));

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

                if (t.dueDate && !t.startDate && t.taskType !== 3) {

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


                if (isFinite(foundMinDate)) {
                    _.each(resultTasks, function (t) {
                        if (!t.startDate && !t.dueDate && foundMinDate !== undefined) {

                            t.startDate = new Date();
                            t.dueDate = new Date();

                            t.startDate.setTime(foundMinDate.getTime());
                            t.dueDate.setTime((new Date(t.startDate)).getTime() + (1 * 60 * 60 * 1000));
                        }
                    });
                }
                else {
                    foundMinDate = _.min(resultTasks, function (t) {
                        if (t.dueDate !== null && t.dueDate !== undefined) {
                            return t.dueDate;
                        }
                    });
                    foundMinDate = foundMinDate.dueDate;
                    if (isFinite(foundMinDate)) {
                        _.each(resultTasks, function (t) {
                            if (!t.startDate && !t.dueDate && foundMinDate !== undefined) {
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

                var takModelForGantt = $.extend(t, {
                    start: t.startDate,
                    end: t.dueDate,
                    title: t.name,
                    parentId: t.parentTaskId
                });

                if (t.parentTaskId === null) {
                    $.extend(takModelForGantt, { summary: true });
                }

                return takModelForGantt;
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
                        expanded: true,
                        id: "id",
                        fields: {
                            id: { from: "id", type: "string" },
                            parentId: { from: "parentId", type: "string", defaultValue: null },
                            start: { from: "start", type: "date" },
                            end: { from: "end", type: "date" },
                            title: { from: "title", defaultValue: "", type: "string" },
                            assignee: { from: "assignee", defaultValue: "", type: "string" },
                            percentComplete: { from: "percentComplete", type: "number" },
                            orderId: { from: "order", type: "number", validation: { required: false } }
                        }
                    }
                }


            });

            var dependenciesDataSource = new kendo.data.GanttDependencyDataSource({
                data: self.dependencyData(),
                schema: {
                    model: {
                        id: "id",
                        fields: {
                            id: { from: "ID", type: "number" },
                            predecessorId: { from: "PredecessorID", type: "string" },
                            successorId: { from: "SuccessorID", type: "string" },
                            type: { from: "Type", type: "number" }
                        }
                    }
                }
            });


            var findGantt = $(view).find("#gantt").data("kendoGantt");
            if (findGantt) {
                findGantt.destroy();
            }


            var gantt = $(view).find("#gantt").empty().kendoGantt({
                dataSource: tasksDataSource,
                resizable: true,
                selectable: true,
                height: 800,
                dependencies: dependenciesDataSource,
                language: "tr-TR",
                columns: [
                    {
                        field: "title",
                        title: i18n.t("app:pages.gantt.taskHeader"),
                        editable: false,
                        sortable: false,
                        width: 300
                    },
                    {
                        field: "start",
                        title: i18n.t("app:pages.gantt.startTimeHeader"),
                        format: "{0:yyyy-MM-dd HH:mm}",
                        editable: false,
                        sortable: false,
                        draggable: false,
                        resizable: true

                    },
                    {
                        field: "end",
                        title: i18n.t("app:pages.gantt.endTimeHeader"),
                        format: "{0:yyyy-MM-dd HH:mm}",
                        editable: false,
                        sortable: false,
                        resizable: true
                    },
                    {
                        field: "assigneeName",
                        title: i18n.t("app:pages.gantt.assigneeNameHeader"),
                        editable: false,
                        sortable: false,
                        resizable: true
                    }


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
                snap: true,
                toolbar: ["pdf",
                    { template: kendo.template($("#expandAllTemplate").html()) }
                ],
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
                    var l = this.list.content.find("tr");

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
                                res[0].style.color = currentData.startDateBgColor;
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
                editable: false
            }).data("kendoGantt");

            // gantt.footer.find(".k-button").css("visibility", "hidden");

            gantt.refresh();


            $("#expandGanttButton").click(function () {

                var findGanttForExpand = $(document).find("#gantt").data("kendoGantt");
                var ganttArr = findGanttForExpand.dataSource.view();
                for (var i = 0; i < ganttArr.length; i++) {
                    ganttArr[i].set("expanded", true);
                }
            });

            $("#collapseGanttButton").click(function () {

                var findGanttForCollapse = $(document).find("#gantt").data("kendoGantt");
                var ganttArr = findGanttForCollapse.dataSource.view();
                for (var i = 0; i < ganttArr.length; i++) {
                    ganttArr[i].set("expanded", false);
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

            var getEtoTaskBefore = _.filter(_this.customGanttTasks(), function (t) {
                return t.name === "Eto";
            });


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

            var getEtoTaskAfter = _.filter(_this.customGanttTasks(), function (t) {
                return t.name === "Eto";
            });


            // TODO: due date null değilse ve zaman belirtilmemişse, zamanı 23:59 olarak belirteceğiz
            _this.bindGantt(view);


        };


        // Composition lifecycle
        ctor.prototype.activate = function (params) {
            var _this = this;
            _this.projectName = params.projectName || "";


            return this.loadProject(params);
            // kendo.culture("tr-TR");
        };


        ctor.prototype.isAllStartAndDueDatesNull = function (tasks) {
            var isAllDatesNull = _.every(tasks, function (t) {
                return t.startDate === null && t.dueDate === null;
            });

            return isAllDatesNull;


        };

        ctor.prototype.loadProject = function (params) {
            var self = this;
            var url = "";
            if (params.taskId) {
                url = String.format("/api/tasks/{0}/gantt", params.taskId);
            }
            else {
                self.isProject(true);
                url = String.format("/api/projects/{0}/gantt", params.projectId);
            }


            return http.get(url).then(function (projectData) {
                // process project data
                var tasks = projectData.tasks;
                _.each(tasks, function (t) {
                    var projectName = "";
                    if (t.project && t.project.name) {
                        projectName = t.project.name;
                    }
                    else if (t.projectName) {
                        projectName = t.projectName;

                    }
                    else if (self.projectName !== null) {
                        projectName = self.projectName;
                    }
                    else {
                        projectName = "SearchResult";
                    }
                    t.projectName = projectName;
                });

                var getDependencyExceptRleation = self.discardRelationTypeDependency(projectData.dependencies);


                var dependencyTransformedData = self.dependencyDataTransformer(getDependencyExceptRleation);
                self.dependencyData(dependencyTransformedData);

                if (params.taskId) {
                    // set parentId null for selected Task

                    var taskToFindResult = _.find(tasks, function (taskToFind) {
                        return taskToFind.id === params.taskId;
                    });

                    if (taskToFindResult) {
                        // taskToFindResult.parentId = null;
                        taskToFindResult.parentTaskId = null;
                        taskToFindResult.summary = true;
                    }

                    tasks = self.getSelectedItemAndItsSubItems(params.taskId, tasks);// sonucu buraya ekle
                }

                var isAllDatesHaveProblems = self.isAllStartAndDueDatesNull(tasks);

                if (isAllDatesHaveProblems) {
                    return;
                }


                var tasksFixedByDate = self.fixDatesForGanttChartTasks(tasks);

                var extendedTasks = self.extendTasksForGantt(tasksFixedByDate);


                var tasksWithStableParentId = self.setTaskParentIdForNotAccesableTasks(extendedTasks);

                // Adds summary  property to task and set it true if the task contains subtasks.It is kendo gantt requirement!
                var setTreeContainerss = self.setSummaryTreeForGanttTasks(tasksWithStableParentId);


                var discardExcludedTasksAndSubTasks = self.extendTasksForDoNotIncludeProperty(setTreeContainerss);

                var includedTasks = self.getIncludedTasksForGantt(discardExcludedTasksAndSubTasks);

                self.customGanttTasks(includedTasks);


                if (self.isProject() === true) {
                    self.generateRootTaskByProject(projectData.name);
                }

                self.generateEmptyTaskForAddLastItem();


            }).fail(self.handleError);
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

                // start: t.startDate,
                //    end: t.dueDate,
                // title: t.name,
                // parentId: t.parentTaskId,
                // color: self.generateColorByTaskType(t.taskType)

                // 1- Generate Root Task
                var rootTask = {
                    id: 1,
                    title: self.projectName,
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
                    if ((cgt.parentId === null || cgt.parentId === undefined || cgt.parentId === "") && cgt.id !== 1) {
                        cgt.parentId = 1;
                    }
                });
            }

        };

        ctor.prototype.generateEmptyTaskForAddLastItem = function (prjName, start, end) {
            var self = this;
            if (self.customGanttTasks().length > 0) {

                var resultStartDateBgColor = self.noDateColor;
                var resultEndDateBgColor = self.noDateColor;

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



                // 1- Generate Empty Task
                var rootTask = {
                    id: 999999,
                    title: "",
                    startDate: new Date(),
                    dueDate: new Date(),
                    start: new Date(),
                    end: new Date(),
                    parentTaskId: null,
                    parentId: null,
                    taskType: 0,
                    summary: false,
                    assignee: "",
                    percentComplete: 0,
                    color: self.noDateColor,
                    startDateBgColor: resultStartDateBgColor,
                    dueDateBgColor: resultEndDateBgColor
                };

                self.customGanttTasks().push(rootTask);


            }

        };


        ctor.prototype.discardRelationTypeDependency = function (rawDependencyData) {
            var self = this;
            var onlyDependencyTypeData = _.filter(rawDependencyData, function (dd) {
                return dd.dependencyType !== 0;
            });
            return onlyDependencyTypeData;
        };

        ctor.prototype.dependencyDataTransformer = function (rawDependencyData) {
            var self = this;
            var dependencyCounter = 0;
            var transformedArray = [];


            _.each(rawDependencyData, function (rawData) {

                var transformedDependency = {
                    ID: dependencyCounter,
                    PredecessorID: rawData.predecessorTaskId,
                    SuccessorID: rawData.successorTaskId,
                    Type: self.kendoDependencyFromFlexiTaskDependency(rawData.dependencyType)
                };
                transformedArray.push(transformedDependency);
                dependencyCounter++;

            });

            return transformedArray;
        };

        ctor.prototype.kendoDependencyFromFlexiTaskDependency = function (flexiTaskDependencyId) {
            var kendoDependency = -1;
            switch (flexiTaskDependencyId) {
            case 1:
                kendoDependency = 1;
                break;
            case 2:
                kendoDependency = 3;
                break;
            case 4:
                kendoDependency = 0;
                break;
            case 8:
                kendoDependency = 2;
                break;
            }
            return kendoDependency;
        };

        return ctor;

    });
