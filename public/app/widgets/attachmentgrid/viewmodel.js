define(["common/kendolib", "common/autocomplete", "common/utils", "common/helpers", "common/lookups", "common/context", "amplify", "durandal/composition", "plugins/dialog", "i18n", "durandal/events", "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (kendo, autocomplete, utils, helpers, lookupFactory, context, amplify, composition, dialog, i18n, events, errorhandler, system, http, router, app, activator, ko, $, _) {


        function ColumnModelBuilder() {
            this.columns = {};
            this.add = function (name, title, options) {
                options = _.extend({
                    type: "string",
                    field: name,
                    title: title,
                    hidden: false
                }, options);

                if (options.type === "date") {
                    options.format = "{0: yyyy-MM-dd }";
                }

                this.columns[name] = options;
                return this;
            };

            this.getColumns = function (columnNames) {
                var _this = this;
                if (!columnNames || columnNames.length === 0) {
                    return _this.columns;
                }

                return _.pick(_this.columns, columnNames);
            };
        }

        /* createdAt: "2015-05-21T19:30:17Z"
         description: null
         id: "baf99fe51e2a47d5860ca49f01416e8e"
         isDeleted: false
         name: "1432236604760924919389"
         projectId: "a6e20b4fa5d248c68e9da495000934a6"
         projectName: "DM Channels"
         tags: []
         taskId: "81830e7f25bd487aa4e2a496004da2ea"
         taskName: "Detroit & Chicago"*/

        var ctor = function () {
            var _this = this;
            this.grid = null;

            this.columnModelBuilder = new ColumnModelBuilder()
                .add("name", i18n.t("app:widgets.attachmentGridWidget.columnNames.name"))
                .add("projectName", i18n.t("app:widgets.attachmentGridWidget.columnNames.projectName"))
                .add("taskName", i18n.t("app:widgets.attachmentGridWidget.columnNames.taskName"))
                .add("authorId", i18n.t("app:widgets.attachmentGridWidget.columnNames.authorId"), {
                    transform: function (attachment) {
                        if (!attachment.authorId) {
                            return null;
                        }
                        var user = context.getUserById(attachment.authorId);
                        if (!user) {
                            return null;
                        }
                        return user.fullName;
                    }
                })
                .add("createdAt", i18n.t("app:widgets.attachmentGridWidget.columnNames.createdAt"), {
                    transform: function (attachment) {
                        return utils.formatDateTime(attachment.createdAt);
                    }
                });


            this.gridRowTransformer = function (row, columns) {
                var x = _.mapObject(row, function (val, key) {
                    if (columns[key]) {
                        if (!columns[key].transform) {
                            return row[key];
                        }
                        return columns[key].transform(row);
                    }
                    return val;
                });
                return x;
            };

        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            var defaults = {};
            this.settings = _.extend(defaults, settings);

            var columns = _this.columnModelBuilder.getColumns(_this.settings.columns);
            if (_this.settings.excludeColumns) {
                columns = _.omit(columns, _this.settings.excludeColumns);

            }
            this.data = ko.computed(function () {

                return _.chain(ko.toJS(_this.settings.results))
                        .map(function (r) {
                            return _this.gridRowTransformer(r, columns);
                        })
                        .value();

            }, _this);
            this.gridOptions = {

                dataSource: {
                    model: {
                        fields: columns
                    }
                },
                columns: _.toArray(columns),
                filterable: true,
                sortable: true,
                groupable: {
                    showFooter: true
                },
                reorderable: true,
                resizable: true,
                columnMenu: true,
                pageable: {
                    input: true,
                    numeric: false,
                    pageSize: 20

                },
                toolbar: ["excel"],
                excel: {
                    allPages: true,
                    filterable: false
                },
                selectable: "row",
                change: function (e) {
                    var selectedRows = this.select();
                    var selectedDataItems = [];
                    for (var i = 0; i < selectedRows.length; i++) {
                        var dataItem = this.dataItem(selectedRows[i]);
                        selectedDataItems.push(dataItem);
                    }
                    if (selectedDataItems.length === 0) {
                        return;
                    }
                    var fist = selectedDataItems[0];
                    ko.postbox.publish("TaskSelected", {
                        taskId: ko.unwrap(fist.taskId),
                        projectId: ko.unwrap(fist.projectId)
                    });
                }
            };
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
        };

        ctor.prototype.attached = function (view) {
            var _this = this;



            _this.grid = $(view).find(".k-grid").data("kendoGrid");

        };


        ctor.prototype.detached = function (settings) {
            var _this = this;
        };

        ctor.prototype.getHeaderText = function (item) {
            if (this.settings.headerProperty) {
                return item[this.settings.headerProperty];
            }

            return item.toString();
        };

        ctor.prototype.afterRenderItem = function (elements, item) {
            var parts = composition.getParts(elements);
            var $itemContainer = $(parts.itemContainer);

            $itemContainer.hide();

            $(parts.headerContainer).bind("click", function () {
                $itemContainer.toggle("fast");
            });
        };


        return ctor;


    });
