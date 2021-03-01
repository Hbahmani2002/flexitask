define(function(require) {

    var convertRemoteViewIdToRequirePath,
        customizeViewEngine,
        customizeViewLocator,
        isRemoteViewId,
        remoteViewExtension,
        remoteViewRoot,
        translateRemoteViewIdToArea,
        viewEngine,
        viewLocator;

    viewEngine = require('durandal/viewEngine');
    viewLocator = require('durandal/viewLocator');

    remoteViewExtension = ".cshtml";
    remoteViewRoot = "/../";

    isRemoteViewId = function(viewId) {
        return viewId.indexOf(remoteViewExtension, viewId.length - remoteViewExtension.length) !== -1;
    };
    convertRemoteViewIdToRequirePath = function(viewId) {
        return this.viewPlugin + "!" + remoteViewRoot + viewId.substring(0, viewId.length - remoteViewExtension.length);
    };

    customizeViewEngine = function() {
        var convertViewIdToRequirePath;
        convertViewIdToRequirePath = viewEngine.convertViewIdToRequirePath;

        viewEngine.convertViewIdToRequirePath = function(viewId) {
            if (isRemoteViewId(viewId)) {
                return convertRemoteViewIdToRequirePath.call(this, viewId);
            } else {
                return convertViewIdToRequirePath.call(this, viewId);
            }
        };
    };
    translateRemoteViewIdToArea = function(viewId, area) {
        if (!area || area === "partial") {
            return viewId;
        } else {
            return "" + area + "/" + viewId;
        }
    };

    customizeViewLocator = function() {
        var translateViewIdToArea;
        translateViewIdToArea = viewLocator.translateViewIdToArea;
        return viewLocator.translateViewIdToArea = function(viewId, area) {
            if (isRemoteViewId(viewId)) {
                return translateRemoteViewIdToArea(viewId, area);
            } else {
                return translateViewIdToArea.call(this, viewId, area);
            }
        };
    };

    return {
        customizeViewEngine: customizeViewEngine,
        customizeViewLocator: customizeViewLocator,
    };
});