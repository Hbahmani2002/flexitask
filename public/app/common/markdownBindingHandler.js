define(["require", "jquery","common/markdownUtil", "exports", "config", "markdown", "durandal/composition", "common/context", "common/helpers", "common/utils", "underscore", "highlightjs", "knockout"],
    function (require, $, markdownUtil,exports, config, Markdown, composition, context, helpers, utils, _, hljs, ko) {

        function MarkdownTruncateBindingHandler (){
            this.after =  ["markdown"];
         }   

        function MarkdownBindingHandler() {}

        MarkdownBindingHandler.install = function () {
            if (!ko.bindingHandlers.markdown) {
                ko.bindingHandlers.markdown = new MarkdownBindingHandler();
                ko.bindingHandlers.markdownTruncate = new MarkdownTruncateBindingHandler();
            }
        };

        MarkdownTruncateBindingHandler.install = function () {
            if (!ko.bindingHandlers.markdownTruncate) {
                ko.bindingHandlers.markdownTruncate = new MarkdownTruncateBindingHandler();
            }
        };

        // MarkdownBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        //     return {
        //         controlsDescendantBindings: false
        //     };
        // };

        // MarkdownTruncateBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        //     return {
        //         controlsDescendantBindings: true
        //     };
        // };
        MarkdownTruncateBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var optionsDefault = {
               
                moreText: "more",
                lessText: "less",
                moreClass: "markdown-more-text",
                lessClass: "markdown-less-text",
                truncate: false,
                mode: "normal",
                expanded: false,
                highlight:true,
                markdownEnabled: true
            };
          
            var binding = ko.unwrap(valueAccessor()) || "";
            var text = "";

            var options = _.extend(optionsDefault, binding);

            var el = $(element);
           

            var truncate = ko.unwrap(options.truncate);
            var expanded = ko.unwrap(options.expanded);


            if(truncate){
                window.setTimeout(function(){
                    if($(el).prop("scrollHeight")>200){
                        
                        el.append("<div class=\"markdown-buttons\"><div>");
                        var $buttons = el.find(".markdown-buttons");
    
                        if(expanded){
                            el.removeClass("collapsed").addClass("markdown-expandable expanded")
                        }else{
                            el.removeClass("expanded").addClass("markdown-expandable collapsed")
                        }
                        
                        $buttons.append('<div class="expand-content"><a href="#" class="js-expand-content btn btn-round  btn-default">show more</a></div>');
                        $buttons.append('<div class="collapse-content"><a href="#" class="js-collapse-content btn btn-round btn-default">show less</a></div>');
    
                        el.on("click",".js-expand-content",function(ev){
                            el.removeClass("collapsed").addClass("expanded");
                            return false;
                        });
                        el.on("click",".js-collapse-content",function(ev){
                            el.removeClass("expanded").addClass("collapsed");
                            return false;
                        });
                    }
                },0);
            }
            

        

        };

        MarkdownBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            
            var binding = ko.unwrap(valueAccessor()) || "";
            var options = null;
            var text = "";

            if (typeof binding === "string") {
                text = binding;
            } else {
                text = ko.unwrap(binding.text);
                if (binding.options) {
                    options = ko.unwrap(binding.options);
                }
            }

            if (!text) {
                ko.bindingHandlers.html.update(element, function () {
                    return text;
                });
                return;
            }

            var result = markdownUtil.transform(text,options);

            var el = $(element);
            el.addClass("markdown-content");
            el.html(String.format("<div class=\"markdown-body\">{0}</div>",result.html));

            var truncate = ko.unwrap(result.options.truncate);
            var expanded = ko.unwrap(result.options.expanded);

            result.initWidgets(element);

            if(truncate){
                window.setTimeout(function(){
                    if($(el).prop("scrollHeight")>200){
                        
                        el.append("<div class=\"markdown-buttons\"><div>");
                        var $buttons = el.find(".markdown-buttons");
    
                        if(expanded){
                            el.removeClass("collapsed").addClass("markdown-expandable expanded")
                        }else{
                            el.removeClass("expanded").addClass("markdown-expandable collapsed")
                        }
                        
                        $buttons.append('<div class="expand-content"><a href="#" class="js-expand-content btn btn-round  btn-default">show more</a></div>');
                        $buttons.append('<div class="collapse-content"><a href="#" class="js-collapse-content btn btn-round btn-default">show less</a></div>');
    
                        el.on("click",".js-expand-content",function(ev){
                            el.removeClass("collapsed").addClass("expanded");
                            return false;
                        });
                        el.on("click",".js-collapse-content",function(ev){
                            el.removeClass("expanded").addClass("collapsed");
                            return false;
                        });
                    }
                },0);
            }
            

            

        };

        return MarkdownBindingHandler;
    });