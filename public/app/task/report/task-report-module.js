/**
 * Created by Rasih CAGLAYAN on 2.02.2016.
 */
define(["durandal/system","jquery", "common/errorhandler", "knockout", "plugins/router", "durandal/activator", "plugins/http", "common/context", "common/utils",
 "project/report/project-report-module-by-status", "project/report/project-report-module-by-assignee", "project/report/project-report-module-startdate-21-problem", 
 "project/report/project-report-module-startdate-22-problem", "project/report/project-report-module-duedate-23-problem",
  "project/report/project-report-module-duedate-24-problem", "project/report/project-report-module-3dt", "project/report/project-report-module-4dt",
   "project/report/project-report-module-5dt", "project/report/project-report-module-6dt", "project/report/project-report-module-62dt",
    "project/report/project-report-module-7dt", "project/report/project-report-module-8dt", "project/report/project-report-module-9dt",
     "project/report/project-report-module-10dt", "project/report/project-report-module-10-2dt", "common/helpers"],
    function (system,$, errorhandler, ko, router, activator, http, context, utils, reportByStatus, reportByAssignee, reportByStartdate21problem, reportByStartdate22problem, reportByDueDate23Problem, reportByDueDate24Problem, reportByOverDue3Date, reportByDueDate4Today, reportByDueDate5Today, reportByDueDate6InAWeek, reportByDueDate62InDays, reportByStartDate7Problematic, reportByStartDate4Today, reportByStartDateTomorrow, reportByStartDateInAWeek, reportByStartDateInDays, helpers) {
        var ctor = function () {
            var self = this;
            self.currentProject = ko.observable();
            self.details = ko.observable();
            self.dashBoardTasks = ko.observableArray();
            self.activeModuleVm = activator.create();

        };


        ctor.prototype.attached = function (view, parent) {
            var self = this;
            return true;
        };

        ctor.prototype.activate = function (params) {

            var self = this;


            // return this.loadProject(params);
            return this.loadProject(params).then(function (d) {
                system.acquire("search/report/task-report-module-from-search")
                    .then(function (m) {
                        // deactivatePreviousModule();
                        m = new m(self.dashBoardTasks());
                        self.activeModuleVm.activateItem(m, self.dashBoardTasks());
                        return m;
                    });
            });


        };

        ctor.prototype.getSelectedItemAndItsSubItems = function (selectedItemId, allItems) {
            var filteredItems = _.filter(allItems, function (t) {

                if (t.id() === selectedItemId || _.contains(t.parentTaskIds(), selectedItemId)) {
                    return t;
                }
            });
            return filteredItems;
        };

        ctor.prototype.loadProject = function (params) {
            var self = this;
            self.filter = {
                includeArchivedTasks: ko.observable(false),
                selectedStatus: ko.observableArray(["0", "1", "2", "4", "8", "16", "32", "64"]).extend({
                    rateLimit: 500
                })
            };


            var criteria = ko.toJS(self.filter);
            criteria.status = criteria.selectedStatus.join();
            delete criteria.selectedStatus;
            var filters = utils.toQueryString(criteria);


            var url = String.format("/api/projects/{0}?{1}", params.projectId, filters);


            return http.get(url).then(function (projectData) {
                function extendProjectTasks(project) {
                    project.tasks = ko.observableArray(_.map(project.tasks, function (task) {
                        var t = ko.mapping.fromJS(task);
                        t.isDeleted = ko.observable(false); //
                        $.extend(t, { projectId: ko.observable(params.projectId) });
                        return t;
                    })).extend({ deferred: true });

                }

                function extendProject(project) {
                    project.id = ko.revertableObservable(project.id);
                    project.startDate = ko.revertableObservable(project.startDate);
                    project.dueDate = ko.revertableObservable(project.dueDate);
                    project.name = ko.revertableObservable(project.name);
                    project.description = ko.revertableObservable(project.description);
                    project.status = ko.revertableObservable(project.status);
                    project.owner = ko.revertableObservable(project.owner);
                    project.manager = ko.revertableObservable(project.manager);
                    project.coOwners = ko.revertableObservableArray(project.coOwners);
                    project.coManagers = ko.revertableObservableArray(project.coManagers);
                    project.category1Followers = ko.revertableObservableArray(project.category1Followers);
                    project.category2Followers = ko.revertableObservableArray(project.category2Followers);
                    project.category3Followers = ko.revertableObservableArray(project.category3Followers);
                    project.members = ko.revertableObservableArray(project.members);
                    project.excludedUsers = ko.revertableObservableArray(project.excludedUsers);
                    project.stopHierarchyUsers = ko.revertableObservableArray(project.stopHierarchyUsers);
                    project.externalUsers = ko.revertableObservableArray(project.externalUsers);
                    project.tags = ko.revertableObservableArray(project.tags);
                    project.hasMuted = ko.revertableObservable(project.hasMuted);
                    project.audit = ko.revertableObservable(project.audit);
                    project.isOnlyForMembers = ko.revertableObservable(project.isOnlyForMembers);
                    project.estimatedDurationDays = ko.revertableObservable(project.estimatedDurationDays);
                    project.estimatedEffordHours = ko.revertableObservable(project.estimatedEffordHours);
                    project.estimatedBudget = ko.revertableObservable(project.estimatedBudget);
                    project.estimatedBudgetCurrencyCode = ko.revertableObservable(project.estimatedBudgetCurrencyCode);
                    project.isPublished = ko.revertableObservable(project.isPublished);
                    project.isArchived = ko.revertableObservable(project.isArchived);
                    project.taskCount = ko.revertableObservable(project.taskCount);
                    project.isStarred = ko.revertableObservable(project.isStarred);
                    project.category = ko.revertableObservable(project.category);

                    project.customFieldDefinations = ko.observableArray(project.customFieldDefinations).subscribeTo("CustomFieldsChanged");
                    extendProjectTasks(project);
                }

                extendProject(projectData);

                self.currentProject(projectData);

                var selectedSubTasks = self.getSelectedItemAndItsSubItems(params.taskId, self.currentProject().tasks());
                self.dashBoardTasks.push.apply(self.dashBoardTasks, selectedSubTasks);

            }).fail(self.handleError);
        };
        return ctor;

    });
