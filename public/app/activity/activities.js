define(["common/autocomplete","amplify", "common/prefs", "moment", "common/context", "common/notifier", "common/utils", "common/helpers", "i18n", "durandal/events", "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (autocomplete, amplify,prefs, moment, context, notifier, utils, helpers, i18n, events, errorhandler, system, http, router, app, activator, ko, $, _) {

        function ActivityFilter(readFilter, priority, group, sort) {
            var self = this;


            this.taskId = ko.observable();
           
            this.projectId = ko.observable();
           
            this.actorId = ko.observable();
            this.actorName = ko.observable();

            this.status = ko.observableArray(["unread"]).extend({
                rateLimit: 250
            });
            this.priority = ko.observableArray(["low", "medium", "high", "mention"]).extend({
                rateLimit: 250
            });
            this.grouping = ko.observable("none");
            this.sorting = ko.observable("newest");

            this.status.subscribe(function (v) {
                ko.postbox.publish("ActivityFilterChanged", self);
            });

            this.priority.subscribe(function (v) {
                ko.postbox.publish("ActivityFilterChanged", self);
            });

            this.grouping.subscribe(function (v) {

            });

            this.sorting.subscribe(function (v) {
                ko.postbox.publish("ActivityFilterChanged", self);
            });


            this.hasFilter = ko.computed(function () {
                return self.taskId() || self.projectId() || self.actorId();
            });


            this.changeSorting = function (sortValue) {
                var v = self.sorting();
                if (v === "newest") {
                    self.sorting("oldest");
                } else {
                    self.sorting("newest");
                }
            };

            this.reset = function () {

                self.projectId(null);
                self.taskId(null);
                self.actorId(null);
              
                self.actorName(null);
            };
        }


        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.prefs = prefs;
            this.utils = utils;
            this.context = context;
            this.useShortenDateFormat = ko.observable(typeof amplify.store("activities/useShortenDataFormat") === "undefined" ? false : amplify.store("activities/useShortenDataFormat"));
            this.advancedFilterActive = ko.observable(false);
            this.hasNewPage = ko.observable(true);
            this.activities = ko.observableArray([]);
            this.reportModule = activator.create();
            this.selectedProject = activator.create();
            this.selectedTask = activator.create();
            this.selectedActivityId = ko.observable(false);
            this.filter = new ActivityFilter();
            this.usedFilter = null;
            this.aggregateActivities = ko.observable(true);
      
            this.canShowAttachmentImages = ko.observable(typeof amplify.store("activities/showImages") === "undefined" ? false : amplify.store("activities/showImages"));
            this.displayFilters = ko.observable(false);
            this.subscriptions = [];

            this.getTaskTypeahead = ko.computed(function () {
                var projectId = _this.filter.projectId() || null;
                return autocomplete.getSelect2OptionsForTasks(projectId,1);
            });

            this.hasActivities = ko.computed(function () {
                return _this.activities().length > 0;
            });

            this.useShortenDateFormat.subscribe(function (v) {
                amplify.store("activities/useShortenDataFormat", v);
            });
            this.canShowAttachmentImages.subscribe(function (v) {
                amplify.store("activities/showImages", v);
            });

            this.headerCollapseStatus = ko.pureComputed({
                read: function () {
                    var v = amplify.store("activities/headerCollapseStatus");
                    if (typeof v === "undefined" || v === null) {
                        return true;
                    }
                    return v;
                },
                write: function (value) {
                    amplify.store("activities/headerCollapseStatus", value);
                },
                owner: this
            });

            this.filteredActivities = ko.computed(function () {
                var result;
                var grouping = _this.filter.grouping() || "none";
                if (grouping === "none") {
                    if (_this.filter.sorting() === "newest") {
                        result = _.sortBy(_this.activities(), function (a) {
                            return a.publishedAt;
                        });
                        result = result.reverse();
                    } else {
                        result = _.sortBy(_this.activities(), function (a) {
                            return a.publishedAt;
                        });
                    }
                } else if (grouping === "project") {
                    result = _.sortBy(_this.activities(), function (a) {
                        return String.format("{0}_{1}", a.projectId, a.publishedAt);
                    });
                    result = result.reverse();
                } else if (grouping === "projecttask") {
                    result = _.sortBy(_this.activities(), function (a) {
                        return String.format("{0}_{1}_{2}", a.projectId, a.taskId, a.publishedAt);
                    });
                    result = result.reverse();
                }


                if (_this.aggregateActivities()) {
                    var groups = _.groupBy(result, function (a) {
                        a.relatedActivities([]);

                        return String.format("{0}_{1}", a.taskId || a.projectId, a.actorId);
                    });

                    _.each(groups, function (value, key, list) {
                        var initialDt = null;
                        var initialActivity = null;
                        _.each(_.sortBy(value, function (a) {
                            return a.publishedAt;
                        }), function (a) {
                            if (!initialDt) {
                                initialDt = moment(a.publishedAt);
                                a.relatedActivities.push(a);
                                initialActivity = a;

                            } else {
                                if (moment(a.publishedAt).diff(initialDt, "seconds") < 120) {
                                    initialActivity.relatedActivities.push(a);
                                    a.visible(false);
                                } else {
                                    initialDt = moment(a.publishedAt);
                                    a.relatedActivities.push(a);
                                    initialActivity = a;
                                }
                            }
                        });
                    });
                } else {
                    _.each(result, function (a) {
                        a.relatedActivities([]);
                        a.visible(true);
                    });
                }

                return _.filter(result, function (a) {
                    return a.visible();
                });
            }).extend({ deferred: true });

            this.addCommentCommand = ko.asyncCommand({
                execute: function (callback) {
                    var activity = this;
                    var errors = ko.validation.group([activity.commentText]);
                    if (errors().length > 0) {
                        errors.showAllMessages(true);
                        return false;
                    }

                    var command = {
                        comment: activity.commentText()
                    };

                    var taskId = activity.taskId;
                    var parentComment = (activity.extraContext.parentCommentId && ko.unwrap(activity.extraContext.parentCommentId)) || false;
                    var url = "";
                    if (parentComment) {
                        url = String.format("/api/tasks/{0}/comments/{1}/replies", taskId, parentComment);
                    } else {
                        url = String.format("/api/tasks/{0}/comments", taskId);
                    }

                    return http.post(url, command)
                        .then(function (response) {
                            activity.commentText("");
                            activity.commentText.isModified(false);
                            $("#collapse" + activity.activityId).collapse("hide");
                        }).fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting;
                }
            });
        };

        ctor.prototype.isSelected = function (activity) {
            var _this = this;
            var selectedActivityId = _this.selectedActivityId();
            if (!selectedActivityId) {
                return false;
            }

            var isExists = _.find(activity.relatedActivities(), function (ra) {
                return ko.unwrap(ra.notificationId) === selectedActivityId;
            });

            return selectedActivityId === ko.unwrap(activity.notificationId) || isExists;
        };

        ctor.prototype.resetFilter = function () {
            var _this = this;
            _this.advancedFilterActive(false);
            _this.filter.reset();
            return _this.loadActivities(true);
        };

        ctor.prototype.loadMore = function () {
            var _this = this;
            return _this.loadActivities();
        };

        ctor.prototype.refreshActivities = function () {
            var _this = this;
            return _this.loadActivities(true);
        };


        ctor.prototype.loadSingleActivity = function (activityId) {
            var _this = this;
            var url = String.format("/api/activities/{0}", activityId);
            var existsActivities = _.pluck(_this.activities(), "notificationId");
            return http.get(url)
                .then(function (response) {
                    var data = [response];
                    _.each(data, function (a, index, list) {
                        if (_.contains(existsActivities, a.notificationId)) {
                            return;
                        }
                        var ac = _this.extendAndMap(a);

                        // notification
                        var body = ac.taskId ? String.format("Project: {0}, Task: {1}", ac.projectName, ac.taskName)
                            : String.format("Project: {0}", ac.projectName);
                        var header = String.format("{0} by {1}", ac.localizationResource.header, ko.unwrap(ac.actor.fullName));
                        //  notifier.notify(header, body, ac.actor);

                        _this.activities.push(ac);

                        ko.postbox.publish("NewActivityAdded", {
                            priority: ac.priority
                        });
                    });
                }).fail(_this.handleError);
        };


        ctor.prototype.showTask = function (activity) {
            var _this = this;
            var taskId = ko.unwrap(activity.taskId) || false;
            if (taskId === false) {
                return;
            }
            var projectId = ko.unwrap(activity.projectId);

            system.acquire("task/task")
                .then(function (taskVm) {
                    var taskView = new taskVm(taskId, projectId);
                    _this.selectedProject.deactivate(true);
                    _this.reportModule.deactivate(true);
                    _this.selectedTask.activateItem(taskView);
                    _this.selectedActivityId(activity.notificationId);
                });

        };

        ctor.prototype.showReport = function ()
        {
            var _this = this;
            system.acquire("dashboard/report-user-defined")
                . then(function (reportVm) {
                    _this.selectedProject.deactivate(true);
                    _this.selectedTask.deactivate(true);
                    var reportViewModule = new reportVm();
                    return _this.reportModule.activateItem(reportViewModule);

                });

        };

        ctor.prototype.showProject = function (activity) {
            var _this = this;
            var projectId = ko.unwrap(activity.projectId) || false;
            if (projectId === false) {
                return;
            }

            system.acquire("project/project")
                .then(function (projectVm) {
                    var projectView = new projectVm();
                    _this.selectedTask.deactivate(true);
                    _this.reportModule.deactivate(true);
                    _this.selectedProject.activateItem(projectView, projectId);
                    _this.selectedActivityId(activity.notificationId);
                });
        };

        ctor.prototype.applyFilter = function () {
            var _this = this;
            _this.advancedFilterActive(true);
            ko.postbox.publish("ActivityFilterChanged", _this.filter);
        };
        ctor.prototype.removeItem = function (elem) {
            if (elem.nodeType === 1) {
                $(elem).fadeOut(300, function () {
                    $(elem).remove();
                });
            }
        };

        ctor.prototype.markAsPin = function (activity) {
            var _this = this;
            if (activity.flagged()) {
                return;
            }
            var url = String.format("/api/activities/{0}/pin", activity.notificationId);
            http.put(url, {}).then(function () {
                activity.flagged(true);
                _this.activities.remove(activity);
            }).fail(_this.handleError);
        };
        ctor.prototype.markAsRead = function (activity) {
            var _this = this;
            var activities = activity.relatedActivities();
            activities.push(activity);

            var ids = _.pluck(activities, "notificationId").join(",");
            var url = String.format("/api/activities/read?type=batch&ids={0}", ids);
            http.put(url).then(function () {
                ko.postbox.publish("ActivityRead", {
                    priority: activity.priority
                });
                _this.activities.removeAll(activities);
            }).fail(_this.handleError);
        };

        ctor.prototype.markScreenAsRead = function () {
            var _this = this;
            var ids = _.pluck(_this.activities(), "notificationId").join(",");
            var url = String.format("/api/activities/read?type=batch&ids={0}", ids);
            http.put(url).then(function () {
                return _this.loadActivities(true);
            }).fail(_this.handleError);
        };
        ctor.prototype.markTaskAsRead = function (activity) {
            var _this = this;
            var url = String.format("/api/activities/read?type=task&taskId={0}", activity.taskId);
            http.put(url).then(function () {
                return _this.loadActivities(true);
            }).fail(_this.handleError);
        };
        ctor.prototype.markProjectAsRead = function (activity) {
            var _this = this;
            var url = String.format("/api/activities/read?type=project&projectId={0}", activity.projectId);
            http.put(url).then(function () {
                return _this.loadActivities(true);
            }).fail(_this.handleError);
        };
        ctor.prototype.markProjectActorEvent = function (activity) {
            var _this = this;
            var url = String.format("/api/activities/read?type=project-actor-event&projectId={0}&actorId={1}&event={2}", activity.projectId, activity.actorId, activity.verb);
            http.put(url).then(function () {
                return _this.loadActivities(true);
            }).fail(_this.handleError);
        };
        ctor.prototype.markAllAsRead = function () {
            var _this = this;
            var url = "/api/activities/read?type=all";
            http.put(url).then(function () {
                return _this.loadActivities(true);
            }).fail(_this.handleError);
        };
        ctor.prototype.markAllMediumsAsRead = function () {
            var _this = this;
            var url = String.format("/api/activities/read?type=priority&priority={0}", "medium");
            http.put(url).then(function () {
                return _this.loadActivities(true);
            }).fail(_this.handleError);
        };
        ctor.prototype.markAllLowsAsRead = function () {
            var _this = this;
            var url = String.format("/api/activities/read?type=priority&priority={0}", "low");
            http.put(url).then(function () {
                return _this.loadActivities(true);
            }).fail(_this.handleError);
        };

        ctor.prototype.markAsUnRead = function (activity) {
            var _this = this;
            var url = String.format("/api/activities/{0}/read", activity.notificationId);
            http.delete(url).then(function () {
                activity.status = 0;
                _this.activities.remove(activity);
            }).fail(_this.handleError);
        };




        ctor.prototype.cancelComment = function () {
            var activity = this;
            activity.commentText("");
            activity.commentText.isModified(false);
            $("#collapse" + activity.activityId).collapse("hide");
        };

        ctor.prototype.refresh = function () {
            var _this = this;
            return _this.loadActivities(true);
        };



        ctor.prototype.extendAndMap = function (a) {
            var _this = this;
            var ac = a;
            ac.taskId = a.objectType === "Task" ? a.objectId : "";
            ac.projectId = a.objectType === "Project" ? a.objectId : a.targetId;
            ac.taskName = a.objectType === "Task" ? a.objectDisplayName : "";
            ac.projectName = a.objectType === "Project" ? a.objectDisplayName : a.targetDisplayName;
            ac.localizationResource = ctor.setLocalizationResource(a);
            ac.actor = context.getUserById(a.actorId);

            ac.publishedTimeText = ko.pureComputed(function () {
                if (_this.useShortenDateFormat()) {
                    return utils.timeFromNow(ko.unwrap(a.publishedAt));
                }

                return utils.formatLogDateTime(ko.unwrap(a.publishedAt));
            });

            ac.visible = ko.observable(true);
            ac.relatedActivities = ko.observableArray([]);
            ac.sortedRelatedActivities = ko.pureComputed(function () {
                if (a.relatedActivities().length === 0) {
                    return [];
                }
                var result;
                if (_this.filter.sorting() === "newest") {
                    result = _.sortBy(a.relatedActivities(), function (ra) {
                        return ra.publishedAt;
                    });
                    result = result.reverse();
                } else {
                    result = _.sortBy(a.relatedActivities(), function (ra) {
                        return ra.publishedAt;
                    });
                }

                return result;
            }).extend({ deferred: true });
            ac.isReplyCommentEnabled = true; // a.verb.toLowerCase().indexOf("comment") > -1; //&& (a.extraContext.commentId || a.extraContext.parentCommentId);

            ac.flagged = ko.observable(a.status === 4);
            ac.canShowAttachmentImages = ko.observable(false);

            ac.tableRow = ctor.getTableRow(a);
            ac.attachments = ctor.getAttachments(a);
            ac.hasAttachments = a.attachments.length > 0;
            ac.viewableAttachments = ko.computed(function () {
                if (_this.canShowAttachmentImages() || a.canShowAttachmentImages()) {
                    return _.filter(a.attachments, function (att) {
                        return att.viewable;
                    });
                }
                return [];
            }, ac).extend({ deferred: true });

            if (ac.isReplyCommentEnabled) {
                ac.commentText = ko.observable().extend({
                    required: true
                });
            }

            return ac;
        };


        ctor.prototype.loadActivities = function (refresh) {
            var _this = this;
            refresh = refresh || false;
            var url = "/api/activities";
            var newDataSet = false;
            var criteria = ko.toJS(_this.filter);
            criteria.priority = criteria.priority.join();
            criteria.status = criteria.status.join();
            var filters = utils.toQueryString(criteria);

            var f2;
            if (refresh || _this.usedFilter === null || (_this.usedFilter !== null && _this.usedFilter !== filters)) {
                newDataSet = true;
                criteria.skip = 0;
                f2 = utils.toQueryString(criteria);
                url = String.format("/api/activities?{0}", f2);
                _this.hasNewPage(true);
            } else {
                criteria.skip = _this.activities().length;
                f2 = utils.toQueryString(criteria);
                url = String.format("/api/activities?{0}", f2);
            }

            return http.get(url)
                .then(function (response) {

                    if (newDataSet) {
                        _this.activities([]);
                    }

                    var activities = [];
                    var existsActivities = _.pluck(_this.activities(), "notificationId");
                    _.each(response.data, function (a, index, list) {
                        var ac = _this.extendAndMap(a);
                        if (ac.localizationResource !== null && _.contains(existsActivities, ac.notificationId) === false)
                        {
                            activities.push(ac);
                        }
                    });


                    _this.activities.push.apply(_this.activities, activities);
                    _this.hasNewPage(response.data.length > 0);
                    _this.usedFilter = filters;
                }).fail(_this.handleError);
        };

        ctor.prototype.subscribeTo = function (name, handler) {
            var _this = this;
            _this.subscriptions.push(ko.postbox.subscribe(name, handler));
        };

        ctor.prototype.activate = function () {
            var _this = this;

            return _this.loadActivities(true);
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
            _this.selectedTask.deactivate(true);
            _this.selectedProject.deactivate(true);
            _this.advancedFilterActive(false);
        };

        ctor.prototype.attached = function (view) {
            var _this = this;



            _this.subscribeTo("StartBackNavigation", function (ev) {
                _this.selectedTask.deactivate(true);
                _this.selectedProject.deactivate(true);
                _this.reportModule.deactivate(true);

                ko.postbox.publish("BackNavigationCompleted");
            });

            _this.subscribeTo("NewActivityCreated", function (params) {
                return _this.loadSingleActivity(params.activityId);
            });

            _this.subscribeTo("ActivityFilterChanged", function (filter) {
                _this.loadActivities();
            });

            $(view).on("click", ".block-activity-content", function (event) { // click event
                var link = $(event.target);
                if (link.is("a")) {
                    return true;
                }

                event.preventDefault();
                var a = ko.dataFor(this);
                var taskId = ko.utils.unwrapObservable(a.taskId);
                var projectId = ko.unwrap(a.projectId);

                _this.selectedTask.deactivate(true);
                _this.selectedProject.deactivate(true);

                if (taskId) {
                    _this.showTask(a);
                } else if (projectId) {
                    _this.showProject(a);
                }
            });

            if (!utils.browser.isXsMobileScreen()) {
                _this.showReport();
            }


        };

        ctor.setLocalizationResource = function (data) {
            var disabledVerbs = ["CommentDownVoted"];
            if (_.contains(disabledVerbs, data.verb)) {
                return null;
            }

            var objectData = data.extraContext;
            $.escapeJSON(data.objectData);
            var oldIsEmptyOrNull = false;
            for (var propertyName in objectData) {
                if (propertyName.indexOf("tags") > -1) {
                    var v = objectData[propertyName];
                    if (v && _.isArray(v)) {
                        if (v.length > 0) {
                            var first = v[0];
                            if (typeof v === "string") {
                                objectData[propertyName] = v.join(",");
                            } else if (typeof v === "object") {
                                if (_.has(first, "value")) {
                                    objectData[propertyName] = _.pluck(v, "value").join(",");
                                }
                            }
                        }
                        else {
                            objectData[propertyName] = "";
                        }
                    }
                }

            
                if (propertyName.startsWith("old") && objectData[propertyName] === null) {
                    oldIsEmptyOrNull = true;
                }
            }

            if(data.verb==="TaskRescheduled" || data.verb==="ProjectRescheduled"){
                oldIsEmptyOrNull=false;
            }


            var disable = String.format("app:pages.activities.events.{0}{1}.disable", data.verb, oldIsEmptyOrNull ? "_New" : "");
            var headerKey = String.format("app:pages.activities.events.{0}{1}.header", data.verb, oldIsEmptyOrNull ? "_New" : "");
            var contentKey = String.format("app:pages.activities.events.{0}{1}.content", data.verb, oldIsEmptyOrNull ? "_New" : "");

            var isMention = ko.unwrap(data.isMentionActivity);
            if (isMention) {
                headerKey = String.format("app:pages.activities.events.{0}{1}.header", data.verb, "_Mention");
            }

            var content = i18n.exists(contentKey) ? i18n.t(contentKey, objectData) : null;
            var header = i18n.t(headerKey, objectData);
            if (!header) {
                return false;
            }
            return {
                header: header,
                content: content
            };
        };

        ctor.getTableRow = function (activity) {
            if (!activity.extraContext) {
                return false;
            }

            if (activity.extraContext.rowId && activity.extraContext.row) {
                return activity.extraContext.row;
            }

            return false;
        };

        ctor.getAttachments = function (activity) {
            if (!activity.extraContext) {
                return [];
            }

            var verb = activity.verb;
            if (verb === "NewCommentAdded" || verb === "ReplyCommentAdded") {
                return _.chain(activity.extraContext.attachments)
                    .map(function (att) {
                        return {
                            viewUrl: helpers.createThumbnailImageUrl(activity.taskId, att.attachmentId, att.version, 0, context.authToken()),
                            name: att.name,
                            viewable: att.fileInfo.isImage,
                            fileInfo: att.fileInfo,
                            downloadUrl: helpers.createDownloadUrl(activity.taskId, att.attachmentId, att.version, 0, context.authToken()),
                            viewName: att.attachmentName === att.fileInfo.actualName ? att.attachmentName : String.format("{0} | {1}", att.attachmentName, att.fileInfo.actualName)
                        };
                    })
                    .value();
            }

            if (verb === "TaskAttachmentAdded" || verb === "CommentAttachmentAdded" || verb === "AttachmentVersionAdded") {
                if (!activity.extraContext.fileInfo) {
                    return [];
                }

                return [{
                    viewUrl: helpers.createThumbnailImageUrl(activity.taskId, activity.extraContext.attachmentId, activity.extraContext.version, 0, context.authToken()),
                    name: activity.extraContext.name,
                    viewable: activity.extraContext.fileInfo.isImage,
                    fileInfo: activity.extraContext.fileInfo,
                    downloadUrl: helpers.createDownloadUrl(activity.taskId, activity.extraContext.attachmentId, activity.extraContext.version, 0, context.authToken()),
                    viewName: activity.extraContext.name === activity.extraContext.fileInfo.actualName ? activity.extraContext.name : String.format("{0} | {1}", activity.extraContext.name, activity.extraContext.fileInfo.actualName)
                }];
            }

            return [];
        };


        return ctor;
    });
