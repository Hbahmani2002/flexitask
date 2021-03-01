
var jeditor = require("gulp-json-editor");
var gulp         = require("gulp");
var args         = require("yargs").argv;
// config
var config = require("../../../config.json");



module.exports = function ()
 {
    return gulp.src(config.destination.root+"/config.json")
       .pipe(jeditor({
           version: args.finalVersion
       }))
       .pipe(gulp.dest(config.build.public));
};
