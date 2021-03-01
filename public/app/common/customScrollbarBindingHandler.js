define(["require", "common/prefs", "common/utils", "exports", "durandal/composition", "knockout", "jquery", "underscore"],
    function (require, prefs, utils, exports, composition, ko, $, _) {


        function CustomScrollbarBindingHandler() {
            var _this = this;
            this.throttleTimeMs = 100;
            var $window = $(window);
            this.windowSizeObservable = ko.observable($window.height() + $window.width());
            window.FlexiTaskWindowSize = this.windowSizeObservable.throttle(this.throttleTimeMs);
            $window.resize(function (ev) {
                return _this.windowSizeObservable($window.height() + $window.width());
            });
        }

        CustomScrollbarBindingHandler.install = function () {
            if (!ko.bindingHandlers.customScroll) {
                ko.bindingHandlers.customScroll = new CustomScrollbarBindingHandler();

                composition.addBindingHandler("customScroll");
            }
        };


        CustomScrollbarBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var bindingValue = valueAccessor();


            if (prefs.customScrollbar()) {
                element.style.overflowX = "visible";
                window.setTimeout(function () {
                    $(element).asScrollable({
                        namespace: "scrollable",
                        direction: "vertical",
                        responsive: true,
                        throttle: 20
                    });
                }, 0);
            }


            ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                var api = $(element).data("asScrollable");
                if (api) {
                    api.destory();
                }
            });
        };


        CustomScrollbarBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var bindingValue = valueAccessor();

            var api = $(element).data("asScrollable");
            if (!prefs.customScrollbar()) {
                element.style.overflowX = "hidden";
                if (api) {
                    api.destory();
                }
            }


            if (api) {
                if (utils.browser.isSingleColumnScreen()) {
                    api.disable();
                    api.hideBar();
                } else {
                    api.enable();
                    api.update();
                }
            }

        };


        return CustomScrollbarBindingHandler;

    });
