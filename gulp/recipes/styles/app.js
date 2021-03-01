var less         = require('gulp-less');
var gulp         = require('gulp');
var autoprefixer = require('gulp-autoprefixer');
var csscomb      = require('gulp-csscomb');
var cleanCss = require("gulp-clean-css");
var rename       = require("gulp-rename");
var plumber      = require('gulp-plumber');

// config
var config = require('../../../config.json');

// options
var options = require('../../options/styles');


module.exports = function () {
  return gulp.src(config.source.less + '/app.less')
    .pipe(plumber())
    .pipe(less(options.less))
    .pipe(autoprefixer(options.autoprefixer))
    .pipe(csscomb(options.csscomb))
    .pipe(gulp.dest(config.destination.css))

    .pipe(cleanCss(options.minify))
    .pipe(rename({
      extname: '.min.css'
    }))
    .pipe(gulp.dest(config.destination.css));
};
