
define(["underscore", "knockout", "config", "jquery"],
function (_, ko, config, $) {

    var defaultOptions = {
        name: "Name",
        seed: 0,
        charCount: 2,
        textColor: "#ffffff",
        height: 100,
        width: 100,
        fontSize: 40,
        fontWeight: 400,
        fontFamily: "HelveticaNeue-Light,Helvetica Neue Light,Helvetica Neue,Helvetica, Arial,Lucida Grande, sans-serif",
        radius: 0,
        color: null,
        serialize: true
    };

    // Defining Colors
    var colors = ["#1abc9c", "#16a085", "#f1c40f", "#f39c12", "#2ecc71", "#27ae60", "#e67e22", "#d35400", "#3498db", "#2980b9", "#e74c3c", "#c0392b", "#9b59b6", "#8e44ad", "#bdc3c7", "#34495e", "#2c3e50", "#95a5a6", "#7f8c8d", "#ec87bf", "#d870ad", "#f69785", "#9ba37e", "#b49255", "#b49255", "#a94136"];


    function createInitial(options) {
        if (typeof options === "string") {
            options = { name: options };
        }

        options = $.extend(true, {}, defaultOptions, options);
        var settings = $.extend({
            // Default settings
            name: "Name",
            seed: 0,
            charCount: 1,
            textColor: "#ffffff",
            height: 100,
            width: 100,
            fontSize: 60,
            fontWeight: 400,
            fontFamily: "HelveticaNeue-Light,Helvetica Neue Light,Helvetica Neue,Helvetica, Arial,Lucida Grande, sans-serif",
            radius: 0
        }, options);


        // making the text object
        var c = options.name.substr(0, options.charCount).toUpperCase();
        var cobj = $('<text text-anchor="middle"></text>').attr({
            "y": "50%",
            "x": "50%",
            "dy": "0.35em",
            "pointer-events": "auto",
            "fill": options.textColor,
            "font-family": options.fontFamily
        }).html(c).css({
            "font-weight": options.fontWeight,
            "font-size": options.fontSize + "px"
        });

        var color = options.color;
        if (!color) {
            var colorIndex = Math.floor((c.charCodeAt(0) + options.seed) % colors.length);
            color = colors[colorIndex];
        }


        var svg = $("<svg></svg>").attr({
            "xmlns": "http://www.w3.org/2000/svg",
            "pointer-events": "none",
            "width": options.width,
            "height": options.height
        }).css({
            "background-color": color,
            "width": options.width + "px",
            "height": options.height + "px",
            "border-radius": options.radius + "px",
            "-moz-border-radius": options.radius + "px"
        });

        svg.append(cobj);
        // svg.append(group);
        if (options.serialize)
        {
            var svgHtml = window.btoa(unescape(encodeURIComponent($("<div>").append(svg.clone()).html())));
            return "data:image/svg+xml;base64," + svgHtml;
        } else {
            return svg.clone();
        }
    }

    return {
        create: createInitial
    };
});
