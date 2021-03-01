define(function (require) {

    var router = require("plugins/router");
    var http = require("plugins/http");
    var app = require("durandal/app");
    var system = require("durandal/system");
    var dialog = require("plugins/dialog");
    var i18n = require("i18n");

    var config = require("config");
    var $ = require("jquery");
    var _ = require("underscore");
    var ko = require("knockout");

    var auth = require("common/auth");
    var context = require("common/context");
    var errorhandler = require("common/errorhandler");
    var utils = require("common/utils");

    var autocomplete = require("common/autocomplete");
    var markdownBindingHandler = require("common/markdownBindingHandler");
    var markdownEditorBindingHandler = require("common/markdownEditorBindingHandler");

    var panelActionsBindingHandler = require("common/panelActionsBindingHandler");
    var NumberFormatBindingHandler = require("common/numberFormatBindingHandler");
    var treeBindingHandler = require("common/treeBindingHandler");
    var datetimepickerHandler = require("common/datetimepickerBindingHandler");
    var initialBindingHandler = require("common/initialBindingHandler");
    var customScrollbarBindingHandler = require("common/customScrollbarBindingHandler");
    var fileUploaderBindingHandler = require("common/FileUploadBindingHandler");
    var select2BindingHandler = require("common/Select2BindingHandler");
    var notifier = require("common/notifier");
    var prefs = require("common/prefs");
    var lookupFactory = require("common/lookups");
    var superShell = require("layout/super_shell");
    var remark = require("layout/remark");

    

    var shell = function () {
        var _this = this;

        errorhandler.includeIn(this);
       
        this.lookups = lookupFactory.create();
        this.router = router;
        this.config = config;
       
        this.isInitialized = ko.observable(false);
        this.autocomplete = autocomplete;
        this.showNavbar = ko.computed(function () {
            return context.user() && context.user().id.length > 0;
        });
        this.searchAutocomplete = autocomplete.searchAllTypeahead;
        this.prefs = prefs;
        this.context = context;
        this.mobilePageViewEnabled = ko.observable(false);
        this.previousPageScrollYPosition = null;
        this.previousPageRoute = null;
        this.activePage = ko.observable(false);
        this.signalRInitialized = false;
        this.isNavigating = ko.observable(false);
        this.activeHash = ko.computed(function () {
            var active = _this.router.activeInstruction();
            if (!active || !active.config.isActive()) {
                return "";
            }

            return active.config.hash;
        }).extend({
            rateLimit: 500
        });
        this.languages = _this.lookups.languages;
        this.forceReload = false;

        this.isIpad = function () {
            return utils.browser.getOrientation() === "portrait" && utils.browser.isIpad();
        };

        this.logout = function () {
            superShell.logout().then(function () {

                auth.logout(_this.router);
            })
        };

        this.isSelectedLanguage = function (language) {
            var currentLang = _this.prefs.lang();
            return currentLang === language.lang;
        };

        this.changeLanguage = function (language) {
            prefs.changeLang(language.lang)
                .then(function () {
                    superShell.login().then(function () {
                        router.navigate("#activities");
                    });
                });
        };

        this.navigateToBack = function () {
            // todo: navigation
            ko.postbox.publish("StartBackNavigation");
        };

        this.searchItemSelected = function (event, suggestion) {
            if (suggestion) {

                var isTask = suggestion.projectId || false;
                if (isTask) {
                    router.navigate(String.format("#projects/{0}/tasks/{1}", suggestion.projectId, suggestion.id), {
                        replace: true,
                        trigger: true
                    });
                } else {
                    router.navigate(String.format("#projects/{0}", suggestion.id), {
                        replace: true,
                        trigger: true
                    });
                }
                // clear after selected
                return true;
            }
            return false;
        };




        markdownBindingHandler.install();
        markdownEditorBindingHandler.install();
        panelActionsBindingHandler.install();
        NumberFormatBindingHandler.install();
        treeBindingHandler.install();
        datetimepickerHandler.install();
        initialBindingHandler.install();
        customScrollbarBindingHandler.install();
        fileUploaderBindingHandler.install();
        select2BindingHandler.install();

        var modalLoading = false;


        function setTitle(title) {
            var instruction = router.activeInstruction();

            if (app.title) {
                document.title = title + " | " + app.title;
            } else {
                document.title = title;
            }


        }

        var debouncedCreateTaskHandler = _.debounce(function (parameters) {
            if (modalLoading) {
                return;
            }

            if ($("div[data-view='task/task-create-modal']").length > 0) {
                modalLoading = false;
                return;
            }

            modalLoading = true;
            return system.acquire("task/task-create-modal")
                .then(function (taskCreateVm) {
                    var instance = new taskCreateVm();
                    return dialog.showBsModal(instance, parameters);
                }).always(function () {
                    modalLoading = false;
                });
        }, 250);

        ko.postbox.subscribe("CreateTaskCommand", debouncedCreateTaskHandler);

        ko.postbox.subscribe("CreateProjectCommand", function (parameters) {
            return system.acquire("project/project-create-modal")
                .then(function (projectCreateVm) {
                    var instance = new projectCreateVm();
                    return dialog.showBsModal(instance, parameters);
                });
        }, this);

        ko.postbox.subscribe("UserNotLoaded", function () {
            return _this.logout();
        }, this);

        ko.postbox.subscribe("UserSettingsChanged", function (ev) {
            $.ajax(config.serviceEndpoints.userInfoWithSearchUrl, {
                cache: false,
                headers: context.getTokenAsHeader()
            }).then(function (data) {
                if (data.userName) {
                    context.setUser(data);
                }
            }).fail(_this.handleError);
        }, this);

        ko.postbox.subscribe("TaskWindowLoaded", function () {
            window.setTimeout(function () {
                modalLoading = false;
            }, 100);
        }, this);




        ko.postbox.subscribe("CustomFieldsUpdated", function (ev) {
            var id = ev.customFieldId;
            window.setTimeout(function () {
                _this.loadCustomFields();
            }, 500);
            return;
        }, this);

        ko.postbox.subscribe("TaskActivated", function (ev) {
            setTitle(ev.taskName);
            _this.activePage({
                type: "Task",
                parameters: ev
            });
            if (utils.browser.isXsMobileScreen()) {
                _this.mobilePageViewEnabled(true);
                var el = $(".left-column");

                _this.previousPageScrollYPosition = $(window).scrollTop();
                _this.previousPageRoute = router.activeInstruction();
                el.hide();
            }
        }, this);

        ko.postbox.subscribe("DashboardActivated", function (ev) {
            setTitle("Dashboard");
            _this.activePage({
                type: "Dashboard",
                parameters: ev
            });
            if (utils.browser.isXsMobileScreen()) {
                _this.mobilePageViewEnabled(true);
                var el = $(".left-column");

                _this.previousPageScrollYPosition = $(window).scrollTop();
                _this.previousPageRoute = router.activeInstruction();
                el.hide();
            }
        }, this);


        ko.postbox.subscribe("ProjectActivated", function (ev) {
            _this.activePage({
                type: "Project",
                parameters: ev
            });
            if (utils.browser.isXsMobileScreen()) {
                _this.mobilePageViewEnabled(true);
                var el = $(".left-column");

                _this.previousPageScrollYPosition = $(window).scrollTop();
                _this.previousPageRoute = router.activeInstruction();
                el.hide();
            }
        }, this);

        ko.postbox.subscribe("BackNavigationCompleted", function (ev) {
            if (utils.browser.isXsMobileScreen()) {
                _this.mobilePageViewEnabled(false);
                _this.activePage(null);
                var el = $(".left-column");
                el.show();
                $("html,body").animate({
                    scrollTop: _this.previousPageScrollYPosition
                }, "slow");
            }
        }, this);

        var debouncedResizeFunc = _.debounce(function (ev) {
            if (!_this.activePage()) {
                return;
            }
            var el;
            if (utils.browser.isXsMobileScreen()) {
                _this.prefs.safeColumnSizes();
                if (_this.mobilePageViewEnabled()) {

                    return;
                }
                _this.mobilePageViewEnabled(true);
                el = $(".left-column");
                var elRight = $(".right-column");
                _this.previousPageScrollYPosition = $(window).scrollTop();
                el.hide();
                elRight.show();

            } else {
                if (!_this.mobilePageViewEnabled()) {
                    return;
                }
                _this.mobilePageViewEnabled(false);
                el = $(".left-column");
                el.show();

                $("html,body").animate({
                    scrollTop: _this.previousPageScrollYPosition
                }, "slow");

                _this.prefs.restoreColumnSizes();
            }
        }, 300);
        $(window).resize(debouncedResizeFunc);
    }

   

    shell.prototype.canActivate = function (args) {
        return true;
    };

    shell.prototype.activate = function (args) {
        var _this = this;

        router.reset();
        router.deactivate();
        router.guardRoute = function (instance, instruction) {
            if (sessionStorage.redirectTo) {
                var redirectTo = sessionStorage.redirectTo;
                sessionStorage.removeItem("redirectTo");
                return redirectTo;
            }

            if (!instruction.config.authorize) {
                return true;
            }

            if (!context.user()) {
                // not authenticate
                return "/account/login?returnUrl=" + encodeURIComponent(instruction.fragment);
            }

            if (context.user().hasRole(instruction.config.authorize) === false) {
                // not authorize
                return "/account/login?returnUrl=" + encodeURIComponent(instruction.fragment);
            }

            return true;
        };

        router
            .map([{
                route: "",
                moduleId: "activity/activities",
                nav: true,
                authorize: ["DEFAULT"]
            },
            {
                route: "activities",
                moduleId: "activity/activities",
                nav: true,
                authorize: ["DEFAULT"]
            },
            {
                route: "profile",
                moduleId: "profile/index",
                nav: true,
                authorize: ["DEFAULT"]
            },
            {
                route: "stars",
                moduleId: "profile/stars",
                nav: true,
                authorize: ["DEFAULT"]
            },
            {
                route: "search",
                moduleId: "search/search",
                nav: true,
                authorize: ["DEFAULT"],
                hash: "#search"
            },
            {
                route: "favorites",
                moduleId: "favorite/favorites",
                nav: true,
                authorize: ["DEFAULT"]
            },
            {
                route: "projects",
                moduleId: "projects/projects",
                nav: true,
                authorize: ["DEFAULT"]
            },
            {
                route: "projects/:id",
                hash: "#projects",
                moduleId: "project/project",
                title: "Project",
                nav: true,
                authorize: ["DEFAULT"]
            },
            {
                route: "projects/:id/tasks/:taskId",
                hash: "#projects",
                moduleId: "project/project",
                title: "Project",
                nav: true,
                authorize: ["DEFAULT"]
            }
            ])
            .buildNavigationModel()
            .mapUnknownRoutes("activity/activities", "activities");




        // Show progress whenever we navigate.
        router.isNavigating.subscribe(function (isNavigating) {
            _this.isNavigating(isNavigating);
            return _this.showNavigationProgress(isNavigating);
        });

        router.on("router:navigation:attached", function (ev) {
            if (utils.browser.isXsMobileScreen()) {
                var btnToggleLeftMenu = $("#btn-toggle-left-menu");
                if (btnToggleLeftMenu.hasClass("unfolded") && btnToggleLeftMenu.hasClass("hided") === false) {
                    btnToggleLeftMenu.click();
                }
                var btnToggleSubNavbar = $("#btn-toggle-sub-navbar");
                if (btnToggleSubNavbar.hasClass("collapsed") === false) {
                    btnToggleSubNavbar.click();
                }


            }
            _this.activePage(null);
        });

        router.on("router:navigation:cancelled", function () {
            return _this.showNavigationProgress(false);
        });

        window.setTimeout(_this.setupSignalR, 1500);

        return _this.connectToServer();
    };

    shell.prototype.deactivate = function (close) {
        var _this = this;
        _this.router.reset();
        _this.router.deactivate();
        $.site = null;
        return true;
    };

    shell.prototype.detached = function () {

    };

    shell.prototype.canDeactivate = function (close) {
        return true;
    };

    shell.prototype.registerOneSignal = function () {
        var _this = this;
        if (!config.useOneSignal) {
            return;
        }
      
        var settings = {
            // httpPermissionRequest: {
            //     enable: true
            // },
            // autoRegister: true,
            // welcomeNotification: {
            //     disable: false,
            //     title: "FlexiTask",
            //     message: "Push bildirimleri etkinleştirildi."
            // },
            // promptOptions: {
            //     actionMessage: "size bildirim göndermek istiyor:",
            //     // exampleNotificationTitleDesktop: "Örnek bildirim",
            //     // exampleNotificationMessageDesktop: "Video: Haftalık Gündem Değerlendirmesi",
            //     // exampleNotificationTitleMobile: "Örnek bildirim",
            //     // exampleNotificationMessageMobile: "Video: Haftalık Gündem Değerlendirmesi",
            //     // exampleNotificationCaption: "(bildirimleri istediğiniz zaman kapatabilirsiniz)",
            //     acceptButtonText: "Devam et",
            //     cancelButtonText: "İstemiyorum"
            // },
            // persistNotification: false
            // path: "/assets/vendor/onesignal/"

        };
        settings = $.extend(true, settings, config.onesignal)
        OneSignal.push(["init", settings]);

        //Firstly this will check user id 
        OneSignal.push(function () {
            OneSignal.getUserId().then(function (userId) {
                if (userId == null) {
                    context.user().subscribedToOneSignal(false);
                } else {
                    context.user().oneSignalUserAgentId = userId;
                    context.user().subscribedToOneSignal(true);

                    OneSignal.push(["getNotificationPermission", function (permission) {

                    }]);
                    OneSignal.getSubscription(function (notOptedOut) {

                    });
                    OneSignal.isPushNotificationsEnabled(function (isEnabled) {
                        if (isEnabled) {
                            context.user().subscribedToOneSignal(true);

                            var s = _.find(context.user().notificationSubscriptions(), function (s) {
                                return s.token === context.user().oneSignalUserAgentId;
                            });
                            if (!s) {
                                var url = String.format("/api/users/{0}/notifications", context.user().id);
                                http.post(url, {
                                    provider: "onesignal",
                                    token: context.user().oneSignalUserAgentId,
                                    device: _this.getDevice()
                                }).then(function (response) {
                                    ko.postbox.publish("UserSettingsChanged", {});
                                }).fail(_this.handleError);
                            }
                        } else {
                            context.user().subscribedToOneSignal(false);

                            var url2 = String.format("/api/users/{0}/notifications/{1}", context.user().id, context.user().oneSignalUserAgentId);
                            http.delete(url2).then(function (response) {
                                ko.postbox.publish("UserSettingsChanged", {});
                            }).fail(_this.handleError);

                        }
                    });
                }
            });
        });
        //Secondly this will check when subscription changed
        OneSignal.push(function () {
            OneSignal.on("subscriptionChange", function (isSubscribed) {
                if (isSubscribed == true) {
                    OneSignal.getUserId()
                        .then(function (userId) {
                            context.user().oneSignalUserAgentId = userId;
                            OneSignal.sendTag("ft-user-id", context.user().id);
                        }).then(function () {
                            var url = String.format("/api/users/{0}/notifications", context.user().id);
                            http.post(url, {
                                provider: "onesignal",
                                token: context.user().oneSignalUserAgentId,
                                device: _this.getDevice()
                            }).then(function (response) {
                                ko.postbox.publish("UserSettingsChanged", {});
                            }).fail(_this.handleError);
                        });

                    context.user().subscribedToOneSignal(true);
                } else if (isSubscribed == false) {
                    OneSignal.getUserId().then(function (userId) {
                        context.user().oneSignalUserAgentId = userId;
                        var url = String.format("/api/users/{0}/notifications/{1}", context.user().id, context.user().oneSignalUserAgentId);
                        http.delete(url).then(function (response) {
                            ko.postbox.publish("UserSettingsChanged", {});
                        }).fail(_this.handleError);
                    });

                    context.user().subscribedToOneSignal(false);
                } else {
                    console.log("Unable to process the request");
                }
            });
        });
    };



    shell.prototype.getDevice = function () {
        var d = utils.browser.getClientType();
        if (d === "tablet" || d === "mobile") {
            return "mobile";
        }
        return d;
    }

   
    shell.prototype.attached = function (view) {
        var _this = this;

        _this.registerOneSignal();
        _this.addFacebookPlugin();
        _this.addTwitterPlugin();
        

        $("body").addClass("activated")
            .removeClass("body-outside-shell")
            .addClass("site-menubar-fold")
            .addClass("site-menubar-keep");

        remark.init();
        notifier.init();

        $(document).offOn("click", ".dropdown-menu", function (e) {
            if ($(e.target).hasClass(".select2-item-user")) {
                return;
            }
            if ($(this).hasClass("js--prevent-close") || $(e.target).hasClass("js--prevent-close") || $(e.target).parents(".js--prevent-close").length > 0)
                e.stopPropagation();
        });

        $(".actor").tooltip({
            trigger: "hover"
        });

        // Cloase simple search box after press esc button
        $(document).keyup(function (e) {
            var isExpanded = $("#simpleSearchButton").attr("aria-expanded");
            if (e.keyCode == 27 && isExpanded === "true") { // escape keycode 27
                $(".input-search-close.icon.wb-close").click();
            }
        });


        $(document).ready(function(){
            $(".dropdown-submenu a.test").on("click", function(e){
               
                $(this).next("ul").toggle();
                e.stopPropagation();
                e.preventDefault();
            });
        });

    };

    shell.prototype.addFacebookPlugin = function(){
        if(!config.facebookAppId){
            return;
        }
        (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s); js.id = id;
            js.src = "https://connect.facebook.net/tr_TR/sdk.js#xfbml=1&version=v2.12&appId="+config.facebookAppId+"&autoLogAppEvents=1";
            fjs.parentNode.insertBefore(js, fjs);
        }(document, "script", "facebook-jssdk"));
    }

    shell.prototype.addTwitterPlugin = function(){
        if(!config.twitterAppId){
            return;
        }

        window.twttr = (function (d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0],
                t = window.twttr || {};
            if (d.getElementById(id)) return t;
            js = d.createElement(s);
            js.id = id;
            js.src = "https://platform.twitter.com/widgets.js";
            fjs.parentNode.insertBefore(js, fjs);

            t._e = [];
            t.ready = function (f) {
                t._e.push(f);
            };

            return t;
        }(document, "script", "twitter-wjs"));
    }

    shell.prototype.connectToServer = function () {
        var _this = this;


        var loadSystemTask = _this.loadSystem();
        var loadCustomFieldsTask = _this.loadCustomFields();

        return $.when(loadSystemTask, loadCustomFieldsTask).then(function () {
            var locationHash = window.location.hash;
            return router.activate();
        });
    };

    shell.prototype.loadCustomFields = function () {
        var _this = this;

        return http.get("/api/custom-fields")
            .fail(function (result) {
                return false;
            }).done(function (results) {
                context.customFields(results);
                return true;
            });
    };


    shell.prototype.setupSignalR = function () {

        var _this = this;
        if (_this.signalRInitialized)
            return;

        $.getScript(config.serviceEndpoints.signalR).then(function () {
            $.connection.hub.qs = {
                token: context.authToken()
            };
            $.connection.hub.url = config.serviceEndpoints.signalR;
            var connectionId = $.connection.hub.id;
            if (system.debug()) {
                $.connection.hub.logging = true;
            }

            var notificationHub = $.connection.notificationHub;
            if (typeof notificationHub === "undefined")
                return;

            notificationHub.client.notify = function (notification) {
                if (!notification) {
                    return;
                }

                if (notification.type === "identity-context") {
                    if (notification.event === "UserSecurityStampChanged") {
                        ko.postbox.publish("UserNotLoaded");
                        return;
                    }
                }


                if (notification.event === "Activity") {

                    if (notification.data && notification.data.activityId) {
                        ko.postbox.publish("NewActivityCreated", {
                            activityId: notification.data.activityId
                        });
                    }

                    var taskId;
                    if (notification.type === "TaskActivity") {
                        if (notification.data.verb === "TaskCreated") {
                            taskId = notification.data.taskId;
                            if (taskId) {
                                if (notification.data.parameters.owner.identity === context.user().id) {
                                    ko.postbox.publish("TaskCreated", notification.data);
                                }
                            }
                        } else if (notification.data.verb.startsWith("Task") && notification.data.verb.indexOf("Attachment") === -1) {
                            taskId = notification.data.taskId;
                            if (taskId) {
                                ko.postbox.publish("TaskUpdated", notification.data);
                            }
                        }
                    }

                    if (notification.type === "ProjectActivity") {
                        if (notification.data.verb !== "ProjectCreated") {
                            var projectId = notification.data.projectId;
                            if (projectId) {
                                ko.postbox.publish("ProjectUpdated", {
                                    projectId: projectId
                                });
                            }
                        }
                    }
                }
            };

            $.connection.hub.disconnected(function () {
                var connectingMessage = i18n.t("app:pages.shell.signalRConnectingMessage");
                _this.signalRInitialized = false;
                if (system.debug() == false) {
                    $.magnificPopup.open({
                        items: {
                            src: '<div class="lightbox-content"><div class="loader vertical-align-middle loader-dot" data-type="default"></div><br>' + connectingMessage + "</div>",
                            type: "inline"
                        },
                        key: "signalr-disconnected",
                        closeOnBgClick: false,
                        closeBtnInside: false,
                        closeOnContentClick: false,
                        enableEscapeKey: false,
                        modal: true
                    }, 0);
                }

                setTimeout(function () {
                    system.log("SignalR trying to reconnect");
                    $.connection.hub.start().done(function () {
                        $.magnificPopup.close();
                        _this.signalRInitialized = true;
                    });
                }, 5000); // Re-start connection after 5 seconds
            });

            $.connection.hub.start()
                .done(function () {
                    _this.signalRInitialized = true;
                }).fail(function () {

                });



        });
    };




    shell.prototype.loadSystem = function () {
        var _this = this;
        var deferred = $.Deferred();

        var requests = [];
        requests.push({
            type: "GET",
            url:  "/api/users"
        });
        requests.push({
            type: "GET",
            url: "/api/teams"
        });

        $.ajaxBatch({
            url: config.serviceEndpoints.baseEndpoint+ "/api/batch",
            headers: context.getTokenAsHeader(),
            data: requests,
            complete: function (xhr, status, data) {
                if (data.length === 2) {
                    var users = data[0].data;
                    var teams = data[1].data;
                    context.setUsersAndTeams(users, teams);
                    return true;
                }
                return false;
            }
        })
            .fail(function (r) {
                return false;
            })
            .always(function () {
                return deferred.resolve();
            });

        return deferred;
    };

    shell.prototype.showNavigationProgress = function (isNavigating) {

    };

    shell.prototype.resizeLayout = function () {
        prefs.resizeColumns();
    };

    shell.prototype.resizeLayoutBy = function (left, right) {
        prefs.resizeColumnsBy(left, right);
    };




    return new shell();


});