define(["common/context", "jquery", "common/helpers", "common/utils", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore"],
    function (context, $, helpers, utils, i18n, dialog, http, composition, notification, app, ko, errorhandler, _) {


        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.helpers = helpers;
            this.context = context;
            this.utils = utils;
            this.taskId = null;
            this.projectId = null;
            this.hasNewPage = ko.observable(true);
            this.activities = ko.observableArray([]);
            this.canShowAttachmentImages = ko.observable(false);
            this.usedFilter = null;
            this.filter = {
                group: ko.observable("none"),
                sort: ko.observable("desc"),
                includeSubTasks: ko.observable(false),
                includeTasks: ko.observable(false),
                reset: function () {
                    this.group("none");
                    this.sort("desc");
                    this.includeSubTasks(false);
                    this.includeTasks(false);
                }
            };
            this.filteredActivities = ko.computed(function () {
                var group = _this.filter.group() || "none";
                if (group == "none")
                    return _this.activities();

                var result = _.sortBy(_this.activities(), function (a) {
                    if (group == "task") {
                        return String.format("{0}_{1}", a.taskId, a.publishedAt);
                    } else if (group == "user") {
                        return String.format("{0}_{1}", a.actorId, a.publishedAt);
                    }
                });

                result = result.reverse();
                return result;
            }, null, {
                deferEvaluation: true
            });

            this.filter.includeSubTasks.subscribe(function (v) {
                _this.load();
            });

            this.filter.includeTasks.subscribe(function (v) {
                _this.load();
            });

            this.isMultiTaskView = ko.pureComputed(function () {
                var g = _.countBy(_this.activities(), "taskId");
                return Object.keys(g).length > 1 || Object.keys(g)[0] !== _this.taskId;
            });


        };

        ctor.prototype.isTaskView = function () {
            var _this = this;
            return _this.taskId != null && _this.projectId != null;
        };

        ctor.prototype.loadMore = function () {
            var _this = this;
            return _this.load();
        };

        ctor.prototype.load = function (refresh) {
            var _this = this;
            refresh = refresh || false;
            var newDataSet = false;
            var url = "";
            var criteria = ko.toJS(_this.filter);
            var filters = utils.toQueryString(criteria);

            var f2;
            if (refresh || _this.usedFilter === null || (_this.usedFilter !== null && _this.usedFilter !== filters)) {
                newDataSet = true;
                criteria.skip = 0;
                f2 = utils.toQueryString(criteria);
                url = ctor.getHttpUrl(_this.taskId, _this.projectId, f2);
                _this.hasNewPage(true);
            } else {
                criteria.skip = _this.activities().length;
                f2 = utils.toQueryString(criteria);
                url = ctor.getHttpUrl(_this.taskId, _this.projectId, f2);
            }



            return http.get(url)
                .then(function (response) {
                    _.each(response.data, function (a, index, list) {
                        a.taskId = a.objectType == "Task" ? a.objectId : "";
                        a.projectId = a.objectType == "Project" ? a.objectId : a.targetId;
                        a.taskName = a.objectType == "Task" ? a.objectDisplayName : "";
                        a.projectName = a.objectType == "Project" ? a.objectDisplayName : a.targetDisplayName;
                        a.actor = context.getUserById(a.actorId);
                        a.localizationResource = ctor.setLocalizationResource(a);
                        a.canShowAttachmentImages = ko.observable(false);
                        a.attachments = ctor.getAttachmentsFromActivity(a);
                        a.hasAttachments = a.attachments.length > 0;
                        a.viewableAttachments = ko.computed(function () {
                            if (_this.canShowAttachmentImages() || a.canShowAttachmentImages()) {
                                return _.filter(a.attachments, function (att) {
                                    return att.viewable;
                                });
                            }
                            return [];

                        }, a);
                    });
                    if (newDataSet) {
                        _this.activities([]);
                    }
                    _this.activities.push.apply(_this.activities, response.data);
                    _this.hasNewPage(response.data.length > 0);
                    _this.usedFilter = filters;
                });
        };

        ctor.prototype.changeGroupingFilter = function (viewModel, event) {
            var _this = this;
            var target = $(event.target);
            if (target) {
                var filter = target.data("filter");
                _this.filter.group(filter);
            }
        };

        ctor.prototype.changeSortDirection = function () {
            var _this = this;
            var sort = _this.filter.sort();
            if (sort == "asc")
                _this.filter.sort("desc");
            else
                _this.filter.sort("asc");
            _this.applyFilter();
        };

        ctor.prototype.applyFilter = function () {
            var _this = this;
            _this.load();
            return true;
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId;
            _this.projectId = settings.projectId;
            return _this.load();
        };

        ctor.prototype.attached = function (view) {
            var _this = this;
        };

        ctor.prototype.deactivate = function () {
            var _this = this;
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
                        } else {
                            objectData[propertyName] = "";
                        }
                    }
                }


                if (propertyName.startsWith("old") && objectData[propertyName] === null) {
                    oldIsEmptyOrNull = true;
                }
            }

            if (data.verb === "TaskRescheduled" || data.verb === "ProjectRescheduled") {
                oldIsEmptyOrNull = false;
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

        ctor.getHttpUrl = function (taskId, projectId, filters) {
            if (taskId) {
                return String.format("/api/tasks/{0}/activities?{1}", taskId, filters);
            } else if (projectId) {
                return String.format("/api/projects/{0}/activities?{1}", projectId, filters);
            }
        };

        ctor.getAttachmentsFromActivity = function (activity) {
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