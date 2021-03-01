var less         = require("gulp-less");
var gulp         = require("gulp");
var autoprefixer = require("gulp-autoprefixer");
var csscomb      = require("gulp-csscomb");
var cleanCSS     = require("gulp-clean-css");
var rename       = require("gulp-rename");
var plumber      = require("gulp-plumber");
var flatten      = require("gulp-flatten");
var merge       = require("merge-stream");

// config
var config = require("../../../config.json");

// options
var options = require("../../options/fonts");

module.exports = function () {
    return gulp.src([config.source.fonts  + "/**/*.{svg,eot,ttf,woff,woff2}"])
        .pipe(plumber())
        .pipe(flatten())
        .pipe(gulp.dest(config.destination.fonts));
};
