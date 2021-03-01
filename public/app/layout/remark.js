
define(["durandal/system","jquery", "knockout", "plugins/router", "common/errorhandler", "common/notifications", "common/utils",  "config", "common/context", "common/auth", "i18n"],
    function (system,$, ko, router, errorhandler, notification, utils, config, context, auth, i18n) {

        var $doc = $(document);

        var remarkSite = {

        };

        $.extend(remarkSite, {
            _queue: {
                prepare: [],
                run: [],
                complete: []
            },

            run: function() {
                var self = this;

                this.dequeue("prepare", function() {
                    self.trigger("before.run", self);
                });

                this.dequeue("run", function() {
                    self.dequeue("complete", function() {
                        self.trigger("after.run", self);
                    });
                });
            },

            dequeue: function(name, done) {
                var self = this,
                    queue = this.getQueue(name),
                    fn = queue.shift(),
                    next = function() {
                        self.dequeue(name, done);
                    };

                if (fn) {
                    fn.call(this, next);
                } else if ($.isFunction(done)) {
                    done.call(this);
                }
            },

            getQueue: function(name) {
                if (!$.isArray(this._queue[name])) {
                    this._queue[name] = [];
                }

                return this._queue[name];
            },

            extend: function(obj) {
                $.each(this._queue, function(name, queue) {
                    if ($.isFunction(obj[name])) {
                        queue.push(obj[name]);

                        delete obj[name];
                    }
                });

                $.extend(this, obj);

                return this;
            },

            trigger: function(name, data, $el) {
                if (typeof name === "undefined") return;
                if (typeof $el === "undefined") $el = $doc;

                $el.trigger(name + ".site", data);
            },

            throttle: function(func, wait) {
                var _now = Date.now || function() {
                    return new Date().getTime();
                };
                var context, args, result;
                var timeout = null;
                var previous = 0;

                var later = function() {
                    previous = _now();
                    timeout = null;
                    result = func.apply(context, args);
                    context = args = null;
                };

                return function() {
                    var now = _now();
                    var remaining = wait - (now - previous);
                    context = this;
                    args = arguments;
                    if (remaining <= 0) {
                        clearTimeout(timeout);
                        timeout = null;
                        previous = now;
                        result = func.apply(context, args);
                        context = args = null;
                    } else if (!timeout) {
                        timeout = setTimeout(later, remaining);
                    }
                    return result;
                };
            },

            resize: function() {
                if (document.createEvent) {
                    var ev = document.createEvent("Event");
                    ev.initEvent("resize", true, true);
                    window.dispatchEvent(ev);
                } else {
                    element = document.documentElement;
                    var event = document.createEventObject();
                    element.fireEvent("onresize", event);
                }
            }
        });

        // Configs
        // =======
        $.configs = $.configs || {};

        $.extend($.configs, {
            data: {},
            get: function(name) {
                var callback = function(data, name) {
                    return data[name];
                }

                var data = this.data;

                for (var i = 0; i < arguments.length; i++) {
                    name = arguments[i];

                    data = callback(data, name);
                }

                return data;
            },

            set: function(name, value) {
                this.data[name] = value;
            },

            extend: function(name, options) {
                var value = this.get(name);
                return $.extend(true, value, options);
            }
        });

        // Colors
        // ======
        $.colors = function(name, level) {
            if (name === "primary") {
                name = $.configs.get("site", "primaryColor");
                if (!name) {
                    name = "red";
                }
            }

            if (typeof $.configs.colors === "undefined") {
                return null;
            }

            if (typeof $.configs.colors[name] !== "undefined") {
                if (level && typeof $.configs.colors[name][level] !== "undefined") {
                    return $.configs.colors[name][level];
                }

                if (typeof level === "undefined") {
                    return $.configs.colors[name];
                }
            }

            return null;
        };

        // Components
        // ==========
        $.components = $.components || {};

        $.extend($.components, {
            _components: {},

            register: function(name, obj) {
                this._components[name] = obj;
            },

            init: function(name, context, args) {
                var self = this;

                if (typeof name === "undefined") {
                    $.each(this._components, function(name) {
                        self.init(name);
                    });
                } else {
                    context = context || document;
                    args = args || [];

                    var obj = this.get(name);

                    if (obj) {
                        switch (obj.mode) {
                        case "default":
                            return this._initDefault(name, context);
                        case "init":
                            return this._initComponent(name, obj, context, args);
                        case "api":
                            return this._initApi(name, obj, args);
                        default:
                            this._initApi(name, obj, context, args);
                            this._initComponent(name, obj, context, args);
                            return;
                        }
                    }
                }
            },

            /* init alternative, but only or init mode */
            call: function(name, context) {
                var args = Array.prototype.slice.call(arguments, 2);
                var obj = this.get(name);

                context = context || document;

                return this._initComponent(name, obj, context, args);
            },

            _initDefault: function(name, context) {
                if (!$.fn[name]) return;

                var defaults = this.getDefaults(name);

                $("[data-plugin=" + name + "]", context).each(function() {
                    var $this = $(this),
                        options = $.extend(true, {}, defaults, $this.data());

                    $this[name](options);
                });
            },


            _initComponent: function(name, obj, context, args) {
                if ($.isFunction(obj.init)) {
                    obj.init.apply(obj, [context].concat(args));
                }
            },

            _initApi: function(name, obj, args) {
                if (typeof obj.apiCalled === "undefined" && $.isFunction(obj.api)) {
                    obj.api.apply(obj, args);

                    obj.apiCalled = true;
                }
            },


            getDefaults: function(name) {
                var component = this.get(name);

                if (component && typeof component.defaults !== "undefined") {
                    return component.defaults;
                } else {
                    return {};
                }
            },

            get: function(name, property) {
                if (typeof this._components[name] !== "undefined") {
                    if (typeof property !== "undefined") {
                        return this._components[name][property];
                    } else {
                        return this._components[name];
                    }
                } else {
                    console.warn("component:" + component + " script is not loaded.");

                    return undefined;
                }
            }
        });


        var $body = $("body"),
            $html = $("html");

        // configs setup
        // =============
        $.configs.set("site", {
            fontFamily: "Noto Sans, sans-serif",
            primaryColor: "blue",
            assets: "../assets"
        });

        function hard(){
            remarkSite.extend({
                run: function(next) {
                    // polyfill
                    this.polyfillIEWidth();

                    $(document).on("click", ".table-section", function(e) {
                        if ("checkbox" !== e.target.type && "button" !== e.target.type && "a" !== e.target.tagName.toLowerCase() && !$(e.target).parent("div.checkbox-custom").length) {
                            if ($(this).hasClass("active")) {
                                $(this).removeClass("active")
                            } else {
                                $(this).siblings(".table-section").removeClass("active");
                                $(this).addClass("active");
                            }
                        }
                    });

                    // Menubar setup
                    // =============
                    if (typeof remarkSite.menu !== "undefined") {
                        remarkSite.menu.init();
                    }

                    if (typeof remarkSite.menubar !== "undefined") {
                        $(".site-menubar").one("changing.site.menubar", function() {
                            $('[data-toggle="menubar"]').each(function() {
                                var $this = $(this);
                                var $hamburger = $(this).find(".hamburger");

                                function toggle($el) {
                                    $el.toggleClass("hided", !remarkSite.menubar.opened);
                                    $el.toggleClass("unfolded", !remarkSite.menubar.folded);
                                }
                                if ($hamburger.length > 0) {
                                    toggle($hamburger);
                                } else {
                                    toggle($this);
                                }
                            });

                            remarkSite.menu.refresh();
                        });

                        $(document).on("click", '[data-toggle="collapse"]', function(e) {
                            var $trigger = $(e.target);
                            if (!$trigger.is('[data-toggle="collapse"]')) {
                                $trigger = $trigger.parents('[data-toggle="collapse"]');
                            }
                            var href;
                            var target = $trigger.attr("data-target") || (href = $trigger.attr("href")) && href.replace(/.*(?=#[^\s]+$)/, "");
                            var $target = $(target);
                            if ($target.hasClass("navbar-search-overlap")) {
                                $target.find("input").focus();

                                e.preventDefault();
                            } else if ($target.attr("id") === "site-navbar-collapse") {
                                var isOpen = !$trigger.hasClass("collapsed");
                                $("body").addClass("site-navbar-collapsing");

                                $("body").toggleClass("site-navbar-collapse-show", isOpen);

                                setTimeout(function() {
                                    $("body").removeClass("site-navbar-collapsing");
                                }, 350);

                                if (isOpen) {
                                    remarkSite.menubar.scrollable.update();
                                }
                            }
                        });

                        $(document).offOn("click", '[data-toggle="menubar"]', function() {
                            remarkSite.menubar.toggle();

                            return false;
                        });

                        remarkSite.menubar.init();

                        Breakpoints.on("change", function() {
                            remarkSite.menubar.change();
                        });
                    }

                    // Gridmenu setup
                    // ==============
                    if (typeof remarkSite.gridmenu !== "undefined") {
                        remarkSite.gridmenu.init();
                    }

                    // Sidebar setup
                    // =============
                    if (typeof remarkSite.sidebar !== "undefined") {
                        remarkSite.sidebar.init();
                    }

                    // Tooltip setup
                    // =============
                    $(document).tooltip({
                        selector: "[data-tooltip=true]",
                        container: "body"
                    });

                    $('[data-toggle="tooltip"]').tooltip();
                    $('[data-toggle="popover"]').popover();

                    // Fullscreen
                    // ==========
                    if (typeof screenfull !== "undefined") {
                        $(document).on("click", '[data-toggle="fullscreen"]', function() {
                            if (screenfull.enabled) {
                                screenfull.toggle();
                            }

                            return false;
                        });

                        if (screenfull.enabled) {
                            document.addEventListener(screenfull.raw.fullscreenchange, function() {
                                $('[data-toggle="fullscreen"]').toggleClass("active", screenfull.isFullscreen);
                            });
                        }
                    }

                    // Dropdown menu setup
                    // ===================
                    $("body").on("click", ".dropdown-menu-media", function(e) {
                        e.stopPropagation();
                    });


                    // Page Animate setup
                    // ==================
                    if (typeof $.animsition !== "undefined") {
                        this.loadAnimate(function() {
                            $(".animsition").css({
                                "animation-duration": "0s"
                            });
                            next();
                        });
                    } else {
                        next();
                    }

                    // Mega navbar setup
                    // =================
                    $(document).on("click", ".navbar-mega .dropdown-menu", function(e) {
                        e.stopPropagation();
                    });

                    $(document).on("show.bs.dropdown", function(e) {
                        var $target = $(e.target);
                        var $trigger = e.relatedTarget ? $(e.relatedTarget) : $target.children('[data-toggle="dropdown"]');

                        var animation = $trigger.data("animation");
                        if (animation) {
                            var $menu = $target.children(".dropdown-menu");
                            $menu.addClass("animation-" + animation);

                            $menu.one("webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend", function() {
                                $menu.removeClass("animation-" + animation);
                            });
                        }
                    });

                    $(document).on("shown.bs.dropdown", function(e) {
                        var $target = $(e.target);
                        var $menu = $target.find(".dropdown-menu-media > .list-group");

                        if ($menu.length > 0) {
                            var api = $menu.data("asScrollable");
                            if (api) {
                                api.update();
                            } else {
                                var defaults = $.components.getDefaults("scrollable");
                                $menu.asScrollable(defaults);
                            }
                        }
                    });

                    // Page Aside Scrollable
                    // =====================

                    var pageAsideScroll = $('[data-plugin="pageAsideScroll"]');

                    if (pageAsideScroll.length > 0) {
                        pageAsideScroll.asScrollable({
                            namespace: "scrollable",
                            contentSelector: "> [data-role='content']",
                            containerSelector: "> [data-role='container']"
                        });

                        var pageAside = $(".page-aside");
                        var scrollable = pageAsideScroll.data("asScrollable");

                        if (scrollable) {
                            if ($("body").is(".page-aside-fixed") || $("body").is(".page-aside-scroll")) {
                                $(".page-aside").on("transitionend", function() {
                                    scrollable.update();
                                });
                            }

                            Breakpoints.on("change", function() {
                                var current = Breakpoints.current().name;

                                if (!$("body").is(".page-aside-fixed") && !$("body").is(".page-aside-scroll")) {
                                    if (current === "xs") {
                                        scrollable.enable();
                                        pageAside.on("transitionend", function() {
                                            scrollable.update();
                                        });
                                    } else {
                                        pageAside.off("transitionend");
                                        scrollable.disable();
                                    }
                                }
                            });

                            $(document).on("click.pageAsideScroll", ".page-aside-switch", function() {
                                var isOpen = pageAside.hasClass("open");

                                if (isOpen) {
                                    pageAside.removeClass("open");
                                } else {
                                    scrollable.update();
                                    pageAside.addClass("open");
                                }
                            });

                            $(document).on("click.pageAsideScroll", '[data-toggle="collapse"]', function(e) {
                                var $trigger = $(e.target);
                                if (!$trigger.is('[data-toggle="collapse"]')) {
                                    $trigger = $trigger.parents('[data-toggle="collapse"]');
                                }
                                var href;
                                var target = $trigger.attr("data-target") || (href = $trigger.attr("href")) && href.replace(/.*(?=#[^\s]+$)/, "");
                                var $target = $(target);

                                if ($target.attr("id") === "site-navbar-collapse") {
                                    scrollable.update();
                                }
                            });
                        }
                    }

                    // Init Loaded Components
                    // ======================
                    $.components.init();

                    this.startTour();
                },

                polyfillIEWidth: function() {
                    if (navigator.userAgent.match(/IEMobile\/10\.0/)) {
                        var msViewportStyle = document.createElement("style");
                        msViewportStyle.appendChild(
                            document.createTextNode(
                                "@-ms-viewport{width:auto!important}"
                            )
                        );
                        document.querySelector("head").appendChild(msViewportStyle);
                    }
                },

                loadAnimate: function(callback) {
                    return $.components.call("animsition", document, callback);
                },

                startTour: function(flag) {
                    if (typeof this.tour === "undefined") {
                        if (typeof introJs === "undefined") {
                            return;
                        }

                        var tourOptions = $.configs.get("tour"),
                            self = this;
                        flag = $("body").css("overflow");
                        this.tour = introJs();

                        this.tour.onbeforechange(function() {
                            $("body").css("overflow", "hidden");
                        });

                        this.tour.oncomplete(function() {
                            $("body").css("overflow", flag);
                        });

                        this.tour.onexit(function() {
                            $("body").css("overflow", flag);
                        });

                        this.tour.setOptions(tourOptions);
                        $(".site-tour-trigger").on("click", function() {
                            self.tour.start();
                        });
                    }
                    // if (window.localStorage && window.localStorage.getItem('startTour') && (flag !== true)) {
                    //   return;
                    // } else {
                    //   this.tour.start();
                    //   window.localStorage.setItem('startTour', true);
                    // }
                }
            });
        }

        remarkSite.menu = {
            speed: 250,
            accordion: true, // A setting that changes the collapsible behavior to expandable instead of the default accordion style

            init: function() {
                this.$instance = $(".site-menu");

                if (this.$instance.length === 0) {
                    return;
                }

                this.bind();
            },

            bind: function() {
                var self = this;

                this.$instance.on("mouseenter.site.menu", ".site-menu-item", function() {
                    var $item = $(this);
                    if (remarkSite.menubar.folded === true && $item.is(".has-sub") && $item.parent(".site-menu").length > 0) {
                        var $sub = $item.children(".site-menu-sub");
                        self.position($item, $sub);
                    }

                    $item.addClass("hover");
                }).on("mouseleave.site.menu", ".site-menu-item", function() {
                    var $item = $(this);
                    if (remarkSite.menubar.folded === true && $item.is(".has-sub") && $item.parent(".site-menu").length > 0) {
                        $item.children(".site-menu-sub").css("max-height", "");
                    }

                    $item.removeClass("hover");
                }).on("deactive.site.menu", ".site-menu-item.active", function(e) {
                    var $item = $(this);

                    $item.removeClass("active");

                    e.stopPropagation();
                }).on("active.site.menu", ".site-menu-item", function(e) {
                    var $item = $(this);

                    $item.addClass("active");

                    e.stopPropagation();
                }).on("open.site.menu", ".site-menu-item", function(e) {
                    var $item = $(this);

                    self.expand($item, function() {
                        $item.addClass("open");
                    });

                    if (self.accordion) {
                        $item.siblings(".open").trigger("close.site.menu");
                    }

                    e.stopPropagation();
                }).on("close.site.menu", ".site-menu-item.open", function(e) {
                    var $item = $(this);

                    self.collapse($item, function() {
                        $item.removeClass("open");
                    });

                    e.stopPropagation();
                }).on("click.site.menu ", ".site-menu-item", function(e) {
                    if ($(this).is(".has-sub") && $(e.target).closest(".site-menu-item").is(this)) {
                        if ($(this).is(".open")) {
                            $(this).trigger("close.site.menu");
                        } else {
                            $(this).trigger("open.site.menu");
                        }
                    } else {
                        if (!$(this).is(".active")) {
                            $(this).siblings(".active").trigger("deactive.site.menu");
                            $(this).trigger("active.site.menu");
                        }
                    }

                    e.stopPropagation();
                }).on("tap.site.menu", "> .site-menu-item > a", function() {
                    var link = $(this).attr("href");

                    if (link) {
                        window.location = link;
                    }
                }).on("touchend.site.menu", "> .site-menu-item > a", function(e) {
                    var $item = $(this).parent(".site-menu-item");

                    if (remarkSite.menubar.folded === true) {
                        if ($item.is(".has-sub") && $item.parent(".site-menu").length > 0) {
                            $item.siblings(".hover").removeClass("hover");

                            if ($item.is(".hover")) {
                                $item.removeClass("hover");
                            } else {
                                $item.addClass("hover");
                            }
                        }
                    }
                }).on("scroll.site.menu", ".site-menu-sub", function(e) {
                    e.stopPropagation();
                });
            },

            collapse: function($item, callback) {
                var self = this;
                var $sub = $item.children(".site-menu-sub");

                $sub.show().slideUp(this.speed, function() {
                    $(this).css("display", "");

                    $(this).find("> .site-menu-item").removeClass("is-shown");

                    if (callback) {
                        callback();
                    }

                    self.$instance.trigger("collapsed.site.menu");
                });
            },

            expand: function($item, callback) {
                var self = this;
                var $sub = $item.children(".site-menu-sub");
                var $children = $sub.children(".site-menu-item").addClass("is-hidden");

                $sub.hide().slideDown(this.speed, function() {
                    $(this).css("display", "");

                    if (callback) {
                        callback();
                    }

                    self.$instance.trigger("expanded.site.menu");
                });

                setTimeout(function() {
                    $children.addClass("is-shown");
                    $children.removeClass("is-hidden");
                }, 0);
            },

            refresh: function() {
                this.$instance.find(".open").filter(":not(.active)").removeClass("open");
            },

            position: function($item, $dropdown) {
                var offsetTop = $item.position().top,
                    dropdownHeight = $dropdown.outerHeight(),
                    menubarHeight = remarkSite.menubar.$instance.outerHeight(),
                    itemHeight = $item.find("> a").outerHeight();

                $dropdown.removeClass("site-menu-sub-up").css("max-height", "");

                //if (offsetTop + dropdownHeight > menubarHeight) {
                if (offsetTop > menubarHeight / 2) {
                    $dropdown.addClass("site-menu-sub-up");

                    if (remarkSite.menubar.foldAlt) {
                        offsetTop = offsetTop - itemHeight;
                    }
                    //if(dropdownHeight > offsetTop + itemHeight) {
                    $dropdown.css("max-height", offsetTop + itemHeight);
                    //}
                } else {
                    if (remarkSite.menubar.foldAlt) {
                        offsetTop = offsetTop + itemHeight;
                    }
                    $dropdown.removeClass("site-menu-sub-up");
                    $dropdown.css("max-height", menubarHeight - offsetTop);
                }
                //}
            }
        };


        remarkSite.menubar = {
            opened: null,
            folded: null,
            top: false,
            foldAlt: false,
            $instance: null,
            auto: true,

            init: function() {
                $html.removeClass("css-menubar").addClass("js-menubar");

                this.$instance = $(".site-menubar");

                if (this.$instance.length === 0) {
                    return;
                }

                var self = this;

                if ($("body").is(".site-menubar-top")) {
                    this.top = true;
                }

                if ($("body").is(".site-menubar-fold-alt")) {
                    this.foldAlt = true;
                }

                if ($("body").data("autoMenubar") === false || $("body").is(".site-menubar-keep")) {
                    if ($("body").hasClass("site-menubar-fold")) {
                        this.auto = "fold";
                    } else if ($("body").hasClass("site-menubar-unfold")) {
                        this.auto = "unfold";
                    }
                }

                this.$instance.one("changed.site.menubar", function() {
                    self.update();
                });

                this.change();
            },

            change: function() {
                var breakpoint = Breakpoints.current();
                if (this.auto !== true) {
                    switch (this.auto) {
                    case "fold":
                        this.reset();
                        if (breakpoint.name == "xs") {
                            this.hide();
                        } else {
                            this.fold();
                        }
                        return;
                    case "unfold":
                        this.reset();
                        if (breakpoint.name == "xs") {
                            this.hide();
                        } else {
                            this.unfold();
                        }
                        return;
                    }
                }

                this.reset();

                if (breakpoint) {
                    switch (breakpoint.name) {
                    case "lg":
                        this.unfold();
                        break;
                    case "md":
                    case "sm":
                        this.fold();
                        break;
                    case "xs":
                        this.hide();
                        break;
                    }
                }
            },

            animate: function(doing, callback) {
                var self = this;
                $("body").addClass("site-menubar-changing");

                doing.call(self);
                this.$instance.trigger("changing.site.menubar");

                setTimeout(function() {
                    callback.call(self);
                    $("body").removeClass("site-menubar-changing");

                    self.$instance.trigger("changed.site.menubar");
                }, 500);
            },

            reset: function() {
                this.opened = null;
                this.folded = null;
                $("body").removeClass("site-menubar-hide site-menubar-open site-menubar-fold site-menubar-unfold");
                $html.removeClass("disable-scrolling");
            },

            open: function() {
                if (this.opened !== true) {
                    this.animate(function() {
                        $("body").removeClass("site-menubar-hide").addClass("site-menubar-open site-menubar-unfold");
                        this.opened = true;

                        $html.addClass("disable-scrolling");

                    }, function() {
                        this.scrollable.enable();
                    });
                }
            },

            hide: function() {
                this.hoverscroll.disable();

                if (this.opened !== false) {
                    this.animate(function() {

                        $html.removeClass("disable-scrolling");
                        $("body").removeClass("site-menubar-open").addClass("site-menubar-hide site-menubar-unfold");
                        this.opened = false;

                    }, function() {
                        this.scrollable.enable();
                    });
                }
            },

            unfold: function() {
                this.hoverscroll.disable();

                if (this.folded !== false) {
                    this.animate(function() {
                        $("body").removeClass("site-menubar-fold").addClass("site-menubar-unfold");
                        this.folded = false;

                    }, function() {
                        this.scrollable.enable();

                        if (this.folded !== null) {
                            remarkSite.resize();
                        }
                    });
                }
            },

            fold: function() {
                this.scrollable.disable();

                if (this.folded !== true) {
                    this.animate(function() {

                        $("body").removeClass("site-menubar-unfold").addClass("site-menubar-fold");
                        this.folded = true;

                    }, function() {
                        this.hoverscroll.enable();

                        if (this.folded !== null) {
                            remarkSite.resize();
                        }
                    });
                }
            },

            toggle: function() {
                var breakpoint = Breakpoints.current();
                var folded = this.folded;
                var opened = this.opened;

                switch (breakpoint.name) {
                case "lg":
                    if (folded === null || folded === false) {
                        this.fold();
                    } else {
                        this.unfold();
                    }
                    break;
                case "md":
                case "sm":
                    if (folded === null || folded === true) {
                        this.unfold();
                    } else {
                        this.fold();
                    }
                    break;
                case "xs":
                    if (opened === null || opened === false) {
                        this.open();
                    } else {
                        this.hide();
                    }
                    break;
                }
            },

            update: function() {
                this.scrollable.update();
                this.hoverscroll.update();
            },

            scrollable: {
                api: null,
                native: false,
                init: function() {
                    // if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                    //   this.native = true;
                    //   $("body").addClass('site-menubar-native');
                    //   return;
                    // }

                    if ($("body").is(".site-menubar-native")) {
                        this.native = true;
                        return;
                    }

                    this.api = remarkSite.menubar.$instance.children(".site-menubar-body").asScrollable({
                        namespace: "scrollable",
                        skin: "scrollable-inverse",
                        direction: "vertical",
                        contentSelector: ">",
                        containerSelector: ">"
                    }).data("asScrollable");
                },

                update: function() {
                    if (this.api) {
                        this.api.update();
                    }
                },

                enable: function() {
                    if (this.native) {
                        return;
                    }
                    if (!this.api) {
                        this.init();
                    }
                    if (this.api) {
                        this.api.enable();
                    }
                },

                disable: function() {
                    if (this.api) {
                        this.api.disable();
                    }
                }
            },

            hoverscroll: {
                api: null,

                init: function() {
                    this.api = remarkSite.menubar.$instance.children(".site-menubar-body").asHoverScroll({
                        namespace: "hoverscorll",
                        direction: "vertical",
                        list: ".site-menu",
                        item: "> li",
                        exception: ".site-menu-sub",
                        fixed: false,
                        boundary: 100,
                        onEnter: function() {
                            //$(this).siblings().removeClass('hover');
                            //$(this).addClass('hover');
                        },
                        onLeave: function() {
                            //$(this).removeClass('hover');
                        }
                    }).data("asHoverScroll");
                },

                update: function() {
                    if (this.api) {
                        this.api.update();
                    }
                },

                enable: function() {
                    if (!this.api) {
                        this.init();
                    }
                    if (this.api) {
                        this.api.enable();
                    }
                },

                disable: function() {
                    if (this.api) {
                        this.api.disable();
                    }
                }
            }
        };

        remarkSite.gridmenu = {
            opened: false,

            init: function() {
                this.$instance = $(".site-gridmenu");

                if (this.$instance.length === 0) {
                    return;
                }

                this.bind();
            },

            bind: function() {
                var self = this;

                $(document).on("click", '[data-toggle="gridmenu"]', function() {
                    var $this = $(this);

                    if (self.opened) {
                        self.close();

                        $this.removeClass("active")
                            .attr("aria-expanded", false);

                    } else {
                        self.open();

                        $this.addClass("active")
                            .attr("aria-expanded", true);
                    }
                });
            },

            open: function() {
                var self = this;

                if (this.opened !== true) {
                    this.animate(function() {
                        self.opened = true;


                        self.$instance.addClass("active");

                        $('[data-toggle="gridmenu"]').addClass("active")
                            .attr("aria-expanded", true);

                        $("body").addClass("site-gridmenu-active");
                        $html.addClass("disable-scrolling");
                    }, function() {
                        this.scrollable.enable();
                    });
                }
            },

            close: function() {
                var self = this;

                if (this.opened === true) {
                    this.animate(function() {
                        self.opened = false;

                        self.$instance.removeClass("active");

                        $('[data-toggle="gridmenu"]').addClass("active")
                            .attr("aria-expanded", true);

                        $("body").removeClass("site-gridmenu-active");
                        $html.removeClass("disable-scrolling");
                    }, function() {
                        this.scrollable.disable();
                    });
                }
            },

            toggle: function() {
                if (this.opened) {
                    this.close();
                } else {
                    this.open();
                }
            },

            animate: function(doing, callback) {
                var self = this;

                doing.call(self);
                this.$instance.trigger("changing.site.gridmenu");

                setTimeout(function() {
                    callback.call(self);

                    self.$instance.trigger("changed.site.gridmenu");
                }, 500);
            },

            scrollable: {
                api: null,
                init: function() {
                    this.api = remarkSite.gridmenu.$instance.asScrollable({
                        namespace: "scrollable",
                        skin: "scrollable-inverse",
                        direction: "vertical",
                        contentSelector: ">",
                        containerSelector: ">"
                    }).data("asScrollable");
                },

                update: function() {
                    if (this.api) {
                        this.api.update();
                    }
                },

                enable: function() {
                    if (!this.api) {
                        this.init();
                    }
                    if (this.api) {
                        this.api.enable();
                    }
                },

                disable: function() {
                    if (this.api) {
                        this.api.disable();
                    }
                }
            }
        };

        remarkSite.sidebar = {
            init: function() {
                if (typeof $.slidePanel === "undefined") return;

                $(document).on("click", '[data-toggle="site-sidebar"]', function() {
                    var $this = $(this);

                    var direction = "right";
                    if ($("body").hasClass("site-menubar-flipped")) {
                        direction = "left";
                    }

                    var defaults = $.components.getDefaults("slidePanel");
                    var options = $.extend({}, defaults, {
                        direction: direction,
                        skin: "site-sidebar",
                        dragTolerance: 80,
                        template: function(options) {
                            return '<div class="' + options.classes.base + " " + options.classes.base + "-" + options.direction + '">' +
              '<div class="' + options.classes.content + ' site-sidebar-content"></div>' +
              '<div class="slidePanel-handler"></div>' +
              "</div>";
                        },
                        afterLoad: function() {
                            var self = this;
                            this.$panel.find(".tab-pane").asScrollable({
                                namespace: "scrollable",
                                contentSelector: "> div",
                                containerSelector: "> div"
                            });

                            $.components.init("switchery", self.$panel);

                            this.$panel.on("shown.bs.tab", function() {
                                self.$panel.find(".tab-pane.active").asScrollable("update");
                            });
                        },
                        beforeShow: function() {
                            if (!$this.hasClass("active")) {
                                $this.addClass("active");
                            }
                        },
                        afterHide: function() {
                            if ($this.hasClass("active")) {
                                $this.removeClass("active");
                            }
                        }
                    });

                    if ($this.hasClass("active")) {
                        $.slidePanel.hide();
                    } else {
                        var url = $this.data("url");
                        if (!url) {
                            url = $this.attr("href");
                            url = url && url.replace(/.*(?=#[^\s]*$)/, "");
                        }

                        $.slidePanel.show({
                            url: url
                        }, options);
                    }
                });

                $(document).on("click", '[data-toggle="show-chat"]', function() {
                    $("#conversation").addClass("active");
                });


                $(document).on("click", '[data-toggle="close-chat"]', function() {
                    $("#conversation").removeClass("active");
                });
            }
        };



        var ctor = function(){
            var self = this;
            this.initialized=false;
        };

        ctor.prototype.init = function(){
            var _this =this;
            hard();
            remarkSite.run();
        // if(!_this.initialized){

        //     _this.initialized=true;
        // }
        // else{
        //     remarkSite.menu.refresh()
        //     remarkSite.menubar.reset();
        //     remarkSite.menubar.update();
        //      remarkSite.run();
        // }
        }

        return new ctor();

    });
