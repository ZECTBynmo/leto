//////////////////////////////////////////////////////////////////////////
// crawler - crawls a leto setup for template parameters
//////////////////////////////////////////////////////////////////////////
//
// Main script!
/* ----------------------------------------------------------------------
													Object Structures
-------------------------------------------------------------------------
	
*/
//////////////////////////////////////////////////////////////////////////
// Requires
var maker = require("maker").createMaker(),
	async = require("async"),
	fs = require("fs");

//////////////////////////////////////////////////////////////////////////
// Namespace (lol)
var SHOW_DEBUG_PRINTS = true;
var log = function( a ) { if(SHOW_DEBUG_PRINTS) console.log(a); };	// A log function we can turn off


//////////////////////////////////////////////////////////////////////////
// Constructor
function crawler() {	
	var _this = this;	
	
} // end crawler()


//////////////////////////////////////////////////////////////////////////
// Crawls through the leto setup and pulls out all of our 
crawler.prototype.crawl = function( source, leto_setup, callback ) {
	var _this = this;

	var procedure = leto_setup.procedure,
		templateParams = {},
		oldParams = {},
		alreadyHadParamsFile = false,
		movingPlanPaths = [],
		movingPlans = {},
		asyncCallQueue = [];

	// load the previously existing params file
	try {
		oldParams = require( source + "/leto_params.json" );
		alreadyHadParamsFile = true;
	} catch( err ) {
		log( "Couldn't find leto_params.json, generating one from scratch. You can open it and add comments to add tooltips to template parameters in the registry" );
	}
	
	function getReplaceParams( step ) {
		return function( cb ) {
			for( var iKeyword in step.keywords ) {
				var paramName = step.keywords[iKeyword];
				templateParams[iKeyword] = oldParams[paramName] || "";
			}

			cb();
		}
	}

	function getTemplateParams( step ) {
		return function( cb ) {

			maker.loadTemplateDir( source + "/" + step.sourcedir, function(templates) {

				for( var iTemplate in step.templates ) {

					// Load params from the destination paths
					var destPathParams = maker.getTemplateParams( step.templates[iTemplate].dest );
					for( var iParam in destPathParams ) {
						var pathParamName = destPathParams[iParam];
						templateParams[pathParamName] = oldParams[pathParamName] || "";
					}

					// Load params from the template file contents
					var templateObj = maker.getTemplate( step.templates[iTemplate].name );
					
					var fileContentsParams = maker.getTemplateParams( templateObj );
					for( var iParam in fileContentsParams ) {
						var fileParamName = fileContentsParams[iParam];
						templateParams[fileParamName] = oldParams[fileParamName] || "";
					}
				}

				cb();
			});
		}
	}

	function getMoveParams( step ) {
		return function( cb ) {

			function getFolderParamsRecursive( folder ) {

				for( var iChild in folder ) {
					if( iChild == "files" ) {
						for( var iFilePath in folder[iChild] ) {
							var params = maker.getTemplateParams( folder[iChild][iFilePath] );
							for( var iParam in params ) {
								var paramName = params[iParam];
								templateParams[paramName] = oldParams[paramName] || "";
							}
						}
					} else {
						getFolderParamsRecursive( folder[iChild] );
					}
				}
			}

			var movingPlanPath = source + "/" + step.plan;

			try {
				getFolderParamsRecursive( require(movingPlanPath) );
			} catch( err ) {
				log( "Crawl failed: Couldn't load your moving plan: " + movingPlanPath );
				log( err );
				cb( err );
			}

			cb();
		}
	}

	function getExecuteParams( step ) {

		return function( cb ) { 
			cb(); 
		}
	}

	function writeFile( filePath, object ) {

		var error = fs.writeFileSync( filePath, object );


	    if( error ) {
	        log( error );
	    }

	    callback();
	}

	function getFunctionsParams() {


		var strFunctionsFule = fs.readFileSync( source + "/" + leto_setup.functions, 'utf8' ),
			functionsParams = maker.getTemplateParams( strFunctionsFule );

		for( var iParam in functionsParams ) {
			var functionsParamName = functionsParams[iParam];
			templateParams[functionsParamName] = oldParams[functionsParamName] || "";
		}		
	}

	function runCrawlSeries( finishedCallback ) {
		// Grab parameters from our functions file if it exists
		if( leto_setup.functions != undefined )
			getFunctionsParams();

		// Grab our setup procedure from the recently cloned repo
		var procedure = leto_setup.procedure;

		for( var iStep=0; iStep<procedure.length; ++iStep ) {

			switch( procedure[iStep].type ) {
			case "replace":
				asyncCallQueue.push( getReplaceParams(procedure[iStep]) );
			  	break;
		  	case "template":
				asyncCallQueue.push( getTemplateParams(procedure[iStep]) );
			  	break;
		  	case "move":
				asyncCallQueue.push( getMoveParams(procedure[iStep]) );
			  	break;
		  	case "execute":
				asyncCallQueue.push( getExecuteParams(procedure[iStep]) );
			  	break;

			default:
			  	console.log( "Step type " + procedure[iStep].type + " not recognized" );
			}
		}

		// Run our async call queue
		async.series( asyncCallQueue, finishedCallback );

	}

	var hasTemplateStep = false;
	for( var iStep in procedure ) {
		if( procedure[iStep].type == "template" )
			hasTemplateStep = true;
	}

	runCrawlSeries( function(err) {

		var strGypObject = JSON.stringify( templateParams, null, 4 );

		writeFile( source + "/leto_params.json", strGypObject );

		console.log( "\nThe following params were found: " );
		for( var iParam in templateParams )
			console.log( iParam )
	});
	
} // end crawl()


exports.crawler = crawler;