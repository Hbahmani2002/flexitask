define(["plugins/dialog", "common/context", "common/notifications", "common/utils", "common/helpers", "i18n", "durandal/events", "plugins/router", "durandal/composition", "durandal/activator", "plugins/http", "durandal/app", "durandal/system", "knockout", "common/errorhandler", "underscore"],
    function (dialog, context, notifications, utils, helpers, i18n, events, router, composition, activator, http, app, system, ko, errorhandler, _) {




        var ctor = function () {
            var _this = this;
            errorhandler.includeIn(this);
            this.taskId = null;
            this.projectId = null;

            this.context = context;
            this.helpers = helpers;
            this.utils = utils;


        };





        return ctor;

    });
