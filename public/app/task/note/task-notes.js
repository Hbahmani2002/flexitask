define(["common/context", "durandal/events", "common/helpers", "i18n", "plugins/dialog", "plugins/http", "durandal/composition", "common/notifications", "durandal/app", "knockout", "common/errorhandler", "underscore", "common/utils"],
    function (context, events, helpers, i18n, dialog, http, composition, notifications, app, ko, errorhandler, _, utils) {

        var ctor = function () {
            var _this = this;
            errorhandler.includeIn(this);
            this.taskId = null;
            this.projectId = null;
            this.notes = ko.observableArray([]);
            this.sortedNotes = ko.computed(function () {
                var r = _.sortBy(_this.notes(), function (a) {
                    return a.createdAt;
                });
                r = r.reverse();
                return r;
            });
            this.editingAttachment = ko.observable();
            this.context = context;
            this.helpers = helpers;
            this.utils = utils;

            this.subscriptions = [];
            this.subscriptions.push(ko.postbox.subscribe("NewNoteAdded", function (note) {
                _this.notes.push(note);
                _this.showNote(note, {
                    loadVersions: false
                });
            }));
            _this.subscriptions.push(ko.postbox.subscribe("NoteUpdated", function (note) {
                _this.showNote(note, {
                    loadVersions: true
                });
            }));

        };


        ctor.prototype.activate = function (settings) {
            var _this = this;
            _this.taskId = settings.taskId || null;
            _this.projectId = settings.projectId || null;

            return _this.loadNotes();
        };

        ctor.prototype.deactivate = function (close) {
            var _this = this;

            _.each(_this.subscriptions, function (subscriber) {
                subscriber.dispose();
            });
        };

        ctor.prototype.deleteNote = function (note) {
            var _this = this;
            notifications.confirm({
                title: i18n.t("app:pages.note.promptdeletenoteheader"),
                text: i18n.t("app:pages.note.promptdeletenote"),
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: "Delete",
                cancelButtonText: "Cancel",
                closeOnConfirm: true,
                closeOnCancel: true
            },
            function (isConfirm) {
                if (isConfirm) {
                    var noteId = ko.unwrap(note.noteId);
                    var url = String.format("/api/tasks/{0}/notes/{1}", _this.taskId, noteId);
                    return http.delete(url)
                    .then(function (response) {
                        _this.notes.remove(note);
                    }).fail(_this.handleError);
                }
            });
        };


        ctor.prototype.loadNotes = function () {
            var _this = this;
            var url = String.format("/api/tasks/{0}/notes", _this.taskId);
            return http.get(url)
            .then(function (response) {
                _this.notes([]);
                var notes = [];
                response.data.forEach(function (note) {
                    _this.createNoteModel(note);
                    notes.push(note);
                });
                _this.notes.push.apply(_this.notes, notes);
            }).fail(_this.handleError);
        };

        ctor.prototype.createNoteModel = function (note) {
            note.noteId = note.noteId;
            note.body = ko.revertableObservable(note.body || "");
            note.name = ko.revertableObservable(note.name).extend({
                required: true
            });
            note.description = ko.revertableObservable(note.description);
            note.versions = ko.observableArray([]);
            note.errors = ko.validation.group(note);
            note.edit = false;
            note.createdAt = note.createdAt;
            note.author = context.getUserById(note.author);
            note.version = ko.observable(note.version || 0);
            note.reset = function () {
                note.name.revert();
                note.body.revert();
                note.description.revert();
                note.dirtyFlag().reset();
            };
            note.commit = function () {
                note.name.commit();
                note.body.commit();
                note.description.commit();
                note.dirtyFlag().reset();
                note.version(note.version() + 1);
            };

            note.dirtyFlag = new ko.DirtyFlag([note.name, note.description, note.body]);
            note.isDirty = function () {
                return note.dirtyFlag().isDirty();
            };
        };

        ctor.prototype.newNote = function () {
            var _this = this;
            var note = {
                author: context.user().id,
                createdAt: utils.now()
            };
            _this.createNoteModel(note);
            note.edit = true;
            _this.showNoteEditModal(note);
        };

        ctor.prototype.showNoteEditModal = function (note) {
            var _this = this;

            var noteEditModalVm = {

                helpers: helpers,
                errorHandler: _this.handleError,
                taskId: _this.taskId,
                utils: utils,
                viewUrl: "task/note/task-note-edit-modal",
                note: note,
                context: _this.context,
                cancel: function () {
                    var modal = this;
                    dialog.close(modal);
                },
                loadVersion: function (version) {
                    var modal = this;
                    var url = String.format("/api/tasks/{0}/notes/{1}/entries/{2}", modal.taskId, modal.note.noteId, version.id);
                    return http.get(url)
                    .then(function (response) {
                        modal.note.body(response.body);
                    }).fail(modal.errorHandler);
                },
                activate: function () {
                    var modal = this;
                    if (modal.note.noteId) {
                        var url = String.format("/api/tasks/{0}/notes/{1}", modal.taskId, modal.note.noteId);
                        return http.get(url)
                        .then(function (response) {
                            modal.note.body(response.body);
                            modal.note.dirtyFlag().reset();
                            modal.note.versions([]);
                            modal.note.versions.push.apply(modal.note.versions, response.versions);
                        }).fail(modal.errorHandler);
                    }
                },
                save: function () {
                    var modal = this;
                    if (modal.note.errors().length > 0) {
                        modal.note.errors.showAllMessages();
                        return;
                    }

                    var input = {
                        description: modal.note.description(),
                        name: modal.note.name(),
                        body: modal.note.body()
                    };
                    if (modal.note.noteId) { // edit mode
                        var url = String.format("/api/tasks/{0}/notes/{1}", modal.taskId, modal.note.noteId);
                        http.put(url, input).then(function (response) {
                            modal.note.commit();
                            ko.postbox.publish("NoteUpdated", modal.note);
                            dialog.close(modal);
                        }).fail(function () {}).fail(modal.errorHandler);
                    } else {
                        // new record
                        var url = String.format("/api/tasks/{0}/notes", modal.taskId);
                        http.post(url, input).then(function (response) {
                            modal.note.commit();
                            delete modal.note.edit;
                            modal.note.noteId = response.noteId;
                            ko.postbox.publish("NewNoteAdded", modal.note);
                            dialog.close(modal);
                        }).fail(modal.errorHandler);
                    }
                },
                canDeactivate: function () {
                    var modal = this;
                    if (modal.note.isDirty()) {
                        var defer = $.Deferred();
                        notifications.confirm({
                            title: i18n.t("app:pages.note.promptunsavedheader"),
                            text: i18n.t("app:pages.note.promptunsaved"),
                            type: "warning",
                            showCancelButton: true,
                            confirmButtonColor: "#DD6B55",
                            confirmButtonText: "Discard changes",
                            cancelButtonText: "Stay on this page",
                            closeOnConfirm: true,
                            closeOnCancel: true
                        },
                        function (isConfirm) {
                            if (isConfirm) {
                                modal.note.reset();
                                defer.resolve(true);
                            }

                            defer.reject(false);
                        });
                        return defer.promise();
                    }
                    return true;
                },
                deactivate: function (close) {}
            };

            return dialog.showBsModal(noteEditModalVm);
        };

        ctor.prototype.showNote = function (note, settings) {
            var _this = this;

            var noteModalVm = {

                helpers: helpers,
                errorHandler: _this.handleError,
                taskId: _this.taskId,
                viewUrl: "task/note/task-notes-modal",
                note: note,
                context: _this.context,
                utils: utils,
                edit: function () {
                    var modal = this;
                    dialog.close(modal, {
                        showEditModal: true
                    });
                },
                loadVersion: function (version) {
                    var modal = this;
                    var url = String.format("/api/tasks/{0}/notes/{1}/entries/{2}", modal.taskId, modal.note.noteId, version.id);
                    return http.get(url)
                    .then(function (response) {
                        modal.note.body(response.body);
                    }).fail(modal.errorHandler);
                },
                save: function () {
                    var modal = this;
                    if (modal.note.errors().length > 0) {
                        modal.note.errors.showAllMessages();
                        return;
                    }

                    var input = {
                        body: modal.note.body(),
                        description: modal.note.description(),
                        name: modal.note.name()
                    };

                    var url = String.format("/api/tasks/{0}/notes/{1}/body", modal.taskId, modal.note.noteId);
                    http.put(url, input).then(function (response) {
                        modal.note.commit();
                    }).fail(function () {

                    }).fail(modal.errorHandler);
                },
                cancel: function () {
                    var modal = this;
                    dialog.close(modal);
                },
                activate: function (settings) {
                    var modal = this;
                    settings = settings || {};
                    settings.loadVersions = typeof settings.loadVersions === "undefined" ? true : settings.loadVersions;
                    if (settings.loadVersions) {
                        if (modal.note.noteId) {
                            var url = String.format("/api/tasks/{0}/notes/{1}", modal.taskId, modal.note.noteId);
                            return http.get(url)
                            .then(function (response) {
                                modal.note.body(response.body);
                                modal.note.dirtyFlag().reset();
                                modal.note.versions([]);
                                modal.note.versions.push.apply(modal.note.versions, response.versions);
                            }).fail(modal.errorHandler);
                        }
                    }

                    return true;
                },
                attached: function (view) {
                    var modal = this;
                },

                deactivate: function (close) {}
            };

            return dialog.showBsModal(noteModalVm, settings).then(function (res) {
                if (res && res.showEditModal) {
                    window.setTimeout(function(){
                        _this.showNoteEditModal(note);
                    },300);
                }
            });
        };

        return ctor;

    });
