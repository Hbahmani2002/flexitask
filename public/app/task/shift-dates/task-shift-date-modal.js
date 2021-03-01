define(["common/autocomplete", "durandal/system", "durandal/events", "config", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, system, events, config, helpers, context, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {

        var ctor = function(){
            var self =this;
            errorhandler.includeIn(this);
            this.dateShiftingValueAsDay = ko.observable(0);

            this.startTaskDateShifting = ko.asyncCommand({
                execute: function (callback) {
                    
                    
                    var input = {
                        dateShiftingValueAsDay: self.dateShiftingValueAsDay()
                    };

                    var url = String.format("/api/tasks/{0}/shift-dates", self.taskId);
                    http.put(url, input).then(function (response) {
                        dialog.close(self);
                    }).fail(self.handleError)
                    .always(function () {
                        callback();
                    });
                },
                canExecute: function (isExecuting) {
                    return !isExecuting && self.dateShiftingValueAsDay()!==0;
                }
            });
        };

        ctor.prototype.cancel = function() {
            dialog.close(this);
        };

        return ctor;

    });
