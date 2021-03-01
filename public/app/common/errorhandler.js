define(["common/notifications", "durandal/system", "common/utils","underscore","common/diag"],
    function (notification, system, util,_,diag) {

        var errorHandler = (function () {

            var ctor = function (targetObject) {
                this.handleError = function (error) {
                    var message = error.message || error;
                    if (error.status) {
                        if (error.responseJSON)
                            message = error.responseJSON.exceptionMessage || error.responseJSON.message;
                        else {
                            message = error.responseText;
                        }
                    }
                    //diag.logError(error);
                    notification.warning("Warning", message); // system.getModuleId(targetObject));
                    // throw error;
                    return false;
                };

                this.returnError = function (error) {
                    var message = error.message || error;
                    if (error.status) {
                        if (error.responseJSON)
                            message = error.responseJSON.exceptionMessage || error.responseJSON.message;
                        else {
                            message = error.statusText;
                        }
                    }

                    notification.error(message, system.getModuleId(targetObject));
                    return message;
                };

                this.log = function (message, showToast) {
                    notification.notify(message, system.getModuleId(targetObject));
                };
            };

            return ctor;
        })();

        return {
            includeIn: includeIn
        };

        function includeIn(targetObject) {
            return _.extend(targetObject, new errorHandler(targetObject));
        }

    });
