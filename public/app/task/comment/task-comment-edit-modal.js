define(["common/autocomplete", "durandal/system", "durandal/events", "config", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, system, events, config, helpers, context, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {



        var modal = function (taskId, projectId, commentId) {
            var _this = this;
            this.autocomplete = autocomplete;
            this.context = context;
            this.helpers = helpers;
            this.utils = utils;
            this.taskId = taskId;
            this.projectId = projectId;
            this.commentId = commentId;
            this.comment = ko.observable();



            this.atjsOptions = null;
            this.positionArray = _.range(101);
            this.uploadingFile = ko.observable(false);
            this.uploadRequests = [];

           

            this.newVersionFileUploadOptions = function (comment) {
                return {
                    url: String.format("{0}/api/tasks/{1}/attachments?type=task/comment", config.serviceEndpoints.baseEndpoint, _this.taskId),
                    headers: context.getTokenAsHeader(),
                    done: function (e, data) {
                        data.result.files.forEach(function (attachmentDto) {
                            var c = ko.mapping.fromJS(attachmentDto);
                            extendAttachment(comment, c);
                            c.isNew = true;
                            comment.attachments.push(c);
                        });
                    },
                    fail: function (e, data) {
                        if (data.jqXHR) {
                            _this.handleError(data.jqXHR);
                        }
                    },
                    beginUpload: function (jqXHR) {
                        _this.uploadRequests.push(jqXHR);
                    },
                    uploadingFile: _this.uploadingFile,
                    progressSelector: ".js--file-upload-progress_" + comment.commentId
                };
            };

            this.getUploadOptions = function () {

                var url = String.format("{0}/api/tasks/{1}/attachments?type=task/comment", config.serviceEndpoints.baseEndpoint, _this.taskId);
                return {
                    autoUpload: true,
                    uploadTemplateId: null,
                    downloadTemplateId: null,
                    url: url,
                    headers: context.getTokenAsHeader(),
                    dataType: "json",
                    done: function (e, data) {
                        var comment = ko.dataFor(this);
                        if (comment)
                            data.result.files.forEach(function (attachmentDto) {
                                var c = ko.mapping.fromJS(attachmentDto);
                                extendAttachment(comment, c);
                                comment.attachments.push(c);
                            });
                    },
                    add: function (e, data) {

                        if (data.autoUpload || (data.autoUpload !== false && $(this).fileupload("option", "autoUpload"))) {
                            var el = $(this);
                            var p = $(el.data("progress-selector"));
                            var pb = p.find(".progress-bar");
                            p.show();
                            pb.css("width", "0%");
                            data.process().done(function () {
                                data.submit();
                            });
                        }

                    },
                    progressall: function (e, data) {
                        var el = $(this);
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        var p = $(el.data("progress-selector"));
                        var pb = p.find(".progress-bar");
                        if (progress >= 100) {
                            progress = 0;
                            p.hide();
                            _this.uploadingFile(false);
                        } else {
                            if (!_this.uploadingFile()) {
                                _this.uploadingFile(true);
                            }
                        }
                        pb.css("width", progress + "%");
                    },
                    fail: function (e, data) {
                        _this.handleError(data.jqXHR);
                    }
                };
            };

            this.getVersionUpdateUploadOptions = function (att) {

                var url = String.format("{0}/api/tasks/{1}/attachments/{2}", config.serviceEndpoints.baseEndpoint, _this.taskId, ko.unwrap(att.attachmentId));
                return {
                    autoUpload: true,
                    uploadTemplateId: null,
                    downloadTemplateId: null,
                    url: url,
                    headers: context.getTokenAsHeader(),
                    dataType: "json",
                    done: function (e, data) {
                        if (!data.result || !data.result.files || data.result.files.length <= 0) {
                            return;
                        }
                        att.version(data.result.files[0].version);
                        att.isNew = true;
                        att.newVersionWindowToggle(false);
                    },
                    add: function (e, data) {

                        if (data.autoUpload || (data.autoUpload !== false && $(this).fileupload("option", "autoUpload"))) {
                            var el = $(this);
                            var p = $(el.data("progress-selector"));
                            var pb = p.find(".progress-bar");
                            p.show();
                            pb.css("width", "0%");
                            data.process().done(function () {
                                data.submit();
                            });
                        }

                    },
                    progressall: function (e, data) {
                        var el = $(this);
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        var p = $(el.data("progress-selector"));
                        var pb = p.find(".progress-bar");
                        if (progress >= 100) {
                            progress = 0;
                            p.hide();
                            _this.uploadingFile(false);
                        } else {
                            if (!_this.uploadingFile()) {
                                _this.uploadingFile(true);
                            }
                        }
                        pb.css("width", progress + "%");
                    },
                    fail: function (e, data) {
                        _this.handleError(data.jqXHR);
                    }
                };
            };
            errorhandler.includeIn(this);

            this.saveCommentCommand = ko.asyncCommand({
                execute: function (callback) {

                    var comment = _this.comment();
                    if (comment.errors().length > 0) {
                        comment.errors.showAllMessages();
                        callback();
                        return;
                    }

                    var deletedAttachments = _.map(_.filter(ko.unwrap(comment.attachments), function (a) {
                        return ko.unwrap(a.delete);
                    }), function (att) {
                        return ko.unwrap(att.attachmentId || att.id);
                    });

                    var newAttachments = _.map(_.filter(ko.unwrap(comment.attachments), function (a) {
                        return !ko.unwrap(a.delete) && a.isNew && ko.unwrap(a.version) <= 1;
                    }), function (a) {
                        return ko.unwrap(a.attachmentId || a.id);
                    });

                    var versionedAttachments = _.map(_.filter(ko.unwrap(comment.attachments), function (a) {
                        return !ko.unwrap(a.delete) && a.isNew && ko.unwrap(a.version) > 1;
                    }), function (a) {
                        return {
                            id: ko.unwrap(a.attachmentId || a.id),
                            version: ko.unwrap(a.version)
                        };
                    });

                    var commentText = comment.commentText();
                    var mentionedUsers = helpers.getMentionedUsers(commentText, context);
                    var tags = helpers.getTags(commentText);

                    var command = {
                        commentNew: commentText,
                        newAttachments: newAttachments,
                        deletedAttachments: deletedAttachments,
                        versionedAttachments: versionedAttachments,
                        position: comment.position(),
                        tags: tags,
                        mentions: mentionedUsers
                    };
                    var commentId = comment.commentId;
                    var url = String.format("/api/tasks/{0}/comments/{1}", _this.taskId, commentId);
                    return http.put(url, command)
                        .then(function (response) {
                            comment.attachments.remove(function (a) {
                                return a.delete();
                            });
                            ko.postbox.publish("CommentUpdated", {
                                commentId: commentId,
                                comment: comment
                            });
                            dialog.close(_this);
                        }).fail(_this.handleError)
                        .always(function () {
                            callback();
                        });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && !_this.uploadingFile() && _this.comment() && _this.comment().commentText();
                }
            });
        };

        function extendComment(comment) {
            comment.commentText = ko.observable(comment.commentText).extend({
                required: true
            });
            comment.position = ko.observable(comment.position);
            comment.attachments = ko.observableArray(_.map(comment.attachments, function (a) {
                extendAttachment(comment, a);
                return a;
            }));
            comment.errors = ko.validation.group(comment);
            comment.dirtyFlag = new ko.DirtyFlag(comment);
            comment.isDirty = function () {
                return comment.dirtyFlag().isDirty();
            };
        }

        function extendAttachment(comment, attachment) {
            attachment.newVersionWindowToggle = ko.observable();
            attachment.delete = ko.observable(false);
            attachment.currentVersion = attachment.version;
            attachment.version = ko.observable(attachment.version || 1);
        }

        modal.prototype.dikla = function () {
            var _this = this;
            system.acquire("upload/upload-new-version").then(function (ctor) {
                var o = system.resolveObject(ctor, [{ name: "o", size: 2 }], _this.projectId, _this.taskId);
                return dialog.showBsModal(o);
            }).then(function (response) {

            });
        };

        modal.prototype.activate = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/comments/{1}", _this.taskId, _this.commentId);
            http.get(url).then(function (comment) {
                extendComment(comment);
                _this.comment(comment);
            }).fail(function (err) {
                _this.handleError(err);
                dialog.close(_this);
            });
        };

        modal.prototype.getUploadComponentOptions = function () {
            var _this = this;
            var url = String.format("{0}/api/tasks/{1}/attachments?type=task/comment", config.serviceEndpoints.baseEndpoint, _this.taskId);
            return {
                url: url,
                pasteZone: $(".editor-active"),
                onCompleted: function (ev, data) {
                    var comment = _this.comment();
                    data.result.files.forEach(function (attachmentDto) {
                        var c = ko.mapping.fromJS(attachmentDto);
                        extendAttachment(comment, c);
                        c.isNew = true;
                        comment.attachments.push(c);
                    });
                },
                taskId: _this.taskId,
                projectId: _this.projectId
            };
        };

        modal.prototype.cancel = function () {
            var _this = this;



            if (_this.comment().isDirty()) {
                notifications.confirm({
                    title: i18n.t("app:pages.commentEdit.modalWarningTitle"),
                    text: i18n.t("app:pages.commentEdit.modalWarningText"),
                    type: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#DD6B55",
                    confirmButtonText: i18n.t("app:pages.commentEdit.modalWarningConfirmButtonText"),
                    cancelButtonText: i18n.t("app:pages.commentEdit.modalWarningCancelButtonText"),
                    closeOnConfirm: true,
                    closeOnCancel: true
                },
                    function (isConfirm) {
                        if (isConfirm) {
                            _this.closeModal();
                        }
                    });
            } else {
                _this.closeModal();
            }


        };

        modal.prototype.closeModal = function () {
            _.each(this.uploadRequests, function (request) {
                request.abort();
            });
            dialog.close(this);
        };

        modal.prototype.deactivate = function () {
            var _this = this;
        };


        return modal;
    });
