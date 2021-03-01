var gulp = require("gulp");
var fancyLog    = require('fancy-log');
var colors = require('ansi-colors');
var sequence = require("run-sequence");
var args = require("yargs").argv;
var plumber = require("gulp-plumber");
var uglify = require("gulp-uglify");
var rename = require("gulp-rename");
var tsm = require("teamcity-service-messages");
var gulpPrint = require("gulp-print");
var exec = require('child_process').exec;
var webserver = require('gulp-webserver');

gulp.task('webserver', function() {
    gulp.src('./build')
      .pipe(webserver({
        livereload: true,
        directoryListing: false,
        open: true
      }));
  });

// utils
var lazyQuire = require("./gulp/utils/lazyQuire");
var pumped = require("./gulp/utils/pumped");
var notifaker = require("./gulp/utils/notifaker");

// config
var config = require("./config.json");
var pakic = require("./package.json");



// gulpfile booting message
fancyLog(colors.green("Starting to Gulp! Please wait..."));


/**
 * Html validation
 */
gulp.task("bootlint", [], lazyQuire(require, "./gulp/recipes/html/bootlint"));
gulp.task("htmllint", [], lazyQuire(require, "./gulp/recipes/html/htmllint"));

gulp.task("validate-html", function (done) {
    sequence("bootlint", "htmllint", done);
});


/**
 * Lint
 */
gulp.task("csslint", [], lazyQuire(require, "./gulp/recipes/csslint"));
gulp.task("jshint", [], lazyQuire(require, "./gulp/recipes/jshint"));

gulp.task("lint", function (done) {
    sequence("csslint", "jshint", done);
});


/**
 * Clean
 */
gulp.task("clean-dist", ["scripts:clean", "fonts:clean", "vendor:clean", "styles:clean", "skins:clean", "build:clean"]);

/**
 * JS distribution
 */
gulp.task("scripts:clean", [], lazyQuire(require, "./gulp/recipes/scripts/clean"));
gulp.task("scripts:dev", [], lazyQuire(require, "./gulp/recipes/scripts/dev"));

gulp.task("dist-js", function (done) {
    sequence("scripts:clean", "scripts:dev", function () {
        done();

        notifaker(pumped("JS Generated!"));
    });
});


/**
 * CSS distribution
 */
gulp.task("styles:clean", [], lazyQuire(require, "./gulp/recipes/styles/clean"));
gulp.task("styles:bootstrap", [], lazyQuire(require, "./gulp/recipes/styles/bootstrap"));
gulp.task("styles:extend", [], lazyQuire(require, "./gulp/recipes/styles/extend"));
gulp.task("styles:site", [], lazyQuire(require, "./gulp/recipes/styles/site"));
gulp.task("styles:app", [], lazyQuire(require, "./gulp/recipes/styles/app"));

gulp.task("dist-css", function (done) {
    sequence("styles:clean", "styles:bootstrap", "styles:extend", "styles:site", "styles:app", function () {
        done();

        notifaker(pumped("CSS Generated!"));
    });
});

/**
 * Skins distribution
 */
gulp.task("skins:clean", [], lazyQuire(require, "./gulp/recipes/skins/clean"));
gulp.task("skins:styles", [], lazyQuire(require, "./gulp/recipes/skins/styles"));

gulp.task("dist-skins", function (done) {
    sequence("skins:clean", "skins:styles", function () {
        done();

        notifaker(pumped("Skins Generated!"));
    });
});

/**
 * Fonts distribution
 */
gulp.task("fonts:clean", [], lazyQuire(require, "./gulp/recipes/fonts/clean"));
gulp.task("fonts:styles", [], lazyQuire(require, "./gulp/recipes/fonts/styles"));
gulp.task("fonts:fonts", [], lazyQuire(require, "./gulp/recipes/fonts/fonts"));

gulp.task("dist-fonts", function (done) {
    sequence("fonts:clean", "fonts:styles", "fonts:fonts", function () {
        done();

        notifaker(pumped("Fonts Generated!"));
    });
});

/**
 * Vendor distribution
 */
gulp.task("vendor:clean", [], lazyQuire(require, "./gulp/recipes/vendor/clean"));
gulp.task("vendor:styles", [], lazyQuire(require, "./gulp/recipes/vendor/styles"));
gulp.task("vendor:scripts", [], lazyQuire(require, "./gulp/recipes/vendor/scripts"));

gulp.task("dist-vendor", function (done) {
    sequence("vendor:clean", "vendor:styles", function () {
        done();

        notifaker(pumped("Vendor Generated!"));
    });
});

/**
 * Full distribution
 */
gulp.task("dist", function (done) {
    sequence("dist-css", "dist-js", "dist-skins", "dist-vendor", "dist-fonts", function () {
        done();

        notifaker(pumped("Style distribution completed!"));
    });
});

/**
 * Default
 */
gulp.task("default", ["dist-css", "dist-vendor"]);

// FLEXITASK EDIT


var livereload = require("gulp-livereload");

/**
 * Build tasks
 */
gulp.task("build:clean", [], lazyQuire(require, "./gulp/recipes/build/clean"));
gulp.task("build:durandal", [], lazyQuire(require, "./gulp/recipes/build/durandal"));
gulp.task("build:assets", [], lazyQuire(require, "./gulp/recipes/build/assets"));
gulp.task("build:configure", [], lazyQuire(require, "./gulp/recipes/build/configure"));
gulp.task("build:app", [], lazyQuire(require, "./gulp/recipes/build/app"));
gulp.task("build:index", [], lazyQuire(require, "./gulp/recipes/build/index"));


gulp.task("build", function (done) {
    sequence("build:clean", "build:durandal", "build:assets", "build:index","setFinalVersion" ,function () {
        done();

        notifaker(pumped("Build completed"));
    });
});

gulp.task("setFinalVersion",function(done){
    var buildNumber = args.buildNumber || 0;
    var branch = args.branch;
    var gitCommitHash = args.gitCommitHash || "";
    var buildEnv = args.buildEnv || "local" ;

    if(process.env.TEAMCITY_PROJECT_NAME){
        buildEnv = "TeamCity";
    }

    if(gitCommitHash.length> 7){
        gitCommitHash = gitCommitHash.substr(0,7);
    }

    var buildTag = "";
    if(branch){
        if (branch.indexOf("/"))
        {
            branch = branch.substring(branch.lastIndexOf("/")+1);
        }
        if(branch==="master"){
            buildTag="-build"+buildNumber+"-"+gitCommitHash;
        }else{
            buildTag = "-"+branch+buildNumber+"-"+gitCommitHash;
        }
    }else{
        buildTag = "-dev"
    }


    var finalVersion = pakic.version;
    var version = pakic.version;

    finalVersion = version  + buildTag;

    require("yargs").default("finalVersion",finalVersion);
    tsm.buildNumber(finalVersion);

    sequence("build:configure", function () {
        done();
    });
});

gulp.task("build-full", function (done) {
    sequence("build:clean", "dist", "build", function () {
        done();

        notifaker(pumped("Build completed"));
    });
});

gulp.task("minjs", function () {
    var path = args.path;
    var outputPath = args.outputPath;
    console.log(path);
    return gulp.src(path)
    .pipe(plumber())
    .pipe(uglify())
    .pipe(rename({
        extname: ".min.js"
    }))
    .pipe(gulp.dest(outputPath));
});


/**
 * Live reload tasks
 */
gulp.task("watch:app", function () {
    livereload.listen();
    var appLessFile = config.source.less + "/app.less";
    gulp.watch(appLessFile, ["compileAndReloadAppLess"]);
});

gulp.task("compileAndReloadAppLess", function () {
    var f = lazyQuire(require, "./gulp/recipes/styles/app");
    return f().pipe(livereload());
});

gulp.task("showFiles",function(){
    gulp.src(["public/assets/**/*.*","!public/assets/style/**/*.*"])
    .pipe(gulpPrint());
});

gulp.task("lint",function(){
    exec("eslint .\\public\\app\\ -o .\\.result\\eslint.html --format html", function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
    });
})

gulp.task("version",function(){
    console.log(getPackageJsonVersion());
})

function getPackageJsonVersion () {
    return pakic.version;
}
