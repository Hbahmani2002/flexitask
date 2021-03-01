define(["common/autocomplete", "durandal/events", "config", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, events, config, helpers, context, i18n, dialog, http, composition, notification, app, ko, errorhandler, _, utils) {

        function FileModel(fileObject) {
            var t = this;
            this.name = ko.observable(fileObject.name);
            this.description = ko.observable();
            this.tags = ko.observableArray([]);
            this.size = fileObject.size;
            this.fileObject = fileObject;

            this.toDto = function () {
                var f = t.fileObject;
                f.extra = {
                    name: t.name(),
                    description: t.description(),
                    tags: t.tags()
                };
                return f;
            };
        }

        var ctor = function (files, projectId, taskId) {
            var _this = this;
            this.projectId = projectId;
            this.taskId = taskId;
            this.queue = _.chain(files)
                        .map(function (f) {
                            return new FileModel(f);
                        })
                        .sortBy(function (f) {
                            return f.size;
                        })
                        .value()
                        .reverse();

            this.queueIndex = ko.observable(0);
            this.currentFile = ko.observable();


            var url = String.format("{0}/api/tasks/{1}/attachments?type=task/comment", config.serviceEndpoints.baseEndpoint, _this.taskId);
            this.tagAutocompletionOptions = autocomplete.getSelect2OptionsForProjectTags(_this.projectId);

            this.jQueryUploadOptions = {
                redirect: window.location.href.replace(/\/[^\/]*$/, "/cors/result.html?%s"),
                autoUpload: false,
                downloadTemplateId: null,
                uploadTemplateId: "task-comment-file-upload",
                url: url,
                headers: context.getTokenAsHeader(),
                dataType: "json",
                sequentialUploads: true,
                failed: function (e, data) {
                    if (data.jqXHR) {
                        _this.handleError(data.jqXHR);
                    } else {
                        $(data.form).find(".js--clear-upload-files").hide();
                    }

                },
                abort: function (e, data) {

                },
                finished: function (e, data) {
                    var comment = ko.dataFor(this);
                    if (comment)
                        data.result.files.forEach(function (attachmentDto) {
                            var c = ko.mapping.fromJS(attachmentDto);
                            _this.extendAttachment(c);
                            comment.attachments.push(c);
                        });
                },
                submit: function (e, data) {
                    var inputs = data.context.find(".js--serializable");
                    if (inputs.filter(function () {
                        return !this.value && $(this).prop("required");
                    }).first().focus().length) {
                        data.context.find("button").prop("disabled", false);
                        return false;
                    }
                    var serializedData = inputs.serializeArray();
                    data.formData = serializedData;
                },
                completed: function (e, data) {
                    $(data.form).find(".js--clear-upload-files").hide();
                },
                added: function (e, data) {
                    var tagInput = $(data.context.find(".tag-input"));
                    var options = autocomplete.getSelect2OptionsForProjectTags(_this.projectId);
                    tagInput.select2(options);
                    tagInput.data("select2").$container.addClass(options.containerClass);
                    tagInput.data("select2").$dropdown.addClass(options.dropdownClass);

                    $(data.form).find(".js--localize").i18n(); // localize again
                    $(data.form).find(".js--clear-upload-files").show();
                }
            };
        };

        ctor.prototype.activate = function () {
            var _this = this;
            if (_this.queue.length <= 0) {
                return false;
            }

            _this.currentFile(_this.queue[0]);

            return true;
        };

        ctor.prototype.nextFile = function () {
            var _this = this;
            var queueIndex = _this.queueIndex();

            if (queueIndex === 0 && _this.currentFile() === false) {
                _this.currentFile(_this.queue[queueIndex]);
                _this.queueIndex(0);
            } else {
                queueIndex = queueIndex + 1;
                if (queueIndex < _this.queue.length) {
                    _this.queueIndex(queueIndex);
                    _this.currentFile(_this.queue[queueIndex]);
                } else {
                    dialog.close(_this);
                }
            }
        };

        ctor.prototype.cancel = function () {
            var _this = this;
            _this.nextFile();
        };
        ctor.prototype.startUpload = function (file) {
            var _this = this;
            ko.postbox.publish("StartUploadCommand", {
                selectedFile: file.toDto()
            });
            _this.nextFile();
        };
        ctor.prototype.cancelAll = function () {
            var _this = this;
            dialog.close(_this);
        };
        ctor.prototype.close = function () {
            var _this = this;
            dialog.close(_this);
        };
        ctor.prototype.deactivate = function () {
            var _this = this;
        };


        return ctor;
    });
