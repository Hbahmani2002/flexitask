define(["jquery", "common/lang", "JSZip", "kendo", "knockout"],function ($, lang, JSZip, kendo, ko) {

    function KendoGridBindingHandler() {}

    KendoGridBindingHandler.install = function () {
        if (!ko.bindingHandlers.kendoGrid) {
            window.JSZip = JSZip;
            ko.bindingHandlers.kendoGrid = new KendoGridBindingHandler();
        }
    };

    KendoGridBindingHandler.prototype.init = function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var unwrap = ko.utils.unwrapObservable;
        var dataSource = valueAccessor();
        var binding = allBindingsAccessor();
        var options = {};


        if (binding.gridOptions) {
            options = $.extend(options, binding.gridOptions);
        }

        // var handleValueChange = function (arg) {
        // 	var selectedItems = this.select();
        // 	var selected = $.map(selectedItems, function (column) {
        // 		return $(column).text();
        // 	});

        // 	if (options.selected)
        // 		options.selected(arg);
        // };

        // var dataChange = function (e) {
        // 	var keyProp = binding.key;

        //			//Use this keyProp to find the model obj edited in the observable Array
        //			// and edit each of its properties manually from the kendo DataSource

        //		};

        //		options.change = handleValueChange;
        if (options.dataBound)
        {
            options.dataBound = options.dataBound;
        }

        var source=null;
        if (unwrap(dataSource) instanceof Array) {
            if (!ko.isObservable(dataSource)) {
                source = ko.observableArray(dataSource);
            }
            else
            {
                source = dataSource;
            }

            var mappedSource = ko.dependentObservable(function () {
                var mapped = ko.utils.arrayMap(unwrap(dataSource), function (item) {
                    var result = {};
                    for (var prop in item) {
                        if (item.hasOwnProperty(prop)) {
                            result[prop] = unwrap(item[prop]);
                        }
                    }
                    return result;
                });
                return mapped;
            }, viewModel);

            // Subscribe to the knockout observable array to get new/remove items
            mappedSource.subscribe(function (newValues) {
                var grid = $(element).data("kendoGrid");
                grid.dataSource.data(newValues);
                grid.refresh();
            });
        }
        else
        {
            throw "The dataSource defined must be a javascript object array or knockout observable array!";
        }

        options.dataSource = $.extend(options.dataSource, {
            data: mappedSource()
        });

        $(element).kendoGrid(options);
    };

    KendoGridBindingHandler.install();

    //KendoGridBindingHandler.instance = kendo;

    return kendo;
});
