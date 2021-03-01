define([
  "common/autocomplete",
  "durandal/system",
  "common/lookups",
  "durandal/events",
  "common/helpers",
  "common/context",
  "i18n",
  "plugins/dialog",
  "plugins/http",
  "durandal/composition",
  "common/notifications",
  "durandal/app",
  "knockout",
  "common/errorhandler",
  "underscore",
  "common/utils"
], function(
  autocomplete,
  system,
  lookupFactory,
  events,
  helpers,
  context,
  i18n,
  dialog,
  http,
  composition,
  notifications,
  app,
  ko,
  errorhandler,
  _,
  utils
) {
  function TableFieldModel(table, data) {
    var _this = this;
    this.clientId = _.uniqueId();
    this.field = ko.observable(data.field);
    this.title = ko
      .observable(data.title || "")
      .extend({ required: true })
      .extend({
        validation: {
          validator: function(val, fields) {
            val = helpers.utils.slug(val);
            var clientId = _this.clientId;
            if (
              _.indexOf(
                _.map(ko.unwrap(table.fields), function(f) {
                  if (f.clientId !== clientId && ko.unwrap(f.title)) {
                    return helpers.utils.slug(ko.unwrap(f.title));
                  }
                }),
                val
              ) > -1
            ) {
              return false;
            }
            return true;
          },
          message: i18n.t("app:pages.table.errors.fieldalreadyexists"),
          params: false
        }
      });
    this.format = ko.observable(data.format);
    this.isRequired = ko.observable(data.isRequired);
    this.isVisible = ko.observable(data.isVisible);

    this.description = ko.observable(data.description);

 
    this.position = ko.observable(data.position || 1);
    this.type = ko.observable(data.type).extend({
      required: true
    });
    this.valuesText = ko.observable((data.values || []).join(","));
    this.values = ko.computed({
      read: function() {
        var text = _this.valuesText();
        if (text === false) {
          return "";
        }
        return text.split(",");
      },
      write: function(value) {
        _this.valuesText(value.join(","));
      }
    });
    this.isDeleted = ko.observable(false);
    this.isNew = ko.observable(data.isNew || false);

    if(data.isNew)
    {
        this.isVisible(true);
    }
    this.errors = ko.validation.group(this);
    this.isArray = data.isArray || false;
    this.edit = false;
    this.bgColor = ko.computed(function() {
      if (_this.isDeleted()) {
        return "bg-red-600";
      }
      if (_this.isNew()) {
        return "bg-green-200";
      }
      return "";
    });
    this.dirtyFlag = new ko.DirtyFlag(this);
    this.isDirty = function() {
      return _this.dirtyFlag().isDirty();
    };
  }

  function TableModel(data) {
    var _this = this;
    this.id = data.id;
    this.name = ko.revertableObservable(data.name || "").extend({
      required: true
    });
    this.description = ko.revertableObservable(data.description || "");
    this.fields = ko.revertableObservableArray(
      _.map(data.fields || [], function(field) {
        return new TableFieldModel(_this, field);
      })
    );
    this.sortedFields = ko.pureComputed(function() {
      return _.sortBy(_this.fields(), function(f) {
        return parseInt(ko.unwrap(f.position), 10);
      });
    });

    this.gridRowTransformer = null;
    this.isLocked = ko.observable(data.isLocked);
    this.author = context.getUserById(data.createdBy);
    this.createdAt = data.createdAt;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt;
    this.updatedBy = data.updatedBy;
    this.updatedAt = data.updatedAt;
    this.templateId = data.templateId;
    this.version = ko.observable(data.version);
    this.taskId = data.taskId;
    this.taskName = data.taskName;
    this.sourceType= data.sourceType;
    this.errors = ko.validation.group(this, {
      deep: true
    });
    this.dirtyFlag = new ko.DirtyFlag([
      _this.name,
      _this.description,
      _this.fields
    ]);

    this.addField = function(title) {
      var field = new TableFieldModel(_this, {
        isNew: true
        // position:++table.lastPosition
      });
      _this.fields.push(field);
    };

    this.reset = function() {
      _this.name.revert();
      _this.fields.revert();
      _this.description.revert();
      _this.dirtyFlag().reset();
    };
    this.commit = function() {
      _this.name.commit();
      _this.fields.commit();
      _this.description.commit();
      _this.dirtyFlag().reset();
      _this.version(_this.version() + 1);
    };

    this.isDirty = function() {
      return _this.dirtyFlag().isDirty();
    };
  }

  var ctor = function() {
    var _this = this;
    errorhandler.includeIn(this);
    this.taskId = null;
    this.projectId = null;
    this.tables = ko.observableArray([]);
    this.sortedTables = ko.computed(function() {
      var r = _.sortBy(_this.tables(), function(a) {
        return a.createdAt;
      });
      r = r.reverse();
      return r;
    });
    this.context = context;
    this.helpers = helpers;
    this.utils = utils;

    this.filter = {
      includeSubTasks: ko.observable(false),
      reset: function() {
        this.includeSubTasks(false);
      }
    };

    this.filter.includeSubTasks.subscribe(function(v) {
      _this.loadTables();
    });

    this.subscriptions = [];
    this.subscriptions.push(
      ko.postbox.subscribe("NewTableAdded", function(note) {
        if (!note) {
          _this.loadTables();
        } else {
          _this.tables.push(note);
        }
      })
    );
    this.isMultiTaskView = ko.pureComputed(function() {
      var g = _.countBy(_this.tables(), "taskId");
      return Object.keys(g).length > 1 || Object.keys(g)[0] !== _this.taskId;
    });
  };

  ctor.prototype.isTaskView = function() {
    var _this = this;
    return _this.taskId != null && _this.projectId != null;
  };

  ctor.prototype.showAttachTableModal = function(data) {
    var _this = this;

    var attachTableModalVm = {
      lookups: lookupFactory.create(),
      helpers: helpers,
      errorHandler: _this.handleError,
      seletedTableId: null,
      taskId: ko.unwrap(data.taskId),
      projectId: ko.unwrap(data.projectId),
      viewUrl: "task/table/attach-table-modal",
      context: _this.context,
      tables: ko.observableArray([]),
      selectedTable: ko.observable(),
      selectedSourceType: ko.observable(),
      cancel: function() {
        var modal = this;
        dialog.close(modal);
      },
      activate: function() {
        var modal = this;
      },
      save: function() {
        var modal = this;
    
        var url = String.format("/api/tables/{0}/tasks", attachTableModalVm.seletedTableId);
        var command = {
          taskId: attachTableModalVm.taskId
        };

        http
          .post(url, command)
          .then(function(res) {
   
            ko.postbox.publish("NewTableAdded",null);
            dialog.close(modal);
          })
          .fail(modal.handleError);
      },
      canDeactivate: function() {
        var modal = this;

        return true;
      },
      deactivate: function(close) {}
    };

    attachTableModalVm.selectedSourceType.subscribe(function(v) {
      var url = String.format(
        "/api/tables?sourceFilter={1}&projectId={0}",
        _this.projectId,
        v
      );

      http
        .get(url)
        .then(function(response) {
          attachTableModalVm.tables(response);
        })
        .fail(_this.handleError);
    });

    attachTableModalVm.selectedTable.subscribe(function(v) {
        attachTableModalVm.seletedTableId = v;

    });


    return dialog.showBsModal(attachTableModalVm).then(function(res) {});
  };

  ctor.prototype.showTableEditModal = function(table) {
    var _this = this;
    var tableEditModalVm = {
      lookups: lookupFactory.create(),
      helpers: helpers,
      errorHandler: _this.handleError,
      taskId: _this.taskId,
      viewUrl: "task/table/task-table-edit-modal",
      table: table,
      context: _this.context,
      cancel: function() {
        var modal = this;
        dialog.close(modal);
      },
      activate: function() {
        var modal = this;
      },
      save: function() {
        var modal = this;
        if (modal.table.errors().length > 0) {
          modal.table.errors.showAllMessages();
          return;
        }

        if (modal.table.id) {
          // edit mode
          var url = String.format(
            "/api/tables/{1}?taskId={0}",
            modal.taskId,
            modal.table.id
          );
          var data = ko.mapping.toJS(modal.table);
          var command = {
            name: data.name,
            description: data.description,
            type: 1,
            updatedFields: _.filter(data.fields, function(f) {
              return f.isDeleted === false && f.isDirty() && f.isNew === false;
            }),
            addedFields: _.filter(data.fields, function(f) {
              return f.isDeleted === false && f.isDirty() && f.isNew;
            }),
            removedFields: _.map(
              _.filter(data.fields, function(f) {
                return f.isDeleted === true;
              }),
              function(f) {
                return f.field;
              }
            )
          };
          http
            .put(url, command)
            .then(function(res) {
              modal.table.commit();
              ko.postbox.publish("TableUpdated", modal.table);
              dialog.close(modal);
            })
            .fail(modal.handleError);
        } else {
          var url = String.format("/api/tables?taskId={0}", modal.taskId);
          var data = ko.mapping.toJS(modal.table);
          var command = {
            name: data.name,
            description: data.description,
            type: 1,
            fieldDefinations: _.filter(data.fields, function(f) {
              return f.isNew === true;
            })
          };

          http
            .post(url, command)
            .then(function(res) {
              modal.table.id = res.tableId;
              modal.table.commit();
              ko.postbox.publish("NewTableAdded", null);
              dialog.close(modal);
            })
            .fail(modal.handleError);
        }
      },
      canDeactivate: function() {
        var modal = this;
        if (modal.table.isDirty()) {
          var defer = $.Deferred();
          notifications.confirm(
            {
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
            function(isConfirm) {
              if (isConfirm) {
                modal.table.reset();
                defer.resolve(true);
              }

              defer.reject(false);
            }
          );
          return defer.promise();
        }
        return true;
      },
      deactivate: function(close) {}
    };

    return dialog.showBsModal(tableEditModalVm).then(function(res) {});
  };

  ctor.prototype.showTable = function(table) {
    var _this = this;
    system
      .acquire("task/table/task-table-modal")
      .then(function(taskTableModal) {
        var modal = new taskTableModal(_this.taskId, _this.projectId, table.id);
        return dialog.showBsModal(modal);
      });
  };
  ctor.prototype.newTable = function() {
    var _this = this;
    var data = {
      createdBy: context.user().id,
      createdAt: utils.now(),
      taskId: _this.taskId
    };

    _this.showTableEditModal(new TableModel(data));
  };

  ctor.prototype.deleteTable = function(table) {
    var _this = this;
    notifications.confirm(
      {
        title: i18n.t("app:pages.table.promptDeleteRowHeader"),
        text: i18n.t("app:pages.table.promptDeleteTableText"),
        type: "warning",
        showCancelButton: true,
        confirmButtonColor: "#DD6B55",
        confirmButtonText: i18n.t("app:alerts.delete.confirm"),
        cancelButtonText: i18n.t("app:alerts.delete.cancel"),
        closeOnConfirm: true,
        closeOnCancel: true
      },
      function(isConfirm) {
        if (isConfirm) {
          var url = String.format(
            "/api/tables/{1}?taskId={0}",
            _this.taskId,
            table.id
          );
          return http
            .delete(url)
            .then(function(response) {
              _this.tables.remove(table);
            })
            .fail(_this.handleError);
        }
      }
    );
  };

  ctor.prototype.duplicateTable = function(table) {
    var _this = this;
    system
      .acquire("task/table/task-table-duplicate-modal")
      .then(function(duplicateTodoListsVm) {
        var modal = new duplicateTodoListsVm(
          _this.taskId,
          _this.projectId,
          table.id
        );
        return dialog.showBsModal(modal);
      });
  };

  ctor.prototype.lockTable = function(table) {
    var _this = this;
    var url = String.format(
      "/api/tasks/{0}/tables/{1}/lock",
      table.taskId,
      ko.unwrap(table.id)
    );
    return http
      .put(url)
      .then(function(response) {
        table.isLocked(true);
      })
      .fail(_this.handleError);
  };

  ctor.prototype.unlockTable = function(table) {
    var _this = this;
    var url = String.format(
      "/api/tasks/{0}/tables/{1}/lock",
      table.taskId,
      ko.unwrap(table.id)
    );
    return http
      .put(url)
      .then(function(response) {
        table.isLocked(true);
      })
      .fail(_this.handleError);
  };

  ctor.prototype.loadTables = function() {
    var _this = this;
    var url = String.format("/api/tables?taskId={0}", _this.taskId);

    return http
      .get(url)
      .then(function(response) {
        _this.tables([]);
        var tables = [];
        response.forEach(function(table) {
          tables.push(new TableModel(table));
        });
        _this.tables.push.apply(_this.tables, tables);
      })
      .fail(_this.handleError);
  };

  ctor.prototype.activate = function(settings) {
    var _this = this;
    _this.taskId = settings.taskId || null;
    _this.projectId = settings.projectId || null;

    return _this.loadTables();
  };

  ctor.prototype.deactivate = function(close) {
    var _this = this;
    _.each(_this.subscriptions, function(subscriber) {
      subscriber.dispose();
    });
  };

  return ctor;
});
