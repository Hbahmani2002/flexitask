define(["common/kendolib","jquery", "durandal/events", "common/autocomplete", "config", "common/helpers", "common/context", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (kendo,$, events, autocomplete, config, helpers, context, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {

        window.formatDateTime = function formatDateTime(d) {
            return d ? utils.formatDateTime(d) : "";
        }

        function TableRowViewModel(fields, id) {
            var self = this;
            self.fields = ko.observableArray([]);
            self.id = ko.observable(id);

            self.init = function () {
                _.each(fields, function (f) {
                    var value;

                    if (ko.unwrap(f.isArray)) {
                        value = ko.observableArray([]).extend({
                            required: ko.unwrap(f.isRequired)
                        });
                    } else {
                        value = ko.observable(null).extend({
                            required: ko.unwrap(f.isRequired)
                        });

                    }


                    self.fields.push({
                        meta: f,
                        value: value,
                        valueText: ko.observable()
                    });
                });
            };


            self.setFieldValue = function (field, value) {
                var m = _.find(self.fields(), function (f) {
                    if (ko.unwrap(f.meta.field) === field) {
                        return true;
                    }
                    return false;
                });
                if (m) {
                    if ($.isArray(value) || ko.unwrap(m.meta.isArray)) {
                        m.value(value || []);
                    } else {
                        m.value(value);
                    }
                }
            };

            this.init();
            this.errors = ko.validation.group(_.map(self.fields(), function (f) {
                return f.value;
            }));

            self.dirtyFlag = new ko.DirtyFlag([self.fields]);
            self.isDirty = ko.computed(function () {
                return self.dirtyFlag().isDirty();
            });
        }


        var taskTableModal = function (taskId, projectId, tableId) {
            var _this = this;
            errorhandler.includeIn(this);
            this.autocomplete = autocomplete;
            this.context = context;
            this.utils = utils;
            this.helpers = helpers;
            this.tableInfo = null;
            this.tableId = tableId;
            this.taskId = taskId;
            this.projectId = projectId;
            this.currentRowView = ko.observable(null);
            this.editingRow = ko.observable(null);
            this.grid = null;
            this.taskAutoCompleteOptions = autocomplete.getSelect2OptionsForTasks(projectId);

            this.gridRowTransformer = null;
            this.editingOrViewingARow = ko.computed(function () {
                return _this.currentRowView() || _this.editingRow();
            });
        };


        taskTableModal.prototype.bindRecordForm = function () {
            var _this = this;
            var url = String.format("{0}/api/tasks/{1}/attachments?type=task/table&token={2}", config.serviceEndpoints.baseEndpoint, _this.taskId, context.authToken());
            $(".js--file-upload").fileupload({
                autoUpload: true,
                uploadTemplateId: null,
                downloadTemplateId: null,
                url: url,
                dataType: "json",
                done: function (e, data) {
                    var field = ko.dataFor(this);
                    $.each(data.result.files, function (index, file) {
                        field.value.push({
                            id: file.id,
                            name: file.name
                        });
                    });
                },
                add: function (e, data) {
                    var field = ko.dataFor(this);
                    if (data.autoUpload || (data.autoUpload !== false && $(this).fileupload("option", "autoUpload"))) {
                        var p = $("#" + ko.unwrap(field.meta.field) + "-progress");
                        var pb = p.find(".progress-bar");
                        p.show();
                        pb.css("width", "0%");
                        data.process().done(function () {
                            data.submit();
                        });
                    }
                },
                progressall: function (e, data) {
                    var field = ko.dataFor(this);
                    var progress = parseInt(data.loaded / data.total * 100, 10);
                    var p = $("#" + ko.unwrap(field.meta.field) + "-progress");
                    var pb = p.find(".progress-bar");
                    if (progress >= 100) {
                        progress = 0;
                        p.hide();
                    }
                    pb.css("width", progress + "%");
                },
                fail: function (e, data) {
                    _this.errorHandler(data.jqXHR);
                }
            });
        };

        taskTableModal.prototype.addNewRecord = function () {
            var _this = this;
            var row = new TableRowViewModel(_this.tableInfo.sortedFields);
            _this.editingRow(row);
            _this.currentRowView(null);
            _this.bindRecordForm();
        };

        taskTableModal.prototype.resetRowView = function () {
            var _this = this;
            _this.editingRow(null);
            _this.currentRowView(null);
        };

        taskTableModal.prototype.saveRecord = function () {
            var _this = this;
            if (_this.editingRow().errors().length > 0) {
                _this.editingRow().errors.showAllMessages();
                return;
            }

            var row = ko.toJS(_this.editingRow());
            var data = {};
            _.each(row.fields, function (field) {
                data[field.meta.field] = field.value;
            });
            var url = "";
            if (row.id) { // edit
                url = String.format("/api/tables/{1}/rows/{2}?taskId={0}", _this.taskId, _this.tableId, row.id);
                http.put(url, {
                    data: data
                }).then(function (response) {
                    // add row to grid
                    if (_this.grid) {
                        var dataSource = _this.grid.dataSource;
                        var rowData = dataSource.get(row.id);
                        if (rowData) {
                            var transformedData = _this.gridRowTransformer(data);
                            for (var propertyName in transformedData) {
                                rowData.set(propertyName, transformedData[propertyName]);
                            }
                        }
                    }

                    _this.cancelRecord();
                }).fail(_this.handleError);
            } else {

                // var tableIdWihoutDashes = _this.tableId.replace(/-/g, '');
                url = String.format("/api/tables/{1}/rows?taskId={0}", _this.taskId, _this.tableId);
                http.post(url, {
                    data: data
                }).then(function (response) {
                    // add row to grid
                    if (_this.grid) {
                        data.id = response.rowId;
                        var dataSource = _this.grid.dataSource;
                        var total = dataSource.data().length;
                        dataSource.insert(total, _this.gridRowTransformer(data));
                    }

                    _this.cancelRecord();
                }).fail(_this.handleError);
            }
        };

        taskTableModal.prototype.cancelRecord = function (row) {
            var _this = this;
            var form = $("#form-edit-row").get(0);
            form.reset();
            _this.editingRow(null);
        };


        taskTableModal.prototype.getAttachmentDownloadUrl = function (attachment) {
            var _this = this;

            return String.format("/api/tasks/{0}/attachments/{1}/download?token={2}", _this.taskId, attachment.id, context.authToken());
        };

        taskTableModal.prototype.removeFile = function (field, file, event) {
            var _this = this;

            field.value.remove(file);
        };


        taskTableModal.prototype.activate = function (settings) {
            var _this = this;
            var url = String.format("/api/tables/{1}?taskId={0}", _this.taskId, _this.tableId);
            return http.get(url)
            .then(function (response) {
                _this.tableInfo = response;

                _this.tableInfo.sortedFields = _.sortBy(_this.tableInfo.fields, function (f) {
                    return f.position;
                });

            }).fail(_this.handleError);
        };

        taskTableModal.prototype.cancel = function () {
            dialog.close(this);
        };

        taskTableModal.prototype.deactivate = function (close) {
            var _this = this;
            _this.editingRow.stopPublishingOn("RowChanged");
            if (_this.grid) {
                _this.grid.destroy();
            }
        };



        taskTableModal.prototype.canDeactivate = function () {
            var _this = this;
            var editingRow = _this.editingRow();
            if (!editingRow) {
                return true;
            }
            if (editingRow.isDirty()) {
                var defer = $.Deferred();
                notifications.confirm({
                    title: i18n.t("app:alerts.dirty.title"),
                    text: i18n.t("app:alerts.dirty.text"),
                    type: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#DD6B55",
                    confirmButtonText: i18n.t("app:alerts.dirty.discard"),
                    cancelButtonText: i18n.t("app:alerts.dirty.stay"),
                    closeOnConfirm: true,
                    closeOnCancel: true
                },
                    function (isConfirm) {
                        if (isConfirm) {
                            defer.resolve(true);
                        }

                        defer.reject(false);
                    });
                return defer.promise();
            }
            return true;

        };

        taskTableModal.prototype.taskSelected = function (task) {
            var _this = this;
            if(!task){
                _this.value(null);
                return;
            }
            _this.value({
                name: task.name,
                id: task.id
            });
        };

        taskTableModal.prototype.cancelEdit = function () {
            var _this = this;
            dialog.close(_this);
        };

        taskTableModal.prototype.tranformGridRow = function (row) {
            var _this = this;
            if (!_this.gridRowTransformer) {
                return null;
            }

            return _this.gridRowTransformer(row);
        };

        taskTableModal.prototype.bindKendoGrid = function () {
            var _this = this;
            var url = config.serviceEndpoints.baseEndpoint+ String.format("/api/tables/{1}/rows?taskId={0}", _this.taskId, _this.tableId);

            var fields = {};
            var columns = [];
            var dataTransformers = {};
            var groups = [];
            var aggregates = [];
            // var sortedFields=_this.tableInfo.sortedFields();
            _.each(_this.tableInfo.sortedFields, function (f) {
                var fieldProperties = ko.toJS(f);

                var field = {

                    nullable: fieldProperties.isRequired === false,
                    type: "string"
                };

                var column = {
                    field: fieldProperties.field,
                    title: fieldProperties.title,
                    hidden: fieldProperties.isVisible === false,
                    encoded: true,
                    // groupHeaderTemplate: "#= field #: #= value # (Count: #= count#)",
                    // groupFooterTemplate: "Count: #=count#",
                    aggregates: ["sum", "average", "count", "max", "min"]
                };

                var dataTransformer = {
                    fieldProperties: fieldProperties,
                    transform: function (row) {
                        return row[fieldProperties.field];
                    }
                };

                aggregates.push({
                    field: fieldProperties.field,
                    aggregate: "sum"
                }, {
                    field: fieldProperties.field,
                    aggregate: "min"
                }, {
                    field: fieldProperties.field,
                    aggregate: "max"
                }, {
                    field: fieldProperties.field,
                    aggregate: "average"
                }, {
                    field: fieldProperties.field,
                    aggregate: "count"
                });

                if (fieldProperties.type === 0) { // text

                } else if (fieldProperties.type === 1) { // number
                    field.type = "number";
                    // column.footerTemplate = "Sum: #= sum # ";
                    // column.groupFooterTemplate="Total: #=count#, Avg: #=average#, Max: #=max#, Min: #=min#, Sum: #=sum#";

                    /* groups.push({
                     field:fieldProperties.field,
                     aggregates: [
                     { field: fieldProperties.field, aggregate: "count" },
                     { field: fieldProperties.field, aggregate: "average" },
                     { field: fieldProperties.field, aggregate: "max" },
                     { field: fieldProperties.field, aggregate: "min" },
                     { field: fieldProperties.field, aggregate: "sum" }
                     ]
                     });*/
                } else if (fieldProperties.type === 3) { // boolean
                    field.type = "boolean";
                } else if (fieldProperties.type === 4) { // link
                    dataTransformer.transform = function (dataItem) {
                        var u = dataItem[fieldProperties.field];
                        if (u) {
                            return String.format("<a href=\"{0}\" target=\"_blank\" >{0}</a>", u);
                        }
                        return null;
                    };
                    field.type = "string";
                    column.encoded = false;
                } else if (fieldProperties.type === 5) { // selection

                } else if (fieldProperties.type === 6) { // user
                    dataTransformer.transform = function (dataItem) {
                        var u = dataItem[fieldProperties.field];
                        if (u) {
                            var user = context.getUserById(u);
                            if (user) {
                                return user.fullName;
                            }
                        }
                        return null;
                    };
                    field.type = "string";
                } else if (fieldProperties.type === 7) { // attachments
                    dataTransformer.transform = function (dataItem) {
                        var u = dataItem[fieldProperties.field];
                        if (u) {
                            var items = [];
                            _.each(u, function (r) {
                                var href = _this.getAttachmentDownloadUrl(r);
                                items.push(String.format("<a href=\"{0}\"  >{1}</a> ", href, r.name));
                            });
                            return items.join(",");
                        }
                        return null;
                    };
                    column.encoded = false;
                    column.groupable = false;
                } else if (f.type === 8) {
                    // date

                    field.type = "date";
                    column.template="#= window.formatDateTime("+fieldProperties.field+") #";
                    column.format =  config.dateTimeFormat;
                } else if (fieldProperties.type === 9) { // task
                    dataTransformer.transform = function (dataItem) {
                        var u = dataItem[fieldProperties.field];
                        if (u) {
                            return u.name;
                        }
                        return null;
                    };
                }

                columns.push(column);
                fields[fieldProperties.field] = field;
                dataTransformers[fieldProperties.field] = dataTransformer;
            });


            columns.push({
                command: [{
                    name: "delete",
                    text: "d",
                    imageClass: "k-icon k-delete",
                    click: function (e) {
                        var tr = $(e.target).closest("tr");
                        var data = this.dataItem(tr);
                        if (!data) {
                            return false;
                        }

                        e.preventDefault();
                        notifications.confirm({
                            title: i18n.t("app:pages.table.promptDeleteRowHeader"),
                            text: i18n.t("app:pages.table.promptDeleteRowText"),
                            type: "warning",
                            showCancelButton: true,
                            confirmButtonText: i18n.t("app:alerts.delete.confirm"),
                            cancelButtonText: i18n.t("app:alerts.delete.cancel"),
                            closeOnConfirm: true,
                            closeOnCancel: true
                        },
                            function (isConfirm) {
                                if (isConfirm) {

                                    var id = data.Id || data.id;
                                    var url = String.format("/api/tables/{1}/rows/{2}?taskId={0}", _this.taskId, _this.tableId, id);
                                    return http.delete(url).then(function () {
                                        var dataSource = _this.grid.dataSource;
                                        dataSource.remove(data);
                                    }).fail(_this.errorHandler);
                                }
                            });

                        return false;
                    }
                }, {
                    name: "edit",
                    text: "e",
                    imageClass: "k-icon k-edit",
                    click: function (e) {
                        var tr = $(e.target).closest("tr");
                        var data = this.dataItem(tr);
                        if (!data) {
                            return false;
                        }

                        e.preventDefault();

                        var id = data.Id || data.id;
                        var url = String.format("/api/tables/{1}/rows/{2}/edit?taskId={0}", _this.taskId, _this.tableId, id);
                        http.get(url).then(function (response) {


                            var row = new TableRowViewModel(_this.tableInfo.sortedFields, response.id);

                            // set values
                            _.each(_this.tableInfo.fields, function (f) {
                                var field = ko.unwrap(f.field);
                                var v = response[field];
                                row.setFieldValue(field, v);
                            });

                            _this.editingRow(row);
                            _this.bindRecordForm();

                        }).fail(_this.errorHandler);

                        return false;
                    }
                }, {
                    name: "view",
                    text: "v",
                    imageClass: "k-icon k-view",
                    click: function (e) {
                        var tr = $(e.target).closest("tr");
                        var data = this.dataItem(tr);
                        if (!data) {
                            return false;
                        }

                        e.preventDefault();

                        var id = data.Id || data.id;

                        var url = String.format("/api/tables/{1}/rows/{2}?taskId={0}", _this.taskId, _this.tableId, id);
                        http.get(url).then(function (response) {
                            _this.currentRowView(response);
                            _this.editingRow(null);
                        }).fail(_this.errorHandler);

                        return false;
                    }
                }]
            });

            _this.gridRowTransformer = function (row) {
                var x = _.mapObject(row, function (val, key) {
                    if (dataTransformers[key]) {
                        return dataTransformers[key].transform(row);
                    }
                    return val;
                });
                return x;
            };

            if (_this.grid) {
                _this.grid.destroy();
            }
            _this.grid = $("#grid-kendo").empty().kendoGrid({
                dataSource: {
                    transport: {
                        read: {
                            url: url,
                            type: "GET",
                            dataType: "json",
                            headers: context.getTokenAsHeader()
                        },
                        pageSize: 100
                    },
                    group: groups,
                    aggregate: aggregates,
                    schema: {
                        id: "Id",
                        model: {
                            fields: fields
                        },
                        data: function (response) {
                            return _.map(response.data, function (row) {
                                return _this.gridRowTransformer(row);
                            });
                        },
                        total: function (response) {
                            return response.recordsTotal;
                        }
                    }
                },
                columns: columns,
                filterable: true,
                sortable: true,
                toolbar: ["excel"],
                excel: {
                    allPages: true,
                    filterable: false
                },
                groupable: {
                    showFooter: true
                },
                reorderable: true,
                resizable: true,
                columnMenu: true,
                // mobile: true,
                pageable: {
                    input: true,
                    numeric: false,
                    pageSize: 100

                }
            }).data("kendoGrid");
        };

        taskTableModal.prototype.attached = function () {
            var _this = this;
            return _this.bindKendoGrid();
        };

        return taskTableModal;
    });
