var gulp       = require("gulp");
var plumber    = require("gulp-plumber");
var header     = require("gulp-header");
var uglify     = require("gulp-uglify");
var rename     = require("gulp-rename");
// var notify     = require('gulp-notify');

// utils
// var pumped     = require('../../utils/pumped');

// config
var config = require("../../../config.json");

// options
var options = require("../../options/scripts");

module.exports = function () {
    return gulp.src([config.destination.vendor  + "/*/*.js", "!" + config.destination.vendor  + "/*/*.min.js","!" + config.destination.vendor  + "/*/*-min.js"])
        .pipe(plumber())
        .pipe(uglify())
        .pipe(header(options.banner))
        .pipe(rename({
            extname: ".min.js"
        }))
        .pipe(gulp.dest(config.destination.vendor));

    // .pipe(notify({
    //   message: pumped('JS Generated & Minified!'),
    //   onLast: true
    // }));
};
