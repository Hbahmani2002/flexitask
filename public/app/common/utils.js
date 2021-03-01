define(["underscore", "moment", "knockout", "config"],
    function (_, moment, ko, config) {

        var rCRLF = /\r?\n/g;
        document.head || (document.head = document.getElementsByTagName("head")[0]);


        function isLetter(str) {
            return /^[a-zA-Z]+$/.test(str);
        }

        function isUpper(str) {
            return str == str.toUpperCase()
        }

        function isLower(str) {
            return str == str.toLowerCase()
        }

        function isDigit(str) {
            if ("0123456789".indexOf(str) !== -1) {
                return true;
            }
            return false;
        }



        function PasswordService() {
            var strongThreshold = 20;
            var veryStrongThreshold = 40;

            var calculatePasswordStrength = function (password) {
                if (!password || password.length === 0) {
                    throw new Error("Password cannot be empty");
                }

                var strength = 0;
                var length = password.length;
                if (length > 7) {
                    strength += 10;
                    strength += (length - 7);
                }


                var digitCount = 0;
                var letterCount = 0;
                var lowerCount = 0;
                var upperCount = 0;
                var symbolCount = 0;

                for (var idx = 0; idx < length; ++idx) {

                    var ch = password[idx];

                    if (isLetter(ch)) {
                        ++letterCount;
                        if (isUpper(ch)) {
                            ++upperCount;
                        } else {
                            ++lowerCount;
                        }
                    } else if (isDigit(ch)) {
                        ++digitCount;
                    } else {
                        ++symbolCount;
                    }
                }

                strength += (upperCount + lowerCount + symbolCount);

                // bonus: letters and digits
                if (letterCount >= 2 && digitCount >= 2) {
                    strength += (letterCount + digitCount);
                }

                return strength;
            }

            this.isWeak = function (password) {
                return calculatePasswordStrength(password) < strongThreshold;
            }

            this.isStrong = function (password) {
                return calculatePasswordStrength(password) >= strongThreshold;
            }

            this.isVeryStrong = function (password) {
                return calculatePasswordStrength(password) >= veryStrongThreshold;
            }
        }




        function svgUtil() {


            var doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';

            function isElement(obj) {
                return obj instanceof HTMLElement || obj instanceof SVGElement;
            }

            function requireDomNode(el) {
                if (!isElement(el)) {
                    throw new Error("an HTMLElement or SVGElement is required; got " + el);
                }
            }

            function isExternal(url) {
                return url && url.lastIndexOf("http", 0) == 0 && url.lastIndexOf(window.location.host) == -1;
            }

            function inlineImages(el, callback) {
                requireDomNode(el);

                var images = el.querySelectorAll("image"),
                    left = images.length,
                    checkDone = function () {
                        if (left === 0) {
                            callback();
                        }
                    };

                checkDone();
                for (var i = 0; i < images.length; i++) {
                    (function (image) {
                        var href = image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
                        if (href) {
                            if (isExternal(href.value)) {
                                console.warn("Cannot render embedded images linking to external hosts: " + href.value);
                                return;
                            }
                        }
                        var canvas = document.createElement("canvas");
                        var ctx = canvas.getContext("2d");
                        var img = new Image();
                        href = href || image.getAttribute("href");
                        if (href) {
                            img.src = href;
                            img.onload = function () {
                                canvas.width = img.width;
                                canvas.height = img.height;
                                ctx.drawImage(img, 0, 0);
                                image.setAttributeNS("http://www.w3.org/1999/xlink", "href", canvas.toDataURL("image/png"));
                                left--;
                                checkDone();
                            };
                            img.onerror = function () {
                                console.log("Could not load " + href);
                                left--;
                                checkDone();
                            };
                        } else {
                            left--;
                            checkDone();
                        }
                    })(images[i]);
                }
            }

            function styles(el, selectorRemap) {
                var css = "";
                var sheets = document.styleSheets;
                for (var i = 0; i < sheets.length; i++) {
                    try {
                        var rules = sheets[i].cssRules;
                    } catch (e) {
                        console.warn("Stylesheet could not be loaded: " + sheets[i].href);
                        continue;
                    }

                    if (rules != null) {
                        for (var j = 0; j < rules.length; j++) {
                            var rule = rules[j];
                            if (typeof (rule.style) != "undefined") {
                                var match, selectorText;

                                try {
                                    selectorText = rule.selectorText;
                                } catch (err) {
                                    console.warn('The following CSS rule has an invalid selector: "' + rule + '"', err);
                                }

                                try {
                                    if (selectorText) {
                                        match = el.querySelector(selectorText);
                                    }
                                } catch (err) {
                                    console.warn('Invalid CSS selector "' + selectorText + '"', err);
                                }

                                if (match) {
                                    var selector = selectorRemap ? selectorRemap(rule.selectorText) : rule.selectorText;
                                    css += selector + " { " + rule.style.cssText + " }\n";
                                } else if (rule.cssText.match(/^@font-face/)) {
                                    css += rule.cssText + "\n";
                                }
                            }
                        }
                    }
                }
                return css;
            }

            function getDimension(el, clone, dim) {
                var v = (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal[dim]) ||
                    (clone.getAttribute(dim) !== null && !clone.getAttribute(dim).match(/%$/) && parseInt(clone.getAttribute(dim))) ||
                    el.getBoundingClientRect()[dim] ||
                    parseInt(clone.style[dim]) ||
                    parseInt(window.getComputedStyle(el).getPropertyValue(dim));
                return (typeof v === "undefined" || v === null || isNaN(parseFloat(v))) ? 0 : v;
            }

            function reEncode(data) {
                data = encodeURIComponent(data);
                data = data.replace(/%([0-9A-F]{2})/g, function (match, p1) {
                    var c = String.fromCharCode("0x" + p1);
                    return c === "%" ? "%25" : c;
                });
                return decodeURIComponent(data);
            }

            var instance = {};
            instance.svgAsDataUri = function (el, options, cb) {
                requireDomNode(el);

                options = options || {};
                options.scale = options.scale || 1;
                options.responsive = options.responsive || false;
                var xmlns = "http://www.w3.org/2000/xmlns/";

                inlineImages(el, function () {
                    var outer = document.createElement("div");
                    var clone = el.cloneNode(true);
                    var width, height;
                    if (el.tagName.toLowerCase() == "svg") {
                        width = options.width || getDimension(el, clone, "width");
                        height = options.height || getDimension(el, clone, "height");
                    } else if (el.getBBox) {
                        var box = el.getBBox();
                        width = box.x + box.width;
                        height = box.y + box.height;
                        clone.setAttribute("transform", clone.getAttribute("transform").replace(/translate\(.*?\)/, ""));

                        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                        svg.appendChild(clone);
                        clone = svg;
                    } else {
                        console.error("Attempted to render non-SVG element", el);
                        return;
                    }

                    clone.setAttribute("version", "1.1");
                    if (!clone.getAttribute("xmlns")) {
                        clone.setAttributeNS(xmlns, "xmlns", "http://www.w3.org/2000/svg");
                    }
                    if (!clone.getAttribute("xmlns:xlink")) {
                        clone.setAttributeNS(xmlns, "xmlns:xlink", "http://www.w3.org/1999/xlink");
                    }

                    if (options.responsive) {
                        clone.removeAttribute("width");
                        clone.removeAttribute("height");
                        clone.setAttribute("preserveAspectRatio", "xMinYMin meet");
                    } else {
                        clone.setAttribute("width", width * options.scale);
                        clone.setAttribute("height", height * options.scale);
                    }

                    clone.setAttribute("viewBox", [
                        options.left || 0,
                        options.top || 0,
                        width,
                        height
                    ].join(" "));

                    var fos = clone.querySelectorAll("foreignObject > *");
                    for (var i = 0; i < fos.length; i++) {
                        if (!fos[i].getAttributeNS("xml", "xmlns")) {
                            fos[i].setAttributeNS(xmlns, "xmlns", "http://www.w3.org/1999/xhtml");
                        }
                    }

                    outer.appendChild(clone);

                    var css = styles(el, options.selectorRemap);
                    var s = document.createElement("style");
                    s.setAttribute("type", "text/css");
                    s.innerHTML = "<![CDATA[\n" + css + "\n]]>";
                    var defs = document.createElement("defs");
                    defs.appendChild(s);
                    clone.insertBefore(defs, clone.firstChild);

                    var svg = doctype + outer.innerHTML;
                    var uri = "data:image/svg+xml;base64," + window.btoa(reEncode(svg));
                    if (cb) {
                        cb(uri);
                    }
                });
            };

            instance.svgAsPngUri = function (el, options, cb) {
                requireDomNode(el);

                instance.svgAsDataUri(el, options, function (uri) {
                    var image = new Image();
                    image.onload = function () {
                        var canvas = document.createElement("canvas");
                        canvas.width = image.width;
                        canvas.height = image.height;
                        var context = canvas.getContext("2d");
                        if (options && options.backgroundColor) {
                            context.fillStyle = options.backgroundColor;
                            context.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        context.drawImage(image, 0, 0);
                        var a = document.createElement("a"),
                            png;
                        try {
                            png = canvas.toDataURL("image/png");
                        } catch (e) {
                            if ((typeof SecurityError !== "undefined" && e instanceof SecurityError) || e.name == "SecurityError") {
                                console.error("Rendered SVG images cannot be downloaded in this browser.");
                                return;
                            } else {
                                throw e;
                            }
                        }
                        cb(png);
                    };
                    image.onerror = function () {
                        console.error(
                            "There was an error loading the data URI as an image on the following SVG\n",
                            window.atob(uri.slice(26)), "\n",
                            "Open the following link to see browser's diagnosis\n",
                            uri);
                    };
                    image.src = uri;
                });
            };

            function download(name, uri) {
                var a = document.createElement("a");
                a.download = name;
                a.href = uri;
                document.body.appendChild(a);
                a.addEventListener("click", function (e) {
                    a.parentNode.removeChild(a);
                });
                a.click();
            }

            instance.saveSvg = function (el, name, options) {
                requireDomNode(el);

                options = options || {};
                instance.svgAsDataUri(el, options, function (uri) {
                    download(name, uri);
                });
            };

            instance.saveSvgAsPng = function (el, name, options) {
                requireDomNode(el);

                options = options || {};
                instance.svgAsPngUri(el, options, function (uri) {
                    download(name, uri);
                });
            };

            return instance;
        }

        function iOS() {

            var iDevices = [
                "iPad Simulator",
                "iPhone Simulator",
                "iPod Simulator",
                "iPad",
                "iPhone",
                "iPod"
            ];

            while (iDevices.length) {
                if (navigator.platform === iDevices.pop()) {
                    return true;
                }
            }

            return false;
        }

        function getOrientation() {
            if (window.innerHeight > window.innerWidth) {
                return "portrait";
            } else if (window.innerHeight < window.innerWidth) {
                return "landscape";
            }
        }

        var hashTagRegex = /\B#\w*[a-zA-Z\u00E7\u011F\u0131\u015F\u00F6\u00FC\u00C7\u011E\u0130\u015E\u00D6\u00DCa-z-]+\b(?!#)\w*/gi;
        var mentionRegex = /\B@\w*[a-zA-Z0-9_]+\b(?!@)\w*/gi;
        var emojiRegex = /\B:\w*[a-zA-Z]+\b:(?!#)\w*/gi;

        var emojis = [
            "bowtie","smile","laughing","blush","smiley","relaxed","smirk","heart_eyes","kissing_heart","kissing_closed_eyes","flushed","relieved","satisfied","grin","wink","stuck_out_tongue_winking_eye","stuck_out_tongue_closed_eyes","grinning","kissing","kissing_smiling_eyes","stuck_out_tongue","sleeping","worried","frowning","anguished","open_mouth","grimacing","confused","hushed","expressionless","unamused","sweat_smile","sweat","disappointed_relieved","weary","pensive","disappointed","confounded","fearful","cold_sweat","persevere","cry","sob","joy","astonished","scream","neckbeard","tired_face","angry","rage","triumph","sleepy","yum","mask","sunglasses","dizzy_face","imp","smiling_imp","neutral_face","no_mouth","innocent","alien","yellow_heart","blue_heart","purple_heart","heart","green_heart","broken_heart","heartbeat","heartpulse","two_hearts","revolving_hearts","cupid","sparkling_heart","sparkles","star","star2","dizzy","boom","collision","anger","exclamation","question","grey_exclamation","grey_question","zzz","dash","sweat_drops","notes","musical_note","fire","hankey","poop","shit","thumbsup","-1","thumbsdown","ok_hand","punch","facepunch","fist","v","wave","hand","raised_hand","open_hands","point_up","point_down","point_left","point_right","raised_hands","pray","point_up_2","clap","muscle","metal","fu","walking","runner","running","couple","family","two_men_holding_hands","two_women_holding_hands","dancer","dancers","ok_woman","no_good","information_desk_person","raising_hand","bride_with_veil","person_with_pouting_face","person_frowning","bow","couplekiss","couple_with_heart","massage","haircut","nail_care","boy","girl","woman","man","baby","older_woman","older_man","person_with_blond_hair","man_with_gua_pi_mao","man_with_turban","construction_worker","cop","angel","princess","smiley_cat","smile_cat","heart_eyes_cat","kissing_cat","smirk_cat","scream_cat","crying_cat_face","joy_cat","pouting_cat","japanese_ogre","japanese_goblin","see_no_evil","hear_no_evil","speak_no_evil","guardsman","skull","feet","lips","kiss","droplet","ear","eyes","nose","tongue","love_letter","bust_in_silhouette","busts_in_silhouette","speech_balloon","thought_balloon","feelsgood","finnadie","goberserk","godmode","hurtrealbad","rage1","rage2","rage3","rage4","suspect","trollface","sunny","umbrella","cloud","snowflake","snowman","zap","cyclone","foggy","ocean","cat","dog","mouse","hamster","rabbit","wolf","frog","tiger","koala","bear","pig","pig_nose","cow","boar","monkey_face","monkey","horse","racehorse","camel","sheep","elephant","panda_face","snake","bird","baby_chick","hatched_chick","hatching_chick","chicken","penguin","turtle","bug","honeybee","ant","beetle","snail","octopus","tropical_fish","fish","whale","whale2","dolphin","cow2","ram","rat","water_buffalo","tiger2","rabbit2","dragon","goat","rooster","dog2","pig2","mouse2","ox","dragon_face","blowfish","crocodile","dromedary_camel","leopard","cat2","poodle","paw_prints","bouquet","cherry_blossom","tulip","four_leaf_clover","rose","sunflower","hibiscus","maple_leaf","leaves","fallen_leaf","herb","mushroom","cactus","palm_tree","evergreen_tree","deciduous_tree","chestnut","seedling","blossom","ear_of_rice","shell","globe_with_meridians","sun_with_face","full_moon_with_face","new_moon_with_face","new_moon","waxing_crescent_moon","first_quarter_moon","waxing_gibbous_moon","full_moon","waning_gibbous_moon","last_quarter_moon","waning_crescent_moon","last_quarter_moon_with_face","first_quarter_moon_with_face","moon","earth_africa","earth_americas","earth_asia","volcano","milky_way","partly_sunny","octocat","squirrel","bamboo","gift_heart","dolls","school_satchel","mortar_board","flags","fireworks","sparkler","wind_chime","rice_scene","jack_o_lantern","ghost","santa","christmas_tree","gift","bell","no_bell","tanabata_tree","tada","confetti_ball","balloon","crystal_ball","cd","dvd","floppy_disk","camera","video_camera","movie_camera","computer","tv","iphone","phone","telephone","telephone_receiver","pager","fax","minidisc","vhs","sound","speaker","mute","loudspeaker","mega","hourglass","hourglass_flowing_sand","alarm_clock","watch","radio","satellite","loop","mag","mag_right","unlock","lock","lock_with_ink_pen","closed_lock_with_key","key","bulb","flashlight","high_brightness","low_brightness","electric_plug","battery","calling","email","mailbox","postbox","bath","bathtub","shower","toilet","wrench","nut_and_bolt","hammer","seat","moneybag","yen","dollar","pound","euro","credit_card","money_with_wings","e-mail","inbox_tray","outbox_tray","envelope","incoming_envelope","postal_horn","mailbox_closed","mailbox_with_mail","mailbox_with_no_mail","door","smoking","bomb","gun","hocho","pill","syringe","page_facing_up","page_with_curl","bookmark_tabs","bar_chart","chart_with_upwards_trend","chart_with_downwards_trend","scroll","clipboard","calendar","date","card_index","file_folder","open_file_folder","scissors","pushpin","paperclip","black_nib","pencil2","straight_ruler","triangular_ruler","closed_book","green_book","blue_book","orange_book","notebook","notebook_with_decorative_cover","ledger","books","bookmark","name_badge","microscope","telescope","newspaper","football","basketball","soccer","baseball","tennis","8ball","rugby_football","bowling","golf","mountain_bicyclist","bicyclist","horse_racing","snowboarder","swimmer","surfer","ski","spades","hearts","clubs","diamonds","gem","ring","trophy","musical_score","musical_keyboard","violin","space_invader","video_game","black_joker","flower_playing_cards","game_die","dart","mahjong","clapper","memo","pencil","book","art","microphone","headphones","trumpet","saxophone","guitar","shoe","sandal","high_heel","lipstick","boot","shirt","tshirt","necktie","womans_clothes","dress","running_shirt_with_sash","jeans","kimono","bikini","ribbon","tophat","crown","womans_hat","mans_shoe","closed_umbrella","briefcase","handbag","pouch","purse","eyeglasses","fishing_pole_and_fish","coffee","tea","sake","baby_bottle","beer","beers","cocktail","tropical_drink","wine_glass","fork_and_knife","pizza","hamburger","fries","poultry_leg","meat_on_bone","spaghetti","curry","fried_shrimp","bento","sushi","fish_cake","rice_ball","rice_cracker","rice","ramen","stew","oden","dango","egg","bread","doughnut","custard","icecream","ice_cream","shaved_ice","birthday","cake","cookie","chocolate_bar","candy","lollipop","honey_pot","apple","green_apple","tangerine","lemon","cherries","grapes","watermelon","strawberry","peach","melon","banana","pear","pineapple","sweet_potato","eggplant","tomato","corn","house","house_with_garden","school","office","post_office","hospital","bank","convenience_store","love_hotel","hotel","wedding","church","department_store","european_post_office","city_sunrise","city_sunset","japanese_castle","european_castle","tent","factory","tokyo_tower","japan","mount_fuji","sunrise_over_mountains","sunrise","stars","statue_of_liberty","bridge_at_night","carousel_horse","rainbow","ferris_wheel","fountain","roller_coaster","ship","speedboat","boat","sailboat","rowboat","anchor","rocket","airplane","helicopter","steam_locomotive","tram","mountain_railway","bike","aerial_tramway","suspension_railway","mountain_cableway","tractor","blue_car","oncoming_automobile","car","red_car","taxi","oncoming_taxi","articulated_lorry","bus","oncoming_bus","rotating_light","police_car","oncoming_police_car","fire_engine","ambulance","minibus","truck","train","station","train2","bullettrain_front","bullettrain_side","light_rail","monorail","railway_car","trolleybus","ticket","fuelpump","vertical_traffic_light","traffic_light","warning","construction","beginner","atm","slot_machine","busstop","barber","hotsprings","checkered_flag","crossed_flags","izakaya_lantern","moyai","circus_tent","performing_arts","round_pushpin","triangular_flag_on_post","jp","kr","cn","us","fr","es","it","ru","gb","uk","de","one","two","three","four","five","six","seven","eight","nine","keycap_ten","1234","zero","hash","symbols","arrow_backward","arrow_down","arrow_forward","arrow_left","capital_abcd","abcd","abc","arrow_lower_left","arrow_lower_right","arrow_right","arrow_up","arrow_upper_left","arrow_upper_right","arrow_double_down","arrow_double_up","arrow_down_small","arrow_heading_down","arrow_heading_up","leftwards_arrow_with_hook","arrow_right_hook","left_right_arrow","arrow_up_down","arrow_up_small","arrows_clockwise","arrows_counterclockwise","rewind","fast_forward","information_source","ok","twisted_rightwards_arrows","repeat","repeat_one","new","top","up","cool","free","ng","cinema","koko","signal_strength","u5272","u5408","u55b6","u6307","u6708","u6709","u6e80","u7121","u7533","u7a7a","u7981","sa","restroom","mens","womens","baby_symbol","no_smoking","parking","wheelchair","metro","baggage_claim","accept","wc","potable_water","put_litter_in_its_place","secret","congratulations","m","passport_control","left_luggage","customs","ideograph_advantage","cl","sos","id","no_entry_sign","underage","no_mobile_phones","do_not_litter","non-potable_water","no_bicycles","no_pedestrians","children_crossing","no_entry","eight_spoked_asterisk","eight_pointed_black_star","heart_decoration","vs","vibration_mode","mobile_phone_off","chart","currency_exchange","aries","taurus","gemini","cancer","leo","virgo","libra","scorpius","sagittarius","capricorn","aquarius","pisces","ophiuchus","six_pointed_star","negative_squared_cross_mark","a","b","ab","o2","diamond_shape_with_a_dot_inside","recycle","end","on","soon","clock1","clock130","clock10","clock1030","clock11","clock1130","clock12","clock1230","clock2","clock230","clock3","clock330","clock4","clock430","clock5","clock530","clock6","clock630","clock7","clock730","clock8","clock830","clock9","clock930","heavy_dollar_sign","copyright","registered","tm","x","heavy_exclamation_mark","bangbang","interrobang","o","heavy_multiplication_x","heavy_plus_sign","heavy_minus_sign","heavy_division_sign","white_flower","100","heavy_check_mark","ballot_box_with_check","radio_button","link","curly_loop","wavy_dash","part_alternation_mark","trident","black_square","white_square","white_check_mark","black_square_button","white_square_button","black_circle","white_circle","red_circle","large_blue_circle","large_blue_diamond","large_orange_diamond","small_blue_diamond","small_orange_diamond","small_red_triangle","small_red_triangle_down","shipit"
        ];
        var emojiList = _.map(emojis, function (value, i) {
            return {
                key: value,
                name: value
            }
        });


        return {
            passwordService: new PasswordService(),
           
            emojiRegex: emojiRegex,
            emojiList: emojiList,
            svgUtil: svgUtil(),
        
            changeFavicon: function (src) {
                var link = document.createElement("link"),
                    oldLink = document.getElementById("dynamic-favicon");
                link.id = "dynamic-favicon";
                link.rel = "icon";
                link.type = "image/png";
                link.link = src;
                link.href = src;
                if (oldLink) {
                    document.head.removeChild(oldLink);
                }
                document.head.appendChild(link);
            },
            exponentialBackoff: function (toTry, max, delay, callback) {
                console.log("max", max, "next delay", delay);
                var result = toTry();

                if (result) {
                    callback(result);
                } else {
                    if (max > 0) {
                        setTimeout(function () {
                            exponentialBackoff(toTry, --max, delay * 2, callback);
                        }, delay);

                    } else {
                        console.log("we give up");
                    }
                }
            },

            getRequestIdFromXhr: function (args) {
                var xhr = null;
                if (args) {
                    xhr = args[2];
                } else {
                    xhr = arguments.callee.caller.arguments[2];
                }
                return xhr.getResponseHeader("X-RequestId");
            },
            loadCss: function (url) {
                var link = document.createElement("link");
                link.type = "text/css";
                link.rel = "stylesheet";
                link.href = url;
                document.getElementsByTagName("head")[0].appendChild(link);
            },
            getDateFormat: function () {
                return config.dateFormat || moment.localeData().longDateFormat("L");
            },
            formatDate: function (date, format) {
                if (typeof format === "undefined")
                    format = config.dateFormat;
                var d = ko.utils.unwrapObservable(date);
                var formattedDate = moment(d);
                var isValid = formattedDate.isValid();
                if (isValid) {
                    return moment(d).format(format);
                } else {
                    return "";
                }

            },
            formatDateTime: function (date, format) {
                if (typeof format === "undefined")
                    format = config.dateTimeFormat;

                var d = ko.utils.unwrapObservable(date);
                var mo = moment(d);
                if (mo.hours() === 0 && mo.minutes() === 0) {
                    return moment(d).format(config.dateFormat);
                }
                return moment(d).format(format);
            },
            formatLogDateTime: function (date, format) {
                if (typeof format === "undefined")
                    format = config.dateTimeFormat;

                var d = ko.utils.unwrapObservable(date) || date;
                var mo = moment(d);

                var now = moment();

                var timeDelta = now.diff(mo, "hours");
                if (timeDelta <= 24 && timeDelta >= -24) {
                    format = "dddd HH:mm";
                    return moment(d).calendar();

                } else {
                    format = "DD MMMM YYYY ddd HH:mm";
                    return moment(d).format(format);

                }
            },
            formatTaskLogDateTime: function (date, format) {
                if (typeof format === "undefined")
                    format = config.dateTimeFormat;

                var d = ko.utils.unwrapObservable(date) || date;


                format = "DD MMMM YYYY ddd HH:mm";
                return moment(d).format(format);


            },
            timeFromNow: function (date, format) {
                if (typeof format === "undefined")
                    format = "";
                var d = ko.utils.unwrapObservable(date) || date;
                return moment(d).fromNow();
            },
            now: function () {
                return moment();
            },
            humanizeBytes: function (bytes) {
                bytes = ko.unwrap(bytes) || 0;
                var sizes = ["Bytes", "KB", "MB", "GB", "TB"];
                if (bytes == 0) return "0 Byte";
                var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
                return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
            },
           
            
            emptyGuid: "00000000-0000-0000-0000-000000000000",
            newGuid: function () {
                function s4() {
                    return Math.floor((1 + Math.random()) * 0x10000)
                        .toString(16)
                        .substring(1);
                }

                return s4() + s4() + "-" + s4() + "-" + s4() + "-" +
                    s4() + "-" + s4() + s4() + s4();
            },
            slug: function (str) {
                if (!arguments.callee.re) {
                    // store these around so we can reuse em.
                    arguments.callee.re = [/[^a-z0-9]+/ig, /^-+|-+$/g];
                    // the first RE matches any sequence of characters not a-z or 0-9, 1 or more
                    // characters, and gets replaced with a '-'  the other pattern matches '-'
                    // at the beginning or end of a string and gets replaced with ''
                }
                return str.toLowerCase()
                    // replace all non alphanum (1 or more at a time) with '-'
                    .replace(arguments.callee.re[0], "-")
                    // replace any starting or trailing dashes with ''
                    .replace(arguments.callee.re[1], "");
            },
            convertToArray: function (obj, properties, delimiter) {
                properties.forEach(function (prop) {
                    if (obj[prop] && $.isArray(obj[prop]) == false)
                        obj[prop] = obj[prop].split(delimiter);
                    else {
                        obj[prop] = [];
                    }
                });
            },
            browser: {
                getClientType: function () {
                    var Return_Device;
                    if (/(up.browser|up.link|mmp|symbian|smartphone|midp|wap|phone|android|iemobile|w3c|acs\-|alav|alca|amoi|audi|avan|benq|bird|blac|blaz|brew|cell|cldc|cmd\-|dang|doco|eric|hipt|inno|ipaq|java|jigs|kddi|keji|leno|lg\-c|lg\-d|lg\-g|lge\-|maui|maxo|midp|mits|mmef|mobi|mot\-|moto|mwbp|nec\-|newt|noki|palm|pana|pant|phil|play|port|prox|qwap|sage|sams|sany|sch\-|sec\-|send|seri|sgh\-|shar|sie\-|siem|smal|smar|sony|sph\-|symb|t\-mo|teli|tim\-|tosh|tsm\-|upg1|upsi|vk\-v|voda|wap\-|wapa|wapi|wapp|wapr|webc|winw|winw|xda|xda\-) /i.test(navigator.userAgent)) {
                        if (/(tablet|ipad|playbook)|(android(?!.*(mobi|opera mini)))/i.test(navigator.userAgent)) {
                            Return_Device = "tablet";
                        } else {
                            Return_Device = "mobile";
                        }
                    } else if (/(tablet|ipad|playbook)|(android(?!.*(mobi|opera mini)))/i.test(navigator.userAgent)) {
                        Return_Device = "tablet";
                    } else if (/(Electron|Electron)/i.test(navigator.userAgent)) {
                        Return_Device = "desktop";
                    } else {
                        Return_Device = "browser";
                    }

                    return Return_Device;
                },
                isAndroid: function () {
                    return navigator.userAgent.match(/Android/i);
                },
                isBlackBerry: function () {
                    return navigator.userAgent.match(/BlackBerry/i);
                },
                isIOS: function () {
                    return iOS() || navigator.userAgent.match(/iPhone|iPad|iPod/i);
                },
                isOpera: function () {
                    return navigator.userAgent.match(/Opera Mini/i);
                },
                isWindows: function () {
                    return navigator.userAgent.match(/IEMobile/i) || navigator.userAgent.match(/WPDesktop/i);
                },
                isMobile: function () {
                    var t = this;
                    return (t.isAndroid() || t.isBlackBerry() || t.isIOS() || t.isOpera() || t.isWindows()) || false;
                },
                isBreakpoint: function (alias) {
                    return $(".device-" + alias).is(":visible");
                },
                isIpad: function () {
                    var matches = this.isIOS();
                    if (typeof matches === "boolean") {
                        return matches;
                    }
                    if (matches && matches[0] === "iPad") {
                        return true;
                    }

                    return false;
                },
                isXsMobileScreen: function () {
                    return this.isBreakpoint("xs") || (this.getOrientation() === "portrait" && this.isIpad());
                },
                isSingleColumnScreen: function () {
                    return this.isBreakpoint("xs");
                },
                getOrientation: getOrientation
            },
            isExternal: isExternal,
            getQueryStringByName: function (name) {
                name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
                var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                    results = regex.exec(location.search);
                return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
            },
            getUrlVarsFromString: function (str) {
                var vars = [],
                    hash;
                var hashes = str.slice(str.indexOf("?") + 1).split("&");
                for (var i = 0; i < hashes.length; i++) {
                    hash = hashes[i].split("=");
                    vars.push(hash[0]);
                    vars[hash[0]] = hash[1];
                }
                return vars;
            },
            getUrlVars: function () {
                var vars = [],
                    hash;
                var hashes = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
                for (var i = 0; i < hashes.length; i++) {
                    hash = hashes[i].split("=");
                    vars.push(hash[0]);
                    vars[hash[0]] = hash[1];
                }
                return vars;
            },
            toFormData: function (obj) {
                var _this = this;
                var arr = [];
                _.each(_.keys(obj), function (key) {
                    var val = obj[key];
                    if (typeof val === "undefined" || val === null) {

                    } else {
                        if (_.isArray(val)) {
                            _.each(val, function (v) {
                                arr.push({
                                    name: key,
                                    value: v.replace(rCRLF, "\r\n")
                                });
                            });
                        } else {
                            arr.push({
                                name: key,
                                value: val.replace(rCRLF, "\r\n")
                            });
                        }
                    }
                });

                return arr;
            },
            toQueryString: function (data, prefix) {
                var _this = this;
                var obj = ko.toJS(data);
                _.each(_.keys(obj), function (key) {
                    var v = obj[key];
                    if (_.isArray(v)) {
                        obj[key] = v.join(",");
                    }
                });
                var str = [];
                for (var p in obj) {
                    if (obj.hasOwnProperty(p) && typeof obj[p] != "function") {
                        var k = prefix ? prefix + "[" + p + "]" : p,
                            v = obj[p];
                        if (typeof v !== "undefined" && v != null) {
                            str.push(typeof v == "object" ? _this.toQueryString(v, k) : encodeURIComponent(k) + "=" + encodeURIComponent(v));

                        }
                    }
                }
                return str.join("&");
            }
        };


        function isExternal(url) {
            var match = url.match(/^([^:\/?#]+:)?(?:\/\/([^\/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/);
            if (typeof match[1] === "string" && match[1].length > 0 && match[1].toLowerCase() !== location.protocol) return true;
            if (typeof match[2] === "string" && match[2].length > 0 && match[2].replace(new RegExp(":(" + {
                    "http:": 80,
                    "https:": 443
                }[location.protocol] + ")?$"), "") !== location.host) return true;
            return false;
        }

    });