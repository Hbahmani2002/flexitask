define(["config","common/utils","common/prefs", "common/notifications", "common/autocomplete", "common/helpers", "common/context", "amplify", "plugins/dialog", "i18n", "task/task", "durandal/events",
    "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout","jquery", "underscore"
],
function (config,utils,prefs,notifications ,autocomplete, helpers, context, amplify, dialog, i18n, taskVm, events, errorhandler, system, http, router, app, activator, ko, $, _) {


   

    var ctor = function () {
        errorhandler.includeIn(this);
        var _this = this;
        this.config = config;
        this.context = context;
        this.prefs = prefs;
        this.autocomplete = autocomplete;
        this.helpers = helpers;

      
        this.subscriptions = [];
        this.staredProjects = []; 
        this.staredTasks = []; 
        this.staredSearchs = []; 



    };

    ctor.prototype.activate = function(){
        var self = this;
        this.staredProjects = context.user().getProjectStars();
        this.staredTasks = context.user().getTaskStars();
        this.staredSearchs = context.user().getSearchStars();
    }
    


    return ctor;
});


