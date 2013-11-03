//////////////////////////////////////////////////////////////////////////
// Spawner - spawns new projects!
//////////////////////////////////////////////////////////////////////////
//
// Spawner is a 'puppet master' controller for project generation. It
// takes a template procedure, and makes calls to Maker, Changer, and
// other modules as necessary.
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
	changer = require("changer").createChanger(),
	gitOps = require("./gitOperations"),
	fs = require("fs-extra");


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

	if( contents === undefined ) {
		console.log( "!!! Spawning with undefined contents !!!" );
		contents = {};
	}

	var asyncCallQueue = [];

	// Make shouldCloneRepo optional
	if( callback === undefined ) {
		callback = shouldCloneRepo;
		shouldCloneRepo = false;
	}

	function requireFromString(src, filename) {
		try {
			var m = new module.constructor();
		    m._compile(src, filename);
		    return m.exports;
		} catch( err ) {
			console.log( "Failed to load module at: " + filename );
			console.log( err );
		}	    
	}

	function templatizeAndLoadModule( src ) {
		// Load the ruleset into a string and templatize it
		var strContents = fs.readFileSync( src, 'utf8' );
		strContents = maker.renderTemplateToString( maker.template(strContents, contents) );
		return requireFromString( strContents );
	}

	function templatizeAndLoadFile( src ) {
		// Load the ruleset into a string and templatize it
		var strContents = fs.readFileSync( src, 'utf8' );
		strContents = maker.renderTemplateToString( maker.template(strContents, contents) );
		return strContents;
	}

	leto_setup.tempRepoDest = dest + this.tempRepoDest;

	// If we have a functions file defined, try to load it 
	// and override necessary parameters
	if( leto_setup.functions != undefined ) {
		try {
			var functionContents = templatizeAndLoadModule( leto_setup.__source + "/" + leto_setup.functions );
		} catch( err ) {
			console.log( "Error, failed to load functions at location " + leto_setup.functions );
			console.log( err );
			callback();
		}
		
		// Load all exports of the functions into our contents blob so that it's loaded later
		for( var iFunction in functionContents ) {
			contents[iFunction] = functionContents[iFunction];
		}
	}

	// If we have external text files that we need to laod, read them
	// all in and templatize them
	if( leto_setup.externals != undefined ) {
		for( var iExternal in leto_setup.externals ) {
			contents[iExternal] = templatizeAndLoadFile( leto_setup.__source + "/" + leto_setup.externals[iExternal] );
		}
	}

	// If we have any defaults defined, fill in missing values in the contents
	if( leto_setup.defaults != undefined ) {
		for( var iDefault in leto_setup.defaults ) {
			if( contents[iDefault] === undefined ) {
				contents[iDefault] = leto_setup.defaults[iDefault];
			}
		}
	}

	var getBatchReplace = function( step ) {
		return function( cb ) {
			var source = step.sourcedir || options.source || leto_setup.__source || process.cwd();

			// Construct our filepath map by grabbing the end values for each 
			// template from the contents we're given
			var filePathMap = {};
			for( var iKey in step.keywords ) {
				var keyword = step.keywords[iKey];

				// If this item is a function, call it to find our string key
				var keyToFind = typeof(contents[iKey]) == "function" ? contents[iKey]() : contents[iKey];

				filePathMap[keyword] = keyToFind;
			}

			maker.makeTemplatesFromDir( source, dest + "/", step.keywords, filePathMap, step.extensions || [], contents, cb );
		}
	}

	var getTemplateFiles = function( step ) {
		return function( cb ) { 
			maker.loadTemplateDir( leto_setup.__source + "/" + step.sourcedir, function( loadedTemplates ) {
				var makeFileCallQueue = [];

				for( var iTemplate=0; iTemplate<step.templates.length; ++iTemplate ) {
					// Create a closure so that we can preserve variables while we loop
					(function(){

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
					}()); // end closure
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
			//mover.setSrc( require("path").dirname(movingPlanPath) );
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

	var getChangeCommand = function( step ) {
		return function( cb ) {
			var changeCallQueue = [];

			// We need to loop and do all of our changes asynchronously, and 
			// then call back to resume running the spawn procedure. 
			for( var iChange=0; iChange<step.changes.length; ++iChange ) {
				
				// Create a closure so that we can preserve variables while we loop
				(function(){
					// Load our rules inside of the closure, so that we can ensure that 
					// variables in rules aren't as their applied between files
					if( step.ruleset != undefined ) {
						var loadedRules = templatizeAndLoadModule( leto_setup.__source + "/" + step.ruleset );
					}

					var rules = loadedRules === undefined ? {} : loadedRules;

					// Load in our default rules (as long as no user-set rule relaces it)
					for( var iRule in changer.defaultRules )
						rules[iRule] = rules[iRule] || changer.defaultRules[iRule];

					var thisChange = step.changes[iChange];		

					// Templatize the filepath that we're about to change
					thisChange.file = maker.renderTemplateToString( maker.template(thisChange.file, contents) );

					// Templatize all of the arguments that we have
					if( typeof(thisChange.args) == "string" ) {
						thisChange.args = maker.renderTemplateToString( maker.template(thisChange.args, contents) );
					} else if( thisChange.args instanceof Array ) {
						for( var iArg in thisChange.args ) {
							thisChange.args[iArg] = maker.renderTemplateToString( maker.template(thisChange.args[iArg], contents) );
						}
					}
					
					var thisChangeFileFn = function( callb ) {

						var args = thisChange.args;						

						if( rules[thisChange.rule] === undefined ) {
							var err = "Rule '" + thisChange.rule + "' not found";
							console.log( err );
							return callb( err );
						}

						// Allow users to use rule.start or rule.line interchangably, so that
						// the API is nicer. Prefer rule.start when both are present
						var startLine = thisChange.start || thisChange.line,
							endLine = thisChange.end;

						if( endLine === undefined ) {
							endLine = thisChange.line;
						}

						// Build the arguments for our call to changer.change()
						var changeArgs = [];
						changeArgs.push( rules[thisChange.rule] );
						changeArgs.push( thisChange.file );
						changeArgs.push( startLine );
						changeArgs.push( endLine );

						if( typeof(thisChange.args) == "string" ) {
							changeArgs.push( thisChange.args );					
						} else if( typeof(thisChange.args) == "object" ) {
							for( var iArg in thisChange.args )
								changeArgs.push( thisChange.args[iArg] );
						}

						changeArgs.push( callb );

						// Change a thing!
						changer.change.apply( changer, changeArgs );
					}

					changeCallQueue.push( thisChangeFileFn );
				}()); // end closure
			} // end for each change

			// Run our series of change commands
			async.series( changeCallQueue, cb );
		}
	}

	var getRecursiveCommand = function( step ) {
		return function( cb ) {
			var childTemplatePath = leto_setup.__source + "/" + step.path;

			try {
				var child_setup = require( childTemplatePath );
			} catch( err ) {
				console.log( "Failed to child template at " + childTemplatePath );
				return cb( err );
			}

			var child_options = step.options || options,
				child_dest = step.dest || dest,
				child_contents = {};

			// Let template contents cascade down, and then override them with anything specified in the 
			for( var iItem in contents )
				child_contents[iItem] = contents[iItem];
			for( var iItem in step.contents )
				child_contents[iItem] = step.contents[iItem];

			_this.spawn( child_dest, child_setup, child_options, child_contents, false, cb );
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
		  	case "change":
				asyncCallQueue.push( getChangeCommand(procedure[iStep]) );
			  	break;
			case "recursive":
				asyncCallQueue.push( getRecursiveCommand(procedure[iStep]) );
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

	// -------------------------------------------------- //
	// RUN THE SPAWN THE THING!
	// -------------------------------------------------- //
	if( shouldCloneRepo ) {
		gitOps.cloneRepo( leto_setup, function() {
			runSpawnSeries();
		});	
	} else {
		runSpawnSeries();
	}
	
} // end spawn()


exports.spawner = spawner;