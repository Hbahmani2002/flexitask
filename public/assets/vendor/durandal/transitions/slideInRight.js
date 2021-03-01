
define(["durandal/system","durandal/transitions/transitionHelper", "jquery"], function(system,helper, $) {


    var settings = {
            inAnimation: "fadeInLeftBig",
            outAnimation: "fadeOutRight"
        },
        fadeIn = function(context) {
            system.extend(context, settings);
            return helper.create(context);
        };

    return fadeIn;
});
