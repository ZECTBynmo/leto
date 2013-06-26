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
	mover = require("mover").createMover(),
	gitOps = require("./gitOperations"),
	ares = require("ares").ares;


//////////////////////////////////////////////////////////////////////////
// Namespace (lol)
var SHOW_DEBUG_PRINTS = true;
var log = function( a ) { if(SHOW_DEBUG_PRINTS) console.log(a); };	// A log function we can turn off


//////////////////////////////////////////////////////////////////////////
// Constructor
function spawner() {	
	var _this = this;	

	this.tempRepoDest = "/_leto_temp/";
	
} // end spawner()


//////////////////////////////////////////////////////////////////////////
// Spawns a project
spawner.prototype.spawn = function( dest, leto_setup, options, contents, shouldCloneRepo, callback ) {
	var _this = this;

	// Make shouldCloneRepo optional
	if( callback === undefined ) {
		callback = shouldCloneRepo;
		shouldCloneRepo = false;
	}

	leto_setup.tempRepoDest = dest + this.tempRepoDest;

	var asyncCallQueue = [];

	var getBatchReplace = function( step ) {
		return function( cb ) {
			var source = step.sourcedir || options.source || leto_setup.__source || process.cwd();

			// Construct our filepath map by grabbing the end values for each 
			// template from the contents we're given
			var filePathMap = {};
			for( var iKey in step.keywords ) {
				var keyword = step.keywords[iKey];
				filePathMap[iKey] = contents[keyword];
			}

			maker.makeTemplatesFromDir( source, dest + "/", step.keywords, filePathMap, step.extensions, contents, cb );
		}
	}

	var getTemplateFiles = function( step ) {
		return function( cb ) { 
			maker.loadTemplateDir( step.sourcedir, function( loadedTemplates ) {
				var makeFileCallQueue = [];

				for( var iTemplate=0; iTemplate<step.templates.length; ++iTemplate ) {
					// Preserve this template for closure
					var thisTemplate = step.templates[iTemplate];

					// Templatize the path
					thisTemplate.dest = maker.renderTemplateToString( maker.template(thisTemplate.dest, contents) );

					var thisTemplateFileFn = function( callb ) {
						// Retreive the empty template object
						var templateObj = maker.getTemplate( thisTemplate.name ),
							templateFiles = [];

						if( templateObj === undefined ) {
							console.log( "Error retrieving template " + thisTemplate.name );
							cb( "Error retrieving template " + thisTemplate.name );
						}

						// Fill the template with our contents
						templateObj = maker.fillTemplate( templateObj, contents );
						templateFiles.push( templateObj );

						// Write the file out to disk
						maker.makeFile( thisTemplate.dest, templateFiles, callb );
					}

					makeFileCallQueue.push( thisTemplateFileFn );
				}

				// Run our async call queue
				async.series( makeFileCallQueue, cb );
			});
		}
	}

	var getMoveFiles = function( step ) {
		return function( cb ) {
			var movingPlanPath = leto_setup.__source + "/" + step.plan;

			try {
				var movingPlan = require( movingPlanPath );
			} catch( err ) {
				console.log( "Failed to load moving plan " + movingPlanPath );
				cb( err );
			}
			

			mover.setPlan( movingPlan );
			mover.setDest( dest );
			mover.setSrc( leto_setup.__source );
			mover.move( cb );
		}
	}

	var getExecuteCommand = function( step ) {
		return function( cb ) {
			// Change the current working directory if that setting is used
			if( step.workingdir != undefined ) {
				var oldCWD = process.cwd(),
					isRelative = step.isRelative || true,
					newCWD = isRelative ? leto_setup.__source + "/" + step.workingdir : step.workingdir;

				process.chdir( newCWD );
			}

			ares( step.command, true, cb );

			// Change the working directory back to what it was
			if( step.workingdir != undefined ) {
				process.chdir( oldCWD );
			}
		}
	}

	function runSpawnSeries() {

		// Grab our setup procedure from the recently cloned repo
		var procedure = leto_setup.procedure;

		for( var iStep=0; iStep<procedure.length; ++iStep ) {
			switch( procedure[iStep].type ) {
			case "replace":
				asyncCallQueue.push( getBatchReplace(procedure[iStep]) );
			  	break;
		  	case "template":
				asyncCallQueue.push( getTemplateFiles(procedure[iStep]) );
			  	break;
		  	case "move":
				asyncCallQueue.push( getMoveFiles(procedure[iStep]) );
			  	break;
		  	case "execute":
				asyncCallQueue.push( getExecuteCommand(procedure[iStep]) );
			  	break;

			default:
			  	console.log( "Step type " + procedure[iStep].type + " not recognized" );
			}
		}

		// Run our async call queue
		async.series( asyncCallQueue, function() {
			callback();
		});
	}

	if( shouldCloneRepo ) {
		gitOps.cloneRepo( leto_setup, function() {
			runSpawnSeries();
		});	
	} else {
		runSpawnSeries();
	}
	
} // end spawn()


exports.spawner = spawner;