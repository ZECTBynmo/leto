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
	changer = require("changer").createChanger(),
	gitOps = require("./gitOperations"),
	ares = require("ares").ares,
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
			// First templatize the ruleset path
			if( step.ruleset != undefined ) {
				var ruleSetPath = step.ruleset;
				ruleSetPath = maker.renderTemplateToString( maker.template(ruleSetPath, contents) );

				// Load the ruleset into a string and templatize it
				var strRulesetContents = fs.readFileSync( leto_setup.__source + "/" + ruleSetPath, 'utf8' );
				strRulesetContents = maker.renderTemplateToString( maker.template(strRulesetContents, contents) );

				// Write the file out to our temp dir so we can load it like a normal node module
				var tempOutputPath = leto_setup.tempRepoDest + "/" + require("path").basename(ruleSetPath);
				fs.outputFileSync( tempOutputPath, strRulesetContents, 'utf8' );

				var loadedRules = require( tempOutputPath );
			}

			var rules = loadedRules === undefined ? {} : loadedRules, /*step.ruleset != undefined ? require( tempOutputPath ) : {},*/
				changeCallQueue = [];

			for( var iRule in changer.defaultRules )
				rules[iRule] = rules[iRule] || changer.defaultRules[iRule];

			// We need to loop and do all of our changes asynchronously, and 
			// then call back to resume running the spawn procedure. 
			for( var iChange=0; iChange<step.changes.length; ++iChange ) {
				
				// Create a closure so that we can preserve variables while we loop
				(function(){

					var thisChange = step.changes[iChange];				
					
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