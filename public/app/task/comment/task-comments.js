define(["twitter-text","moment", "amplify", "durandal/system", "common/lookups", "common/prefs", "config", "durandal/events", "common/autocomplete", "common/helpers", "plugins/dialog", "plugins/http", "i18n", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/context", "common/utils"],
    function (twitterText,moment, amplify, system, lookupFactory, prefs, config, events, autocomplete, helpers, dialog, http, i18n, composition, notifications, app, ko, errorhandler, _, context, utils) {

        
        function Comment() {
            var self = this;
            this.commentText = ko.observable("").extend({
                required: true
            });
            this.position = ko.observable(50).extend({
                number: true
            });
            this.attachments = ko.observableArray([]);
            this.commentId = ko.observable();
            this.errors = ko.validation.group(this);
            this.reset = function () {
                self.commentText("");
                self.attachments([]);
                self.commentId(null);
            };
            this.parent = null;
            this.dirtyFlag = new ko.DirtyFlag(this);
            this.isDirty = function () {
                return self.dirtyFlag().isDirty();
            };

            this.isMyReply = function (parentComment) {
                return self.parent === parentComment;
            };
        }
        var ctor = function () {
            var _this = this;
            errorhandler.includeIn(this);
            this.utils = utils;
            this.prefs = prefs;
            this.context = context;
            this.helpers = helpers;
            this.lookups = lookupFactory.create();
            this.autocomplete = autocomplete;
            this.useShortenDateFormat = ko.observable(typeof amplify.store("comments/useShortenDataFormat") === "undefined" ? false : amplify.store("comments/useShortenDataFormat"));
            this.uploadingFile = ko.observable(false);
            this.taskId = null;
            this.projectId = null;
            this.comments = ko.observableArray([]);
            this.pinnedComments = ko.observableArray([]);
            this.newComment = ko.observable();
            this.replyComment = ko.observable(null);
            this.sortType = ko.observable("newest");
            this.canShowAttachmentImages = ko.observable(typeof amplify.store("comments/showImages") === "undefined" ? false : amplify.store("comments/showImages"));
            this.showingPinnedComments = ko.observable(true);
            this.showingOnlyComment = ko.observable(false);
            this.showingUntruncatedComments = ko.observable(false);
            this.viewMode = ko.observable(_this.lookups.commentViewModes.CHRONOLOGICAL);
            this.allowedCommentReplyLevel = 0;
            this.subscriptions = [];
            this.voteStatus = _this.lookups.commentVoteStatus.OFF;
            this.votingMode = _this.lookups.commentVoteModes.UP;
            this.defaultSorting = _this.lookups.commentSortModes.Newest;
            this.useShortenDateFormat.subscribe(function (v) {
                amplify.store("comments/useShortenDataFormat", v);
            });
            this.canShowAttachmentImages.subscribe(function (v) {
                amplify.store("comments/showImages", v);
            });
            this.atjsOptions = {
                selector: ".md-input",
                settings: [
                    
                    {
                    // tags
                        at: "#",
                        callbacks: {
                            remoteFilter: function (query, callback) {
                                if (query.length < 2) {
                                    return false;
                                }

                                var  q= encodeURIComponent(query);
                                var url = String.format("/api/search/typeahead?type=tag&query={0}&projectId={1}",q,_this.projectId);

                                http.get(url).then(function(data){
                                    callback(data);
                                });
                            },
                            matcher: function (flag, subtext, should_startWithSpace) {
                                var r  = twitterText.extractHashtagsWithIndices(subtext);
                                if(r.length===0){
                                    return null;
                                }
                                var lastHashtag = r[r.length-1];
                                if(subtext.length>lastHashtag.indices["1"]){
                                    return null;
                                }
                                return lastHashtag.hashtag;
                            }
                        },
                        displayTpl: "<li>${value}</li>",
                        insertTpl: "${atwho-at}${value}",
                        searchKey: "value"
                    }, {
                    // mentions
                        at: "@",
                        data:context.users,
                        callbacks: {
                           
                           
                            matcher: function (flag, subtext, should_startWithSpace) {
                                var acceptSpaceBar = true;
                                var a = decodeURI("%C3%80");
                                var y = decodeURI("%C3%BF");
                                var space = acceptSpaceBar ? "\ " : "";
                                var regexp = new RegExp(/@([^\s]*$)/, "gi");
                                var match = regexp.exec(subtext);
                                if (match) {
                                    return match[2] || match[1];
                                } else {
                                    return null;
                                }
                            }
                        },
                        displayTpl: "<li>${fullName}</li>",
                        insertTpl: "${atwho-at}${userName}",
                        searchKey: "fullName"
                    }]
            };
            if(config.emojiPath){
                this.atjsOptions.settings.push({
                    at: ":",
                    data: utils.emojiList,
                    displayTpl: "<li>${name} <img src='" + config.emojiPath+"'  height='20' width='20' /></li>",
                    insertTpl: ":${key}:",
                    limit:20,
                    delay: 400
                });
            }
            this.isHierarchicalView = ko.computed(function () {
                return _this.viewMode() === _this.lookups.commentViewModes.HIERARCHICAL;
            });
            this.isChronologicalView = ko.computed(function () {
                return _this.viewMode() === _this.lookups.commentViewModes.CHRONOLOGICAL;
            });
            this.hasPinnedComments = ko.computed(function () {
                return _this.pinnedComments().length > 0;
            });
            this.filteredComments = ko.pureComputed(function () {
                if (_this.isHierarchicalView()) {
                    return _.filter(_this.comments(), function (c) {
                        return !c.parentCommentId();
                    });
                } else if (_this.isChronologicalView()) {
                    return _this.comments();
                }

                return [];
            });

            this.addCommentCommand = ko.asyncCommand({
                execute: function (callback) {
                    var commentText = _this.newComment().commentText();
                    var mentionedUsers = helpers.getMentionedUsers(commentText, context);
                    var tags = helpers.getTags(commentText);

                    var command = {
                        comment: commentText,
                        attachmentIds: _.pluck(ko.toJS(_this.newComment().attachments), "id"),
                        tags: tags,
                        mentions: mentionedUsers
                    };

                    var url = String.format("/api/tasks/{0}/comments", _this.taskId);
                    return http.post(url, command)
                        .then(function (response) {
                            // todo : don't fetch comment
                            return _this.loadComments().then(function () {
                                _this.newComment(null);
                            });
                        })
                        .fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.uploadingFile() === false && _this.newComment() && _this.newComment().commentText();
                }
            });

            this.addReplyCommentCommand = ko.asyncCommand({
                execute: function (callback) {

                    var reply = _this.replyComment();

                    if (reply.errors().length > 0) {
                        reply.errors.showAllMessages();
                        callback();
                        return;
                    }
                    var replyCommentText = reply.commentText();
                    var mentionedUsers = helpers.getMentionedUsers(replyCommentText, context);
                    var tags = helpers.getTags(replyCommentText);


                    var command = {
                        comment: replyCommentText,
                        attachmentIds: _.pluck(ko.toJS(reply.attachments), "id"),
                        tags: tags,
                        mentions: mentionedUsers
                    };
                    var parentComment = reply.parent;
                    var url = String.format("/api/tasks/{0}/comments/{1}/replies", _this.taskId, ko.unwrap(parentComment.commentId));


                    http.post(url, command)
                        .then(function (response) {
                            var viewType = _this.viewMode();
                            if (viewType === _this.lookups.commentViewModes.HIERARCHICAL) {
                                return _this.loadReplyComments(parentComment, true).then(function () {
                                    _this.cancelReplyForm();
                                    parentComment.replyCount(parentComment.replyCount() + 1); // fake because  eventual consistency
                                });
                            } else if (viewType === _this.lookups.commentViewModes.CHRONOLOGICAL) {
                                return _this.loadComments().then(function () {
                                    _this.cancelReplyForm();
                                });
                            }
                        })
                        .fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && _this.uploadingFile() === false && _this.replyComment() && _this.replyComment().commentText();
                }
            });
        };




        ctor.prototype.loadVersions = function (comment) {
            var _this = this;
            var url = String.format("/api/tasks/{0}/comments/{1}/versions", ko.unwrap(comment.taskId), ko.unwrap(comment.commentId));
            return http.get(url)

                .then(function (response) {
                    var versions = _.map(response, function (v) {
                        v.body = ko.observable();
                        v.author = context.getUserById(v.editedBy);
                        return v;
                    });
                    comment.versions(versions);
                }).fail(_this.handleError);
        };

        ctor.prototype.cancelAllUploads = function () {

        };

        ctor.prototype.getUploadComponentOptions = function () {
            var _this = this;
            var url = String.format("{0}/api/tasks/{1}/attachments?type=task/comment", config.serviceEndpoints.baseEndpoint, _this.taskId);
            return {
                url: url,
                pasteZone: $(".editor-active"),
                onCompleted: function (ev, data) {
                    var comment = ko.dataFor(this);
                    if (comment)
                        data.result.files.forEach(function (attachmentDto) {
                            var c = ko.mapping.fromJS(attachmentDto);
                            _this.extendAttachment(c);
                            comment.attachments.push(c);
                        });
                },
                taskId: _this.taskId,
                projectId: _this.projectId
            };
        };

        ctor.prototype.resetNewComment = function () {
            var _this = this;
            if (!_this.newComment()) {
                return;
            }
            if (_this.newComment().isDirty()) {
                notifications.confirm({
                    title: i18n.t("app:alerts.dirty.title"),
                    text: i18n.t("app:alerts.dirty.text"),
                    type: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#DD6B55",
                    confirmButtonText: i18n.t("app:alerts.dirty.discard"),
                    cancelButtonText: i18n.t("app:alerts.dirty.stay"),
                    closeOnConfirm: true,
                    closeOnCancel: true
                },
                function (isConfirm) {
                    if (isConfirm) {
                        _this.newComment(null);
                    }
                });
            } else {
                _this.newComment(null);
            }
        };

        ctor.prototype.newReplyForm = function (comment) {
            var replyComment = new Comment();
            replyComment.parent = comment;
            this.replyComment(replyComment);
        };


        ctor.prototype.cancelReplyForm = function () {
            this.replyComment().commentText("");
            this.replyComment().commentText.isModified(false);
            this.replyComment(null);
        };

        ctor.prototype.getUserFullName = function (userId) {
            var user = context.getUserById(ko.unwrap(userId));
            if (!user) {
                return "";
            }
            return user.fullName;
        };

        ctor.prototype.showCommentVoters = function (comment) {
            _.each(ko.unwrap(comment.votes), function (v) {
                if (!v.author) {
                    v.author = context.getUserById(ko.unwrap(v.collaboratorId));
                }
            });
            var modalVm = {
                helpers: helpers,
                context: context,
                viewUrl: "task/comment/task-comment-votes-modal",
                comment: comment,
                getUpVotes: function () {
                    var t = this;
                    return _.filter(t.comment.votes(), function (v) {
                        return ko.unwrap(v.value) === 1;
                    });
                },
                getDownVotes: function () {
                    var t = this;
                    return _.filter(t.comment.votes(), function (v) {
                        return ko.unwrap(v.value) === -1;
                    });
                }
            };
            dialog.showBsModal(modalVm);
        };

      

     

        ctor.prototype.showPinnedComments = function () {
            var _this = this;
            _this.showingPinnedComments(!_this.showingPinnedComments());
            if (_this.showingPinnedComments()) {
                _this.loadPinnedComments();
            }
        };
        ctor.prototype.showOnlyComment = function () {
            this.showingOnlyComment(!this.showingOnlyComment());
        };
        ctor.prototype.showUntruncatedComments = function () {
            this.showingUntruncatedComments(!this.showingUntruncatedComments());
        };

        ctor.prototype.showAttachmentImages = function () {
            this.canShowAttachmentImages(!this.canShowAttachmentImages());
        };

        ctor.prototype.isVoteEnabled = function () {
            var _this = this;
            return this.voteStatus !== _this.lookups.commentVoteStatus.OFF;
        };

        ctor.prototype.changeViewTypeAsHierarchical = function () {
            var _this = this;
            this.viewMode(_this.lookups.commentViewModes.HIERARCHICAL);
            this.loadComments();
        };
        ctor.prototype.changeViewTypeAsChronological = function () {
            var _this = this;
            this.viewMode(_this.lookups.commentViewModes.CHRONOLOGICAL);
            this.loadComments();
        };
        ctor.prototype.changeSortType = function (type, t) {
            this.sortType(type);
            this.loadComments();
        };

        ctor.prototype.deleteAttachment = function (comment, attachment, event) {
            var _this = this;
            notifications.confirm({
                title: i18n.t("app:pages.comment.promptdeleteattachmentheader"),
                text: i18n.t("app:pages.comment.promptdeleteattachment"),
                type: "warning",
                showCancelButton: true,
                confirmButtonText: i18n.t("app:alerts.delete.confirm"),
                cancelButtonText: i18n.t("app:alerts.delete.cancel"),
                closeOnConfirm: true,
                closeOnCancel: true
            },
            function (isConfirm) {
                if (isConfirm) {
                    http.delete(ko.unwrap(attachment.deleteUrl)).then(function () {
                        comment.attachments.remove(attachment);
                        notifications.success(i18n.t("app:pages.comment.promptdeleteattachmentconfirmtext"));
                    }).fail(_this.handleError);
                }
            });
        };


        ctor.prototype.pinComment = function (comment) {
            var _this = this;
            var taskId = _this.taskId;
            var commentId = comment.commentId();

            var url = String.format("/api/tasks/{0}/comments/{1}/pin", taskId, commentId);
            return http.put(url)
                .then(function (response) {
                    comment.isPinned(true);
                    _this.pinnedComments.push(comment);
                }).fail(_this.handleError);
        };

        ctor.prototype.unpinComment = function (comment) {
            var _this = this;
            var taskId = _this.taskId;
            var commentId = comment.commentId();

            var url = String.format("/api/tasks/{0}/comments/{1}/pin", taskId, commentId);
            return http.delete(url)
                .then(function (response) {
                    comment.isPinned(false);
                    _this.pinnedComments.remove(comment);
                }).fail(_this.handleError);
        };

        ctor.prototype.editComment = function (comment) {
            var _this = this;
            system.acquire("task/comment/task-comment-edit-modal").then(function (instance) {
                var modal = new instance(_this.taskId, _this.projectId, ko.unwrap(comment.commentId));
                modal.atjsOptions = _this.atjsOptions;

                dialog.showBsModal(modal);
            });
        };

        ctor.prototype.loadReplyComments = function (parentComment, forceLoad) {
            var _this = this;
            forceLoad = typeof forceLoad === "object" ? false : forceLoad;
            var pc = parentComment;

            var parentCommentId = ko.unwrap(parentComment.commentId);
            if (parentComment.replies().length > 0 && forceLoad === false) {
                _this.comments.remove(function (c) {
                    return c.parentCommentId() === parentCommentId;
                });
                parentComment.replies([]);
                return;
            }
            var url = String.format("/api/tasks/{0}/comments/{1}/replies?sort={2}", _this.taskId, parentCommentId, _this.sortType());
            return http.get(url)
                .then(function (response) {
                    var comments = [];
                    response.forEach(function (commentDto) {
                        var c = ko.mapping.fromJS(commentDto);
                        // c.parent = parentComment;
                        _this.extendComment(c, pc);
                        comments.push(c);
                    });

                    parentComment.replies([]);
                    parentComment.replies.push.apply(parentComment.replies, comments);
                    _this.comments.push.apply(_this.comments, comments);

                }).fail(_this.handleError);
        };

        ctor.prototype.loadPinnedComments = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/comments?view={1}&sort={2}&pinned=true", _this.taskId, _this.viewMode().name, _this.sortType());
            return http.get(url)
                .then(function (response) {
                    var comments = [];
                    response.forEach(function (commentDto) {
                        var c = ko.mapping.fromJS(commentDto);
                        _this.extendComment(c);
                        c.commentViewType = "pinned";
                        comments.push(c);
                    });

                    _this.pinnedComments([]);
                    _this.pinnedComments.push.apply(_this.pinnedComments, comments);
                }).fail(_this.handleError);
        };


        ctor.prototype.loadComments = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/comments?view={1}&sort={2}", _this.taskId, _this.viewMode().name, _this.sortType());
            return http.get(url)
                .then(function (response) {
                    var comments = [];
                    response.forEach(function (commentDto) {
                        var c = ko.mapping.fromJS(commentDto);
                        _this.extendComment(c);
                        comments.push(c);
                    });

                    _this.comments([]);
                    _this.comments.push.apply(_this.comments, comments);
                }).fail(_this.handleError);
        };


        ctor.prototype.deleteComment = function (comment) {
            var _this = this;
            var commentId = ko.unwrap(comment.commentId);

            notifications.confirm({
                title: i18n.t("app:pages.comment.promptdeletecomment"),
                text: i18n.t("app:pages.comment.promptdeletecommentheader"),
                type: "warning",
                showCancelButton: true,
                confirmButtonText: i18n.t("app:alerts.delete.confirm"),
                cancelButtonText: i18n.t("app:alerts.delete.cancel"),
                closeOnConfirm: true,
                closeOnCancel: true
            },
            function (isConfirm) {
                if (isConfirm) {
                    var url = String.format("/api/tasks/{0}/comments/{1}", _this.taskId, commentId);
                    return http.delete(url)
                        .then(function (response) {
                            if (comment.parent && comment.parent.replies && comment.parent.replies().length > 0) {
                                comment.parent.replyCount(comment.parent.replyCount() - 1);
                                comment.parent.replies.remove(comment);
                            }
                            _this.comments.remove(comment);
                            notifications.success(i18n.t("app:pages.comment.promptdeletecommentconfirmtext"));
                        }).fail(_this.handleError);
                }
            });

        };

        ctor.prototype.extendComment = function (c, parentComment) {
            var _this = this;
            c.author = context.getUserById(ko.unwrap(c.authorId));
            c.parentAuthor = context.getUserById(ko.unwrap(c.parentAuthorId));
            c.position = ko.observable(ko.unwrap(c.position)).extend({
                number: true
            });
            c.commentText = ko.revertableObservable(ko.unwrap(c.commentText) || "").extend({
                required: true,
                minLength: 1
            });
            c.replies = ko.observableArray([]);
            c.versions = ko.observableArray([]);

            if (parentComment) {
                c.parent = parentComment;
            }
            c.canReply = ko.computed(function () {
                return c.allParentIds && ko.unwrap(c.allParentIds).length < _this.allowedCommentReplyLevel;
            }, c).extend({
                deferred: true
            });
            c.canParentCommentTextVisible = ko.computed(function () {
                return _this.viewMode() === _this.lookups.commentViewModes.CHRONOLOGICAL && c.parentCommentId();
            }, c).extend({
                deferred: true
            });
            c.getMyVote = function () {
                return _.chain(ko.unwrap(c.votes))
                    .filter(function (v) {
                        return ko.unwrap(v.collaboratorId) === context.user().id;
                    })
                    .first()
                    .value();
            };

            c.getMyVoteValue = function () {
                var vote = _.chain(ko.unwrap(c.votes))
                    .filter(function (v) {
                        return ko.unwrap(v.collaboratorId) === context.user().id;
                    })
                    .first()
                    .value();
                if (vote) {
                    return ko.unwrap(vote.value);
                }

                return 0;
            };

            c.myVote = ko.computed(function () {
                _.chain(ko.unwrap(c.votes))
                    .filter(function (v) {
                        return ko.unwrap(v.collaboratorId) === context.user().id;
                    }).map(function (v) {
                        return v.value();
                    })
                    .first()
                    .value();
            }).extend({
                deferred: true
            });

            c.addVote = function (voteValue) {
                var myVote = c.getMyVote();
                if (myVote) {
                    c.votes.remove(myVote);
                }

                if (voteValue !== 0) {
                    c.votes.push({
                        value: ko.observable(voteValue),
                        collaboratorId: ko.observable(context.user().id)
                    });
                }
            };

            c.downVote = function () {
                c.addVote(-1);
            };

            c.upVote = function () {
                c.addVote(1);
            };


            c.totalUpVote = ko.computed(function () {
                return _.filter(ko.unwrap(c.votes), function (v) {
                    return ko.unwrap(v.value) === 1;
                }).length;
            }).extend({
                deferred: true
            });

            c.totalDownVote = ko.computed(function () {
                return _.filter(ko.unwrap(c.votes), function (v) {
                    return ko.unwrap(v.value) === -1;
                }).length;
            }).extend({
                deferred: true
            });

            c.canShowAttachmentImages = ko.observable(false);
            c.showAttachmentImages = function () {
                c.canShowAttachmentImages(!c.canShowAttachmentImages());
            };


            c.viewableAttachments = ko.computed(function () {

                if (_this.canShowAttachmentImages() || c.canShowAttachmentImages()) {
                    return _.filter(ko.unwrap(c.attachments), function (att) {
                        return ko.unwrap(att.isImage) && ko.unwrap(att.viewUrl);
                    });
                }
                return [];

            }, c).extend({
                deferred: true
            });

            c.errors = ko.validation.group(c);
            c.revert = function () {
                c.commentText.revert();
            };
            c.commit = function () {
                c.commentText.commit();
            };


            _.each(c.attachments(), function (att) {
                _this.extendAttachment(att);
            });


            c.voteDownCommand = ko.asyncCommand({
                execute: function (callback) {
                    var comment = this;
                    var commentId = comment.commentId();
                    var promise = $.Deferred();
                    var currentVote = comment.getMyVoteValue();
                    var url = String.format("/api/tasks/{0}/comments/{1}/votes", _this.taskId, commentId);
                    var addValue = 0;
                    if (currentVote === -1) { // already vote down
                        addValue = 0;
                        promise = http.delete(url);
                    } else if (currentVote === 1) {
                        addValue = -1;
                        promise = http.delete(url).then(function () {
                            return http.post(url, {
                                voteType: -1
                            });
                        });
                    } else { // no vote
                        addValue = -1;
                        promise = http.post(url, {
                            voteType: -1
                        });
                    }

                    return promise.then(function (r) {
                        comment.addVote(addValue);
                    }).fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting;
                }
            });

            c.voteUpCommand = ko.asyncCommand({
                execute: function (callback) {
                    var comment = this;
                    var commentId = comment.commentId();
                    var promise = $.Deferred();
                    var currentVote = comment.getMyVoteValue();
                    var url = String.format("/api/tasks/{0}/comments/{1}/votes", _this.taskId, commentId);
                    var addValue = 0;
                    if (currentVote === 1) { // already up down
                        addValue = 0;
                        promise = http.delete(url);
                    } else if (currentVote === -1) {
                        addValue = 1;
                        promise = http.delete(url).then(function () {
                            return http.post(url, {
                                voteType: 1
                            });
                        });
                    } else { // no vote
                        addValue = 1;
                        promise = http.post(url, {
                            voteType: 1
                        });
                    }

                    return promise.then(function (r) {
                        comment.addVote(addValue);
                    }).fail(_this.handleError).always(function () {
                        callback();
                    });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting;
                }
            });
        };

        ctor.prototype.extendAttachment = function (attachment) {
            var _this = this;

            if (!attachment.version) {
                attachment.version = ko.observable(0);
            }
            attachment.viewName = ko.unwrap(attachment.name) === ko.unwrap(attachment.actualName) ? ko.unwrap(attachment.name) : String.format("{0} | {1}", ko.unwrap(attachment.name), ko.unwrap(attachment.actualName));
            attachment.downloadUrl = ko.computed(function () {
                return attachment.downloadUrl() + "?version=" + attachment.version() + "&token=" + context.authToken();
            }, attachment);

            attachment.deleteUrl = ko.computed(function () {
                return attachment.deleteUrl() + "?version=" + attachment.version() + "&token=" + context.authToken();
            }, attachment);

            if (attachment.viewUrl) {
                attachment.viewUrl = ko.computed(function () {
                    return attachment.viewUrl() + "&version=" + attachment.version() + "&token=" + context.authToken();
                }, attachment);
            }
        };

        ctor.prototype.loadEntry = function (comment, entry) {
            var _this = this;
            var url = String.format("/api/tasks/{0}/comments/{1}/versions/{2}", _this.taskId, ko.unwrap(comment.commentId), ko.unwrap(entry.id));
            return http.get(url)
                .then(function (response) {
                    entry.body(response.body);
                }).fail(_this.handleError);
        };

        ctor.prototype.init = function (a, b, c, d) {

        };

        ctor.prototype.subscribeTo = function (name, handler) {
            var _this = this;
            _this.subscriptions.push(ko.postbox.subscribe(name, handler));
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId || null;
            _this.projectId = settings.projectId || null;
            _this.allowedCommentReplyLevel = settings.allowedCommentReplyLevel || 0;
            _this.voteStatus = settings.voteStatus || _this.lookups.commentVoteStatus.OFF;
            _this.votingMode = settings.votingMode || _this.lookups.commentVoteModes.UP;
            _this.sortType((settings.defaultSorting || _this.lookups.commentSortModes.Newest).text.toLowerCase());
            _this.sortType((settings.defaultSorting || _this.lookups.commentSortModes.Newest).text.toLowerCase());
            _this.viewMode(settings.viewMode || _this.lookups.commentViewModes.CHRONOLOGICAL);


            return _this.loadComments();
        };

        ctor.prototype.attached = function (view) {
            var _this = this;



            _this.subscribeTo("CommentUpdated", function (params) {
                var oldComment = _.find(_this.comments(), function (c) {
                    return c.commentId() === params.commentId;
                });
                if (!oldComment) {
                    return;
                }

                var parentComment = _.find(_this.comments(), function (c) {
                    return c.commentId() === ko.unwrap(oldComment.parentCommentId);
                });

                var url = String.format("/api/tasks/{0}/comments/{1}", _this.taskId, params.commentId);
                http.get(url).then(function (comment) {
                    var c = ko.mapping.fromJS(comment);
                    _this.extendComment(c, parentComment);
                    _this.comments.replace(oldComment, c);
                    if (parentComment) {
                        parentComment.replies.replace(oldComment, c);
                    }
                }).fail(_this.handleError);
            });

            $(view).find(".js--fake-comment-textbox").focus(function (ev) {
                _this.newComment(new Comment());
            });

            $(view)
                .off("click", ".toggle-button")
                .on("click", ".toggle-button", function (e) {
                    e.preventDefault();
                    var $this = $(this);
                    var target = $($this.data("target"));
                    var showText = $this.data("show-text");
                    if (showText.startsWith("app:"))
                        showText = i18n.t(showText);

                    var hideText = $this.data("hide-text");
                    if (hideText.startsWith("app:"))
                        hideText = i18n.t(hideText);

                    if ($this.text() === showText) {
                        $this.text(hideText);
                        target.removeClass("hide");
                        target.show();
                    } else {
                        $this.text(showText);
                        target.toggle();
                    }

                });

            $(".actor").tooltip({
                trigger: "hover"
            });
        };


        ctor.prototype.deactivate = function (close) {
            var _this = this;
            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };

        ctor.prototype.canDeactivate = function () {
            var self = this;
            if (self.newComment() && self.newComment().isDirty()) {
                var defer = $.Deferred();
                notifications.confirm({
                    title: i18n.t("app:alerts.dirty.title"),
                    text: i18n.t("app:alerts.dirty.text"),
                    type: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#DD6B55",
                    confirmButtonText: i18n.t("app:alerts.dirty.discard"),
                    cancelButtonText: i18n.t("app:alerts.dirty.stay"),
                    closeOnConfirm: true,
                    closeOnCancel: true
                },
                function (isConfirm) {
                    if (isConfirm) {
                        self.newComment().reset();
                        defer.resolve(true);
                    }

                    defer.reject(false);
                });
                return defer.promise();
            }
            return true;
        };

        ctor.prototype.getCommentTime = function (getRelatedDateTime) {
            var _this = this;
            if (_this.useShortenDateFormat()) {
                return utils.timeFromNow(ko.unwrap(getRelatedDateTime));
            }
            return utils.formatLogDateTime(ko.unwrap(getRelatedDateTime));
        };

        return ctor;
    });