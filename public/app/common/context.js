define(function (require) {

    var ko = require("knockout");
    var http = require("plugins/http");
    var amplify = require("amplify");

    var utils = require("common/utils");
    var config = require("config");

    var _ = require("underscore");
    var helpers = require("common/helpers");
    var prefs = require("common/prefs");


    function loadUserStars(user, data, refresh) {
        refresh = refresh || false;
        if (refresh) {
            var url = String.format("/api/stars");
            return http.get(url).then(function (result) {
                if (result && result.length > 0) {
                    user.resetStars();
                }
                _.each(result, function (s) {
                    user.addStar(s.type, s.objectId, s.design, s[s.type]);
                });
            }).fail(self.handleError);
        } else {
            if (data && data.length > 0) {
                user.resetStars();
            }
            _.each(data, function (s) {
                user.addStar(s.type, s.objectId, s.design, s[s.type]);
            });
        }
    }


    // Constructor
    var Context = function () {
        var _this = this;
        this.authToken = ko.observable(null);
        this.user = ko.observable();
        this.prefs = prefs;
        this.users = [];
        this.teams = [];
        this.usersIndexById = {};
        this.teamsIndexById = {};
        this.usersIndexByUsername = {};
        this.customFields = ko.observableArray([]);

        this.getCompanyLogo = function () {
            var defaultImage = "../assets/images/company-logo.jpg";
            var user = _this.user();
            if (!user) {
                return defaultImage;
            }
            var c = _.first(user.companies);
            if (!c) {
                return defaultImage;
            }

            return c.companyLogoImage;
        };

        this.getTokenAsHeader = function () {
            return {
                Authorization: "Bearer " + _this.authToken()
            };
        };

        this.getUserById = function (userId) {
            var uid = ko.unwrap(userId);
            if (!uid) return false;
            var u = _this.usersIndexById[uid] || {
                id: "user-x",
                fullName: "X",
                zombie: true
            };
            return u;
        };

        this.getUserFullNameOrDefaultById = function (userId) {
            var user = _this.getUserById(userId);
            if (!user) {
                return "";
            }
            return user.fullName;
        };

        this.getUserByUsername = function (username) {
            var u = _this.usersIndexByUsername[ko.unwrap(username)];
            return u;
        };

        this.getUserAvatarById = function (userId) {
            var user = _this.getUserById(userId);
            return helpers.getAvatarOrDefault(user);
        };



        this.setUsersAndTeams = function (users, teams) {
            // enrich team objects
            _.extendCollection(teams, function (p) {
                return {
                    fullName: p.name,
                    userName: p.name,
                    alias: p.alias
                };
            });

            _this.users = users.concat(teams);
            _this.usersIndexById = _.object(_.pluck(_this.users, "id"), _this.users); // id = > obj
            _this.usersIndexByUsername = _.object(_.pluck(_this.users, "userName"), _this.users); // id = > obj
        };

        this.setUser = function (data) {

            var user = new User(data.id, data.userName, data.fullName, data.alias);
            user.companies = data.companies;
            user.avatar(helpers.getAvatarOrDefault(data));
            user.setRoles(data.roles);
            user.setNotificationStatistics(data.notificationStatistics);
            user.setNotificationSubscriptions(data.notificationSubscriptions);
            loadUserStars(user, data.stars);

            _this.user(user);

            // ko.postbox.publish("CurrentUser", user);
        };







    };


    var instance = new Context();
    window.FT.context = instance;



    return instance;


    function User(id, username, fullname, alias) {
        var self = this;
        this.id = id;
        this.userName = ko.observable(username);
        this.fullName = ko.observable(fullname);
        this.alias = ko.observable(alias);
        this.avatar = ko.observable();
        this.roles = [];
        this.isConfirmed = ko.observable(true);
        this.stars = ko.observableArray([]);
        this.companies = [];
        this.notificationStatistics = {
            unreadLowActivityCount: ko.observable(0),
            unreadMediumActivityCount: ko.observable(0),
            unreadHighActivityCount: ko.observable(0)
        };
        this.oneSignalUserAgentId = null;
        this.notificationSubscriptions = ko.observableArray([]);
        this.uiLanguage = ko.observable();

        this.subscribedToOneSignal = ko.observable(false);

        this.hasRole = function (roles) {
            var isuserinrole = false;
            _.each(roles, function (value) {
                if (self.roles.indexOf(value) !== -1) {
                    isuserinrole = true;
                }
            });
            return isuserinrole;
        };

        this.setRoles = function (roles) {
            if (typeof (roles) == "string") {
                self.roles = roles.split(",");
            } else {
                self.roles = roles;
            }
        };

        this.setNotificationSubscriptions = function (data) {
            if (!data) {
                return;
            }

            _.each(data, function (s) {
                self.notificationSubscriptions.push(s);
            });
        }

        this.getStarByType = function (type) {
            return ko.utils.arrayFilter(self.stars(), function (star) {
                return star.type === type;
            });
        };

        this.getTaskStars = ko.computed(function () {
            return self.getStarByType("task");
        }, this);

        this.getSearchStars = ko.computed(function () {
            return self.getStarByType("search");
        }, this);

        this.getProjectStars = ko.computed(function () {
            return self.getStarByType("project");
        }, this);




        this.setNotificationStatistics = function (data) {
            self.notificationStatistics.unreadLowActivityCount(data.unreadLowActivityCount);
            self.notificationStatistics.unreadHighActivityCount(data.unreadHighActivityCount);
            self.notificationStatistics.unreadMediumActivityCount(data.unreadMediumActivityCount);
        };


        this.addStar = function (type, objectId, design, objectDetail) {
            var userStar = {
                type: ko.unwrap(type),
                objectId: ko.unwrap(objectId),
                design: ko.unwrap(design)
            };
            userStar[userStar.type] = objectDetail;
            self.stars.push(userStar);
        };

        this.resetStars = function () {
            self.stars([]);
        };
    }




});