define(["require", "exports", "durandal/composition", "knockout", "jquery", "underscore"], function (require, exports, composition, ko, $, _) {

    function TreeBindingHandler() {
        var _this = this;

    }

    TreeBindingHandler.install = function () {
        if (!ko.bindingHandlers.tree) {
            ko.bindingHandlers.tree = new TreeBindingHandler();

            composition.addBindingHandler("tree");
        }
    };


    TreeBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        var $element = $(element),
            value = ko.unwrap(valueAccessor()),
            options = value.options || {};

        options = $.extend(options, {
            group: 0,
            noDragClass: "dd-nodrag",
            maxDepth: 1000,
            callback: function (l, e, z, a) {

            }
        });

        ko.unwrap(value.data);

        var tree = $element.closest(".dd");
        var nestablePlugin = tree.data("nestable");
        if (nestablePlugin) {
            tree.find("[data-action='expand'],[data-action='collapse']").remove();
            tree.nestable("destroy");
            tree.data("nestable", null);
        }

        if (options.beforeBinding) {
            options.beforeBinding();
        }

        tree.nestable(options).on("change", function (ev, a) {
            ev.preventDefault();
        });

        tree.find("a").on("mousedown", function (event) {
            event.preventDefault();
            return false;
        });

        if (options.afterRender) {
            options.afterRender(tree);
        }

        if (options.expandCollapseHandler) {
            $(tree).on("click", "[data-action='expand'],[data-action='collapse']", function (ev) {
                var target = $(ev.currentTarget),
                    action = target.data("action"),
                    item = target.parent("li");

                return options.expandCollapseHandler(action, item, ev, tree);
            });
        }


        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            tree.nestable("destroy");
            tree.data("nestable", null);
            tree.empty();
            $(tree).off("click", "[data-action='expand'],[data-action='collapse']");
        });
    };


    return TreeBindingHandler;
});
