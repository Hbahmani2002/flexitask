﻿(function (factory) {
    if (typeof define === "function" && define.amd) {
        // AMD anonymous module
        define(["knockout", "jquery", "exports"], factory);
    } else {
        // No module loader (plain <script> tag) - put directly in global namespace
        factory(window.ko, window.jQuery, ko.editable = {});
    }
})(function (ko, $, exports) {
    // create our namespace object
    ko.editable = exports;

    var configuration = configuration || {};

    ko.bindingHandlers.editable = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var $element = $(element),
                value = valueAccessor(),
                allBindings = allBindingsAccessor(),
                editableOptions = allBindings.editableOptions || {};
            // init default configuration and override it
            //var editableOptions = configuration;
            //for (var property in allBindings.editableOptions) {
            //    editableOptions[property] = allBindings.editableOptions[property];
            //}


            editableOptions.value = ko.utils.unwrapObservable(value);

            if (!editableOptions.name) {
                $.each(bindingContext.$data, function (k, v) {
                    if (v == value) {
                        editableOptions.name = k;
                        return false;
                    }
                });
            }

            //wrap calls to knockout.validation
            if (!editableOptions.validate && value.isValid) {
                editableOptions.validate = function(testValue) {
                    //have to set to new value, then call validate, then reset to original value
                    //not pretty, but works
                    var initalValue = value();
                    value(testValue);
                    var res = value.isValid() ? null : ko.utils.unwrapObservable(value.error);
                    value(initalValue);
                    return res;
                };
            }

            if ((editableOptions.type === 'select' || editableOptions.type === 'checklist' || editableOptions.type === 'typeahead') && !editableOptions.source && editableOptions.options) {
                if (editableOptions.optionsCaption)
                    editableOptions.prepend = editableOptions.optionsCaption;

                //taken directly from ko.bindingHandlers['options']
                function applyToObject(object, predicate, defaultValue) {
                    var predicateType = typeof predicate;
                    if (predicateType == "function")    // Given a function; run it against the data value
                        return predicate(object);
                    else if (predicateType == "string") // Given a string; treat it as a property name on the data value
                        return object[predicate];
                    else                                // Given no optionsText arg; use the data value itself
                        return defaultValue;
                }

                editableOptions.source = function() {
                    var options;
                    if (editableOptions.options && editableOptions.options.length)
                        options = editableOptions.options;
                    else {
                        options = editableOptions.options();
                    }

                    return ko.utils.arrayMap(options, function(item) {
                        var optionValue = editableOptions.optionsValue ? applyToObject(item, editableOptions.optionsValue, item) : item;
                        var optionText = editableOptions.optionsText ? applyToObject(item, editableOptions.optionsText, optionText) : item;

                        return {
                            value: ko.utils.unwrapObservable(optionValue),
                            text: ko.utils.unwrapObservable(optionText)
                        };
                    });
                };
            }

            if (editableOptions.visible && ko.isObservable(editableOptions.visible)) {
                editableOptions.toggle = 'manual';
            }

            //create editable
            var $editable = $element.editable(editableOptions);

            //update observable on save
            if (ko.isObservable(value)) {
                $editable.on('save.ko', function(e, params) {
                    value(params.newValue);
                });
            };

            if (editableOptions.save) {
                $editable.on('save', editableOptions.save);
            }

            //setup observable to fire only when editable changes, not when options change
            //http://www.knockmeout.net/2012/06/knockoutjs-performance-gotcha-3-all-bindings.html
            ko.computed({
                read: function () {
                    var val = ko.utils.unwrapObservable(valueAccessor());
                    if (val === null) val = '';
                    $editable.editable('setValue', val, true);
                },
                owner: this,
                disposeWhenNodeIsRemoved: element
            });

            if (editableOptions.visible && ko.isObservable(editableOptions.visible)) {
                ko.computed({
                    read: function () {
                        var val = ko.utils.unwrapObservable(editableOptions.visible());
                        if (val)
                            $editable.editable('show');
                    },
                    owner: this,
                    disposeWhenNodeIsRemoved: element
                });

                $editable.on('hidden.ko', function (e, params) {
                    editableOptions.visible(false);
                });
            }
        }
    };

    var api = (function () {
        return {
            configure: function (options) { configuration = options; }
        };
    }());

    ko.utils.extend(ko.editable, api);
});