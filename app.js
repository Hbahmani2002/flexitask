var http = require('http');

var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');

var serve = serveStatic("./public/");

var server = http.createServer(function(req, res){
    var done = finalhandler(req, res)
    serve(req, res, done)
});
process.env = process.env || {};
process.argv.forEach(function (val, index, array) {
	if(val){
		var splited = val.split(/=(.+)?/);
	
		if(splited && splited.length>=2){
			var key = splited[0];
			var value = splited[1];
			
			if(!process.env[key]){

				process.env[key]=value;
			}
		}
	}
});
server.listen(process.env.port || 8000);