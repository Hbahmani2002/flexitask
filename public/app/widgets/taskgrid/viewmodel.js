define(["common/kendolib", "common/autocomplete", "common/utils", "common/helpers", "common/lookups", "common/context", "amplify", "durandal/composition", "plugins/dialog", "i18n", "durandal/events", "common/errorhandler", "durandal/system", "plugins/http", "plugins/router", "durandal/app", "durandal/activator", "knockout", "jquery", "underscore"],
    function (kendo, autocomplete, utils, helpers, lookupFactory, context, amplify, composition, dialog, i18n, events, errorhandler, system, http, router, app, activator, ko, $, _) {


        function ColumnModelBuilder() {
            this.columns = {};
            this.add = function (name, title, options) {
                options = _.extend({
                    type: "string",
                    field: name,
                    title: title,
                    hidden: false,
                    required:false
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

                var k = _.pick(_this.columns, function(value, key, object) {
                    return _.contains(columnNames,key) || value.required;
                });

                return k;
            };
        }

        var ctor = function () {
            var _this = this;
            this.grid = null;

            this.lookups = lookupFactory.create();
            this.selectedTask = ko.observable();
            this.columnModelBuilder = new ColumnModelBuilder()
                .add("id", "TaskId", {
                    hidden: true,
                    required:true,
                    width:"200px",
                })
                .add("projectId","ProjectId", {
                    hidden: true,
                    required:true,
                    width:"200px",
                })
                .add("name", i18n.t("app:widgets.taskGridWidget.columnNames.name"), { width: "200px"})
                .add("status", i18n.t("app:widgets.taskGridWidget.columnNames.status"), {
                    transform: function (task) {
                        return task.status ? _this.lookups.taskStatus.get(task.status).text : null;
                    },
                    width:"120px",
                })
                .add("assignee", i18n.t("app:widgets.taskGridWidget.columnNames.assignee"), {
                    transform: function (task) {
                        if (!task.assignee) {
                            return null;
                        }
                        var user = context.getUserById(task.assignee);
                        if (!user) {
                            return null;
                        }
                        return user.fullName;
                    },
                    width:"200px",
                })
                .add("owner", i18n.t("app:widgets.taskGridWidget.columnNames.owner"), {
                    transform: function (task) {
                        if (!task.owner) {
                            return null;
                        }
                        var user = context.getUserById(task.owner);
                        if (!user) {
                            return null;
                        }
                        return user.fullName;
                    },
                    width:"200px",
                    hidden: true
                })
                .add("startDate", i18n.t("app:widgets.taskGridWidget.columnNames.startDate"), {
                    type: "date",
                    hidden: true,
                    transform: function (task) {
                        return task.startDate ? utils.formatDateTime(task.startDate) : "";
                    },
                    width:"160px",
                })
                .add("dueDate", i18n.t("app:widgets.taskGridWidget.columnNames.dueDate"), {
                    type: "date",
                    transform: function (task) {
                        return task.dueDate ? utils.formatDateTime(task.dueDate) : "";
                    },
                    width:"160px",
                })
                .add("priority", i18n.t("app:widgets.taskGridWidget.columnNames.priority"), {
                    transform: function (task) {
                        return task.priority ? _this.lookups.taskPriority.get(task.priority).text : null;
                    },
                    width:"120px",
                    
                })
                .add("project", i18n.t("app:widgets.taskGridWidget.columnNames.project"), {
                    transform: function (task) {
                        if (!task.project) {
                            return null;
                        }
                   
                        return task.project.name;
                    },
                    width:"200px",
                })
                .add("tags", i18n.t("app:widgets.taskGridWidget.columnNames.tags"), {
                    transform: function (task) {
                        return task.tags.join(",");
                    },
                    hidden: true,
                    width:"200px"
                })
                .add("completionPercentage", i18n.t("app:widgets.taskGridWidget.columnNames.completionPercentage"), {
                    hidden: true,
                    width:"50px"
                })
                .add("isBlocked", i18n.t("app:widgets.taskGridWidget.columnNames.isBlocked"), {
                    hidden: true,
                    width:"50px"
                });


            this.gridRowTransformer = function (row, columns) {
                var x = {};
                _.each(columns,function(col){
                    x[col.field] = col.transform ? col.transform(row) : row[col.field];
                });
                return x;
            };

        };

        // shit :: fix custom field id if starts with custom characters (number,others)
        ctor.prototype.convertToValidCustomFieldId = function(name){
            return "_"+name;
        }

        ctor.prototype.activate = function (settings) {
            var _this = this;
            var defaults = {};

            this.settings = _.extend(defaults, settings);

            
            _.each(settings.customFields, function (cf) {
                _this.columnModelBuilder.add(_this.convertToValidCustomFieldId(cf.id), cf.title, {
                    transform: function (task) {
                        var customFields = ko.unwrap(task.customFields);
                        if (!customFields || customFields.length===0) {
                            return null;
                        }
                        
                        var customField = _.find(customFields,function(c){
                            return c.id === cf.id;
                        })
                        if(!customField){
                            return null;
                        }

                        var v = customField.value;
                        return v;
                    }
                });
            });


            var columns = _this.columnModelBuilder.getColumns(_this.settings.columns);
            if (_this.settings.excludeColumns) {
                columns = _.omit(columns, _this.settings.excludeColumns);

            }

            this.data = ko.computed(function () {

                var selectedStatus = _this.settings.filter.selectedStatus ? _this.settings.filter.selectedStatus() : false;
                var selectedTaskTypes = _this.settings.filter.selectedTaskType ? _this.settings.filter.selectedTaskType() : false;
                return _.chain(ko.toJS(_this.settings.tasks))
                    .filter(function (task) {
                        if (typeof task.status !== "undefined" && selectedStatus) {
                            return _.contains(selectedStatus, ko.unwrap(task.status).toString());
                        }

                        return true;
                    })
                    .filter(function (task) {
                        if (typeof task.taskType !== "undefined" && selectedTaskTypes) {
                            return _.contains(selectedTaskTypes, ko.unwrap(task.taskType).toString());
                        }

                        return true;
                    })
                    .map(function (task) {
                        return _this.gridRowTransformer(task, columns);
                    })
                    .value();

            }, _this).extend({rateLimit: 500});
            this.gridOptions = {
                dataSource: {
                    model: {
                        fields: columns,
                      
                    },
                    pageSize:50
                },
                columns: _.toArray(columns),
                filterable: true,
                sortable: true,
           
                groupable: {
                    showFooter: true
                },
                reorderable: true,
           
                columnMenu: true,
                scrollable: true,
                pageable: {
                    input: true,
                    numeric: false,
                    pageSizes: [10,20,50,100, "all"]
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
                        taskId: ko.unwrap(fist.id),
                        projectId: ko.unwrap(fist.projectId)
                    });
                },
                dataBound: function (e) {

                    $(e.sender.wrapper).find(".js--localize").i18n();
                }
            };
            if (settings.toolbarTemplate) {
                this.gridOptions.toolbar = kendo.template($(settings.toolbarTemplate).html());
            }
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
        };

        ctor.prototype.attached = function (view) {
            var _this = this;

            _this.grid = $(view).find(".k-grid").data("kendoGrid");



            ko.computed(function(){
                if(!_this.settings.viewOptions){
                    return;
                }
                var selectedCustomFields=ko.unwrap(_this.settings.viewOptions.selectedCustomFields);
                var allCustomFields = _this.settings.customFields;

                //Hide all custom fiels
                _.each(allCustomFields, function (aCf) {
                    _this.grid.hideColumn(_this.convertToValidCustomFieldId(aCf.id));
                });

                //Show only selected custom fields
                _.each(selectedCustomFields, function (sCf) {

                    _this.grid.showColumn(_this.convertToValidCustomFieldId(sCf));
                });
            });


            //Other filter menu
            ko.computed(function(){
                if(!_this.settings.viewOptions){
                    return;
                }
                var vO=_this.settings.viewOptions;

                var tagColName="tags";
                var percentageColName="completionPercentage";
                var ownerColName="owner";
                var startDateColName="startDate";
                var isBlockedColName="isBlocked";

                //Tag
                if(vO.showTags()===true)
                {
                    _this.grid.showColumn(tagColName);
                }
                else
                {
                    _this.grid.hideColumn(tagColName);
                }

                //startDate
                if(vO.showStartDate()===true)
                {
                    _this.grid.showColumn(startDateColName);
                }
                else
                {
                    _this.grid.hideColumn(startDateColName);
                }

                //showCompletionPercentage
                if(vO.showCompletionPercentage()===true)
                {
                    _this.grid.showColumn(percentageColName);
                }
                else
                {
                    _this.grid.hideColumn(percentageColName);
                }

                //showOwner
                if(vO.showOwner()===true)
                {
                    _this.grid.showColumn(ownerColName);
                }
                else
                {
                    _this.grid.hideColumn(ownerColName);
                }

                //showOwner
                if(vO.showIsBlocked()===true)
                {
                    _this.grid.showColumn(isBlockedColName);
                }
                else
                {
                    _this.grid.hideColumn(isBlockedColName);
                }
            });
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
