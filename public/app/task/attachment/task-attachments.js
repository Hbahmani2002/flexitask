define(["common/autocomplete","jquery", "config", "common/helpers", "common/context", "jquery.scrollto", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete,$, config, helpers, context, scrollto, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {

        var ctor = function () {
            var _this = this;
            errorhandler.includeIn(this);
            this.attachmentId = null;
            this.taskId = null;
            this.projectId = null;
            this.attachments = ko.observableArray([]);
            this.editingAttachment = ko.observable();
            this.context = context;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.utils = utils;

            this.filter = {
                includeSubTasks: ko.observable(false),
                types: ko.observableArray(["task", "task/comment"]).extend({
                    rateLimit: 250
                }),
                reset: function () {
                    this.includeSubTasks(false);
                }
            };

            this.filter.types.subscribe(function (v) {
                _this.loadAttachments();
            });

            this.filter.includeSubTasks.subscribe(function (v) {
                _this.loadAttachments();
            });

            this.isMultiTaskView = ko.pureComputed(function () {
                var g = _.countBy(_this.attachments(), "taskId");
                return Object.keys(g).length > 1 || Object.keys(g)[0] !== _this.taskId;
            });
        };

        ctor.prototype.isTaskView = function () {
            var _this = this;
            return _this.taskId != null && _this.projectId != null;
        };

        ctor.prototype.extendItem = function (item) {
            item.associatedCommentId = item.associatedCommentId;
            item.author = context.getUserById(item.author);
            item.name = ko.revertableObservable(item.name || "").extend({
                required: true,
                minLength: 1
            });
            item.description = ko.revertableObservable(item.description || "");
            item.tags = ko.revertableObservableArray(item.tags);
            item.downloadUrl = item.downloadUrl + "?token=" + context.authToken();
            item.deleteUrl = item.deleteUrl + "?token=" + context.authToken();
            item.viewUrl = item.viewUrl + "&token=" + context.authToken();
            item.comment = ko.observable(null);
            item.isEditing = ko.observable(false);
            item.errors = ko.validation.group(item);


            item.reset = function () {
                item.name.revert();
                item.description.revert();
                item.tags.revert();
            };
            item.commit = function () {
                item.name.commit();
                item.description.commit();
                item.tags.commit();
            };

            _.each(item.versions, function (f) {
                f.downloadUrl = f.downloadUrl + "&token=" + context.authToken();
                f.author = context.getUserById(f.author);
            });

            item.lastVersion = _.max(item.versions, function (file) { return file.version; });
            item.verDescription = item.lastVersion.description;
            item.viewName = ko.pureComputed(function () {
                if (!item.lastVersion) {
                    return item.name.cached();
                }
                return item.name.cached() === item.lastVersion.actualName ? item.name.cached() : String.format("{0} | {1}", item.name.cached(), item.lastVersion.actualName);
            });
        };


        ctor.prototype.getUploadComponentOptions = function () {
            var _this = this;
            var url = String.format("{0}/api/tasks/{1}/attachments", config.serviceEndpoints.baseEndpoint, _this.taskId);
            return {
                url: url,
                onCompleted: function (ev, data) {
                    // todo : load only single attachment by id
                    _this.loadAttachments();
                },
                taskId: _this.taskId
            };
        };


        ctor.prototype.showAssociatedComment = function (attachment) {
            var _this = this;
            if (!attachment.associatedCommentId) {
                return;
            }
            var url = String.format("/api/tasks/{0}/comments/{1}", attachment.taskId, attachment.associatedCommentId);
            http.get(url).then(function (comment) {
                attachment.comment(comment);
            }).fail(_this.handleError);
        };


        ctor.prototype.newAttachment = function (files) {
            var _this = this;

            var newVm = {
                files: files,
                handleError: _this.handleError,
                taskId: _this.taskId,
                projectId: _this.projectId,
                viewUrl: "task/attachment/task-attachment-create-modal",
                parent: _this,
                utils: _this.utils,
                cancel: function () {
                    var t = this;
                    dialog.close(t);
                },
                activate: function () {

                },
                attached: function (view) {
                    var t = this;

                    $(view).find("#clear-uploaded-files").off("click").on("click", function () {
                        $("#fileupload-form table tbody tr.template-download").remove();
                    });


                    $(view).find("#fileupload-form").fileupload({
                        downloadTemplateId: null,
                        // Uncomment the following to send cross-domain cookies:
                        // xhrFields: {withCredentials: true},
                        url: String.format("{0}/api/tasks/{1}/attachments?token={2}", config.serviceEndpoints.baseEndpoint, t.taskId, context.authToken())
                    });

                    // Enable iframe cross-domain access via redirect option:
                    $(view).find("#fileupload-form").fileupload(
                        "option",
                        "redirect",
                        window.location.href.replace(
                            /\/[^\/]*$/,
                            "/cors/result.html?%s"
                        )
                    );

                    $(view).find("#fileupload-form")
                        .on("fileuploadfailed", function (e, data) {
                            t.handleError(data.jqXHR);
                        })
                        .on("fileuploadsent", function (e, data) {})
                        .on("fileuploadstopped", function (e, data) {})
                        .on("fileuploadchange", function (e, data) {})
                        .on("fileuploadsubmit", function (e, data) {
                            var inputs = data.context.find(".js--serializable");
                            if (inputs.filter(function () {
                                return !this.value && $(this).prop("required");
                            }).first().focus().length) {
                                data.context.find("button").prop("disabled", false);
                                return false;
                            }
                            var serializedData = inputs.serializeArray();
                            data.formData = serializedData;
                        })
                        .on("fileuploadadded", function (e, data) {

                            var tagInput = $(data.context.find(".tag-input"));
                            var options = autocomplete.getSelect2OptionsForProjectTags(t.projectId);
                            tagInput.select2(options);
                            tagInput.data("select2").$container.addClass(options.containerClass);
                            tagInput.data("select2").$dropdown.addClass(options.dropdownClass);

                            $(".js--localize").i18n(); // localize again
                        })
                        .on("fileuploadcompleted", function (e, data) {
                            _this.loadAttachments();

                            // dialog.close(t);
                        });


                    $(view).find("#fileupload-form").fileupload("add", {
                        versions: t.versions || [{
                            name: this.value
                        }],
                        fileInput: $(this)
                    });
                },
                canDeactivate: function () {
                    return true;
                }
            };
            return dialog.showBsModal(newVm);
        };

        ctor.prototype.newVersion = function (att) {
            var _this = this;

            var editVm = {
                utils: utils,
                attachment: att,
                handleError: _this.handleError,
                taskId: att.taskId,
                viewUrl: "task/attachment/task-attachment-new-version-modal",
                parent: _this,
                uploadRequests: [],
                uploadingFile: ko.observable(false),
                getNewVersionFileUploadOptions: function () {
                    var modal = this;
                    return {
                        url: String.format("{0}/api/tasks/{1}/attachments/{2}", config.serviceEndpoints.baseEndpoint, att.taskId, modal.attachment.attachmentId),
                        headers: context.getTokenAsHeader(),
                        done: function (e, data) {
                            dialog.close(modal, {
                                status: 1,
                                attachmentId: modal.attachment.attachmentId,
                                attachment: modal.attachment
                            });
                        },
                        fail: function (e, data) {
                            if (data.jqXHR) {
                                modal.handleError(data.jqXHR);
                            }
                        },
                        beginUpload: function (jqXHR) {
                            modal.uploadRequests.push(jqXHR);
                        },
                        uploadingFile: modal.uploadingFile,
                        progressSelector: ".js--file-upload-progress_" + modal.attachment.attachmentId
                    };
                },
                deactivate: function () {
                    var modal = this;
                    _.each(modal.uploadRequests, function (request) {
                        request.abort();
                    });
                },
                cancel: function () {
                    var t = this;
                    dialog.close(t);
                },
                activate: function () {

                },
                attached: function (view) {
                    var t = this;
                },
                canDeactivate: function () {
                    return true;
                }
            };
            return dialog.showBsModal(editVm).then(function (response) {
                if (response && response.status == 1) {
                    var getUrl = String.format("/api/tasks/{0}/attachments/{1}", att.taskId, att.attachmentId);
                    http.get(getUrl).then(function (response) {
                        _this.extendItem(response);
                        _this.attachments.replace(att, response);
                    });
                }
                return response;
            });
        };

        ctor.prototype.editAttachment = function (att) {
            var _this = this;

            var editVm = {
                tagsTypeahead: _this.tagsTypeahead,
                attachment: att,
                handleError: _this.handleError,
                projectId: _this.projectId,
                context: context,
                autocomplete: autocomplete,
                taskId: att.taskId,
                viewUrl: "task/attachment/task-attachment-edit-modal",
                parent: _this,
                cancel: function () {
                    var t = this;
                    dialog.close(t);
                },
                activate: function () {

                },
                attached: function (view) {

                },
                canDeactivate: function () {
                    return true;
                },
                deactivate: function (close) {
                    var t = this;
                    t.attachment.reset();
                },
                update: function () {
                    var t = this;
                    var attachment = t.attachment;
                    if (attachment.errors().length > 0) {
                        attachment.errors.showAllMessages();
                        return;
                    }

                    var input = ko.mapping.toJS(attachment);
                    var command = {
                        name: input.name,
                        description: input.description,
                        tags: input.tags
                    };
                    var url = String.format("/api/tasks/{0}/attachments/{1}", att.taskId, input.attachmentId);
                    http.put(url, command)
                        .then(function (response) {
                            attachment.commit();
                            dialog.close(t);
                        }).fail(function () {
                            attachment.reset();
                        }).fail(t.handleError);
                }
            };
            return dialog.showBsModal(editVm);
        };

        ctor.prototype.showVersions = function (attachment) {
            $("#list-" + attachment.attachmentId + "-versions")
                .hide()
                .removeClass("hide")
                .slideDown("slow");
        };

        ctor.prototype.deleteAttachment = function (attachment) {
            var _this = this;
            notifications.confirm({
                title: i18n.t("app:pages.attachment.promptdeleteattachmentheader"),
                text: i18n.t("app:pages.attachment.promptdeleteattachment"),
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: "Delete",
                cancelButtonText: "Cancel",
                closeOnConfirm: true,
                closeOnCancel: true
            },
            function (isConfirm) {
                if (isConfirm) {
                    http.delete(ko.unwrap(attachment.deleteUrl)).then(function () {
                        _this.attachments.remove(attachment);
                    }).fail(_this.handleError);
                }
            });
        };

        ctor.prototype.sortFiles = function (files) {
            var _this = this;
            var array = _.sortBy(files, function (f) {
                return f.version;
            });
            var index = 0;
            _.map(array, function (item) {
                item.index = index;
                index++;
                return item;
            });
            array.reverse();

            return array;
        };

        ctor.prototype.loadAttachments = function () {
            var _this = this;
            var url = "";
            var filters = utils.toQueryString(ko.toJS(_this.filter));
            if (_this.taskId) {
                url = String.format("/api/tasks/{0}/attachments?{1}", _this.taskId, filters);
            } else {
                url = String.format("/api/projects/{0}/attachments?{1}", _this.projectId,filters);
            }


            return http.get(url)
                .then(function (response) {
                    _this.attachments([]);
                    var attachments = [];
                    response.forEach(function (item) {
                        // var i = ko.mapping.fromJS(item);
                        _this.extendItem(item);
                        attachments.push(item);
                    });
                    _this.attachments.push.apply(_this.attachments, attachments);
                }).fail(_this.handleError);
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId || null;
            _this.projectId = settings.projectId || null;
            _this.attachmentId = settings.attachmentId || 0;

            return _this.loadAttachments();
        };

        ctor.prototype.deactivate = function (params) {

        };

        ctor.prototype.attached = function (view) {
            var _this = this;

            if (_this.attachmentId) {
                // var toggleEl = $(view).find("#collapse_" + _this.attachmentId);
                // toggleEl.toggle();
                window.setTimeout(function () {
                    $.scrollTo(toggleEl.parent(), 800, {
                        offset: function () {
                            return {
                                top: -30,
                                left: -5
                            };
                        }
                    });
                }, 100);
            }

            $(view).find(".actor").tooltip({
                trigger: "hover"
            });

            $(view).find(".js--new-file-upload").bind("change", function (e) {
                var files = e.target.files;
                _this.newAttachment(files).then(function () {
                    $(e.target).parent("form").get(0).reset();
                });
            });
        };


        return ctor;
    });
