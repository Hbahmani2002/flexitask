define(["i18n","common/helpers", "plugins/dialog", "common/utils", "common/lookups", "durandal/events", "common/errorhandler", "common/autocomplete", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (i18n,helpers, dialog, utils, lookupFactory, events, errorhandler, autocomplete, system, http, router, app, activator, ko, $, _) {

        var ctor = function () {
            var _this = this;
            errorhandler.includeIn(this);
            this.lookups = lookupFactory.create();
            this.autocomplete = autocomplete;

            this.name = ko.observable().extend({
                required: true
            });
            this.projectType = ko.observable().extend({
                required: true
            });
            this.projectFolderId = ko.observable().extend({
                required: true
            });
         
            this.errors = ko.validation.group(this);
            this.projectTypes = [];
            this.folders = [];
        };



        ctor.prototype.createProject = function () {
            var _this = this;
            if (_this.errors().length > 0) {
                _this.errors.showAllMessages();
                return;
            }
            var command = {
                projectTypeId: _this.projectType(),
                projectFolderId: _this.projectFolderId(),
                name: _this.name()
            };
            var url = "/api/projects";
            http.post(url, command).then(function (response) {

                var requestId = utils.getRequestIdFromXhr(arguments);
                ko.postbox.publish("NewProjectCreated", {
                    projectData: command,
                    projectId: response.projectId,
                    requestId: requestId
                });
                // ft-todo : fixed but need refactor for push based activation.
                router.navigate("#/projects/" + response.projectId, true);

                dialog.close(_this);
            }).fail(_this.handleError);
        };

        ctor.prototype.canActivate = function () {
            return true;
        };
        ctor.prototype.attached = function () {

        };

        ctor.prototype.activate = function (parameters) {
            var _this = this;



            _this.folders = helpers.groupProjectFolders(parameters.folderTree);

            _this.projectTypes = _this.lookups.projectTypes.getAll();

            // return http.get("/api/search/typeahead?type=projecttypes").then(function(response) {
            //     _this.projectTypes = response;
            // });
        };

        ctor.prototype.cancel = function () {
            dialog.close(this);
        };


        ctor.prototype.canDeactivate = function (isClose) {
            return true;
        };

        ctor.prototype.deactivate = function (isClose) {

        };

        return ctor;
    });
