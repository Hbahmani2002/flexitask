var del = require('del');

// config
var config = require('../../../config.json');

module.exports = function (done) {
  del(config.build.root, { force: true })
    .then(function () { done(); });
};
