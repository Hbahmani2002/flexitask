define(["require","moment", "durandal/system", "plugins/dialog", "common/context", "durandal/composition", "knockout", "jquery", "config", "common/utils", "common/errorhandler"],
    function (require,moment, system, dialog, context, composition, ko, $, config, utils, errorhandler) {

        // 'tmpl':'../assets/vendor/jquery-file-upload/tmpl',
        // 'jquery.ui.widget':'../assets/vendor/jquery-file-upload/vendor/jquery.ui.widget',
        // 'jquery.iframe-transport':'../assets/vendor/jquery-file-upload/jquery.iframe-transport',
        // 'jquery.fileupload':'../assets/vendor/jquery-file-upload/jquery.fileupload',
        // 'jquery.fileupload-process':'../assets/vendor/jquery-file-upload/jquery.fileupload-process',
        // 'jquery.fileupload-validate':'../assets/vendor/jquery-file-upload/jquery.fileupload-validate',
        // 'jquery.fileupload-ui':'../assets/vendor/jquery-file-upload/jquery.fileupload-ui'

        function FileUploaderBindingHandler() {
            errorhandler.includeIn(this);
        }

        FileUploaderBindingHandler.install = function () {
            if (!ko.bindingHandlers.fileUploader) {
                ko.bindingHandlers.fileUploader = new FileUploaderBindingHandler();

                composition.addBindingHandler("fileUploader");
            }
        };

        FileUploaderBindingHandler.showUploadForm = function (files, projectId, taskId) {
            system.acquire("upload/upload-form").then(function (ctor) {
                var o = system.resolveObject(ctor, files, projectId, taskId);
                return dialog.showBsModal(o);
            }).then(function (response) {

            });
        };

        FileUploaderBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var _this = this;
            var options = valueAccessor() || {};
            var selector = allBindings().fileUploadSelector || false;

            options = $.extend(true, {}, {
                multiple: !utils.browser.isIOS(),
                uploadTemplateId: "task-comment-file-upload",
                redirect: window.location.href.replace(/\/[^\/]*$/, "/cors/result.html?%s"),
                autoUpload: true,
                downloadTemplateId: null,
                url: "",
                headers: context.getTokenAsHeader(),
                dataType: "json",
                sequentialUploads: true,
                failed: function (e, data) {
                    if (data.jqXHR) {
                        if (data.jqXHR.statusText === "abort") {

                        } else {
                            options.onFailed.call(this, e, data);
                        }
                    }
                },
                completed: function (e, data) {
                    options.onCompleted.call(this, e, data);
                },
                submit: function (e, data) {
                    for (i = 0; i < 1000; i++) {
                        utils.newGuid();
                    }
                    var serializedData = utils.toFormData(data.files[0].extra || {});
                    data.formData = serializedData;
                },
                drop: function (ev, data) {
                    FileUploaderBindingHandler.showUploadForm(data.files, options.projectId, options.taskId);
                    ev.preventDefault();
                },
                paste: function (ev, data) {
                    if (!data.files || data.files.length <= 0) {
                        ev.preventDefault();
                        return false;
                    }
                    _.each(data.files, function (f) {
                        f.name = String.format("screenshot_{0}.png", moment().format("YYYYMMDD_X"));
                    });
                    FileUploaderBindingHandler.showUploadForm(data.files, options.projectId, options.taskId);
                    ev.preventDefault();
                },
                onFailed: function (ev, data) {
                    _this.handleError(data.jqXHR);
                },
                onCompleted: function (e, data) { },
                onFilesSelected: function (ev) {
                    FileUploaderBindingHandler.showUploadForm(ev.target.files, options.projectId, options.taskId);
                },
                onInit: function (delegate) { }
            }, options);
            var el = $(element);

            el
                .off("click")
                .on("click", function (ev) {
                    this.value = null;
                })
                .off("change")
                .on("change", function (ev) {
                    if (!ev.target.files) {
                        return;
                    }
                    options.onFilesSelected.call(this, ev);
                });

            var componentElement = el;
            if (selector) {
                componentElement = $(selector);
            }

            var $componentElement = $(componentElement);
            $componentElement
                .append("<div class=\"files\"></div>")
                .append("<input class=\"hidden\" type=\"file\" name=\"files[]\" " + (options.multiple ? 'multiple=\"multiple\"' : "") + ">");

            $componentElement.fileupload(options);
            options.onInit({
                call: function (method) {
                    var parameters = Array.prototype.slice.call(arguments, 1);
                    return $componentElement.fileupload(method, parameters[0]);
                }
            });

            var uploadSubscription = ko.postbox.subscribe("StartUploadCommand", function (ev) {
                $componentElement.fileupload("add", {
                    files: [ev.selectedFile]
                });
            });

            var cancelAllUploads = ko.postbox.subscribe("CancelUploadsCommand",function(ev){

            });

            ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                try {
                    uploadSubscription.dispose();
                    cancelAllUploads.dispose();
                    $componentElement.fileupload("destroy");
                } catch (err) {
                    console.log(err);
                }
            });
        };


        FileUploaderBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {


        };

        return FileUploaderBindingHandler;
    });
