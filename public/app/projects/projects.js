define(["common/prefs", "common/context", "common/lookups", "durandal/events", "durandal/activator", "plugins/http", "durandal/app", "knockout", "jquery", "underscore", "common/utils", "common/helpers"],
    function (prefs, context, lookupFactory, events, activator, http, app, ko, $, _, utils, helpers) {


        function loadProjects(projectVm) {
            var filters = utils.toQueryString(ko.toJS(projectVm.filter));

            var url = String.format("/api/projects?{0}", filters);
            return http.get(url)
                .then(function (response) {

                    _.extendCollection(response.projects, function (p) {
                        return {
                            ownerUser: context.getUserById(p.owner)
                            //projectManagerUser: context.getUserById(p.projectManagerUserId)
                        };
                    });


                    projectVm.projects(response.projects);
                    projectVm.folderTree(response.folderTree);
                });
        }

      

        var ctor = function () {
            var _this = this;
            this.lookups = lookupFactory.create();
            this.utils = utils;
            this.context = context;
            this.helpers = helpers;
            this.prefs = prefs;
            this.filter = {
                includeArchivedProjects: ko.observable(amplify.store("includeArchivedProjects") || false),
                selectedProjectType: ko.observableArray([ "1", "2", "3", "4", "5","6"]).extend({
                    rateLimit: 500
                }), // default 'None' status always
                selectedProjectStatus:ko.observableArray(["0", "1", "2", "4", "8", "16", "32"]).extend({
                    rateLimit: 500
                })
            };



            this.lastProcessedEvent = "";
            this.projects = ko.observableArray([]);
            this.folderTree = ko.observableArray([]);
            this.filter.includeArchivedProjects.subscribe(function (v) {
                amplify.store("includeArchivedProjects", v);
                return loadProjects(_this);
            });

            this.treeOptions = {
                noDragDrop: true
            };
            this.isShowOnlyStarredSelected = ko.observable(amplify.store("projects/isShowOnlyStarredSelected") || false);

            this.isShowOnlyStarredSelectedSubs=this.isShowOnlyStarredSelected.subscribe(function(showOnlyStarredSelected){
                amplify.store("projects/isShowOnlyStarredSelected",showOnlyStarredSelected);
            });


            this.projectsFilteredByStar = ko.computed(function () {
                var cUser = ko.unwrap(_this.context.user);
                var cUserStars = ko.unwrap(cUser.stars);
                var stars = null;
                if (cUserStars) {
                    stars = cUserStars;
                }

                var flattenStars=[];
                flattenStars=_.map(stars,function(s){
                    return s.objectId;
                });

                var filterProjects = _.filter(_this.projects(), function (p) {
                    if (_this.isShowOnlyStarredSelected() === true) {
                        var isProjectInStarList = _.contains(flattenStars, p.id);
                        return isProjectInStarList;
                    }
                    else {
                        return true;
                    }

                });
                return filterProjects;
            });

          this.projectFilterByProjectType = ko.computed(function () {
       
            var projectTypes = _this.filter.selectedProjectType();
            var filterProjects = _.filter(_this.projects(), function (p) {
               
                    var byType = _.contains(projectTypes, p.projectType.toString());
                    return byType;
                
            
              
           

            });
            return filterProjects;
        });

        this.projectFilterByProjectStatus = ko.computed(function () {
       
            var projectStatues = _this.filter.selectedProjectStatus();
            var filterProjects = _.filter(_this.projects(), function (p) {
               
                    var bystatus = _.contains(projectStatues, p.status.toString());
                    return bystatus;
                
            
              
           

            });
            return filterProjects;
        });
    
    };

        ctor.prototype.changeArchiveFilter = function (value) {
            var _this = this;
            _this.filter.archive = value;
            return loadProjects();
        };

        ctor.prototype.getFolderProjects = function (folder) {
            var _this = this;
            if (_this.projects().length == 0)
                return [];
            
                var filterStar = _.filter(_this.projectsFilteredByStar(), function (project) {
                    return project.projectFolderId === folder.id;
                });
                var filterType = _.filter(_this.projectFilterByProjectType(), function (project) {
                    return project.projectFolderId === folder.id;
                }); 
                var filterStatus = _.filter(_this.projectFilterByProjectStatus(), function (project) {
                    return project.projectFolderId === folder.id;
                });
    
               
          
            return  _.intersection(filterStar,filterType,filterStatus);

        };



        ctor.prototype.createNewProject = function () {
            var _this = this;
            ko.postbox.publish("CreateProjectCommand", {
                folderTree: ko.toJS(_this.folderTree)
            });
        };

        ctor.prototype.onProjectsScroll = function (ev, el, scrollTop) {
            var api = $("#projects-header-panel").data("panel-api");

            if (scrollTop > 300) {
                api.hideContent();
            } else if (scrollTop <= 0) {
                api.showContent();
            }
        };

        ctor.prototype.activate = function () {
            return loadProjects(this);
        };


        ctor.prototype.goProjectDetail = function(data) {
            console.log(data)
             window.location= "#/projects/" +  data.id;
          
        }


        ctor.prototype.isTypeFilterInUse = function () {
            var _this = this;
            return _this.filter.selectedProjectType().length === _this.lookups.projectTypes.getAll().length;
        }

        ctor.prototype.isStatusFilterInUse = function () {
            var _this = this;
            return _this.filter.selectedProjectStatus().length === _this.lookups.projectStatus.getAll().length;
        }

        ctor.prototype.attached = function (view) {
            var _this = this;
            _this.context.user;
            $(view).find(".js--expand-all").on("click", function (ev) {
                $(".dd").nestable("expandAll");
            });

            $(view).find(".js--collapse-all").on("click", function (ev) {
                $(".dd").nestable("collapseAll");
            });

            // expand all - collapse all buttons
            $(view).find(".js--expand-all").on("click", function (ev) {
                var key = "projects/tree/";
                $(".dd").nestable("expandAll");
                amplify.store(key, null);
            });
            $(view).find(".js--collapse-all").on("click", function (ev) {
                var key = "projects/tree/";
                $(".dd").nestable("collapseAll");
                var ids = $(".project-item").collect("id");
                amplify.store(key, ids);
            });

             $(view).off("click").on("click", ".task-link,.dd2-content", function (event) { // click event


                return true;
             });



            $("#archive-filter li a").click(function (event) {
                event.preventDefault();
                var $this = $(this);
                var target = $($this.parent().parent().data("selected-text-selector"));
                target.text($this.text());
                var v = $this.data("filter");
                changeArchiveFilter(v);

            });
        };

        return ctor;
    });
