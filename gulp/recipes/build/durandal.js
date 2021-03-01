var gulp = require("gulp");
var plumber = require("gulp-plumber");
var durandal = require("gulp-durandal");
var merge = require("merge-stream");
var header = require("gulp-header");
var uglify = require("gulp-uglify");
var jsonminify = require("gulp-jsonminify")
var args = require("yargs").argv;


// config
var config = require("../../../config.json");

// options
var options = require("../../options/scripts");

module.exports = function () {
    var durandalStream = durandal({
        baseDir: config.build.durandalAppSource, //same as default, so not really required.
        main: "main.js", //same as default, so not really required.
        output: "main.js", //same as default, so not really required.
        //extraModules:['text!views/templates/comment-view.html'],
        durandalDynamicModules: true,
        almond: false,
        minify: true,
        verbose: true,
        rjsConfigAdapter: function (config) {
            var env = args.env || "dev";
            config.paths = {
                kendo: "empty:",
                JSZip: "empty:"
            }
            config.pragmas = {
                env: env
            };
            console.log("Build environment: " + env);

            config.insertRequire = ["main"];
            config.uglify2= {
                compress: {
                    global_defs: {
                        DEBUG: false
                    }
                },
                warnings: true
            };
            return config;
        }
    })
      
        .on("error", function (err) {
            this.emit("end");
            process.exit(1);
            throw err;

        })
       // .pipe(uglify())
        .pipe(gulp.dest(config.build.public + "/app/"))
       
        //.pipe(gulp.dest(config.build.public + "/app/main.min.js"));

    var localeCopyStream = gulp.src([config.build.durandalAppSource + "/locales/**"])
        .pipe(plumber())
        .pipe(jsonminify())
        .pipe(gulp.dest(config.build.public + "/app/locales/"))

    return merge(durandalStream, localeCopyStream);
};