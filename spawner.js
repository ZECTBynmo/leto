//////////////////////////////////////////////////////////////////////////
// nptm - node project template manager
//////////////////////////////////////////////////////////////////////////
//
// Main script!
/* ----------------------------------------------------------------------
													Object Structures
-------------------------------------------------------------------------
	
*/
//////////////////////////////////////////////////////////////////////////
// Requires
var ares = require("ares").ares,
	async = require("async"),
	maker = require("maker").createMaker(),
	gitOps = require("./src/gitOperations");


//////////////////////////////////////////////////////////////////////////
// Namespace (lol)
var SHOW_DEBUG_PRINTS = true;
var log = function( a ) { if(SHOW_DEBUG_PRINTS) console.log(a); };				// A log function we can turn off


//////////////////////////////////////////////////////////////////////////
// Constructor
function spawner() {	
	var _this = this;	
	
} // end spawner()


//////////////////////////////////////////////////////////////////////////
// Spawns a project
spawner.prototype.spawn = function( options, contents, callback ) {
	var _this = this;

	options.tempRepoDest = __dirname + "/TempClones/";

	async.series([
		function( cb ) {
			// Clone the repo onto the local computer
			gitOps.cloneRepo( options, cb );
		},
		function( cb ) {
			var source = options.tempRepoDest + "/" + options.github.repo;

			maker.makeTemplatesFromDir( source, options.dest, options.keywords, options.keywords, options.extensions, contents, cb );
		},

	// Finished callback
	], function() {
		callback();
	});
	
} // end spawn()


exports.spawner = spawner;