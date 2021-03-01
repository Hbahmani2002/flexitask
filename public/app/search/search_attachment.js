define(
    [
        "common/autocomplete",
        "common/lookups",
        "moment",
        "common/helpers",
        "common/context",
        "amplify",
        "plugins/dialog",
        "i18n",
        "durandal/events",
        "common/errorhandler",
        "durandal/system",
        "plugins/http",
        "plugins/router",
        "durandal/app",
        "durandal/activator",
        "knockout",
        "jquery",
        "underscore"
    ],
    function(
        autocomplete,
        lookupFactory,
        moment,
        helpers,
        context,
        amplify,
        dialog,
        i18n,
        events,
        errorhandler,
        system,
        http,
        router,
        app,
        activator,
        ko,
        $,
        _
    ) {
        function FilterModel() {
            this.name = ko.observable();
            this.tags = ko.observableArray([]);
            this.authors = ko.observableArray([]);
            this.tagOperation = ko.observable();
            this.uploadDateStart = ko.observable(moment("2015-01-01")).extend({
                required: {
                    onlyIf: function() {
                        return true;
                    }
                }
            });
            this.uploadDateEnd = ko.observable(moment()).extend({
                required: {
                    onlyIf: function() {
                        return true;
                    }
                }
            });
            this.projectId = ko.observable();
            this.taskId = ko.observable();
            this.errors = ko.validation.group(this);
        }

        var ctor = function() {
            errorhandler.includeIn(this);
            var _this = this;
            this.gridUniqueName = _.uniqueId("grid_");
            this.context = context;
            this.autocomplete = autocomplete;
            this.helpers = helpers;
            this.lookups = lookupFactory.create();
            this.filter = new FilterModel();
            this.results = ko.observableArray([]);
            this.shouldShowSearchForm = ko.observable(true);
        };

       

        ctor.prototype.buildCriteriaAndSearch = function() {
            var _this = this;
            if (_this.filter.errors().length > 0) {
                _this.filter.errors.showAllMessages();
                return;
            }
            var criteria = ko.mapping.toJS(_this.filter);
            _this.search(criteria);
        };

        ctor.prototype.clear = function () {
            _this=this;
            _this.filter.name(null);
            _this.filter.tags([]);
            _this.filter.authors([]);
            _this.filter.tagOperation(null);
            _this.filter.uploadDateStart(null);
            _this.filter.uploadDateEnd(null);
        }

        ctor.prototype.search = function(criteria) {
            var _this = this;
            http
                .post("/api/search/attachments", criteria)
                .then(function(response) {
                    var results = response.results;

                    _this.results([]);
                    _this.results.push.apply(_this.results, results);
                    _this.shouldShowSearchForm(false);
                    ko.postbox.publish("SearchFinished", {
                        results: results,
                        type: "Attachment"
                    });
                })
                .fail(_this.handleError);
        };

        return ctor;
    }
);
