var gulp = require("gulp");
var plumber = require("gulp-plumber");
var durandal = require("gulp-durandal");
var merge = require("merge-stream");
var header = require("gulp-header");
var uglify = require("gulp-uglify");
var jsonminify = require("gulp-jsonminify");
var args = require("yargs").argv;
var usemin = require("gulp-usemin");
var autoprefixer = require("gulp-autoprefixer");
var csscomb = require("gulp-csscomb");
var cleanCSS = require("gulp-clean-css");


// config
var config = require("../../../config.json");

var jsOptions = require("../../options/scripts");


var cssOptions = require("../../options/styles");

module.exports = function () {
    return gulp.src(config.destination.root + "/index.html")
      .pipe(plumber())
      .pipe(usemin({
          js: [uglify(), header(jsOptions.banner)],
          fonts: [],
          css: [autoprefixer(cssOptions.autoprefixer), csscomb(cssOptions.csscomb), cleanCSS(cssOptions.cleanCSS), header(cssOptions.banner)],
          kendocss: []
      }))
      .pipe(gulp.dest(config.build.public));
};
