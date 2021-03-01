define(["common/autocomplete","durandal/system", "common/lookups", "common/context", "common/helpers", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (autocomplete, system,lookupFactory, context, helpers, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {


        ko.subscribable.fn.field = function (options) {


            if (options) {
                this.label = options.label;
                this.type = options.type || "input";
            }

            return this;
        };

        function CustomFieldModel(data) {
            var lookups = lookupFactory.create();
            data = data || {};
            var _this = this;
            this.id = data.id;
            this.title = ko.revertableObservable(data.title).extend({
                required: true
            });
            this.includeReports = ko.revertableObservable(data.includeReports || false);
            this.defaultValue = ko.revertableObservable(data.defaultValue);
            this.description = ko.revertableObservable(data.description).extend({
                maxLength: 100
            });
            this.addAutomatically = ko.revertableObservable(data.addAutomatically);
            this.type = ko.revertableObservable(data.type);
            this.attributes = ko.revertableObservable(data.type);
            this.useDefaultValue = ko.revertableObservable(data.defaultValue);

            this.copy = ko.observable(false);
            this.canUseDefaultValue = ko.computed(function () {
                var dataType = lookups.customFieldTypes.get(_this.type());
                if (!dataType) {
                    return false;
                }
                return dataType.canUseDefaultValue || false;
            });
            this.typeAsText = ko.pureComputed(function () {
                var dataType = lookups.customFieldTypes.get(_this.type());
                if (!dataType) {
                    return "";
                }
                return dataType.text;
            });

            this.sourceProjectId = data.sourceProjectId;
            this.projects = data.projects;

            function initAttributes(v, data) {
                function getValueOrDefault(func) {
                    if (data && data.attributes) {
                        return func(data.attributes);
                    }

                    return undefined;
                }

                var dataType = lookups.customFieldTypes.get(_this.type());
                if (dataType === lookups.customFieldTypes.NUMBER) {
                    _this.attributes({
                        minValue: ko.revertableObservable(getValueOrDefault(function (att) {
                            return att.minValue;
                        })).field({
                            label: i18n.t("app:pages.customFieldModule.minValue")
                        }).extend({
                            number: true
                        }),
                        maxValue: ko.revertableObservable(getValueOrDefault(function (att) {
                            return att.maxValue;
                        })).field({
                            label: i18n.t("app:pages.customFieldModule.maxValue")
                        }).extend({
                            number: true
                        })
                    });
                } else if (dataType === lookups.customFieldTypes.DROPDOWN) {
                    _this.attributes({
                        values: ko.revertableObservable(getValueOrDefault(function (att) {
                            return att.values && att.values.join("\n");
                        })).field({
                            label: i18n.t("app:pages.customFieldModule.values"),
                            type: "textarea"
                        }).extend({
                            required: true
                        })
                    });
                } else {
                    _this.attributes(null);
                }
            }

            this.errors = ko.validation.group(this);
            this.type.subscribe(function (v) {
                initAttributes(v, data);
            });


            if (this.id) {
                initAttributes(this.type(), data);
                _this.attributes.commit(); // fake
            }


            this.reset = function () {
                _this.title.revert();
                _this.description.revert();
                _this.defaultValue.revert();
                _this.useDefaultValue.revert();
                _this.attributes.revert();

                var attributesKeys = _.keys(_this.attributes());
                _.each(attributesKeys, function (key) {
                    _this.attributes()[key].revert();
                });
                _this.type.revert();
                _this.addAutomatically.revert();
                _this.includeReports.revert();
                _this.dirtyFlag().reset();
            };
            this.commit = function () {
                _this.title.commit();
                _this.description.commit();
                _this.defaultValue.commit();
                _this.useDefaultValue.commit();
                _this.attributes.commit();
                _this.type.commit();
                _this.addAutomatically.commit();
                _this.includeReports.commit();
                _this.dirtyFlag().reset();
            };

            this.dirtyFlag = new ko.DirtyFlag([this]);
            this.isDirty = function () {
                return _this.dirtyFlag().isDirty();
            };

        }

        var ctor = function () {
            var _this = this;
            errorhandler.includeIn(this);
            this.i18n = i18n;
            this.projectId = null;
            this.context = context;
            this.helpers = helpers;
            this.customFields = ko.observableArray([]).publishOn("CustomFieldsChanged");
            this.linkCustomFields = ko.observable(true);
            this.subscriptions = [];
            this.subscriptions.push(ko.postbox.subscribe("NewCustomFieldAdded", function (cf) {
                _this.customFields.push(cf);
            }));

        };

        ctor.prototype.canEditOrDeleteCustomField = function (cf) {
            var _this = this;
            return cf.sourceProjectId === _this.projectId;
        };


        ctor.prototype.editCustomField = function (customField) {
            var _this = this;
            _this.showEditModal(customField);
        };

        ctor.prototype.duplicateCustomFields = function () {
            var _this = this;
            system.acquire("project/custom-fields/project-module-custom-fields-duplicate-modal").then(function (vm) {
                var modal = new vm( _this.projectId);
                dialog.showBsModal(modal);
            });
        };

        ctor.prototype.deleteCustomField = function (customField) {
            var _this = this;
            notifications.confirm({
                title: i18n.t("app:pages.customFieldModule.deleteCustomFieldTitle"),
                text: i18n.t("app:pages.customFieldModule.deleteCustomFieldText"),
                type: "error",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: i18n.t("app:pages.customFieldModule.deleteCustomFieldConfirm"),
                cancelButtonText: i18n.t("app:pages.customFieldModule.deleteCustomFieldCancel"),
                closeOnConfirm: true,
                closeOnCancel: true
            },
                function (isConfirm) {
                    if (isConfirm) {
                        var customFieldId = ko.unwrap(customField.id);
                        var url = String.format("/api/projects/{0}/custom-fields/{1}", _this.projectId, customFieldId);
                        return http.delete(url)
                            .then(function (response) {
                                _this.customFields.remove(customField);
                                ko.postbox.publish("CustomFieldsUpdated", {
                                    customFieldId: customField
                                });
                            }).fail(_this.handleError);
                    }
                });
        };

        ctor.prototype.detachCustomField = function (customField) {
            var _this = this;
            notifications.confirm({
                title: i18n.t("app:pages.customFieldModule.detachCustomFieldTitle"),
                text: i18n.t("app:pages.customFieldModule.detachCustomFieldText"),
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: i18n.t("app:pages.customFieldModule.detachCustomFieldConfirm"),
                cancelButtonText: i18n.t("app:pages.customFieldModule.detachCustomFieldCancel"),
                closeOnConfirm: true,
                closeOnCancel: true
            },
                function (isConfirm) {
                    if (isConfirm) {
                        var customFieldId = ko.unwrap(customField.id);
                        var url = String.format("/api/projects/{0}/custom-fields/{1}/link", _this.projectId, customFieldId);
                        return http.delete(url)
                            .then(function (response) {
                                _this.customFields.remove(customField);
                                ko.postbox.publish("CustomFieldsUpdated", {
                                    customFieldId: customField
                                });
                            }).fail(_this.handleError);
                    }
                });
        };

        ctor.prototype.newCustomField = function () {
            var _this = this;
            _this.showEditModal(new CustomFieldModel());
        };

        ctor.prototype.showEditModal = function (model) {
            var _this = this;
            var vm = {

                helpers: helpers,
                lookups: lookupFactory.create(),
                errorHandler: _this.handleError,
                taskId: _this.taskId,
                utils: utils,
                viewUrl: "project/custom-fields/project-module-custom-fields-edit-modal",
                record: model,
                context: _this.context,
                projectId: _this.projectId,
                cancel: function () {
                    var modal = this;
                    // modal.record.reset();
                    dialog.close(modal);
                },
                saveCustomField: ko.asyncCommand({
                    execute: function (callback) {
                        var modal = this;
                        var model = modal.record;
                        if (model.errors().length > 0) {
                            model.errors.showAllMessages();
                            callback();
                            return;
                        }

                        var data = ko.toJS(model);
                        if (data.id) {
                            // update the custom field
                            var url = String.format("/api/projects/{0}/custom-fields/{1}", modal.projectId, data.id);
                            return http.put(url, data)
                                .then(function (response) {
                                    model.commit();
                                    dialog.close(modal, {notify: true, customFieldId: data.id});
                                }).fail(_this.handleError).always(function () {
                                    callback();
                                });
                        } else {
                            // new custom field
                            var url = String.format("/api/projects/{0}/custom-fields", modal.projectId);
                            return http.post(url, data)
                                .then(function (response) {
                                    model.id = response.customFieldId;
                                    modal.sourceProjectId = modal.projectId;
                                    model.commit();


                                    dialog.close(modal, {notify: true, customFieldId: model.id});
                                }).fail(_this.handleError).always(function () {
                                    callback();
                                });
                        }
                    },
                    canExecute: function (isExecuting) {
                        return !isExecuting;
                    }
                }),
                canDeactivate: function () {
                    var modal = this;
                    if (modal.record.isDirty()) {
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
                                    modal.record.reset();
                                    return defer.resolve(true);
                                }

                                return defer.reject(false);
                            });
                        return defer.promise();
                    }
                    return true;
                }
            };
            dialog.showBsModal(vm).then(function (res) {
                if (res && res.notify && res.customFieldId) {
                    ko.postbox.publish("CustomFieldsUpdated", {
                        customFieldId: res.customFieldId
                    });
                }

            });
        };

        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.projectId = settings.projectId;
            _this.customFields.removeAll();

            var url = String.format("/api/projects/{0}/custom-fields", _this.projectId);
            return http.get(url)
                .then(function (response) {
                    _this.customFields([]);
                    var customFields = [];
                    response.forEach(function (cf) {
                        // createNoteModel(note);
                        var model = new CustomFieldModel(cf);

                        // cf.copy = ko.observable(false);
                        customFields.push(model);
                    });
                    _this.customFields.push.apply(_this.customFields, customFields);
                }).fail(_this.handleError);
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;
            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };

        return ctor;

    });
