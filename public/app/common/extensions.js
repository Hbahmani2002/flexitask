define(["durandal/composition", "amplify", "i18n", "durandal/binder", "exports", "highlightjs", "underscore", "moment",
    "summernote", "common/utils", "jquery.atwho", "jquery", "knockout", "config", "datepicker",
    "knockout.postbox",
    "knockout.mapping",
    "knockout.punches",
    "knockout.validation",
    "knockout.dirtyFlag",
    "knockout.command",
    "knockout.activity"],
function (composition,amplify, i18n, binder, exports, hljs, _, moment, summernote, utils, atwho, $, ko, config, datepicker, koPostbox, koMapping, koPunches, koValidation, koDirtyFlag, koCommand, koActivity) {



    var extensions = (function () {
        function extensions() {}

        extensions.install = function () {
            extensions.installArrayExtensions();
            extensions.installDateExtensions();
            extensions.installKnockout();
            extensions.installi18N();
            extensions.installToastr();
            extensions.installObservableExtensions();
            extensions.installStringExtension();
            extensions.installStorageExtension();
            extensions.installBindingHandlers();
            extensions.installJQueryExtensions();
            extensions.installUnderscoreExtensions();
            extensions.installJQueryAjaxBatch();


            composition.addBindingHandler("horizontalTabs");
            composition.addBindingHandler("matchHeight");
        };

        extensions.installJQueryAjaxBatch = function () {
            // https://github.com/volpav/batchjs/blob/master/src/batch.js
            var pack = function (data, boundary) {
                var body = [];

                $.each(data, function (i, d) {
                    var t = d.type.toUpperCase(),
                        noBody = ["GET", "DELETE"];

                    body.push("--" + boundary);
                    body.push("Content-Type: application/http; msgtype=request");
                    _.each(_.keys(d.headers), function (key) {
                        body.push(key + ": " + d.headers[key]);
                    });
                    body.push("");
                    body.push(t + " " + d.url + " HTTP/1.1");

                    /* Don't care about content type for requests that have no body. */
                    if (noBody.indexOf(t) < 0) {
                        body.push("Content-Type: " + (d.contentType || "application/json; charset=utf-8"));
                    }

                    body.push("Host: " + location.host);
                    body.push("", d.data ? JSON.stringify(d.data) : "");
                });

                body.push("--" + boundary + "--", "");

                return body.join("\r\n");
            };

                /**
                 * Unpacks the given response and passes the unpacked data to the original callback.
                 * @param {object} xhr jQuery XHR object.
                 * @param {string} status Response status.
                 * @param {Function} complete A callback to be executed upon unpacking the response.
                 */
            var unpack = function (xhr, status, complete) {
                var lines = xhr.responseText.split("\r\n"),
                    boundary = lines[0],
                    data = [],
                    d = null;

                $.each(lines, function (i, l) {
                    if (l.length) {
                        if (l.indexOf(boundary) == 0) {
                            if (d) data.push(d);
                            d = {};
                        } else if (d) {
                            if (!d.status) {
                                d.status = parseInt((function (m) {
                                    return m || [0, 0];
                                })(/HTTP\/1.1 ([0-9]+)/g.exec(l))[1], 10);
                            } else if (!d.data) {
                                try {
                                    d.data = JSON.parse(l);
                                } catch (ex) {

                                }
                            }
                        }
                    }
                });

                complete.call(this, xhr, status, data);
            };

            $.extend($, {
                /**
                     * Sends the given batch request.
                     * @param {object} params Request parameters.
                     */
                ajaxBatch: function (params) {
                    var boundary = new Date().getTime().toString();

                    return $.ajax({
                        type: "POST",
                        url: params.url,
                        headers: ko.toJS(params.headers),
                        dataType: "json",
                        data: pack(params.data, boundary),
                        contentType: 'multipart/mixed; boundary="' + boundary + '"',
                        complete: params.complete ?
                            function (xnr, status) {
                                unpack(xnr, status, params.complete);
                            } : null
                    });
                }
            });
        };

        extensions.installi18N = function () {

        };

        extensions.installToastr = function () {
            // toastr configuration
            toastr.options.positionClass = "toast-bottom-right";
            toastr.options.backgroundpositionClass = "toast-bottom-right";
        };

        extensions.installKnockout = function () {
            ko.mapping = koMapping;

            // knockout punches configuration
            ko.punches.enableAll();
            ko.punches.interpolationMarkup.enable();
            ko.punches.attributeInterpolationMarkup.enable();

            // ko.validation configuration
            ko.validation.rules.pattern.message = "Invalid.";
            ko.validation.init({
                registerExtenders: true,
                messagesOnModified: true,
                insertMessages: true,
                parseInputAttributes: true,
                writeInputAttributes: true,
                messageTemplate: null,
                errorElementClass: "has-error",
                errorMessageClass: "help-block",
                decorateInputElement: true,
                grouping: {
                    deep: true
                },
                errorsAsTitle: true
            });
            ko.validation.insertValidationMessage = function (element) {
                var span = document.createElement("SPAN");
                span.className = ko.validation.utils.getConfigOptions(element).errorMessageClass;
                var el = $(element);
                if (el.next().is("label")) {
                    ko.validation.utils.insertAfter(el.next().get(0), span);
                } else {
                    ko.validation.utils.insertAfter(element, span);
                }
                return span;
            };
            ko.validation.rules.checked = {
                validator: function (value) {
                    if (!value) {
                        return false;
                    }
                    return true;
                }
            };
            ko.validation.registerExtenders();
        };



        extensions.installJQueryExtensions = function () {

            $.fn.offOn = function(events,selector,handler){
                this.off(events,selector).on(events,selector,handler);
            };

            jQuery.fn.exists = function () {
                return this.length > 0;
            };

            $.fn.collect = function (fn) {
                var values = [];

                if (typeof fn == "string") {
                    var prop = fn;
                    fn = function () {
                        return this.attr(prop);
                    };
                }

                $(this).each(function () {
                    var val = fn.call($(this));
                    values.push(val);
                });
                return values;
            };

            $.fn.serializeObject = function () {
                var o = {};
                var a = this.serializeArray();
                $.each(a, function () {
                    if (o[this.name] !== undefined) {
                        if (!o[this.name].push) {
                            o[this.name] = [o[this.name]];
                        }
                        o[this.name].push(this.value || "");
                    } else {
                        o[this.name] = this.value || "";
                    }
                });
                return o;
            };

            jQuery.extend({
                // isFunction: function (functionToCheck) {
                //    var getType = {};
                //    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
                // },
                offOn: function (types, selector, data, fn, /* INTERNAL*/ one) {

                },
                valueOrDefault: function (value, defaultValue) {
                    if (typeof value != "undefined") {
                        return value;
                    } else {
                        return defaultValue;
                    }
                },
                isNull: function (o) {
                    if (o === null) {
                        return true;
                    }
                    return false;
                },
                isNullOrUndefined: function (o) {
                    if (o === null || typeof o == "undefined") {
                        return true;
                    }
                    return false;
                },
                isUndefined: function (object) {
                    return typeof object == "undefined";
                },
                isDefined: function (object) {
                    return typeof object != "undefined";
                },
                endsWith: function (value, suffix) {
                    return value.indexOf(suffix, value.length - suffix.length) !== -1;
                },
                all: function (objects, selector) {
                    for (var i = 0; i < objects.length; i++) {
                        if (selector(objects[i]) == false) {
                            return false;
                        }
                    }

                    return true;
                },
                htmlEncode: function (value) {
                    // create a in-memory div, set it's inner text(which jQuery automatically encodes)
                    // then grab the encoded contents back out.  The div never exists on the page.
                    return $("<div/>").text(value).html();
                },
                htmlDecode: function (value) {
                    return $("<div/>").html(value).text();
                },
                isNullOrWhiteSpace: function (str) {
                    return str === null || str.match(/^ *$/) !== null;
                },
                getFragment: function () {
                    if (window.location.hash.indexOf("#") === 0) {
                        return $.parseQueryString(window.location.hash.substr(1));
                    } else {
                        return {};
                    }
                },
                updateQueryString: function (uri, key, value) {
                    var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
                    var separator = uri.indexOf("?") !== -1 ? "&" : "?";
                    if (uri.match(re)) {
                        return uri.replace(re, "$1" + key + "=" + value + "$2");
                    } else {
                        return uri + separator + key + "=" + value;
                    }
                },

                escapeJSON: function (data) {
                    var length, key, i;
                    if (Object.prototype.toString.call(data) === "[object Object]") {
                        for (key in data) {
                            if (data.hasOwnProperty(key)) {
                                if (typeof data[key] === "object") {
                                    $.escapeJSON(data[key]);
                                } else if (typeof data[key] === "string") {
                                    data[key] = $.htmlEncode(data[key]);
                                }
                            }
                        }
                        return;
                    }
                    if (Object.prototype.toString.call(data) === "[object Array]") {
                        for (i = 0, length = data.length; i < length; i++) {
                            $.escapeJSON(data[i]);
                        }
                    }
                }
            });
        };
        extensions.installUnderscoreExtensions = function () {
            _.mixin({

                // Get/set the value of a nested property
                deep: function (obj, key, value) {

                    var keys = key.replace(/\[(["']?)([^\1]+?)\1?\]/g, ".$2").replace(/^\./, "").split("."),
                        root,
                        i = 0,
                        n = keys.length;

                        // Set deep value
                    if (arguments.length > 2) {

                        root = obj;
                        n--;

                        while (i < n) {
                            key = keys[i++];
                            obj = obj[key] = _.isObject(obj[key]) ? obj[key] : {};
                        }

                        obj[keys[i]] = value;

                        value = root;

                        // Get deep value
                    } else {
                        while ((obj = obj[keys[i++]]) != null && i < n) {

                        }
                        value = i < n ? void 0 : obj;
                    }

                    return value;
                },
                pluckDeep: function (obj, key) {
                    return _.map(obj, function (value) {
                        return _.deep(value, key);
                    });
                },
                // Return a copy of an object containing all but the blacklisted properties.
                unpick: function (obj) {
                    obj || (obj = {});
                    return _.pick(obj, _.difference(_.keys(obj), _.flatten(Array.prototype.slice.call(arguments, 1))));
                },
                extendCollection: function () {
                    var length = arguments.length;
                    var collection = arguments[0];
                    if (length < 2 || collection == null) return collection;
                    var args = arguments;
                    _.each(collection, function (c) {
                        for (var index = 1; index < length; index++) {
                            var source = args[index](c);
                            _.extend(c, source);
                        }
                    });
                    return collection;
                }

            });
        };
        extensions.installDateExtensions = function () {
            var datePrototype = Date.prototype;
            var formatNumber = function (num) {
                return num < 10 ? "0" + num : num;
            };
            datePrototype.getUTCDateFormatted = function () {
                var date = this.getUTCDate();
                return formatNumber(date);
            };
            datePrototype.getUTCMonthFormatted = function () {
                var month = this.getUTCMonth() + 1;
                return formatNumber(month);
            };
            datePrototype.getUTCHoursFormatted = function () {
                var hours = this.getUTCHours();
                return formatNumber(hours);
            };
            datePrototype.getUTCMinutesFormatted = function () {
                var minutes = this.getUTCMinutes();
                return formatNumber(minutes);
            };
            datePrototype.getUTCSecondsFormatted = function () {
                var seconds = this.getUTCSeconds();
                return formatNumber(seconds);
            };
        };
        extensions.installObservableExtensions = function () {
            var subscribableFn = ko.subscribable.fn;
            var observableArrayFn = ko.observableArray.fn;

            // observable.distinctUntilChanged
            subscribableFn.distinctUntilChanged = function () {
                var observable = this;
                var matches = ko.observable();
                var lastMatch = observable();
                observable.subscribe(function (val) {
                    if (val !== lastMatch) {
                        lastMatch = val;
                        matches(val);
                    }
                });
                return matches;
            };
            // observable.throttled
            subscribableFn.throttle = function (throttleTimeMs) {
                var observable = this;
                return ko.computed(function () {
                    return observable();
                }).extend({
                    throttle: throttleTimeMs
                });
            };



            extensions.stopVirtualElementBinding = function (value) {
                value = typeof value !== "undefined" ? value : false;
                ko.virtualElements.allowedBindings.stopBinding = value;
            };

            // protected observableArray that would work with primitive items or plain objects
            ko.revertableObservableArray = function (initialValue) {


                var actual = ko.observableArray(initialValue),
                    cache = ko.observableArray(initialValue);

                actual.cached = cache;

                actual.commit = function () {
                    cache(actual());
                };

                actual.revert = function () {
                    actual(cache());
                };

                return actual;
            };

            // wrapper for an observable that protects value until committed
            ko.revertableObservable = function (initialValue) {
                // private variables
                var cache = ko.observable(initialValue),
                    actual = ko.observable(initialValue);

                actual.cached = cache;

                // cache the current value, so we can potentially revert back to it
                actual.commit = function () {
                    cache(actual());
                };

                // revert back to the cached value
                actual.revert = function () {
                    actual(cache());
                };

                return actual;
            };


            //
            // extenders
            //
            ko.extenders.trackValue = function (target, option) {
                target.hasValue = ko.observable(false);
                target.subscribe(function (newValue) {
                    target.hasValue(typeof newValue !== "undefined" && newValue ? true : false);
                });
                return target;
            };


            ko.extenders.dateFormat = function (target, format) {
                var result = ko.dependentObservable({
                    read: function () {
                        return moment(target()).format(format);
                    },
                    write: target
                });

                result.raw = target;
                return result;
            };

            ko.extenders.notifyOnChange = function (target, func) {
                target.subscribe(function (newValue) {
                    func(newValue);
                });
                return target;
            };

            ko.extenders.booleanAsValue = function (target, option) {
                var result = ko.computed({
                    read: target,
                    write: function (newValue) {
                        if (newValue === true) {
                            target(option.v);
                        } else {
                            target(option.d);
                        }
                    }
                });

                result(target());
                return result;
            };


            // /
            // functions
            //

            ko.observableArray.fn.contains = function(data){

                return ko.unwrap(this).indexOf(data)>-1;
            };

            ko.observableArray.fn.isArray = function () {
                return this;
            };

            // track elements for observableArray (data-bind="if:itemCollection.hasItems)
            ko.observableArray.fn.trackHasItems = function () {
                // create a sub-observable
                this.hasItems = ko.observable();

                // update it when the observableArray is updated
                this.subscribe(function (newValue) {
                    this.hasItems(newValue && newValue.length ? true : false);
                }, this);

                // trigger change to initialize the value
                this.valueHasMutated();

                // support chaining by returning the array
                return this;
            };

            ko.subscribable.fn.trimmed = function () {
                return ko.computed({
                    read: function () {
                        var v = this();
                        if (v) {
                            return v.trim();
                        }
                        return v;
                    },
                    write: function (value) {
                        if (value) {
                            this(value.trim());
                            this.valueHasMutated();
                        }

                    },
                    owner: this
                });
            };
        };
        extensions.installArrayExtensions = function () {
            Array.prototype.remove = function () {
                var what, a = arguments,
                    L = a.length,
                    ax;
                while (L && this.length) {
                    what = a[--L];
                    while ((ax = this.indexOf(what)) !== -1) {
                        this.splice(ax, 1);
                    }
                }
                return this;
            };
        };
        extensions.installStringExtension = function () {
            String.prototype.replaceAll = function (search, replace) {
                // if replace is not sent, return original string otherwise it will
                // replace search string with 'undefined'.
                if (replace === undefined) {
                    return this.toString();
                }

                return this.replace(new RegExp("[" + search + "]", "g"), replace);
            };

            String.format = function () {
                var s = arguments[0];
                for (var i = 0; i < arguments.length - 1; i++) {
                    var reg = new RegExp("\\{" + i + "\\}", "gm");
                    s = s.replace(reg, arguments[i + 1]);
                }

                return s;
            };

            if (!String.prototype.trim) {
                // code for trim
                String.prototype.trim = function () {
                    return this.replace(/^\s+|\s+$/g, "");
                };
                String.prototype.ltrim = function () {
                    return this.replace(/^\s+/, "");
                };
                String.prototype.rtrim = function () {
                    return this.replace(/\s+$/, "");
                };
                String.prototype.fulltrim = function () {
                    return this.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, "").replace(/\s+/g, " ");
                };
            }

            String.prototype.endsWith = function (suffix) {
                return (this.substr(this.length - suffix.length) === suffix);
            };

            String.prototype.startsWith = function (prefix) {
                return (this.substr(0, prefix.length) === prefix);
            };

            String.prototype.format = String.prototype.format || function () {
                var args = Array.prototype.slice.call(arguments);
                args.splice(0, 0, this.toString());
                return String.format.apply(this, args);
            };

            String.prototype.trunc = String.prototype.trunc || function (n) {
                return this.length > n ? this.substr(0, n - 1) + "..." : this;
            };
        };
        extensions.installStorageExtension = function () {
            Storage.prototype.getObject = function (key) {
                var value = this.getItem(key);
                return value && JSON.parse(value);
            };
            Storage.prototype.setObject = function (key, value) {
                this.setItem(key, ko.toJSON(value));
            };
        };

        extensions.installBindingHandlers = function () {



            // on-the-fly binding (ko 3.0)
            var original = ko.getBindingHandler;
            ko.getBindingHandler = function (bindingKey) {
                var binding = original(bindingKey);
                if (!binding) {
                    binding = {
                        update: function (element, valueAccessor) {
                            element.setAttribute(bindingKey, ko.unwrap(valueAccessor()));
                        }
                    };
                }
                return binding;
            };

            ko.bindingHandlers.inverseChecked = {
                init: function (element, valueAccessor, allBindingsAccessor) {
                    var value = valueAccessor();
                    var interceptor = ko.computed({
                        read: function () {
                            return !value();
                        },
                        write: function (newValue) {
                            value(!newValue);
                        },
                        disposeWhenNodeIsRemoved: element
                    });

                    var newValueAccessor = function () { return interceptor; };


                    // keep a reference, so we can use in update function
                    ko.utils.domData.set(element, "newValueAccessor", newValueAccessor);
                    // call the real checked binding's init with the interceptor instead of our real observable
                    ko.bindingHandlers.checked.init(element, newValueAccessor, allBindingsAccessor);
                },
                update: function (element, valueAccessor) {
                    // call the real checked binding's update with our interceptor instead of our real observable
                    ko.bindingHandlers.checkedValue.update(element, ko.utils.domData.get(element, "newValueAccessor"));
                }
            };

            ko.bindingHandlers.matchHeight = {
                init: function (element, valueAccessor, allBindingsAccessor, data, context) {
                    var options = ko.unwrap(valueAccessor());

                    var defaults = {
                        byRow: true
                    };
                    $.extend(true, {}, defaults, options);
                    if (options.matchSelector)
                    {
                        $(element).find(options.matchSelector).matchHeight(options);
                    } else {
                        $(element).children().matchHeight(options);
                    }
                }
            };

            ko.bindingHandlers.myCustomBinding = {
                init: function (element, valueAccessor, allBindingsAccessor, data, context) {

                },
                update: function (element, valueAccessor, allBindingsAccessor, data, context) {
                    // update logic
                }
            };

            // binding to do event delegation for any event
            // http://www.knockmeout.net/2011/04/event-delegation-in-knockoutjs.html
            // delegatedEvent: [{ event: 'mouseover', callback: setDescription, selector: 'th'} }
            ko.bindingHandlers.delegatedEvent = {
                init: function (element, valueAccessor, allBindings, viewModel) {
                    var eventsToHandle = valueAccessor() || {};
                    // if a single event was passed, then convert it to an array
                    if (!$.isArray(eventsToHandle)) {
                        eventsToHandle = [eventsToHandle];
                    }
                    ko.utils.arrayForEach(eventsToHandle, function (eventOptions) {
                        var realCallback = function (event) {
                            var element = event.target;
                            var options = eventOptions;
                            // verify that the element matches our selector
                            if ($(element).is(options.selector)) {
                                // get real context
                                var context = $(event.target).tmplItem().data;
                                // if a string was passed for the function, then assume it is a function of the real context
                                if (typeof options.callback === "string" && typeof context[options.callback] === "function") {
                                    return context[options.callback].call(context, event);
                                }
                                // if a function was passed, then give it the real context as a param
                                return options.callback.call(viewModel, context, event);
                            }
                        };

                        var realValueAccessor = function () {
                            var result = {};
                            result[eventOptions.event] = realCallback;
                            return result;
                        };

                        ko.bindingHandlers.event.init(element, realValueAccessor, allBindings, viewModel);
                    });
                }
            };

            ko.bindingHandlers.lightbox = {
                init: function (element, valueAccessor, allBindingsAccessor, data, context) {
                    var options = ko.unwrap(valueAccessor());

                    if (options.type === "gallery") {
                        $(element).magnificPopup({
                            delegate: "a",
                            type: "image",
                            closeOnContentClick: false,
                            tLoading: "Loading image #%curr%...",
                            mainClass: "mfp-img-mobile",
                            gallery: {
                                enabled: true,
                                navigateByImgClick: true
                                // preload: [0, 1] // Will preload 0 - before current, and 1 after the current image
                            },
                            zoom: {
                                enabled: true,
                                duration: 300, // don't foget to change the duration also in CSS
                                opener: function (element) {
                                    return element.find("img");
                                }
                            },
                            image: {
                                verticalFit: true,
                                tError: '<a href="%url%">The image #%curr%</a> could not be loaded.',
                                titleSrc: function (item) {
                                    return item.el.attr("title");
                                }
                            }
                        });
                    } else {
                        $(element).magnificPopup({
                            type: "image",
                            closeOnContentClick: true,
                            mainClass: "mfp-img-mobile",
                            image: {
                                verticalFit: true
                            }
                        });
                    }

                },
                update: function (element, valueAccessor, allBindingsAccessor, data, context) {
                    // update logic
                }
            };


            ko.bindingHandlers.highlight = {
                init: function (element, valueAccessor, allBindingsAccessor, data, context) {
                    hljs.highlightBlock(element);
                },
                update: function (element, valueAccessor, allBindingsAccessor, data, context) {

                }
            };


            ko.bindingHandlers.horizontalTabs = {
                after: ["foreach"],
                // https://github.com/LucasLazaro/bootstrap-nav-tab-scrollable
                init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                    function horizontalTabs(el) {
                        var $elem = $(el),
                            widthOfReducedList = $elem.find(".nav-tabs-horizontal").width(),
                            widthOfList = 0,
                            currentPos = 0,
                            adjustScroll = function () {
                                widthOfList = 0;
                                $elem.find(".nav-tabs-horizontal li").each(function (index, item) {
                                    widthOfList += $(item).width();
                                });

                                widthAvailale = $elem.width();

                                if (widthOfList > widthAvailale && utils.browser.isMobile() === false) {
                                    $elem.find(".scroller").show();
                                    updateArrowStyle(currentPos);
                                    widthOfReducedList = $elem.find(".nav-tabs-horizontal").width();
                                } else {
                                    $elem.find(".scroller").hide();
                                }
                            },
                            scrollLeft = function () {
                                $elem.find(".nav-tabs-horizontal").animate({
                                    scrollLeft: currentPos - widthOfReducedList
                                }, 500);

                                if (currentPos - widthOfReducedList > 0) {
                                    currentPos -= widthOfReducedList;
                                } else {
                                    currentPos = 0;
                                }
                            },
                            scrollRight = function () {
                                $elem.find(".nav-tabs-horizontal").animate({
                                    scrollLeft: currentPos + widthOfReducedList
                                }, 500);

                                if ((currentPos + widthOfReducedList) < (widthOfList - widthOfReducedList)) {
                                    currentPos += widthOfReducedList;
                                } else {
                                    currentPos = (widthOfList - widthOfReducedList);
                                }
                            },
                            manualScroll = function () {
                                currentPos = $elem.find(".nav-tabs-horizontal").scrollLeft();

                                updateArrowStyle(currentPos);
                            },
                            updateArrowStyle = function (position) {
                                if (position >= (widthOfList - widthOfReducedList)) {
                                    $elem.find(".arrow-right").addClass("disabled");
                                } else {
                                    $elem.find(".arrow-right").removeClass("disabled");
                                }

                                if (position <= 0) {
                                    $elem.find(".arrow-left").addClass("disabled");
                                } else {
                                    $elem.find(".arrow-left").removeClass("disabled");
                                }
                            };

                            // Event binding
                        $(window).resize(function () {
                            adjustScroll();
                        });

                        $elem.find(".arrow-left").on("click.horizontalTabs", function () {
                            scrollLeft();
                        });

                        $elem.find(".arrow-right").on("click.horizontalTabs", function () {
                            scrollRight();
                        });

                        $elem.find(".nav-tabs-horizontal").scroll(function () {
                            manualScroll();

                        });
                        adjustScroll();
                    }

                    // Initial Call
                    // window.setTimeout(function() {
                    horizontalTabs(element);
                    // }, 1);
                }
            };


            ko.bindingHandlers.scrollable = {
                update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                    var $element = $(element),
                        value = ko.unwrap(valueAccessor()),
                        options = value.options || {};

                        /* options = $.extend(options, {
                         group: 0,
                         noDragClass: 'dd-nodrag',
                         maxDepth: 1000,
                         callback: function (l, e, z, a) {

                         }
                         });*/


                    $element.asScrollable({
                        namespace: "scrollable",
                        contentSelector: "> [data-role='content']",
                        containerSelector: "> [data-role='container']"
                    });

                    //  $element.asScrollable("update");

                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {

                    });
                },
                init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                    /* var $element = $(element),
                         value = ko.unwrap(valueAccessor()),
                         options = value.options || {};

                         $element.asScrollable({
                         namespace: "scrollable",
                         contentSelector: "> [data-role='content']",
                         containerSelector: "> [data-role='container']"
                         });*/

                }
            };


            ko.bindingHandlers.atwho = {
                init: function (element, valueAccessor, allBindings) {
                    var value = valueAccessor();
                    var options = allBindings.get("atwhoOptions");
                    var selector = options.selector;
                    if ($.isArray(options.settings)) {
                        var i, len;
                        for (i = 0, len = options.settings.length; i < len; i++) {
                            var sett = options.settings[i];
                            if (selector) {
                                $(element).find(selector).atwho(sett);
                            } else {
                                $(element).atwho(sett);
                            }
                        }
                    } else {
                        if (selector) {
                            $(element).find(selector).atwho(sett);
                        } else {
                            $(element).atwho(options.settings);
                        }
                    }


                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                        if (selector) {
                            $(element).find(selector).atwho("destroy");
                        } else {
                            $(element).atwho("destroy");
                        }

                    });
                }
            };

            ko.bindingHandlers.summernote = new function () {
                var isblur = false;

                this.init = function (element, valueAccessor, allBindings) {
                    var value = valueAccessor();

                    var updateObservable = function (e) {
                        value(e.currentTarget.innerHTML);
                    };


                    var options = {
                        toolbar: [
                            ["style", ["style"]],
                            ["font", ["bold", "italic", "underline", "clear"]],
                            ["fontname", ["fontname"]],
                            // ['fontsize', ['fontsize']], // Still buggy
                            ["color", ["color"]],
                            ["para", ["ul", "ol", "paragraph"]],
                            ["height", ["height"]],
                            ["table", ["table"]],
                            ["insert", ["link", "picture", "video"]],
                            ["view", ["fullscreen"]],
                            ["help", ["help"]]
                        ],
                        height: 300, // set editable area's height
                        focus: true,
                        disableDragAndDrop: true
                        // onBlur: function(e) {
                        //     isblur = true;
                        //     value($(element).code());
                        //     isblur = false;
                        // }
                    };
                    options.onblur = updateObservable;
                    $.extend(options, allBindings.get("summerOptions"));

                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                        $(element).destroy();
                    });

                    return $(element).summernote(options);
                };
                this.update = function (element, valueAccessor) {
                    if (!isblur) {
                        var value = valueAccessor();
                        $(element).code(value());
                    }


                };
            };


            ko.bindingHandlers.fileUpload2 = {
                update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                    var options = valueAccessor() || {};

                    var autoUpload = typeof options.autoUpload === "undefined" ? true : options.autoUpload;
                    var componentElement = $(element).fileupload({
                        autoUpload: autoUpload,
                        uploadTemplateId: options.uploadTemplateId || null,
                        downloadTemplateId: options.downloadTemplateId || null,
                        url: options.url,
                        headers: options.headers,
                        dataType: "json",
                        change: options.change,
                        done: function (e, data) {
                            return options.done(e, data);
                        },
                        add: function (e, data) {
                            if (autoUpload || (data.autoUpload !== false && $(element).fileupload("option", "autoUpload"))) {
                                var p = $(options.progressSelector);
                                var pb = p.find(".progress-bar");
                                p.show();
                                pb.css("width", "0%");
                                data.process().done(function () {
                                    var jqXHR = data.submit();
                                    if (options.beginUpload) {
                                        options.beginUpload(jqXHR);
                                    }
                                });
                            }
                        },
                        progressall: function (e, data) {
                            var progress = parseInt(data.loaded / data.total * 100, 10);
                            var p = $(options.progressSelector);
                            var pb = p.find(".progress-bar");
                            if (progress >= 100) {
                                progress = 0;
                                p.hide();
                                if (options.uploadingFile) {
                                    options.uploadingFile(false);
                                }
                            } else {
                                if (options.uploadingFile) {
                                    if (!options.uploadingFile()) {
                                        options.uploadingFile(true);
                                    }
                                }

                            }
                            pb.css("width", progress + "%");
                        },
                        fail: function (e, data) {
                            options.fail(e, data.jqXHR);
                            if (options.uploadingFile) {
                                options.uploadingFile(false);
                            }
                        }
                    }).on("fileuploadsubmit", function (e, data) {
                        if (options.getFormElement) {
                            // BUG : there is a bug when accessing to parent of element
                            var form = options.getFormElement($(element), e, data);
                            var inputs = form.find(":input.js--serializable");
                            data.formData = inputs.serializeArray();
                        } else {
                            var inputs = $(data.form).find(".js--serializable");
                            data.formData = inputs.serializeArray();
                        }
                    });
                    options.componentElement = componentElement;

                    // //handle disposal (if KO removes by the template binding)
                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                        try {
                            options.componentElement = null;
                            $(element).find(selector).fileupload("destroy");
                        } catch (err) {

                        }
                    });

                }
            };

            ko.bindingHandlers.fadeVisible = {
                init: function (element, valueAccessor) {
                    // Initially set the element to be instantly visible/hidden depending on the value
                    var value = valueAccessor();
                    $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
                },
                update: function (element, valueAccessor) {
                    // Whenever the value subsequently changes, slowly fade the element in or out
                    var value = valueAccessor();
                    ko.unwrap(value) ? $(element).fadeIn() : $(element).fadeOut();
                }
            };


         

            ko.bindingHandlers.fileUpload = {
                update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                    var options = valueAccessor() || {};
                    var selector = allBindings().fileUploadSelector || false;
                    var el = $(element);

                    var componentElement = el;
                    if (selector) {
                        componentElement = el.find(selector);
                    }

                    // componentElement.find('.js--clear-upload-files').off("click").on("click", function() {
                    //     componentElement.find('tr.template-upload').remove();
                    // })

                    componentElement.fileupload(options)
                        .on("fileuploadsubmit", function (e, data) {
                            var inputs = el.find(":input.js--serializable");
                            data.formData = inputs.serializeArray();
                        });

                    // //handle disposal (if KO removes by the template binding)
                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                        try {
                            componentElement.fileupload("destroy");
                        } catch (err) {

                        }
                    });

                }
            };


            ko.bindingHandlers.truncatedText = {
                update: function (element, valueAccessor, allBindingsAccessor) {
                    var value = ko.utils.unwrapObservable(valueAccessor()),
                        length = ko.utils.unwrapObservable(allBindingsAccessor().length) || ko.bindingHandlers.truncatedText.defaultLength,
                        truncatedValue = value.length > length ? value.substring(0, Math.min(value.length, length)) + " ..." : value;

                    ko.bindingHandlers.text.update(element, function () {
                        return truncatedValue;
                    });
                },
                defaultLength: 15
            };

            ko.bindingHandlers.numericValue = {
                init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                    var underlyingObservable = valueAccessor();
                    var interceptor = ko.computed({
                        read: underlyingObservable,
                        write: function (value) {
                            if (!isNaN(value)) {
                                underlyingObservable(parseFloat(value));
                            }
                        },
                        disposeWhenNodeIsRemoved: element
                    });
                    ko.bindingHandlers.value.init(element, function () {
                        return interceptor;
                    }, allBindingsAccessor, viewModel, bindingContext);
                },
                update: ko.bindingHandlers.value.update
            };

            ko.bindingHandlers.customValidity = {
                update: function (element, valueAccessor) {
                    var errorMessage = ko.unwrap(valueAccessor()); // unwrap to get subscription
                    element.setCustomValidity(errorMessage);
                }
            };


            //
            // template engine
            //
            ko.bindingHandlers.alwaysRerenderForEach = {
                init: function (element, valueAccessor) {
                    return ko.bindingHandlers.template.init(element, valueAccessor);
                },
                update: function (element, valueAccessor, allBindings, viewModel, context) {
                    var value = valueAccessor();
                    value.foreach();
                    var options = ko.unwrap(value);
                    // valueAccessor().foreach();
                    ko.utils.domData.clear(element);
                    $(element).empty();
                    return ko.renderTemplateForEach(value.name, value.foreach, options, element, context);
                }
            };

            //
            // binding handlers
            //


            ko.bindingHandlers.collapseVisible = {
                // init: function (element, valueAccessor) {
                //    var value = valueAccessor();
                //    var v = ko.unwrap(value);
                //    $(element).collapse('toggle');

                //    if (typeof v == "undefined")
                //        return;

                //    $(element).collapse(ko.unwrap(value) ? 'show' : 'hide');
                // },
                update: function (element, valueAccessor) {
                    var value = valueAccessor();
                    var v = ko.unwrap(value);

                    var el = $(element);
                    if (el.hasClass("collapse") === false) {
                        el.addClass("collapse").collapse({
                            toggle: false
                        });
                    }
                    if (typeof v == "undefined")
                        return;

                    if (v) {
                        el.collapse("show").addClass("in");


                    } else {
                        el.collapse("hide");
                    }

                }
            };


            ko.bindingHandlers.fadeVisible = {
                init: function (element, valueAccessor) {
                    // Initially set the element to be instantly visible/hidden depending on the value
                    var value = valueAccessor();
                    $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
                },
                update: function (element, valueAccessor) {
                    // Whenever the value subsequently changes, slowly fade the element in or out
                    var value = valueAccessor();
                    ko.unwrap(value) ? $(element).fadeIn() : $(element).fadeOut();
                }
            };



            // stop binding for context (data-bind="stopBindings:true")
            ko.bindingHandlers.stopBindings = {
                init: function () {
                    return {
                        controlsDescendantBindings: true
                    };
                }
            };

            ko.bindingHandlers.initializeValue = {
                init: function (element, valueAccessor) {
                    valueAccessor()(element.getAttribute("value"));
                },
                update: function (element, valueAccessor) {
                    var value = valueAccessor();
                    element.setAttribute("value", ko.utils.unwrapObservable(value));
                }
            };

            ko.bindingHandlers.initializeChecked = {
                init: function (element, valueAccessor) {
                    valueAccessor()(element.getAttribute("checked"));
                },
                update: function (element, valueAccessor) {
                    var value = valueAccessor();
                    element.setAttribute("checked", ko.utils.unwrapObservable(value));
                }
            };



            ko.bindingHandlers.dataToggleClick ={
                init:function(element,valueAccessor,allBindings){
                    var options = valueAccessor();
                    options = $.extend(true, {}, {
                        preventDefault:true
                    }, options);

                    var value = options.value;
                    var target = options.target;

                    ko.utils.registerEventHandler(element, "click", function (ev) {
                        if (ko.unwrap(target) instanceof Array) {
                            var index = ko.unwrap(target).indexOf(value);

                            if (index === -1) {
                                target.push(value);
                            } else if (index !== -1) {
                                target.splice(index, 1);
                            }
                        } else {
                            var v = ko.unwrap(target);
                            if(typeof v  ==="undefined"){
                                target(!target()); // basic toggle, true->false | false->true
                            }else{
                                if(typeof v  ==="undefined" || v === null){
                                    target(null);
                                }else{
                                    target(value);
                                }
                            }
                        }

                        if(options.preventDefault){
                            ev.preventDefault();
                        }
                    });

                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {

                    });
                }
            }

            ko.bindingHandlers.toggleClick = {
                init: function (element, valueAccessor, allBindings) {
                    var value = valueAccessor();
                    var options = {
                        stop: true
                    };
                    $.extend(options, allBindings.get("toggleClickOptions"));

                    ko.utils.registerEventHandler(element, "click", function (ev) {
                        value(!value());
                        if (options) {
                            ev.preventDefault();
                        }
                    });
                }
            };


            ko.bindingHandlers.toggleAttr = {
                update: function (element, valueAccessor) {
                    var options = ko.utils.unwrapObservable(valueAccessor());
                    var attr = ko.utils.unwrapObservable(options.attr);
                    var param = ko.utils.unwrapObservable(options.param);

                    param ? element.setAttribute(attr, param) : element.removeAttribute(attr);
                }
            };

            ko.bindingHandlers.slider = {
                init: function (element, valueAccessor, allBindingsAccessor) {
                    ko.utils.registerEventHandler(element, "slide", function (event, ui) {
                        var observable = valueAccessor();
                        observable(event.value);
                    });
                },
                update: function (element, valueAccessor) {
                    var value = ko.utils.unwrapObservable(valueAccessor());
                    if (isNaN(value)) value = 0;
                    $(element).slider("setValue", value);
                }
            };


            // bolean binding (data-bind="booleanValue: state")
            ko.bindingHandlers.booleanValue = {
                init: function (element, valueAccessor, allBindingsAccessor) {
                    var observable = valueAccessor(),
                        interceptor = ko.computed({
                            read: function () {
                                return observable().toString();
                            },
                            write: function (newValue) {
                                observable(newValue === "true");
                            }
                        });

                    ko.applyBindingsToNode(element, {
                        value: interceptor
                    });
                }
            };

            // <div data-bind="safeText: { value: selectedItem, property: 'name', default: 'unknown' }"></div>
            ko.bindingHandlers.safeText = {
                update: function (element, valueAccessor, allBindingsAccessor) {
                    var options = ko.utils.unwrapObservable(valueAccessor()),
                        value = ko.utils.unwrapObservable(options.value),
                        property = ko.utils.unwrapObservable(options.property),
                        fallback = ko.utils.unwrapObservable(options["default"]) || "",
                        text;

                    text = value ? (options.property ? value[property] : value) : fallback;

                    ko.bindingHandlers.text.update(element, function () {
                        return text;
                    });
                }
            };

            // create template with dynamic context
            ko.bindingHandlers.templateWithContext = {
                init: function (element, valueAccessor, allBindingsAccessor, viewModel, context) {
                    return ko.bindingHandlers.template.init.apply(this, arguments);
                },
                update: function (element, valueAccessor, allBindingsAccessor, viewModel, context) {
                    var options = ko.utils.unwrapObservable(valueAccessor());

                    if (options.context) {
                        options.context.data = options.data;
                        options.data = options.context;
                        delete options.context;
                    }

                    ko.bindingHandlers.template.update.apply(this, arguments);
                }
            };




            // extra library depended binding handlers
            ko.bindingHandlers.chosen = {
                init: function (element, valueAccessor, allBindingsAccessor) {
                    var options = valueAccessor();

                    $(element).chosen({
                        no_results_text: options.no_results_text
                    });
                    $(element).trigger("liszt:updated");
                },
                update: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                    var options = valueAccessor();

                    $(element).chosen({
                        no_results_text: options.no_results_text
                    });
                    $(element).trigger("liszt:updated");
                }
            };


            ko.bindingHandlers.datepicker = {
                init: function (element, valueAccessor, allBindingsAccessor) {
                    // initialize datepicker with some optional options
                    var options = allBindingsAccessor().datepickerOptions || {};
                    var el = $(element);
                    if (options.type && options.type === "component") {
                        // el = el.parent();
                        delete options.type;
                    }
                    options.format = config.dateFormat.toLowerCase();
                    el.datepicker(options).on("clearDate", function (e) {
                        var value = valueAccessor();
                        if (ko.isObservable(value)) {
                            value(undefined);
                        }
                    }).on("changeDate", function (e) {
                        var value = valueAccessor();
                        if (ko.isObservable(value)) {
                            value(e.date);
                        }
                    }).on("click", function (e) {
                        if (options.stopPropagation) {
                            e.stopPropagation();
                        }

                    });


                },
                update: function (element, valueAccessor) {


                    var selectedDate = ko.utils.unwrapObservable(valueAccessor());
                    if (!selectedDate) {
                        $(element).datepicker("clearDates");
                        return;
                    }

                    $(element).datepicker("setDate", moment(selectedDate).toDate());
                }
            };

            ko.bindingHandlers.datepicker2 = {
                // http://bootstrap-datepicker.readthedocs.org/en/stable/methods.html
                init: function (element, valueAccessor, allBindingsAccessor) {
                    // initialize datepicker with some optional options
                    var options = allBindingsAccessor().datepickerOptions || {};
                    var el = $(element);
                    if (options.type && options.type === "component") {
                        el = el.parent();
                        delete options.type;
                    }
                    el.datepicker(options);

                    // when a user changes the date, update the view model
                    ko.utils.registerEventHandler(element, "changeDate", function (event) {
                        var value = valueAccessor();
                        if (ko.isObservable(value)) {
                            value(event.date);
                        }
                    });
                },
                update: function (element, valueAccessor) {

                    // var widget = $(element).data("datepicker");

                    $(element).datepicker("setDate", moment(ko.utils.unwrapObservable(valueAccessor())).toDate());

                }
            };

         

            ko.bindingHandlers.i18n = {
                update: function (element, valueAccessor, allBindings) {
                    var key = ko.unwrap(valueAccessor()),
                        options = ko.toJS(allBindings.get("i18n-options") || {}),
                        translation,
                        parts,
                        attr;

                        // Check whether we are dealing with attributes
                    if (key.indexOf("[") === 0) {
                        parts = key.split("]");
                        key = parts[1];
                        attr = parts[0].substr(1, parts[0].length - 1);
                    }

                    translation = i18n.t(key, options);

                    if (attr === undefined) {
                        // Check whether the translation contains markup
                        if (translation.match(/<(\w+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/)) {
                            // noinspection InnerHTMLJS
                            element.innerHTML = translation;
                        } else {
                            // Check whether the translation contains HTML entities
                            if (translation.match(/&(?:[a-z]+|#x?\d+);/gi)) {
                                // noinspection InnerHTMLJS
                                element.innerHTML = translation;
                            } else {
                                // Treat translation as plain text
                                element.innerText = translation;
                            }
                        }
                    } else {
                        // Add translation to given attribute
                        element.setAttribute(attr, translation);
                    }
                }
            };

            

            ko.bindingHandlers.typeahead = {
                update: function (element, valueAccessor, allBindingsAccessor, data, bindingContext) {
                    var allBindings = allBindingsAccessor();
                    var options = ko.unwrap(valueAccessor()) || {},
                        $el = $(element),
                        normalChange = function (p1, p2, p3) {
                            var p1Val = $(p1.target).val();
                            if (!p1Val) {
                                if (allBindings["data-id"])
                                    allBindings["data-id"](null);

                            }
                        },
                        triggerChange = function (event, suggestion, dataset) {

                            $el.change();

                            if (allBindings["data-id"])
                                allBindings["data-id"](suggestion.id);


                            var c = bindingContext;
                            if (allBindings.itemSelected) {
                                allBindings.itemSelected(data, suggestion, event, dataset);
                            }

                            if (allBindings.typeaheadSelected) {
                                var t = allBindings.typeaheadSelected(event, suggestion);
                                if (t) {
                                    $el.typeahead("val", "");
                                }
                            }


                        };
                    $el.typeahead("destroy");

                    $el.typeahead(options.options, options.datasets)
                        .on("typeahead:selected", triggerChange)
                        .on("typeahead:autocompleted", triggerChange)
                        .on("change", normalChange);

                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                        $el.typeahead("destroy");
                        $el = null;
                    });
                },
                init: function (element, valueAccessor, allBindingsAccessor, data, bindingContext) {


                }
            };


           

            // https://github.com/faulknercs/Knockstrap/blob/master/src/utils/unwrapProperties.js
            ko.utils.unwrapProperties = function (wrappedProperies) {

                if (wrappedProperies === null || typeof wrappedProperies !== "object") {
                    return wrappedProperies;
                }

                var options = {};

                ko.utils.objectForEach(wrappedProperies, function (propertyName, propertyValue) {
                    options[propertyName] = ko.unwrap(propertyValue);
                });

                return options;
            };


            // https://github.com/faulknercs/Knockstrap/blob/master/src/utils/uniqueId.js
            ko.utils.uniqueId = (function () {

                var prefixesCounts = {
                    "ks-unique-": 0
                };

                return function (prefix) {
                    prefix = prefix || "ks-unique-";

                    if (!prefixesCounts[prefix]) {
                        prefixesCounts[prefix] = 0;
                    }

                    return prefix + prefixesCounts[prefix]++;
                };
            })();

            // https://github.com/faulknercs/Knockstrap/blob/master/src/bindings/tooltipBinding.js
            ko.bindingHandlers.tooltip = {
                init: function (element) {
                    var $element = $(element);

                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                        if ($element.data("bs.tooltip")) {
                            $element.tooltip("destroy");
                        }
                    });
                },

                update: function (element, valueAccessor) {
                    var $element = $(element),
                        value = ko.unwrap(valueAccessor()),
                        options = ko.toJS(value);

                    if (typeof options === "string") {
                        options = {
                            title: options
                        };
                    }

                    /* var parent = $element.parent();
                         if(parent.hasClass('btn-group') || parent.hasClass('input-group')){
                         options.container='body';
                         }*/
                    options.container = "body";

                    var tooltipData = $element.data("bs.tooltip");

                    if (!tooltipData) {
                        $element.tooltip(options);
                    } else {
                        ko.utils.extend(tooltipData.options, options);
                    }
                }
            };


            // https://github.com/faulknercs/Knockstrap/blob/master/src/bindings/toggleBinding.js
            ko.bindingHandlers.toggle = {
                init: function (element, valueAccessor) {
                    var value = valueAccessor();

                    if (!ko.isObservable(value)) {
                        throw new Error("toggle binding should be used only with observable values");
                    }

                    $(element).on("click", function () {
                        var previousValue = ko.unwrap(value);
                        value(!previousValue);
                    });
                },

                update: function (element, valueAccessor) {
                    ko.utils.toggleDomNodeCssClass(element, "active", ko.unwrap(valueAccessor()));
                }
            };

            // https://github.com/faulknercs/Knockstrap/blob/master/src/bindings/checkboxBinding.js
            ko.bindingHandlers.checkbox = {
                init: function (element, valueAccessor) {
                    var $element = $(element),
                        handler = function (e) {
                            // we need to handle change event after bootsrap will handle its event
                            // to prevent incorrect changing of checkbox state
                            setTimeout(function() {
                                var $checkbox = $(e.target),
                                    value = valueAccessor(),
                                    data = $checkbox.val(),
                                    isChecked = $checkbox.parent().hasClass("active");

                                if(!$checkbox.prop("disbled")) {
                                    if (ko.unwrap(value) instanceof Array) {
                                        var index = ko.utils.arrayIndexOf(ko.unwrap(value), (data));

                                        if (isChecked && (index === -1)) {
                                            value.push(data);
                                        } else if (!isChecked && (index !== -1)) {
                                            value.splice(index, 1);
                                        }
                                    } else {
                                        value(isChecked);
                                    }
                                }
                            }, 0);
                        };

                    if ($element.attr("data-toggle") === "buttons" && $element.find("input:checkbox").length) {

                        if (!(ko.unwrap(valueAccessor()) instanceof Array)) {
                            throw new Error("checkbox binding should be used only with array or observableArray values in this case");
                        }

                        $element.on("change", "input:checkbox", handler);
                    } else if ($element.attr("type") === "checkbox") {

                        if (!ko.isObservable(valueAccessor())) {
                            throw new Error("checkbox binding should be used only with observable values in this case");
                        }

                        $element.on("change", handler);
                    } else {
                        throw new Error("checkbox binding should be used only with bootstrap checkboxes");
                    }
                },

                update: function (element, valueAccessor) {
                    var $element = $(element),
                        value = ko.unwrap(valueAccessor()),
                        isChecked;

                    if (value instanceof Array) {
                        if ($element.attr("data-toggle") === "buttons") {
                            $element.find("input:checkbox").each(function (index, el) {
                                isChecked = ko.utils.arrayIndexOf(value, el.value) !== -1;
                                $(el).parent().toggleClass("active", isChecked);
                                el.checked = isChecked;
                            });
                        } else {
                            isChecked = ko.utils.arrayIndexOf(value, $element.val()) !== -1;
                            $element.toggleClass("active", isChecked);
                            $element.find("input").prop("checked", isChecked);
                        }
                    } else {
                        isChecked = !!value;
                        $element.prop("checked", isChecked);
                        $element.parent().toggleClass("active", isChecked);
                    }
                }
            };





            // https://github.com/faulknercs/Knockstrap/blob/master/src/bindings/radioBinding.js
            ko.bindingHandlers.radio = {
                init: function (element, valueAccessor) {

                    if (!ko.isObservable(valueAccessor())) {
                        throw new Error("radio binding should be used only with observable values");
                    }

                    $(element).on("change", "input:radio", function (e) {
                        // we need to handle change event after bootsrap will handle its event
                        // to prevent incorrect changing of radio button styles
                        setTimeout(function() {
                            var radio = $(e.target),
                                value = valueAccessor(),
                                newValue = radio.val();

                                // we shouldn't change value for disables buttons
                            if (!radio.prop("disabled")) {
                                value(newValue);
                            }
                        }, 0);
                    });
                },

                update: function (element, valueAccessor) {
                    var value = ko.unwrap(valueAccessor()) || "",
                        $radioButton = $(element).find('input[value="' + value.replace(/"/g, '\\"') + '"]'),
                        $radioButtonWrapper;

                    if ($radioButton.length) {
                        $radioButtonWrapper = $radioButton.parent();

                        $radioButtonWrapper.siblings().removeClass("active");
                        $radioButtonWrapper.addClass("active");

                        $radioButton.prop("checked", true);
                    } else {
                        $radioButtonWrapper = $(element).find(".active");
                        $radioButtonWrapper.removeClass("active");
                        $radioButtonWrapper.find("input").prop("checked", false);
                    }
                }
            };

            // https://raw.githubusercontent.com/faulknercs/Knockstrap/master/src/bindings/popoverBinding.js
            var popoverDomDataTemplateKey = "__popoverTemplateKey__";
            ko.bindingHandlers.popover = {

                init: function (element) {
                    var $element = $(element);

                    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                        if ($element.data("bs.popover")) {
                            $element.popover("destroy");
                        }
                    });
                },

                update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                    var $element = $(element),
                        value = ko.unwrap(valueAccessor()),
                        options = (!value.options && !value.template ? ko.utils.unwrapProperties(value) : ko.utils.unwrapProperties(value.options)) || {};

                    if (value.template) {
                        // use unwrap to track dependency from template, if it is observable
                        ko.unwrap(value.template);


                        var id = ko.utils.domData.get(element, popoverDomDataTemplateKey),
                            data = ko.unwrap(value.data);

                        var renderPopoverTemplate = function (eventObject) {


                            if (eventObject && eventObject.type === "inserted") {
                                $element.off("shown.bs.popover");
                            }
                            // use unwrap again to get correct template value instead of old value from closure
                            // this works for observable template property
                            ko.renderTemplate(ko.unwrap(value.template), bindingContext.createChildContext(data), value.templateOptions, document.getElementById(id));

                            // bootstrap's popover calculates position before template renders,
                            // so we recalculate position, using bootstrap methods
                            var $popover = $("#" + id).parents(".popover"),
                                popoverMethods = $element.data("bs.popover"),
                                offset = popoverMethods.getCalculatedOffset(options.placement || "right", popoverMethods.getPosition(), $popover.outerWidth(), $popover.outerHeight());

                            $popover.addClass(value.customClass);
                            if (!$popover.find(".popover-title .close").length) {
                                $popover.find(".popover-title").append('<button class="close pull-right" type="button" data-action="close">×</button>');
                            }


                            popoverMethods.applyPlacement(offset, options.placement || "right");
                        };

                            // if there is no generated id - popover executes first time for this element
                        if (!id) {
                            id = ko.utils.uniqueId("ks-popover-");
                            ko.utils.domData.set(element, popoverDomDataTemplateKey, id);

                            // place template rendering after popover is shown, because we don't have root element for template before that
                            $element.on("shown.bs.popover inserted.bs.popover", renderPopoverTemplate);
                        }

                        options.content = '<div id="' + id + '"  class="ks-popover"></div>';
                        options.html = true;
                        // options.trigger="manuel";

                        // support rerendering of template, if observable changes, when popover is opened
                        if ($("#" + id).is(":visible")) {
                            renderPopoverTemplate();
                        }
                    }

                    if (value.popoverToggle) {
                        if (ko.unwrap(value.popoverToggle) === false) {
                            // $element.popover('hide');
                            $element.click();
                        }
                    }

                    var popoverData = $element.data("bs.popover");

                    if (!popoverData) {
                        $element.popover(options);

                        $element.on("shown.bs.popover inserted.bs.popover", function () {
                            // todo: when I enable this, template binding runs two-times
                            // if (value.popoverToggle) {
                            //     value.popoverToggle(true);
                            // }

                            // todo: change event handler initialization
                            (options.container ? $(options.container) : $element.parent()).one("click", '[data-action="close"]', function () {
                                element.click();
                                $element.popover("hide");
                            });
                        });


                    } else {
                        ko.utils.extend(popoverData.options, options);
                    }
                }
            };

        };


        return extensions;
    })();
    return extensions;
});
