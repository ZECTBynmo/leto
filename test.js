var NTPM = new require("./nptm").nptm,
	options = require("./template_setup.json");

var nptm = new NTPM();

//console.log( nptm );
//console.log( options );

options.dest = __dirname + "/TEMP/";

var contents = {
	"projectName": "WorkingProject"
}

nptm.spawn( options, contents, function() {
	console.log( "finished spawn" );
});