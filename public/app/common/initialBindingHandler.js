define(["require", "exports", "durandal/composition", "knockout", "jquery", "config", "common/initial"],
    function (require, exports, composition, ko, $, config, initial) {

        function InitialBindingHandler() {}

        InitialBindingHandler.install = function () {
            if (!ko.bindingHandlers.initial) {
                ko.bindingHandlers.initial = new InitialBindingHandler();

                composition.addBindingHandler("initial");
            }
        };

        InitialBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var _this = this;
            var options = valueAccessor() || {};

            var e = $(element);
            // // overriding from data attributes
            // settings = $.extend(settings, e.data());
            var image = initial.create(options);
            e.attr("src", image);
        };


        InitialBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {


        };

        return InitialBindingHandler;
    });
