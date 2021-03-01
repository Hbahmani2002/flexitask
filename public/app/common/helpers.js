﻿define(["twitter-text", "common/initial", "moment", "config", "amplify", "plugins/router", "durandal/events", "durandal/app", "jquery", "plugins/http", "underscore", "common/errorhandler", "common/utils", "knockout"],
    function (twitterText, initial, moment, config, amplify, router, events, app, $, http, _, errorHandler, utils, ko) {

        var deletedUserAvatar = initial.create("X");

        function flatFolders(data, indent) {
            var items = [];
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                var name = item.name;
                if (indent > 0) {
                    var indentText = new Array(indent + 1).join("—");
                    name = String.format("{0} {1}", indentText, name);
                }
                items.push({
                    name: name,
                    id: item.id
                });
                if (item.subFolders && item.subFolders.length > 0) {
                    var innerIndent = indent + 1;
                    Array.prototype.push.apply(items, flatFolders(item.subFolders, innerIndent));
                }
            }
            return items;
        }

        var statusColors = [{
            id: 0,
            name: "None",
            color: "#D3D3D3"
        },
        {
            id: 1,
            name: "NotStarted",
            color: "#D0C990"
        },
        {
            id: 2,
            name: "OnHold",
            color: "#96C6C7"
        },
        {
            id: 4,
            name: "InProgress",
            color: "#87A9BF"
        },
        {
            id: 8,
            name: "InPlanning",
            color: "#B891D6"
        },
        {
            id: 16,
            name: "Cancelled",
            color: "#778490"
        },
        {
            id: 32,
            name: "Completed",
            color: "#8BBB8B"
        },
        {
            id: 64,
            name: "WaitingForApproval",
            color: "#668CAD"
        }
        ];
        var vm = {};
        vm = {
            groupProjectFolders: function (folders) {
                var groups = [];
                for (var i = 0; i < folders.length; i++) {
                    var item = folders[i];
                    groups.push({
                        name: item.name,
                        id: item.id,
                        folders: flatFolders(item.folders, 0)
                    })
                }
                return groups;
            },
            getColorByStatus: function (statusValue) {
                var result = _.find(statusColors, function (currentColor) {
                    return currentColor.id === statusValue;
                });
                return result.color;

            },
            generateColorByTaskType: function (taskType) {
                taskType = ko.unwrap(taskType);
                if (taskType === undefined && taskType === null) {
                    return "transparent";
                }

                var taskBgColor = "";
                switch (taskType) {
                case 0:
                    taskBgColor = "transparent";
                    // task
                    break;
                case 1:
                    taskBgColor = "#e6e5eb";
                    // section
                    break;
                case 2:
                    taskBgColor = "#f7fae1";
                    // event
                    break;
                case 3:
                    taskBgColor = "#edf0ff";
                    // milestone
                    break;
                case 4:
                    taskBgColor = "#f8f0de";
                    //Ongoing work item
                    break;
                case 5:
                    taskBgColor = "#f1fcf2";
                    //Info
                    break;
                }
                return taskBgColor;
            },
            getAvatarOrDefault: function (user) {

                if (!user) {
                    return deletedUserAvatar;
                }

                if (!user.avatar || !ko.unwrap(user.avatar)) {
                    user.avatar = initial.create(ko.unwrap(user.initials));
                    return user.avatar;
                }

                if (user.avatar.startsWith("data:image/svg+xml;base64,")) {
                    return user.avatar;
                }

                // if(!user.avatar.startsWith("http")){
                //     // for better ux : http://stackoverflow.com/questions/9714525/javascript-image-url-verify/9714891#9714891
                //     user.avatar = config.cdnEndpoints.avatarPath + "/"+ ko.unwrap(user.avatar);
                // }

                return user.avatar;
            },
            getFormattedCustomFieldValue: function (context, defination, value, lookups) {
                var v = ko.unwrap(value);
                var type = lookups.customFieldTypes.get(defination.type);
                if (!type) {
                    return "";
                }
                if (type === lookups.customFieldTypes.DATE) {
                    return utils.formatDate(v);
                } else if (type === lookups.customFieldTypes.USER) {
                    return context.getUserFullNameOrDefaultById(value);
                }
                return v;
            },
            createPrivateLink: function (url, context) {
                if (!url) {
                    return url;
                }
                if (url.indexOf("?") > -1) {
                    return url + "&token=" + context.authToken();
                } else {
                    return url + "?token=" + context.authToken();
                }
            },
            getTags: function (text) {
                return twitterText.extractHashtags(text);
            },
            getMentionedUsers: function (text, context) {
                var t = this;
                var mentions = twitterText.extractMentionsWithIndices(text);
                var users = _.filter(_.map(mentions, function(mention) {
                    var u = context.getUserByUsername(mention.screenName);
                    return {
                        user: u,
                        username: mention.screenName,
                        mention: mention
                    };
                }), function (p) {
                    return p.user;
                });

                return _.map(users,function(p){
                    return p.user.id
                });
            },


            createThumbnailImageUrl: function (taskId, attachmentId, version, size, token) {
                var urlFormat = config.serviceEndpoints.baseEndpoint + "/api/tasks/{0}/attachments/{1}/download?action=view&version={2}&size={3}&token={4}";
                return String.format(urlFormat, taskId, attachmentId, version || 1, size || 0, token);
            },
            createDownloadUrl: function (taskId, attachmentId, version, size, token) {
                var urlFormat = config.serviceEndpoints.baseEndpoint + "/api/tasks/{0}/attachments/{1}/download?action=download&version={2}&size={3}&token={4}";
                return String.format(urlFormat, taskId, attachmentId, version || 1, size || 0, token);
            },

          
            orderTaskGetPosition: function (tasks, currentTask, order) {
                var pos = -1;
                var taskIndex = _.indexOf(tasks, currentTask);

                if (order === "up") {
                    if (taskIndex - 1 >= 0) {
                        var prev = tasks[taskIndex - 1];
                        var morePrev = tasks[taskIndex - 2];
                        if (morePrev) {
                            pos = prev.order() - ((prev.order() - morePrev.order()) / 2);
                        } else {
                            pos = prev.order() / 2;
                        }
                    }
                } else if (order === "down") {
                    if (taskIndex < tasks.length - 1) {
                        var next = tasks[taskIndex + 1];
                        var moreNext = tasks[taskIndex + 2];
                        if (moreNext) {
                            pos = moreNext.order() - ((moreNext.order() - next.order()) / 2);
                        } else {
                            pos = next.order() + 65536;
                        }
                    }
                }
                return pos;
            },


            getDependencyText: function (v, lookups) {
                v = ko.utils.unwrapObservable(v);
                return _.find(lookups.dependencies.getAll(), function (item) {
                    return item.value === v;
                }).text;
            },


            getTaskStatusClass: function (status) {
                var defaultCss = "task-status-none";
                status = ko.utils.unwrapObservable(status) || false;
                if (status === false) {
                    return defaultCss;
                }
                var value = ko.unwrap(status) || status;
                switch (value) {
                case 0:
                    return "task-status-none";
                case 1:
                    return "task-status-not-started";
                case 2:
                    return "task-status-on-hold";
                case 4:
                    return "task-status-in-progress";
                case 8:
                    return "task-status-in-planning";
                case 16:
                    return "task-status-cancelled";
                case 32:
                    return "task-status-completed";
                default:
                    return "task-status-waiting-for-approval";
                }
            },

            getProjectStatusClass: function (status) {
                var defaultCss = "project-status-none";
                status = ko.utils.unwrapObservable(status) || false;
                if (status === false) {
                    return defaultCss;
                }
                var value = ko.unwrap(status) || status;
                switch (value) {
                case 0:
                    return "project-status-none";
                case 1:
                    return "project-status-in-planning";
                case 2:
                    return "project-status-on-hold";
                case 4:
                    return "project-status-in-progress";
                case 8:
                    return "project-status-waiting-for-approval";
                case 32:
                    return "project-status-completed";
                default:
                    return "project-status-waiting-for-approval";
                }
            },

            navigations: {
                // loadTask: function(projectId, taskId, parameters) {
                //    var hash = "#projects/" + projectId + "/tasks/" + taskId;
                //    router.navigate(hash, false);
                //    app.trigger('navigation:loadtask', taskId);
                // },
                getTaskNavigationUrl: function (projectId, taskId) {
                    projectId = ko.utils.unwrapObservable(projectId);
                    taskId = ko.utils.unwrapObservable(taskId);
                    return String.format("#projects/{0}/tasks/{1}", projectId, taskId);
                },

                getProjectNavigationUrl: function (projectId) {
                    projectId = ko.utils.unwrapObservable(projectId);
                    return String.format("#projects/{0}", projectId);
                }
            },
            utils: utils
        };


        vm.getTaskPriorityClass = function (task, lookups) {
            if (ko.unwrap(task.taskType) !== lookups.taskType.TASK.value) {
                return "type--section";
            }
            var css = "priority ";
            if (ko.unwrap(task.isArchived)) {
                css = "archived";
            }
            var priority = ko.unwrap(task.priority) || false;
            if (priority === false) {
                return css;
            }
            var value = priority;
            switch (value) {
            case 0:
                css += "priority-low";
                break;
            case 1:
                css += "priority-normal";
                break;
            case 2:
                css += "priority-high";
                break;
            case 4:
                css += "priority-critical";
                break;
            default:
                css += "archived";
            }

            return css;
        };

        vm.getProjectStartDateColor = function (project, lookups) {
            var defaultCss = "project-start-invalid";
            if (project === null) {
                return defaultCss;
            }

            var startDate = ko.utils.unwrapObservable(project.startDate) || false;
            if (startDate === false) {
                return defaultCss;
            }

            var status = ko.toJS(project.status) || false;
            var sv = status;
            if (sv === lookups.projectStatus.NONE.value || sv === lookups.projectStatus.INPLANNING.value || sv === lookups.projectStatus.NOTSTARTED.value) {
                var now = moment();
                var diff = moment(startDate).diff(now, "days");
                if (diff < 0) {
                    return "project-start-past";
                } else {
                    return defaultCss;
                }
            } else {
                return defaultCss;
            }
        };

        vm.getTaskStartDateColor = function (task, lookups) {
            var defaultCss = "task-start-invalid";
            if (task === null) {
                return defaultCss;
            }

            var startDate = ko.utils.unwrapObservable(task.startDate) || false;
            if (startDate === false) {
                return defaultCss;
            }

            var status = ko.toJS(task.status) || false;
            var sv = status;
            if (sv === lookups.taskStatus.NONE.value || sv === lookups.taskStatus.INPLANNING.value || sv === lookups.taskStatus.NOTSTARTED.value) {
                var now = moment();
                var diff = moment(startDate).diff(now, "days");
                if (diff < 0) {
                    return "task-start-past";
                } else {
                    return defaultCss;
                }
            } else {
                return defaultCss;
            }
        };

        vm.getTaskDueDateColor = function (task, lookups) {
            var defaultCss = "task-due-invalid";
            if (task === null) {
                return defaultCss;
            }

            var dueDate = ko.utils.unwrapObservable(task.dueDate) || false;
            if (dueDate === false) {
                return defaultCss;
            }

            var status = ko.toJS(task.status) || false;
            var sv = status;
            if (sv === lookups.taskStatus.COMPLETED.value || sv === lookups.taskStatus.CANCELLED.value || sv === lookups.taskStatus.ONHOLD.value) {
                return defaultCss;
            }

            var now = moment();
            var diff = moment(dueDate).diff(now, "days");
            if (diff < 0) {
                return "task-due-past";
            }
            if (diff === 0) {
                return "task-due-recently-past";
            } else if (diff <= 2) {
                return "task-due-soon";
            } else if (diff > 2) {
                return "task-due-relax";
            } else {
                return defaultCss;
            }
        };

        vm.getProjectDueDateColor = function (project, lookups) {
            var defaultCss = "project-due-invalid";
            if (project === null) {
                return defaultCss;
            }

            var dueDate = ko.utils.unwrapObservable(project.dueDate) || false;
            if (dueDate === false) {
                return defaultCss;
            }

            var status = ko.toJS(project.status) || false;
            var sv = status;
            if (sv === lookups.projectStatus.COMPLETED.value || sv === lookups.projectStatus.CANCELLED.value || sv === lookups.projectStatus.ONHOLD.value) {
                return defaultCss;
            }

            var now = moment();
            var diff = moment(dueDate).diff(now, "days");
            if (diff < 0) {
                return "project-due-past";
            }
            if (diff === 0) {
                return "project-due-recently-past";
            } else if (diff <= 2) {
                return "project-due-soon";
            } else if (diff > 2) {
                return "project-due-relax";
            } else {
                return defaultCss;
            }
        };


        errorHandler.includeIn(vm);
        return vm;
    });