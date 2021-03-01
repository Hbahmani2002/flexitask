define(["moment", "common/lang", "plugins/router", "durandal/events", "durandal/app", "jquery", "plugins/http", "underscore", "common/errorhandler", "common/utils", "knockout", "i18n"],
    function (moment, lang, router, events, app, $, http, _, errorHandler, utils, ko, i18n) {


        var getAll = function (values) {
            return _.filter(_.values(values), function (v) {
                return _.isFunction(v) === false;
            });
        };



        var ctor = function () {
            var _this = this;
            this.taskConstraintTypes = {
                AsSoonAsPossible: 0,
                AsLateAsPossible: 1,
                FinishNoEarlierThan: 2
            };
            this.getAllConstraintTypes = function () {
                return null;
            };

        };


        return ctor;
    });
