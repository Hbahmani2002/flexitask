/**
 * Created by Rasih CAGLAYAN on 2.05.2016.
 */
define(["knockout", "durandal/activator", "plugins/router", "common/errorhandler", "common/context", "common/helpers", "common/lookups", "common/utils"],
function (ko, activator, router, errorhandler, context, helpers, lookupFactory, utils) {


    var ctor = function (taskList)
    {
        var self = this;
        errorhandler.includeIn(this);
        self.context = context;
        self.helpers = helpers;
        self.lookups = lookupFactory.create();
        self.utils = utils;
        self.tasks = ko.observableArray([]);
        self.tasks.push.apply(self.tasks, taskList);
    };

    return ctor;

});
