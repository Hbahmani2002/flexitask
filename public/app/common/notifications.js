define(["durandal/system"],
    function (system) {
        var logger = {
            notify: info,
            error: error,
            info: info,
            warning: warning,
            success: success,
            confirm:confirm
        };

        return logger;



        function confirm(parameters,callback){
            swal(parameters,callback);
        }

        function notify(title, message) {
            log(title, message, {});
        }

        function success(title, message) {
            log(title, message, "success", {});
        }

        function warning(title, message) {
            log(title, message, "warning", {});
        }

        function error(title, message) {
            log(title, message, "error", {});
        }

        function info(title, message) {
            log(title, message, "info", {});
        }

        function log(title, message, type, options) {
            var message = message || "";
            var title = title || undefined;
            if (typeof type === "object") {
                options = type;
            }
            options = options || {};
            options.type = options.type || "info";

            var logMessage = title + ": " + message;
            switch (type) {
            case "success":
                toastr.success(message, title, options);
                system.log(logMessage);
                break;
            case "warning":
                toastr.warning(message, title, options);
                system.warn(logMessage);
                break;
            case "error":
                toastr.error(message, title, options);
                system.error(logMessage);
                break;
            case "info":
                toastr.info(message, title, options);
                system.log(logMessage);
                break;
            default:
                toastr.info(message, title, options);
                system.log(logMessage);
            }
        }
    });
