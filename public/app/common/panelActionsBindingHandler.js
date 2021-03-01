define(["require", "exports", "durandal/composition", "knockout", "jquery"], function (require, exports, composition, ko, $) {

    function PanelActionsBindingHandler() {


    }

    PanelActionsBindingHandler.install = function () {
        if (!ko.bindingHandlers.panelActions) {
            ko.bindingHandlers.panelActions = new PanelActionsBindingHandler();

          //  composition.addBindingHandler('panelActions');
        }
    };


    PanelActionsBindingHandler.prototype.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        var options = valueAccessor();
        var $this = $(element);
        var isFullscreen = false;
        var isClose = false;
        var isCollapse = false;
        var isLoading = false;

        var collapseStatus =  ko.unwrap(options.collapseStatus) || false;
       

        var $fullscreen = $this.find('[data-toggle="panel-fullscreen"]');
        var $collapse = $this.find('[data-toggle="panel-collapse"]');
        var $loading;
        var self = this;

        if ($this.hasClass("is-collapse")) {
            isCollapse = true;
        }

        var $loadingArea = $this;
        if (options.loadingAreaSelector) {
            $loadingArea = $(options.loadingAreaSelector);
        }

        var api = {
            refresh: function (callback) {
                var type = $this.data("loader-type");
                if (!type) {
                    type = "round-circle";
                }

                $loading = $('<div class="panel-loading">' +
                    '<div class="loader loader-' + type + '"></div>' +
                    "</div>");

                $loading.appendTo($loadingArea);

                $loadingArea.addClass("is-loading");
                $this.trigger("loading.uikit.panel");
                isLoading = true;

                var thiz = this;
                if (options.onRefresh) {
                    var r = options.onRefresh.call(viewModel);
                    if (typeof r === "object" && r.promise) {
                        r.always(function () {
                            thiz.done();
                        });
                    } else {
                        thiz.done();
                    }

                }
            },
            done: function () {
                if (isLoading === true) {
                    $loading.remove();
                    $loadingArea.removeClass("is-loading");
                    $this.trigger("loading.done.uikit.panel");
                }
            },
            toggleContent: function () {
                if (isCollapse) {
                    this.showContent();
                    if (options.collapseStatus) {
                        options.collapseStatus(false);
                    }
                } else {
                    this.hideContent();
                    if (options.collapseStatus) {
                        options.collapseStatus(true);
                    }
                }
            },
            isHided: function () {
                return isCollapse;
            },
            showContent: function () {
                if (isCollapse !== false) {
                    $this.removeClass("is-collapse");
                    if ($collapse.hasClass("wb-chevron-down")) {
                        $collapse.removeClass("wb-chevron-down").addClass("wb-chevron-up");
                    }
                    $this.trigger("shown.uikit.panel");
                    isCollapse = false;
                }
            },

            hideContent: function () {
                if (isCollapse !== true) {
                    $this.addClass("is-collapse");
                    if ($collapse.hasClass("wb-chevron-up")) {
                        $collapse.removeClass("wb-chevron-up").addClass("wb-chevron-down");
                    }
                    $this.trigger("hidden.uikit.panel");
                    isCollapse = true;
                }
            },

            toggleFullscreen: function () {
                if (isFullscreen) {
                    this.leaveFullscreen();
                } else {
                    this.enterFullscreen();
                }
            },
            enterFullscreen: function () {
                if (isFullscreen !== true) {
                    $this.addClass("is-fullscreen");
                    if ($fullscreen.hasClass("wb-expand")) {
                        $fullscreen.removeClass("wb-expand").addClass("wb-contract");
                    }
                    $this.trigger("enter.fullscreen.uikit.panel");
                    isFullscreen = true;

                    if (options.onEnterFullScreen) {
                        options.onEnterFullScreen();
                    }

                }
            },
            leaveFullscreen: function () {
                if (isFullscreen !== false) {
                    $this.removeClass("is-fullscreen");
                    if ($fullscreen.hasClass("wb-contract")) {
                        $fullscreen.removeClass("wb-contract").addClass("wb-expand");
                    }
                    $this.trigger("leave.fullscreen.uikit.panel");
                    isFullscreen = false;

                    if (options.onLeaveFullScreen) {
                        options.onLeaveFullScreen();
                    }
                }
            },
            toggle: function () {
                if (isClose) {
                    this.open();
                } else {
                    this.close();
                }
            },
            open: function () {
                if (isClose !== false) {
                    $this.removeClass("is-close");
                    $this.trigger("open.uikit.panel");

                    isClose = false;
                }
            },
            close: function () {
                if (isClose !== true) {

                    $this.addClass("is-close");
                    $this.trigger("close.uikit.panel");

                    isClose = true;
                }
            }

        };

        $this.data("panel-api", api);

        if (collapseStatus) {
            api.hideContent();
        }

        ko.utils.registerEventHandler($this.find('[data-toggle="panel-fullscreen"]'), "click", function (ev) {
            ev.preventDefault();
            api.toggleFullscreen();
        });

        ko.utils.registerEventHandler($this.find('[data-toggle="panel-collapse"]'), "click", function (ev) {
            ev.preventDefault();
            api.toggleContent();
        });

        ko.utils.registerEventHandler($this.find('[data-toggle="panel-close"]'), "click", function (ev) {
            ev.preventDefault();
            api.close();
        });

        ko.utils.registerEventHandler($this.find('[data-toggle="panel-refresh"]'), "click", function (ev) {
            ev.preventDefault();
            var t = $(this);
            api.refresh();
        });


        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            $this.find('[data-toggle="panel-refresh"]').off("click");
            $this.find('[data-toggle="panel-close"]').off("click");
            $this.find('[data-toggle="panel-collapse"]').off("click");
            $this.find('[data-toggle="panel-fullscreen"]').off("click");
        });
    };


    PanelActionsBindingHandler.prototype.update = function (element, valueAccessor, allBindings, viewModel, bindingContext) {


    };

    return PanelActionsBindingHandler;
});
