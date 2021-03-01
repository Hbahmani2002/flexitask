define(["require", "exports", "durandal/composition", "knockout", "jquery", "datetimepicker", "moment", "common/prefs"],
    function (require, exports, composition, ko, $, datetimepicker, moment, prefs) {

        function DatetimePickerBindingHandler() {
            this.defaults = {
                icons: {
                    time: "icon fa-clock-o",
                    date: "icon fa-calendar",
                    up: "icon fa-chevron-up",
                    down: "icon fa-chevron-down",
                    previous: "icon fa-chevron-left",
                    next: "icon fa-chevron-right",
                    today: "icon fa-crosshairs",
                    clear: "icon fa-trash",
                    close: "icon fa-times"
                },
                widgetPositioning:{
                    horizontal:"left",
                    vertical:"bottom"
                },
                format: prefs.dateTimeFormat(),
                showTodayButton: true,
                showClear: true,
                defaultDate: false,
                useCurrent: false

            };

        }

        DatetimePickerBindingHandler.install = function () {
            if (!ko.bindingHandlers.dateTimepicker) {
                ko.bindingHandlers.dateTimepicker = new DatetimePickerBindingHandler();

                composition.addBindingHandler("dateTimepicker");
            }
        };


        DatetimePickerBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var self = this;
            // initialize datepicker with some optional options
            var options = allBindings().dateTimePickerOptions || {};
            var defaults = self.defaults;
            defaults.format = prefs.dateTimeFormat();

            options = $.extend(true, {}, self.defaults, options);

            $(element).datetimepicker(options);

            // when a user changes the date, update the view model
            ko.utils.registerEventHandler(element, "dp.change", function (event) {
                var value = valueAccessor();
                if (ko.isObservable(value)) {
                    if (event.date === false) {
                        value(null);
                        return;
                    }
                    if (event.date != null && !(event.date instanceof Date)) {
                        value(event.date.toDate());
                    } else {
                        value(event.date);
                    }
                }
            });

            ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                var picker = $(element).data("DateTimePicker");
                if (picker) {
                    picker.destroy();
                }
            });
        };


        DatetimePickerBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            var picker = $(element).data("DateTimePicker");
            // when the view model is updated, update the widget
            if (picker) {
                var koDate = ko.utils.unwrapObservable(valueAccessor());

                // in case return from server datetime i am get in this form for example /Date(93989393)/ then fomat this
                // koDate = (typeof (koDate) !== 'object') ? new Date(parseFloat(koDate.replace(/[^0-9]/g, ''))) : koDate;

                picker.date(moment(koDate));
            }

        };

        return DatetimePickerBindingHandler;
    });
