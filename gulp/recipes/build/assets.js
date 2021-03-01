var less         = require("gulp-less");
var gulp         = require("gulp");
var autoprefixer = require("gulp-autoprefixer");
var csscomb      = require("gulp-csscomb");
var cleanCSS     = require("gulp-clean-css");
var rename       = require("gulp-rename");
var plumber      = require("gulp-plumber");
var args         = require("yargs").argv;
var merge        = require("merge-stream");

// config
var config = require("../../../config.json");



module.exports = function ()
 {
    var assetsStream =  gulp.src([config.destination.assets  + "/**/*.*","!"+config.source.root+"/**/*.*"])
        .pipe(plumber())
        .pipe(gulp.dest(config.build.public+"/assets"));

    var htmlStream = gulp.src([config.destination.root+"/*.+(html|json)"])
        .pipe(plumber())
        .pipe(gulp.dest(config.build.public));

    var jsStream = gulp.src([config.destination.root]+"/**.js")
        .pipe(plumber())
        .pipe(gulp.dest(config.build.public));

    return merge(assetsStream,htmlStream,jsStream);
};
