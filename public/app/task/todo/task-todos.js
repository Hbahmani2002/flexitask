define(["plugins/dialog", "common/context", "common/notifications", "common/utils", "common/helpers", "i18n", "durandal/events", "plugins/router", "durandal/composition", "durandal/activator", "plugins/http", "durandal/app", "durandal/system", "knockout", "common/errorhandler", "underscore"],
function (dialog, context, notifications, utils, helpers, i18n, events, router, composition, activator, http, app, system, ko, errorhandler, _) {

    function TodoItemModel(data, parent) {
        data = data || {};
        var _this = this;
        this.id = data.id;
        this.name = ko.revertableObservable(data.name || "").extend({
            required: true,
            minLength: 1
        });
        this.todoListId = data.todoListId;
        this.position = ko.observable(data.position);
        this.version = data.version;
        this.status = ko.observable(data.status);
        this.isEditing = ko.observable(false);
        this.isChecked = ko.computed({
            read: function () {
                return _this.status() === "complete";
            },
            write: function (value) {
                var newStatus = _this.status() !== "complete" ? "complete" : "incomplete";
                var command = {
                    status: newStatus
                };
                var url = String.format("/api/todolist/{0}/todos/{1}/status", parent.id, _this.id);
                http.put(url, command).then(function () {
                    _this.status(newStatus);
                });
            }
        });
        this.errors = ko.validation.group(this);
        this.isNew = function () {
            return $.isNullOrWhiteSpace(_this.name());
        };
    }


    var ctor = function () {
        var _this = this;
        errorhandler.includeIn(this);
        this.taskId = null;
        this.projectId = null;
        this.lists = ko.observableArray([]);
        this.sortedLists = ko.computed(function () {
            var r = _.sortBy(_this.lists(), function (a) {
                return a.createdAt;
            });
            r = r.reverse();
            return r;
        });
        this.filter = {
            includeSubTasks: ko.observable(false),
            reset: function () {
                this.includeSubTasks(false);
            }
        };
        this.context = context;
        this.helpers = helpers;
        this.utils = utils;
        this.attachedView = null;

        this.subscriptions = [];
        this.subscriptions.push(ko.postbox.subscribe("NewTodoListAdded", function (list) {
            _this.lists.push(list);

        }));
        this.filter.includeSubTasks.subscribe(function (v) {
            _this.loadTodoLists();
        });
        this.isMultiTaskView = ko.pureComputed(function () {
            var g = _.countBy(_this.lists(), "taskId");
            return Object.keys(g).length > 1 || Object.keys(g)[0] !== _this.taskId;
        });
    };

    ctor.prototype.isTaskView = function () {
        var _this = this;
        return _this.taskId != null && _this.projectId != null;
    };


    ctor.prototype.createTodoListModel = function (list) {
        var _this = this;

        list.id = list.id;
        list.taskId = list.taskId;
        list.description = ko.revertableObservable(list.description);
        list.name = ko.revertableObservable(list.name).extend({
            required: true
        });
        list.position = ko.revertableObservable(list.position);
        list.version = ko.observable(list.version || 0);
        list.author = context.getUserById(list.createdBy);
        list.createdAt = list.createdAt;
        list.showTodoItems = ko.observable(true);
        list.showCheckedItems = ko.observable(true);
        list.items = ko.revertableObservableArray(_.map(list.items, function (item) {
            return new TodoItemModel(item, list);
        }));

        list.reset = function () {
            list.name.revert();
            list.position.revert();
            list.description.revert();
            list.dirtyFlag().reset();
        };
        list.commit = function () {
            list.name.commit();
            list.position.commit();
            list.description.commit();
            list.dirtyFlag().reset();
            list.version(list.version() + 1);
        };

        list.showDescription = ko.observable(false);
        list.completedTodosPercentage = ko.computed(function () {
            var todoCount = list.items().length;
            if (todoCount === 0) {
                return 0;
            }
            var completedCount = _.filter(list.items(), function (item) {
                return item.status() == "complete";
            }).length;

            var percentage = 100 / (todoCount / completedCount);
            return parseInt(percentage);
        });
        list.sortType = ko.observable("date");
        list.changeSortType = function (type, t) {
            list.sortType(type);
        };
        list.hasItem = ko.computed(function () {
            return list.items().length > 0;
        });
        list.hasCheckItems = ko.computed(function () {
            return _.some(list.items(), function (item) {
                return item.status() === "complete";
            });
        });
        list.countOfCheckedItems = ko.computed(function () {
            return _.filter(list.items(), function (item) {
                return item.status() === "complete";
            }).length;
        });
        list.filteredItems = ko.computed(function () {
            var result = _.filter(list.items(), function (item) {
                if (list.showCheckedItems() === false && item.status() === "complete") {
                    return false;
                }
                return true;
            });

            if (list.sortType() === "date") {
                return result;
            } else if (list.sortType() === "name") {
                return _.sortBy(result, function (s) {
                    return ko.unwrap(s.name);
                });
            }

            return result;
        }).extend({ throttle: 200 });
        list.currentItem = ko.observable(new TodoItemModel({}, list));
        list.editingItem = ko.observable();
        list.newItem = function () {
            list.currentItem(new TodoItemModel({}, list));

            $("#todo-new-item-input-" + list.id).focus();
        };
        list.editItem = function (item, el, ev) {
            list.editingItem(item);
            item.isEditing(true);

            $(".js--todo-edit-item-input").focus();
        };
        list.cancelNewItem = function () {
            list.currentItem(new TodoItemModel({}, list));

        };
        list.cancelEditing = function (item) {
            list.editingItem().name.revert();
            list.editingItem(null);
            item.isEditing(false);
        };
        list.hasFocus = ko.observable();
        list.addItem = function () {
            if (list.currentItem().errors().length > 0) {
                return;
            }
            var input = ko.mapping.toJS(list.currentItem);
            var lines = input.name.split("\n");
            $.each(lines, function (index, line) {
                if (line.trim() === false)
                    return;
                var command = {
                    name: line.trim()
                };
                var url = String.format("/api/todolist/{0}/todos", ko.unwrap(list.id));
                http.post(url, command)
                .then(function (response, status, xhr) {
                    var data = {
                        name: command.name,
                        createdAt: utils.now(),
                        id: response.todoId
                    };

                    list.items.push(new TodoItemModel(data, list));
                    list.newItem();
                    // var getUrl = xhr.getResponseHeader('Location');
                    // if (getUrl) {
                    //     http.get(getUrl).then(function(item) {
                    //         _this.createTodoItemModel(item, list);
                    //         list.items.push(item);
                    //         list.newItem();
                    //     });
                    // }
                }).fail(_this.handleError);
            });
        };
        list.updateItem = function () {
            var item = list.editingItem();
            if (item) {
                if (item.errors().length > 0) {
                    return;
                }
                var command = {
                    name: item.name()
                };
                var url = String.format("/api/todolist/{0}/todos/{1}/name", list.id, item.id);
                http.put(url, command).then(function () {
                    item.name.commit();
                    list.editingItem(null);
                    item.isEditing(false);
                });
            }
        };
        list.deleteTodoItem = function (item) {
            var url = String.format("/api/todolist/{0}/todos/{1}/", list.id, item.id);
            http.delete(url).then(function () {
                list.items.remove(item);
            });
        };
        list.errors = ko.validation.group([list.name]);
        list.dirtyFlag = new ko.DirtyFlag([list.name, list.description, list.position]);
        list.isDirty = function () {
            return list.dirtyFlag().isDirty();
        };
    };

    ctor.prototype.showTodoListEditModal = function (list) {
        var _this = this;
        var modalVm = {
            helpers: helpers,
            viewUrl: "task/todo/task-todo-list-new-edit-modal",
            handleError: _this.handleError,
            taskId: ko.unwrap(list.taskId),
            list: list,
            isNew: !list.id,
            canDeactivate: function () {
                var modal = this;
                if (modal.list.isDirty()) {
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
                            modal.list.reset();
                            defer.resolve(true);
                        }

                        defer.reject(false);
                    });
                    return defer.promise();
                }
                return true;
            },
            deactivate: function (close) {

            },
            activate: function () {
                var modal = this;
                modal.list.dirtyFlag().reset();
            },
            cancel: function () {
                var modal = this;
                dialog.close(modal);
            },
            save: function () {
                var modal = this;
                if (modal.list.errors().length > 0) {
                    modal.list.errors.showAllMessages();
                    return;
                }

                if (modal.isNew) {
                    var url = String.format("/api/tasks/{0}/todolist", modal.taskId);
                    var command = {
                        name: modal.list.name(),
                        description: modal.list.description()
                    };

                    http.post(url, command)
                    .then(function (res, status, xhr) {

                        modal.list.commit();
                        modal.list.id = res.todoListId;
                        ko.postbox.publish("NewTodoListAdded", modal.list);
                        dialog.close(modal);
                    }).fail(modal.handleError);
                } else {
                    var url = String.format("/api/todolist/{0}", modal.list.id);
                    var command = {
                        name: modal.list.name(),
                        description: modal.list.description()
                    };

                    http.put(url, command)
                    .then(function (res, status, xhr) {
                        modal.list.commit();
                        dialog.close(modal);
                    }).fail(modal.handleError);
                }
            }
        };

        return dialog.showBsModal(modalVm);
    };

    ctor.prototype.newTodoList = function () {
        var _this = this;
        var list = {
            createdAt: utils.now(),
            taskId: _this.taskId
        };
        _this.createTodoListModel(list);
        _this.showTodoListEditModal(list);
    };

    ctor.prototype.editTodoList = function (todoList) {
        var _this = this;
        _this.showTodoListEditModal(todoList);
    };



    ctor.prototype.duplicateTodoLists = function () {
        var _this = this;
        system.acquire("task/todo/task-todolist-duplicate-modal").then(function (duplicateTableVm) {
            var modal = new duplicateTableVm(_this.taskId, _this.projectId);
            dialog.showBsModal(modal);
        });
    };

    ctor.prototype.deleteList = function (list) {
        var _this = this;
        notifications.confirm({
            title: i18n.t("app:pages.todo.promptDeleteTodoListTitle"),
            text: i18n.t("app:pages.todo.promptDeleteTodoListText"),
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: "#DD6B55",
            confirmButtonText: i18n.t("app:alerts.delete.confirm"),
            cancelButtonText: i18n.t("app:alerts.delete.cancel"),
            closeOnConfirm: true,
            closeOnCancel: true
        },
        function (isConfirm) {
            if (isConfirm) {
                var url = String.format("/api/todolist/{0}", list.id);
                http.delete(url).then(function () {
                    _this.lists.remove(list);
                    notifications.success(i18n.t("app:pages.todo.promptDeleteTodoListConfirmText"));
                });
            }
        });
    };




    ctor.prototype.loadTodoLists = function () {
        var _this = this;


        var filters = utils.toQueryString(ko.toJS(_this.filter));
        if (_this.taskId) {
            url = String.format("/api/tasks/{0}/todolist?{1}&includeTodoItems=true", _this.taskId, filters);
        } else {
            url = String.format("/api/todolist?projectId={0}&includeTodoItems=true", _this.projectId);
        }

        return http.get(url)
        .then(function (response) {
            _this.lists([]);
            var lists = [];
            response.forEach(function (list) {
                _this.createTodoListModel(list);
                lists.push(list);
            });
            _this.lists.push.apply(_this.lists, lists);
        }).fail(_this.handleError);
    };

    ctor.prototype.activate = function (settings) {
        var _this = this;
        _this.taskId = settings.taskId || null;
        _this.projectId = settings.projectId || null;
        return _this.loadTodoLists();
    };

    ctor.prototype.attached = function (view) {
        var _this = this;

        $(document)
        .off("keydown", ".js--todo-new-item-input,.js--todo-edit-item-input")
        .off("blur", ".js--todo-edit-item-input")
        .off("focus", ".js--todo-new-item-input")
        .off("blur", ".js--todo-new-item-input")
        .on("keydown", ".js--todo-new-item-input,.js--todo-edit-item-input", function (e) {
            if (e.keyCode == 13) {
                e.preventDefault();
                $(this).parents("form").submit();
                return false;
            }
        })
        .on("blur", ".js--todo-edit-item-input", function (e) {
            var rt = $(e.relatedTarget);
            var container = rt.parents("form.js--todo-edit-form").get(0);
            if (rt && container) {
                event.preventDefault();
                return;
            }

            var todoItem = ko.dataFor(this);
            todoItem.isEditing(false);
        })
        .on("focus", ".js--todo-new-item-input", function (ev) {
            var rt = $(ev.target);
            var container = rt.parents("form.js--todo-new-form");
            $(this).addClass("todo-new-item-input-focused");
            container.find(".js--todo-new-form-buttons").show();
        })
        .on("blur", ".js--todo-new-item-input", function (ev) {
            var rt = $(ev.relatedTarget || ev.target);
            if (rt.attr("type") == "submit" || rt.attr("type") == "button" || rt.prop("tagName") == "A") {
                event.preventDefault();
            } else {
                $(_this.attachedView).find(".js--todo-new-form-buttons").hide();
                $(this).removeClass("todo-new-item-input-focused");
            }
        });
    };

    ctor.prototype.deactivate = function () {
        var _this = this;

        _this.attachedView = null;
        _.each(_this.subscriptions, function (subscriber) {
            subscriber.dispose();
        });
    };

    ctor.prototype.detached = function () {
        var _this = this;

        $(document)
        .off("keydown", ".js--todo-new-item-input,.js--todo-edit-item-input")
        .off("blur", ".js--todo-edit-item-input")
        .off("blur", ".js--todo-new-item-input")
        .off("focus", ".js--todo-new-item-input");

    };





    return ctor;

});
