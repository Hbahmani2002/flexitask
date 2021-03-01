define(["require", "exports", "durandal/composition", "knockout", "jquery", "config", "common/utils", "select2"],
    function (require, exports, composition, ko, $, config, utils) {


        function Select2BindingHandler() {}

        function triggerChangeQuietly(element, binding) {
            var isObservable = ko.isObservable(binding);
            var originalEqualityComparer;
            if (isObservable) {
                originalEqualityComparer = binding.equalityComparer;
                binding.equalityComparer = function () {
                    return true;
                };
            }
            $(element).trigger("change");
            if (isObservable) {
                binding.equalityComparer = originalEqualityComparer;
            }
        }

        Select2BindingHandler.install = function () {
            if (!ko.bindingHandlers.select2) {
                ko.bindingHandlers.select2 = new Select2BindingHandler();

                composition.addBindingHandler("select2");
            }
        };

        Select2BindingHandler.prototype.init = function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var options = ko.unwrap(valueAccessor());
            var allBindings = allBindingsAccessor();
            var ignoreChange = false;
            var dataChangeHandler = null;
            var subscription = null;

           
            


            $(element).on("select2:selecting select2:unselecting", function () {
                ignoreChange = true;
            });
            $(element).on("select2:select select2:unselect", function () {
                ignoreChange = false;
            });

            if (ko.isObservable(allBindings.value)) {
                subscription = allBindings.value.subscribe(function (value) {
                    if (ignoreChange) return;
                    triggerChangeQuietly(element, this._target || this.target);
                });
            } else if (ko.isObservable(allBindings.selectedOptions)) {
                subscription = allBindings.selectedOptions.subscribe(function (value) {
                    if (ignoreChange) return;
                    triggerChangeQuietly(element, this._target || this.target);
                });
            }


            // Provide a hook for binding to the select2 "data" property; this property is read-only in select2 so not subscribing.
            if (ko.isWriteableObservable(allBindings.select2Data)) {
                dataChangeHandler = function () {
                    if (!$(element).data("select2")) return;
                    var v = $(element).val();

                    if (allBindings.select2Data.isArray) {
                        allBindings.select2Data(v || []);
                    } else {
                        allBindings.select2Data(v);
                    }
                };
                $(element).on("change", dataChangeHandler);
            }


            // Apply select2 and initialize data; delay to allow other binding handlers to run
            setTimeout(function () {

                // Apply select2
                var $el = $(element);
                $(element).select2(options);
                if (allBindings.select2Data) {

                    var selectedValues = ko.unwrap(allBindings.select2Data);
                    if (_.isArray(selectedValues) === false) {
                        selectedValues = [selectedValues];
                    }
                    if (selectedValues.length > 0 && typeof selectedValues[0] !== "undefined") {
                        if (options.onInit) {
                            var loadingOption = $("<option selected>Loading...</option>").val(null);
                            $el.append(loadingOption).trigger("change");
                            options.onInit(selectedValues)
                                .then(function (response) {

                                    if (_.isArray(response) === false) {
                                        response = [response];
                                    }

                                    if (response.length > 0) {
                                        loadingOption.removeData();
                                        loadingOption.remove();
                                    }

                                    response.forEach(function (item) {
                                        var opt = $("<option selected>" + item.text + "</option>").val(item.id);
                                        $el.append(opt);
                                    });
                                    $el.trigger("change"); // notify
                                });
                        } else {

                            selectedValues.forEach(function (v) {
                                var opt = $("<option selected>" + v + "</option>").val(v);
                                $el.append(opt);
                            });
                            $el.trigger("change");
                        }
                    }
                }

                if (options.containerClass) {
                    $(element).data("select2").$container.addClass(options.containerClass);
                }
                if (options.dropdownClass) {
                    $(element).data("select2").$dropdown.addClass(options.dropdownClass);
                }

                var bc = bindingContext.$data;
                $(element).on("change", function (ev) {
                    if (allBindings.select2Selected) {
                        var selected = $(element).find(":selected").data("selected");
                        allBindings.select2Selected.call(bc,selected);
                    }
                });

                // Destroy select2 on element disposal
                ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                    $(element).select2("destroy");
                    if (dataChangeHandler !== null) {
                        $(element).off("change", dataChangeHandler);
                    }
                    if (subscription !== null) {
                        subscription.dispose();
                    }
                });
            }, 0);
        };


        Select2BindingHandler.prototype.update = function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var options = ko.unwrap(valueAccessor());
            var allBindings = allBindingsAccessor();

            $(element).val(allBindings.select2Data()).trigger("change.select2");
        };

        return Select2BindingHandler;
    });
