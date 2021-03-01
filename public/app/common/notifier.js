define(["durandal/system", "common/utils", "common/initial", "underscore", "knockout"],
function (system, utils, initial, _, ko) {
    var userAvatarMapping = {};

    function getNotificationIcon(user, callback) {
        if (!user.avatar.startsWith("data:image/svg+xml;base64,")) {
            callback(user.avatar);
            return;
        }
        var userId = ko.unwrap(user.id);
        if (_.has(userAvatarMapping, userId)) {
            callback(userAvatarMapping[userId]);
            return;
        }

        var svg = initial.create({ name: ko.unwrap(user.initials), serialize: false });
        utils.svgUtil.svgAsPngUri(svg.get(0), {}, function (iconUrl) {
            userAvatarMapping[userId] = iconUrl;
            callback(iconUrl);
        });
    }

    function notify(title, body, user, closeTimeout, onClickCallback) {
        closeTimeout = closeTimeout || 5000;
        onClickCallback = onClickCallback || function () { };
        try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                getNotificationIcon(user, function (iconUrl) {
                    var notification = new Notification(title, {
                        icon: iconUrl,
                        tag: {},
                        dir: "auto",
                        lang: "",
                        silent: !0,
                        body: body
                    });

                    // createFavicon(1,function(img){
                    //     utils.changeFavicon(img);
                    // });

                    if (closeTimeout > 0) {
                        setTimeout(function () {
                            notification.close();
                        }, closeTimeout);
                    }

                    notification.onclick = function () {
                        window.focus();
                        onClickCallback();
                    };
                });
            }
        } catch (err) {
            console.log(err);
        }
    }

    function init() {
        if (typeof Notification === "undefined") {
            console.log("Notifications are supported in modern versions of Chrome, Firefox, Opera and Firefox.");
        } else {
            // setup notification
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }
        }
    }

    return {
        notify: notify,
        init: init
    };
});
