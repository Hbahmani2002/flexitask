define(["require", "common/prefs", "common/utils", "exports", "durandal/composition", "knockout", "jquery", "underscore"],
 function (require, prefs, utils, exports, composition, ko, $, _) {


     function DynamicHeightBindingHandler() {
         var _this = this;
         this.throttleTimeMs = 100;
         var $window = $(window);
         this.windowHeightObservable = ko.observable($window.height());
         window.FlexiTaskWindowHeight = this.windowHeightObservable.throttle(this.throttleTimeMs);
         $window.resize(function (ev) {
             return _this.windowHeightObservable($window.height());
         });
     }

     DynamicHeightBindingHandler.install = function () {
         if (!ko.bindingHandlers.dynamicHeight) {
             ko.bindingHandlers.dynamicHeight = new DynamicHeightBindingHandler();

             composition.addBindingHandler("dynamicHeight");
         }
     };

    // Called by Knockout a single time when the binding handler is setup.
     DynamicHeightBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
         var bindingValue = valueAccessor();


         if (bindingValue.target) {
             var newWindowHeight = bindingValue.resizeTrigger;
             var targetSelector = bindingValue.target || "footer";
             var bottomMargin = bindingValue.bottomMargin || 0;
             var onScroll = bindingValue.onScroll || false;

             var el = $(element);
             el.addClass("dynamic-height");
             element.style.overflowX = "hidden";



             if (onScroll) {
                 var throttled = _.debounce(function (ev) {
                     var ell = $(this);
                     var scrollTop = ell.scrollTop();
                     onScroll(ev, ell, scrollTop);
                 }, 250);

                 el.scroll(throttled);
             }

             var elementIntervalKey = "DynamicHeightElementInterval";
             var elementInterval = ko.utils.domData.get(element, elementIntervalKey);
             if (elementInterval) {
                 clearInterval(elementInterval);
             }



             elementInterval = setInterval(function () {
                 var elementTopOffset = el.offset().top;
                 var lastElementTopOffset = ko.utils.domData.get(element, "DynamicHeightElementTopOffset");
                 if (elementTopOffset !== lastElementTopOffset) {
                     DynamicHeightBindingHandler.stickToTarget(element, targetSelector, bottomMargin);
                 }
             }, 500);
             ko.utils.domData.set(element, elementIntervalKey, elementInterval);

             ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                 el.removeClass("dynamic-height");
                 clearInterval(elementInterval);
                // var api =  $(element).data('asScrollable');
                // if(api){
                //     api.destory();
                // }

             });
         }
     };

    // Called by Knockout each time the dependent observable value changes.
     DynamicHeightBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
         var bindingValue = valueAccessor();


         if (bindingValue.target) {
             var newWindowHeight = bindingValue.resizeTrigger;
             var targetSelector = bindingValue.target || "footer";
             var bottomMargin = bindingValue.bottomMargin || 0;

            // Check what was the last dispatched height to this element.
             var lastWindowHeightKey = "FlexiTaskLastDispatchedHeight";
             var lastWindowHeight = ko.utils.domData.get(element, lastWindowHeightKey);
             if (lastWindowHeight !== newWindowHeight) {
                 ko.utils.domData.set(element, lastWindowHeightKey, newWindowHeight);
                 DynamicHeightBindingHandler.stickToTarget(element, targetSelector, bottomMargin);
             }

             if (prefs.customScrollbar()) {
                 $(element).asScrollable({
                     namespace: "scrollable",
                     direction: "vertical",
                     responsive: true,
                     throttle: 20
                 });
             } else {
                // var api =  $(element).data('asScrollable');
                // if(api){
                //     api.destory();
                // }
             }
         }
     };


     DynamicHeightBindingHandler.stickToTarget = function (element, targetSelector, bottomMargin) {

         var targetElement = $(targetSelector);
         if (targetSelector.length === 0) {
             throw new Error("Couldn't configure dynamic height because the target element isn't on the page. Target element: " + targetSelector);
         }

         var $element = $(element);
         var isVisible = $element.is(":visible");

         if (isVisible) {
             var elementTop = $element.offset().top;
             var footerTop = $(targetSelector).position().top;
             var padding = 0 + bottomMargin;
             var desiredElementHeight = footerTop - elementTop - padding;


             ko.utils.domData.set(element, "DynamicHeightElementTopOffset", elementTop);

             if ($(document).fullScreen()) {
                 var windowHeightKey = "FlexiTaskLastDispatchedHeight";
                 var windowHeight = ko.utils.domData.get(element, windowHeightKey);
                 desiredElementHeight = windowHeight - elementTop - padding;
             }
             var minimumHeight = 100;
             if (desiredElementHeight >= minimumHeight) {
                 $element.height(desiredElementHeight);
                 $element.trigger("DynamicHeightSet", desiredElementHeight);
             }


            // var api =  $(element).data('asScrollable');
            // if(api){
            //     window.setTimeout(function(){
            //         if(utils.browser.isSingleColumnScreen()){
            //             api.disable();
            //             api.hideBar();
            //         }else{
            //             api.enable();
            //             api.update();
            //         }

            //     },0);

            // }


            //  console.log("el:"+$element +",top:"+elementTop+",footer:"+footerTop+",des:"+desiredElementHeight);
         }
     };
     return DynamicHeightBindingHandler;

 });
