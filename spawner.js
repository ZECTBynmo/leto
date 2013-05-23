//////////////////////////////////////////////////////////////////////////
// nptm - node project template manager
//////////////////////////////////////////////////////////////////////////
//
// Main script!
/* ----------------------------------------------------------------------
													Object Structures
-------------------------------------------------------------------------
	var options = {
		dest: "...path where we'll be dumping files...",
	}
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
var log = function( a ) { if(SHOW_DEBUG_PRINTS) console.log(a); };	// A log function we can turn off


//////////////////////////////////////////////////////////////////////////
// Constructor
function spawner() {	
	var _this = this;	
	
} // end spawner()


//////////////////////////////////////////////////////////////////////////
// Spawns a project
spawner.prototype.spawn = function( dest, template, options, contents, callback ) {
	var _this = this;

	template.tempRepoDest = options.dest + "/_Temp/";

	async.series([
		function( cb ) {
			// Clone the repo onto the local computer
			gitOps.cloneRepo( template, cb );
		},
		function( cb ) {
			var source = template.tempRepoDest + "/" + template.github.repo;

			// Construct our filepath map by grabbing the end values for each 
			// template from the contents we're given
			var filePathMap = {};
			for( var iKey in template.keywords ) {
				var keyword = template.keywords[iKey];
				filePathMap[iKey] = contents[keyword];
			}

			maker.makeTemplatesFromDir( source, options.dest + "/", template.keywords, filePathMap, template.extensions, contents, cb );
		}

	// We're finished, call back!
	], function() {
		callback();
	});
	
} // end spawn()


exports.spawner = spawner;