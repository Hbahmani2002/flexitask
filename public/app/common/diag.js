define(["underscore","plugins/http", "durandal/system","moment", "knockout", "config", "stacktrace"],
    function (_, http, system, moment, ko, config,stackTrace) {
        var slice = Array.prototype.slice;
        var enableKnockoutPerformanceReport = function () {
            var report = [];
            var lastReport = 0;
            var debounceWait = 500;

            var viewReport = _.debounce(function () {
                if (report.length) {
                    report = _.sortBy(report, "totalDuration").reverse();

                    _.each(report, function (r) {
                        r.entries = _.sortBy(r.entries, "duration").reverse();
                    });

                    var worst = _.max(report, function (r) {
                        return r.totalDuration;
                    });
                    var total = _.reduce(report, function (memo, r) {
                        return memo + r.totalDuration;
                    }, 0);

                    var levels = [
                        { min: 0, max: 50, style: "background-color: green; color: white;" },
                        { min: 51, max: 150, style: "background-color: orange; color: white;" },
                        { min: 151, max: 999999999, style: "background-color: red; color: white;" }
                    ];

                    var getLevel = function (v) {
                        return _.find(levels, function (def) {
                            return v >= def.min && v <= def.max;
                        }).style;
                    };

                    console.log("%cKnockout Binding Report", "background-color: yellow; font-size: 2em;");
                    console.log("Report Date:", new Date().toISOString(), "(+" + (new Date().getTime() - debounceWait - lastReport) + "ms)");
                    console.log("%cTotal: " + total + "ms", getLevel(total));
                    console.log("%cTop: " + worst.handler + " (" + worst.totalDuration + "ms)", getLevel(worst.totalDuration));

                    console.table(report);

                    report = [];
                    lastReport = new Date().getTime();
                }
            }, debounceWait);

            var getWrapper = function (bindingName) {
                return function (fn, element, valueAccessor, allBindings, viewModel, bindingContext) {
                    var st = new Date().getTime();

                    var result = fn(element, valueAccessor, allBindings, viewModel, bindingContext);

                    var duration = new Date().getTime() - st;
                    var handlerReport = _.findWhere(report, { handler: bindingName });

                    if (!handlerReport) {
                        handlerReport = {
                            handler: bindingName,
                            totalDuration: 0,
                            entries: []
                        };
                        report.push(handlerReport);
                    }

                    handlerReport.totalDuration += duration;
                    handlerReport.entries.push({
                        element: element,
                        binding: (element.attributes && element.attributes["data-bind"]) || element.nodeValue || "",
                        duration: duration
                    });

                    viewReport();

                    return result;
                };
            };

            _.each(ko.bindingHandlers, function (binding, name) {
                if (binding.init) binding.init = _.wrap(binding.init, getWrapper(name + ".init"));
                if (binding.update) binding.update = _.wrap(binding.update, getWrapper(name + ".update"));
            });
        };

        var ErrorHandlingBindingProvider = function() {
            var original = new ko.bindingProvider();

            //determine if an element has any bindings
            this.nodeHasBindings = original.nodeHasBindings;

            //return the bindings given a node and the bindingContext
            this.getBindingAccessors = function(node, bindingContext) {
                var result = {};

                //catch general errors parsing binding syntax
                try {
                    result = original.getBindingAccessors(node, bindingContext);
                }
                catch (e) {
                    if (console && console.log) {
                        console.log("Error in binding syntax: " + e.message, node);
                    }
                }

                //catch errors when actually evaluating the value of a binding
                ko.utils.objectForEach(result, function (key, value) {
                    result[key] = function() {
                        var result = null;

                        try {
                            result = value();
                        }
                        catch (e) {
                            if (console && console.log) {
                                console.log("Error in \"" + key + "\" binding: " + e.message, node);
                            }
                        }

                        return result;
                    };
                });

                return result;
            };
        };

        var log = function() {
            try {

                if(arguments[0].startsWith("ERROR:")){
                    var error;
                    if(arguments.length>1){
                        error = arguments[1];
                    }else{
                        error = arguments[0];
                    }
                    var parameters;
                    var cause;
                    if(error instanceof Error) {
                        stackTrace.fromError(error).then(function(stackFrames){
                            return sendError(stackFrames,error.toString(),parameters);
                        }).catch(errback);
                        return
                    }else{
                        if(typeof error === "object"){
                            if(error.status) { // xhr
                                parameters = error.responseJSON;
                                parameters.statusCode = error.status;
                                error = error.responseText;
                                cause= "AJAX";
                            }else{
                                error = error.toString();
                            }
                        }
                        stackTrace.get().then(function(stackFrames){
                            return sendError(stackFrames,error,parameters,cause);
                        }).catch(errback)
                    }
                }
                // Modern browsers
                if (typeof console != 'undefined' && typeof console.log == 'function') {
                    // Opera 11
                    if (window.opera) {
                        var i = 0;
                        while (i < arguments.length) {
                            console.log('Item ' + (i + 1) + ': ' + arguments[i]);
                            i++;
                        }
                    }
                    // All other modern browsers
                    else if ((slice.call(arguments)).length == 1 && typeof slice.call(arguments)[0] == 'string') {
                        console.log((slice.call(arguments)).toString());
                    } else {
                        console.log.apply(console, slice.call(arguments));
                    }
                }
                // IE8
                else if ((!Function.prototype.bind || treatAsIE8) && typeof console != 'undefined' && typeof console.log == 'object') {
                    Function.prototype.call.call(console.log, console, slice.call(arguments));
                }

                // IE7 and lower, and other old browsers
            } catch (ignore) { }
        }

        //ko.bindingProvider.instance = new ErrorHandlingBindingProvider();

        var errback = function(err) {
            console.log(err.message);
        }

        var isClientSideErrorLoggingEnabled=false;

        var getBrowserInformations = function(){
            var x = '';
            for(var p in navigator)
               x += p + '=' + navigator[p] + "\n";
            return x;
        };

        var getBrowserInformationsCached = _.memoize(getBrowserInformations);

        var sendError  =function(stackFrames,message,parameters,cause){
            var stringifiedStack = stackFrames.map(function(sf) {
                return sf.toString();
            }).join("\n");

            var data = {
                message : message,
                parameters: parameters,
                stackTrace : stringifiedStack,
                errorUrl: window.location.href,
                cause : cause ||"",
                type:"warn",
                browser: getBrowserInformationsCached()
            };

            http.post("api/diags/log",data);

        }

        var logError = function(error,cause){
            // if(!isClientSideErrorLoggingEnabled){
            //     return false;
            // }
            //
            // if(error instanceof Error) {
            //     stackTrace.fromError(error).then(function(stackFrames){
            //         return sendError(stackFrames,error.toString());
            //     }).catch(errback);
            //     return
            // }else{
            //     stackTrace.get().then(function(stackFrames){
            //         return sendError(stackFrames,error);
            //     }).catch(errback)
            // }
        }

        return {
            logError:logError,
            enableKnockoutPerformanceReport:enableKnockoutPerformanceReport,
            enableClientSideErrorLogging : function(){
                isClientSideErrorLoggingEnabled= true;

                system.log = log;
                ko.onError = function(error) {
                    console.log("from ko:"+error);
                };

                window.onerror =  function(msg, file, line, col, error) {
                    logError(error);
                };
            }
        };
    });
