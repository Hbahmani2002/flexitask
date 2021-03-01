define(["durandal/system","config", "i18n", "durandal/binder", "knockout", "knockout.validation", "jquery", "moment"],
    function (system,config, i18n, binder, ko, koValidation, $, moment) {

        var initialized = false;



        function init(lang) {
            // i18next configuration
            var i18NOptions = {
                detectFromHeaders: false,
                lng: window.navigator.userLanguage || window.navigator.language || "en-US",
                // fallbackLang: "en-US",
                ns: "app",
                resGetPath: "App/locales/{{lng}}/{{ns}}.json",
                useCookie: false,
                fallbackOnNull: true,
                fallbackOnEmpty: true,
                lowerCaseLng: true,
                getAsync: false,
                reusePrefix: "$t(",
                reuseSuffix: ")",
                interpolationPrefix: "{{",
                interpolationSuffix: "}}"
                // useLocalStorage: true,
                // postProcess: "sprintf",
                // shorcutFunction: "sprintf"
            };

            window.i18n = i18n;
            window.t = i18n.t;

            if (lang) {
                i18NOptions.lng = lang;

                system.acquire("knockout.validation.localizations/" + lang).then(function () {
                    ko.validation.locale(lang);
                });

                if (lang && lang.indexOf("-") > -1) {
                    moment.locale(lang.split("-")[0]);
                    config.dateFormat = moment().localeData()._longDateFormat["L"];
                    config.dateTimeFormat = moment().localeData()._longDateFormat["L"] + " " + moment().localeData()._longDateFormat["LT"];

                }
            }

            var defer = $.Deferred();
            i18n.init(i18NOptions, function (t, err) {
                initialized = true;
                amplify.store("lang", lang);
                defer.resolve(true);
            });
            binder.binding = function (obj, view) {
                $(view).i18n();
            };

            return defer.promise();
        }




        function changeLang(lang) {
            var defer = $.Deferred();
            if (lang) {
                i18n.setLng(lang, function (err, t) {
                    amplify.store("lang", lang);
                    //$(document).i18n();
                    defer.resolve(true);
                });
                system.acquire("knockout.validation.localizations/" + lang).then(function () {
                    ko.validation.locale(lang);
                });

                if (lang.indexOf("-") > -1) {
                    moment.locale(lang.split("-")[0]);
                    config.dateFormat = moment().localeData()._longDateFormat["L"];
                    config.dateTimeFormat = moment().localeData()._longDateFormat["L"] + " " + moment().localeData()._longDateFormat["LT"];

                }
            }
            if (defer && defer.resolve) {
                defer.resolve(true);
            }
            return defer.promise();
        }

        return {
            init: init,
            changeLang: changeLang,
            initialized: initialized,
            currentLang: function () {
                return amplify.store("lang");
            }
        };

    });