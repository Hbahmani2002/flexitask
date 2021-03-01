var less         = require("gulp-less");
var gulp         = require("gulp");
var autoprefixer = require("gulp-autoprefixer");
var csscomb      = require("gulp-csscomb");
var cleanCSS     = require("gulp-clean-css");
var rename       = require("gulp-rename");
var plumber      = require("gulp-plumber");
var args         = require("yargs").argv;
var merge        = require("merge-stream");
var gnf = require("gulp-npm-files");

// config
var config = require("../../../config.json");



module.exports = function () {
    var s1=  gulp.src(["./package.json","./app.js"])
        .pipe(plumber())
        .pipe(gulp.dest(config.build.root));

    var reportOptions = {
     	err: true, // default = true, false means don't write err
     	stderr: true, // default = true, false means don't write stderr
     	stdout: true // default = true, false means don't write stdout
    };

    var s2= gulp.src(gnf(), {base:"./"})
        .pipe(gulp.dest(config.build.root));



    return merge(s1,s2);
};
