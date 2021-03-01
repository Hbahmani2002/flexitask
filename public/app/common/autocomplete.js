define(["require","jquery","typeahead", "bloodhound", "knockout", "exports", "durandal/composition", "common/context", "common/lookups", "config", "common/helpers", "common/utils", "underscore"],
    function (require, $,typeahead, Bloodhound,ko, exports, composition, context, lookupFactory, config, helpers, utils, _) {



        var suggestionEngineCache = {};
        var vm = {

            getSelect2OptionsForProjects: function (max) {
                max = max || 1;

                return {
                    theme:"bootstrap",
                    containerClass: "select2-container-popover",
                    dropdownClass: "select2-dropdown-popover",
                    ajax: {
                        url: config.serviceEndpoints.baseEndpoint + "/api/search/typeahead?type=project",
                        delay: 250,
                        processResults: function (data, page) {
                            return {
                                results: $.map(data, function (item) {
                                    return {
                                        id: item.id,
                                        text: item.name
                                    };
                                })
                            };
                        },
                        data: function (term, page) {
                            return {
                                query: term.term
                            };
                        },
                        cache: true,
                        transport: function (params, success, failure) {
                            params.headers = context.getTokenAsHeader();
                            var $request = $.ajax(params);
                            $request.then(success);
                            $request.fail(failure);
                            return $request;
                        }
                    },
                    onInit: function (selectedValues) {
                        var requests = [];
                        selectedValues.forEach(function (v) {
                            var projectId = v;
                            requests.push($.ajax(String.format(config.serviceEndpoints.baseEndpoint + "/api/search/typeahead/{0}?type=project", projectId), {
                                headers: context.getTokenAsHeader()
                            }));
                        });

                        var defer = $.when.apply($, requests);
                        return defer.then(function () {

                            var args = arguments;
                            var responses = [];
                            if (requests.length === 1) {
                                args = [args];
                            }
                            $.each(args, function (index, response) {
                                var responseData = response[0];
                                responses.push({
                                    text: responseData.name,
                                    id: responseData.id
                                });
                            });

                            return responses;

                        });
                    },
                    width: "style",
                    minimumInputLength: 1,
                    escapeMarkup: function (markup) {
                        return markup;
                    },
                    templateResult: function (selection) {
                        return selection.text;
                    },
                    templateSelection: function (selection) {
                        return selection.text;
                    }
                };
            },
           
            getSelect2OptionsForExpenseTypes: function () {

                return {
                    theme:"bootstrap",
                    containerClass: "select2-container-popover",
                    dropdownClass: "select2-dropdown-popover",
                    ajax: {
                        url: config.serviceEndpoints.baseEndpoint + "/api/search/typeahead?type=expense-type",
                        delay: 250,
                        processResults: function (data, page) {
                            // parse the results into the format expected by Select2.
                            // since we are using custom formatting functions we do not need to
                            // alter the remote JSON data
                            return {
                                results: $.map(data, function (item) {
                                    return {
                                        id: item.id,
                                        text: item.text
                                    };
                                })
                            };
                        },
                        data: function (term, page) {
                            return {
                                query: term.term
                            };
                        },
                        cache: true,
                        transport: function (params, success, failure) {
                            params.headers = context.getTokenAsHeader();
                            var $request = $.ajax(params);
                            $request.then(success);
                            $request.fail(failure);
                            return $request;
                        }
                    },
                    width: "style",
                    escapeMarkup: function (markup) {
                        return markup;
                    },
                    templateResult: function (selection) {
                        return selection.text;
                    },
                    templateSelection: function (selection) {
                        return selection.text;
                    }
                };
            },
            getSelect2OptionsForCollaborators: function (tags) {
                tags = tags || false;
                return {
                    allowClear: true,
                    theme:"bootstrap",
                    maximumSelectionLength: 10,
                    containerClass: "select2-container-collaborators",
                    dropdownClass: "select2-dropdown-collaborators",
                    ajax: {
                        url: config.serviceEndpoints.baseEndpoint + "/api/search/typeahead?type=user",
                        delay: 250,
                        processResults: function (data, page) {
                            return {
                                results: [{
                                    text:"Users",
                                    children: _.map(data.users, function (item) {
                                        return {
                                            id: item.id,
                                            text: item.fullName,
                                            type:"user"
                                        };
                                    })
                                },{
                                    text:"Teams",
                                    children: _.map(data.teams, function (item) {
                                        return {
                                            id: item.id,
                                            text: item.name,
                                            type:"team"
                                        };
                                    })
                                }]
                            };
                        },
                        data: function (term, page) {
                            return {
                                query: term.term
                            };
                        },
                        cache: true,
                        transport: function (params, success, failure) {
                            params.headers = context.getTokenAsHeader();
                            var $request = $.ajax(params);
                            $request.then(success);
                            $request.fail(failure);
                            return $request;
                        }
                    },
                    placeholder: " ",
                    minimumInputLength: 3,

                    width: "style",
                    escapeMarkup: function (markup) {
                        return markup;
                    },
                    templateResult: function (selection) {
                        var user = context.getUserById(selection.id);
                        if (!user) {
                            return selection.text;
                        }
                        selection.text = user.fullName;
                        var $state = $(String.format('<span class="select2-item-user"><div class="avatar avatar-xs avatar-scale"><img style="margin-top:-1px;" class="img-responsive" src="{0}"/></div> {1}</span>', helpers.getAvatarOrDefault(user), user.fullName));
                        return $state;
                    },
                    templateSelection: function (selection) {
                        var user = context.getUserById(selection.id);
                        if (!user) {
                            return selection.text;
                        }
                        selection.text = user.fullName;
                        var $state = $(String.format('<span class="select2-item-user"><div class="avatar avatar-xs avatar-scale"><img style="margin-top:-1px;" class="img-responsive" src="{0}"/></div> {1}</span>', helpers.getAvatarOrDefault(user), user.fullName));
                        return $state;
                    }
                };
            },
            getSelect2OptionsForProjectTags: function (projectId, max) {
                max = max || 1;

                return {
                    theme:"bootstrap",
                    containerClass: "select2-container-popover",
                    dropdownClass: "select2-dropdown-popover",
                    ajax: {
                        url: config.serviceEndpoints.baseEndpoint + "/api/search/typeahead?type=tag&projectId=" + projectId,
                        delay: 250,
                        processResults: function (data, page) {
                            // parse the results into the format expected by Select2.
                            // since we are using custom formatting functions we do not need to
                            // alter the remote JSON data
                            return {
                                results: $.map(data, function (item) {
                                    return {
                                        id: item.value,
                                        text: item.value
                                    };
                                })
                            };
                        },
                        data: function (term, page) {
                            return {
                                query: term.term
                            };
                        },
                        cache: true,
                        transport: function (params, success, failure) {
                            params.headers = context.getTokenAsHeader();
                            var $request = $.ajax(params);
                            $request.then(success);
                            $request.fail(failure);
                            return $request;
                        }
                    },
                    width: "style",
                    tags: true,
                    tokenSeparators: [",", " "],
                    minimumInputLength: 1,
                    escapeMarkup: function (markup) {
                        return markup;
                    },
                    templateResult: function (selection) {
                        return selection.text;
                    },
                    templateSelection: function (selection) {
                        return selection.text;
                    }
                };
            },
            getSelect2OptionsForTags: function () {
                return {
                    containerClass: "select2-container-popover",
                    dropdownClass: "select2-dropdown-popover",
                    theme:"bootstrap",
                    width: "style",
                    tags: true,
                    tokenSeparators: [",", " "],
                    minimumInputLength: 1,
                    escapeMarkup: function (markup) {
                        return markup;
                    },
                    templateResult: function (selection) {
                        return selection.text;
                    },
                    templateSelection: function (selection) {
                        return selection.text;
                    }
                };
            },
            getSelect2OptionsForTasks:function(projectId,max,allowClear){
                max = max || 1;
                if(typeof allowClear === "undefined"){
                    allowClear = true;
                }
                
                var lookups = lookupFactory.create();
                var pId = ko.unwrap(projectId);

                return {
                    allowClear: allowClear,
                    theme:"bootstrap",
                    containerClass: "select2-container-popover",
                    dropdownClass: "select2-dropdown-popover",
                    ajax: {
                        url: config.serviceEndpoints.baseEndpoint + "/api/search/typeahead?type=task&projectId=" + pId,
                        delay: 250,
                        processResults: function (data, page) {
                            return {
                                results: $.map(data, function (item) {
                                    return {
                                        id: item.id,
                                        text: item.name,
                                        task:item
                                    };
                                })
                            };
                        },
                        data: function (term, page) {
                            return {
                                query: term.term
                            };
                        },
                        cache: true,
                        transport: function (params, success, failure) {
                            params.headers = context.getTokenAsHeader();
                            var $request = $.ajax(params);
                            $request.then(success);
                            $request.fail(failure);
                            return $request;
                        }
                    },
                    onInit: function (selectedValues) {
                        var requests = [];
                        selectedValues.forEach(function (v) {
                            var taskId = v;
                            requests.push($.ajax(String.format(config.serviceEndpoints.baseEndpoint + "/api/search/typeahead/{0}?type=task", taskId), {
                                headers: context.getTokenAsHeader()
                            }));
                        });

                        var defer = $.when.apply($, requests);
                        return defer.then(function () {

                            var args = arguments;
                            var responses = [];
                            if (requests.length === 1) {
                                args = [args];
                            }
                            $.each(args, function (index, response) {
                                var responseData = response[0];
                                responses.push({
                                    text: responseData.name,
                                    id: responseData.id
                                });
                            });

                            return responses;

                        });
                    },
                    width: "style",
                    placeholder: " ",
                    minimumInputLength:3,
                    escapeMarkup: function (markup) {
                        return markup;
                    },
                    templateResult: function (selection) {
                        var data = selection.task;
                        if(!data){
                            return selection.text;
                        }
                        var status = lookups.taskStatus.getTextOrDefault(data.status);
                        var user = context.getUserById(data.assignee || "") || {
                            fullName: ""
                        };
                        var userAvatar = helpers.getAvatarOrDefault(user);
                        var fullName = user.fullName;
                        var dueDate = data.dueDate ? utils.formatDate(data.dueDate) : "hidden";

                        return "<div>" +
                                '<div class="media">' +
                                '<div class="media-left">' +
                                '<a class="avatar avatar-sm avatar-scale"  href="javascript:void(0)">' +
                                '<img src="' + userAvatar + '" alt="">' +
                                "</a>" +
                                "</div>" +
                                '<div class="media-body">' +
                                '<small class="pull-right hidden">20 hours ago</small>' +
                                '<h5 class="media-heading">' + data.name + "</h5>" +
                                '<time class="media-meta hidden" datetime="2015-06-12T20:50:48+08:00">5 hours ago</time>' +
                                '<small><span class="' + dueDate + '"">due date: <a class="label label-outline label-default" href="javascript:void(0)" title="">' + dueDate + '</a>,</span> status: <a class="label label-outline label-default" href="javascript:void(0)" title="">' + status + "</a></small>" +
                                "</div>" +
                                "</div>" +
                                "</div>";
                    },
                    templateSelection: function (selection) {
                        if(selection && selection.task){
                            $(selection.element).data("selected", selection.task);
                        }
                       
                        return selection.text;
                    }
                };
            },
            suggestion: function (name, datum, type, parameters, limit) {


                var key = String.format("{0}-{1}", name, utils.toQueryString(parameters));
                var bh = suggestionEngineCache[key];

                if (typeof bh === "undefined" || bh === null) {
                    bh = new Bloodhound({
                        datumTokenizer: Bloodhound.tokenizers.whitespace,
                        queryTokenizer: Bloodhound.tokenizers.whitespace,
                        limit: 100,
                        identify: function (obj) {
                            return obj.id;
                        },
                        remote: {
                            url: config.serviceEndpoints.baseEndpoint + "/api/search/typeahead?type={0}&query={1}",
                            prepare: function (query, settings) {
                                if (parameters) {
                                    settings.url = String.format(settings.url, type, query) + "&" + utils.toQueryString(parameters);
                                } else {
                                    settings.url = String.format(settings.url, type, query);
                                }

                                settings.headers = {
                                    Authorization: "Bearer " + context.authToken()
                                };
                                return settings;
                            }
                        }

                    });
                    bh.initialize(true);


                    suggestionEngineCache[key] = bh;
                }
                return bh;
            }
        };

        vm.searchAllTypeahead = {
            options: {
                hint: true,
                highlight: true,
                minLength: 3,
                name: "full-search"
            },
            datasets: [{
                name: "typeahead-full-search-tasks",
                limit: 100,
                source: vm.suggestion("full-search-tasks", "name", "task").ttAdapter(),
                templates: {
                    header: '<h5 class="typeahead-header text-danger">Tasks</h3>',
                    empty: "",
                    suggestion: _.template([
                        "<p><%=name%> - <%=status.text%></p>",
                        // "<p><small><%=project.name%></small></p>"
                    ]
                        .join(""))
                },
                display: function (o) {
                    return o.name;
                }
            }, {
                name: "typeahead-full-search-projects",
                limit: 100,
                source: vm.suggestion("full-search-projects", "name", "project").ttAdapter(),
                templates: {
                    header: '<h5 class="typeahead-header text-danger">Projects</h3>',
                    empty: "",
                    suggestion: _.template(["<p><%=name%></p>"].join(""))
                },
                display: function (o) {
                    return o.name;
                }
            }, {
                name: "typeahead-full-search-task-tags",

                limit: 100,
                source: vm.suggestion("full-search-task-tags", "name", "tasktags").ttAdapter(),
                templates: {
                    header: '<h5 class="typeahead-header text-danger">Task Tags</h3>',
                    empty: "",
                    suggestion: _.template([
                        "<p><%=name%> - <%=status.text%></p>",
                        // "<p><small><%=project.name%></small></p>"
                    ]
                        .join(""))
                },
                display: function (o) {
                    return o.name;
                }
            }, {
                name: "typeahead-full-search-comment-tags",
                limit: 100,
                source: vm.suggestion("full-search-comment-tags", "name", "commenttags").ttAdapter(),
                templates: {
                    header: '<h5 class="typeahead-header text-danger">Comment Tags</h3>',
                    empty: "",
                    suggestion: _.template([
                        "<p><%=name%> - <%=status.text%></p>",
                        // "<p><small><%=project.name%></small></p>"
                    ]
                        .join(""))
                },
                display: function (o) {
                    return o.name;
                }
            }]
        };
      

        return vm;

    });
