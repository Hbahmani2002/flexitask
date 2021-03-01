var fancyLog    = require('fancy-log');
var colors = require('ansi-colors');
var notifier = require('node-notifier');


/**
 * Fake the gulp-notfy functionality
 * to provide a consistent interface
 * for non-stream notifications
 *
 * @param message
 */
module.exports = function (message) {

  fancyLog(
    colors.cyan('gulp-notifier'),
    '[' + colors.blue('Gulp notification') + ']',
    colors.green(message)
  );

  notifier.notify({
    title: 'Gulp notification',
    message: message,
    onLast: true
  });
};
