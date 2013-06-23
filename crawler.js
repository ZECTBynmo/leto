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
		movingPlans = {};

	// load the previously existing params file
	try {
		oldParams = require( source + "/leto_params.json" );
		alreadyHadParamsFile = true;
	} catch( err ) {
		log( "Couldn't find leto_params.json, generating one from scratch. You can open it and add comments to add tooltips to template parameters in the registry" );
	}
	
	function getReplaceParams( step ) {
		for( var iKeyword in step.keywords ) {
			var paramName = step.keywords[iKeyword];
			templateParams[paramName] = oldParams[paramName] || "";
		}
	}

	function getTemplateParams( step ) {
		for( var iTemplate in step.templates ) {
			var params = maker.getTemplateParams( step.templates[iTemplate].dest );
			for( var iParam in params ) {
				var paramName = params[iParam];
				templateParams[paramName] = oldParams[paramName] || "";
			}
		}
	}

	function getMoveParams( step ) {
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
			return;
		}
	}

	function getExecuteParams( step ) {

	}

	function writeFile( filePath, object ) {
		log( "Writing gyp file " + filePath );
		fs.writeFile( filePath, object, function(error) {
		    if( error ) {
		        log( error );
		    } else {
		        log( "The file was saved!" );
		    }

		    callback();
		});
	}

	// Loop through the procedure to find stuff
	// that might contain template strings
	for( var iStep in procedure ) {
		switch( procedure[iStep].type ) {
		case "replace":
			getReplaceParams( procedure[iStep] );
		  	break;
	  	case "template":
			getTemplateParams( procedure[iStep] );
		  	break;
	  	case "move":
			getMoveParams( procedure[iStep] );
		  	break;
	  	case "execute":
			getExecuteParams( procedure[iStep] );
		  	break;

		default:
		  	console.log( "Step type " + procedure[iStep].type + " not recognized" );
		}
	}

	var strGypObject = JSON.stringify( templateParams, null, 4 );

	if( !alreadyHadParamsFile )
		writeFile( source + "/leto_params.json", strGypObject );
	else
		callback();
} // end crawl()


exports.crawler = crawler;