define(["require","common/lang","common/lookups","amplify", "exports", "durandal/composition", "knockout", "jquery", "config", "common/utils"],
    function (require,lang,lookupFactory,amplify, exports, composition, ko, $, config, utils) {



        function Preferences() {
            var _this = this;
            this.data = null;
            this.customScrollbar = ko.observable(false);
            this.dateTimeFormat = ko.observable(config.dateTimeFormat);
            this.dateFormat = ko.observable(config.dateFormat);

            this.orientation = ko.observable(utils.browser.getOrientation());
            // window.FlexiTaskWindowOrientation = this.orientation.throttle(10);
            this.layoutMode = ko.observable("full");

            this.middleColumnSize = ko.observable(amplify.store("options/middleColumnsize") || 6);
            this.rightColumnSize = ko.observable(amplify.store("options/rightColumnSize") || 6);
            this.dragDropTaskMove = ko.observable(amplify.store("options/taskdragdrop") || false);

            this.dragDropTaskMove.subscribe(function (v) {
                amplify.store("options/taskdragdrop", v);
            });
            this.lang  = ko.observable("en-us");


            this.middleColumnSizeClass = ko.computed(function () {
                var orientation = _this.orientation();
                if (_this.layoutMode() === "full") {
                    if (utils.browser.isIOS()) {
                        if (orientation === "portrait") {
                            return "col-xs-12";
                        }
                    }

                    return String.format("col-sm-{0}", ko.unwrap(_this.middleColumnSize));
                }
                else {
                    return String.format("col-sm-4 col-sm-offset-1", ko.unwrap(_this.middleColumnSize));
                }

            });

            this.rightColumnSizeClass = ko.computed(function () {
                var orientation = _this.orientation();
                if (_this.layoutMode() === "full") {
                    if (utils.browser.isIOS()) {
                        if (orientation === "portrait") {
                            return "col-xs-12";
                        }
                    }
                    return String.format("col-sm-{0}", ko.unwrap(_this.rightColumnSize));
                }
                else {
                    return String.format("col-sm-5 col-sm-offset-1", ko.unwrap(_this.middleColumnSize));
                }
            });


        }

        
        Preferences.prototype.restoreColumnSizes = function () {
            var _this = this;
            var leftCol = amplify.store("options/middleColumnsize");
            var rightCol = amplify.store("options/rightColumnSize");

            if (leftCol && rightCol) {
                _this.middleColumnSize(leftCol);
                _this.rightColumnSize(rightCol);
            }

        };

        Preferences.prototype.safeColumnSizes = function () {
            var _this = this;
            amplify.store("options/middleColumnsize", 6);
            amplify.store("options/rightColumnSize", 6);

            _this.middleColumnSize(6);
            _this.rightColumnSize(6);
        };

        Preferences.prototype.resizeColumnsBy = function (left, right) {
            var _this = this;
            if (utils.browser.getOrientation() === "portrait") {
                return;
            }

            if (utils.browser.isSingleColumnScreen()) {
                $(".left-column").show();
                $(".right-column").show();
                return;
            }


            amplify.store("options/middleColumnsize", left);
            amplify.store("options/rightColumnSize", right);

            if (left === 0) {
                $(".left-column").hide();
            }
            else {
                $(".left-column").show();
            }
            if (right === 0) {
                $(".right-column").hide();
            }
            else {
                $(".right-column").show();
            }

            if (left === 12) {
                left++;
                right--;
            }
            // if(right!==0 && left!==0)
            // {
            //    $(".left-column").show();
            //    $(".right-column").show();
            // }

            _this.middleColumnSize(left);
            _this.rightColumnSize(right);
        };


        Preferences.prototype.changeLayout = function () {
            var _this = this;
            if (_this.layoutMode() === "full") {
                _this.layoutMode("small");
            }
            else {
                _this.layoutMode("full");
            }
        };

        Preferences.prototype.getDateTimeFormat = function () {
            return this.dateTimeFormat;
        };

        Preferences.prototype.changeLang = function (langCode) {
            var _this = this;
            var currentLang = _this.lang();
            if(!langCode || currentLang === langCode){
                var defer = $.Deferred();
                defer.resolve(false);
                return defer.promise();
            }

            return lang.changeLang(langCode).then(function () {
                _this.lang(langCode);
                lookupFactory.reset();
                //app.setRoot("layout/shell", "entrance");
            });
        };

        Preferences.init = function (data) {
            var p = new Preferences();
            p.dateTimeFormat = data["dateTimeFormat"];

            Export = p;
        };

        Preferences.prototype.reset = function () {
            var _this = this;
            _this.lang("en");
        };

        var instance = new Preferences();

        window.onresize = function (ev) {
            instance.orientation(utils.browser.getOrientation());
        };

        window.FT.prefs = instance;
        return instance;
    });
