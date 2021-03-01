define(["require", "jquery", "exports", "config", "common/markdownUtil", "durandal/composition", "common/context", "common/helpers", "common/utils", "underscore", "highlightjs", "knockout"],
    function (require, $, exports, config, markdownUtil, composition, context, helpers, utils, _, hljs, ko) {

        

        

        function MarkdownEditorBindingHandler() {}

        MarkdownEditorBindingHandler.install = function () {
            if (!ko.bindingHandlers.markdownEditor) {
                ko.bindingHandlers.markdownEditor = new MarkdownEditorBindingHandler();
            }
        };

        MarkdownEditorBindingHandler.prototype.init =function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var bindingOptions = valueAccessor() || {};

            var editStatusSubscription;
            var api = {
                dispose: function () {
                    var el = $(element);
                    el.removeClass("editor-active");
                    el.find(".editor").find("*").off();
                    el.find(".editor").empty();
                    // el.append("<div class='editor'></div>");
                    el.find(".view").show();
                    if (editStatusSubscription) {
                        bindingOptions.editStatus(false);
                    }
                },
                init: function (ev) {
                    var el = $(element);
                    if (el.find(".view").length > 0) {
                        if (el.find(".view").is(":visible")) {
                            el.addClass("editor-active");
                            el.find(".view").hide();
                            el.find(".editor").append("<div></div>").find("div").markdown(options);
                            if (ev) {
                                ev.preventDefault();
                            }
                        }
                    } else {
                        el.addClass("editor-active");
                        el.find(".editor").append("<div></div>").find("div").markdown(options);
                        if (ev) {
                            ev.preventDefault();
                        }
                    }
                }
            };

            var markdownTransformResult = null;
            var defaultOptions = {
                iconlibrary: "fa",
                autofocus: true,
                height: bindingOptions.height || "inherit",
                resize: "vertical",
                savable: typeof bindingOptions.saveButton !== "undefined" ? bindingOptions.saveButton : true,
                onShow: function (e) {
                    e.setContent(ko.unwrap(bindingOptions.data));
                },
                onPreview: function (e) {
                    if (bindingOptions.onPreview) {
                        return bindingOptions.onPreview.call(viewModel, e);
                    }
                    e
                    markdownTransformResult =  markdownUtil.transform(e.getContent(),{truncate:false,highlight:true });
                    return  String.format("<div class=\"markdown-content\"><div class=\"markdown-body\">{0}</div></div>", markdownTransformResult.html);
                },
                onSave: function (e) {
                    if (bindingOptions.onSave) {
                        return bindingOptions.onSave.call(viewModel, e, api);
                    }
                },
                onChange: function (e) {
                    if (bindingOptions.onChange) {
                        bindingOptions.data.call(viewModel, e.getContent());
                    }
                    if(e.$isPreview && markdownTransformResult){
                        markdownTransformResult.initWidgets(e.$editor.get(0));
                     
                    }
                },
                onFocus: function (e) {
                    

                },
                onBlur: function (e) {
                  

                },
                additionalButtons: []
            };

            if (typeof bindingOptions.cancelButton === "undefined" ||
                    (typeof bindingOptions.cancelButton !== "undefined" && bindingOptions.cancelButton)) {
                defaultOptions.additionalButtons.push([{
                    name: "groupCustom",
                    data: [{
                        name: "cmdCancel",
                        // toggle: true, // this param only take effect if you load bootstrap.js
                        title: "Cancel",
                        icon: "fa fa-remove",
                        callback: function (e) {
                            api.dispose();
                            if (bindingOptions.onCancel) {
                                return bindingOptions.onCancel.call(viewModel, e, api);
                            }
                        }
                    }]
                }]);
            }

            var options = $.extend(true, {}, defaultOptions, {});


            if (bindingOptions.editStatus) {
                editStatusSubscription = bindingOptions.editStatus.subscribe(function (v) {
                    if (v) {
                        api.init();
                    } else {
                        api.dispose();
                    }
                });
            }

            ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                api.dispose();
                if (editStatusSubscription) {
                    editStatusSubscription.dispose();
                    bindingOptions.editStatus(false);
                }
            });

            if (ko.unwrap(bindingOptions.init)) {
                api.init();
            }


        }


        

        return MarkdownEditorBindingHandler;
    });