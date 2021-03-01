define(["common/context", "durandal/system","common/helpers", "common/lookups", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (context,system, helpers, lookupFactory, i18n, dialog, http, composition, notification, app, ko, errorhandler, _, utils) {

        var ctor = function () {
            errorhandler.includeIn(this);
            var _this = this;
            this.context = context;
            this.helpers = helpers;
            this.lookups = lookupFactory.create();
            this.taskId = null;
            this.projectId = null;
            this.projectName = null;
            var filters = {

            };
            this.subscriptions = [];
            this.subtasks = ko.observableArray([]);
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId;
            _this.projectId = settings.projectId;
            _this.projectName = settings.projectName;

            return _this.loadRecords();
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };

        ctor.prototype.getStatusText = function (status) {
            var _this = this;
            var statusValue = ko.unwrap(status.value);
            var s = _.find(_this.lookups.taskStatus.getAll(), function (item) {
                return item.value === statusValue;
            });
            if (s) {
                return s.text;
            } else {
                return "";
            }
        };

        ctor.prototype.changeTaskOrder = function (order, task, ev) {
            var _this = this;
            var orderedTasks = _.sortBy(_this.subtasks(), function (t) {
                return ko.unwrap(t.order);
            });

            var pos = helpers.orderTaskGetPosition(orderedTasks, task, order);
            if (pos === -1) {
                return;
            }

            var command = {
                order: pos
            };
            var taskId = ko.unwrap(task.id);
            var url = String.format("/api/tasks/{0}/order", taskId);
            return http.put(url, command).then(function (response) {
                task.order(pos);
                var requestId = utils.getRequestIdFromXhr(arguments);
                ko.postbox.publish("TaskPropertiesUpdated", {
                    taskId: taskId,
                    value: pos,
                    requestId: requestId,
                    property: "order"
                });
            });
        };

        ctor.prototype.loadRecords = function () {
            var _this = this;
            var filters = utils.toQueryString(ko.toJS(_this.filter));
            var url = String.format("/api/tasks/{0}/subtasks?{1}", _this.taskId, filters);

            return http.get(url)
                .then(function (response) {
                    _this.subtasks([]);
                    var subtasks = [];
                    response.forEach(function (st) {
                        st.order = ko.observable(st.order);
                        subtasks.push(st);
                    });
                    _this.subtasks.push.apply(_this.subtasks, subtasks);
                }).fail(_this.handleError);
        };

        return ctor;
    });
