#!/usr/bin/env node
var Spawner = require("./spawner").spawner,
	Crawler = require("./crawler").crawler,
	needle = require("needle"),
	spawner = new Spawner(),
	crawler = new Crawler(),
	urls = require("./urls.json")

require('json5/lib/require');

// Enum our arg indices for code clarity
var ARG_PROCESS = 0,	// node
	ARG_SCRIPT = 1,		// leto
	ARG_ARG1 = 2,		// spawn/crawl/publish
	ARG_ARG2 = 3;		// ...

if( process.argv.length < 3 ) {
	console.log( "Spawn requires some arguments, type 'spawn help' for more info" );
	return;
}

switch( process.argv[ARG_ARG1] ) {
case "spawn":
	spawnProject( process.argv[ARG_ARG2] );
  	break;

case "publish": 	
 	publishTemplate( process.argv[ARG_ARG2] );
 	break;

case "crawl": 	
 	crawlTemplate( process.argv[ARG_ARG2] );
 	break;

default:
  	console.log( "Argument " + process.argv[ARG_ARG1] + " is not recognized" );
}


//////////////////////////////////////////////////////////////////////////
// Push a project up to the registry
function publishTemplate( source ) {
	// Default the source to the current working directory
	source = source || process.cwd();

	console.log( "Publishing template project in " + source );

	var template = {},
		setupJSON = require( source + "/leto.json5" );

	try {
		var templateParams = require( source + "/leto_params.json" );
	} catch( err ) {
		console.log( "Couldn't find " + source + "/leto_params.json, run 'leto crawl' on the project to generate it" );
		return;
	}

	template = setupJSON;
	template.__params = templateParams;

	console.log( template );

	needle.post( urls.LOCAL_URL + "/templates", template, function(error){if(error!=undefined)console.log(error);} );
}


//////////////////////////////////////////////////////////////////////////
// Spawns a project from contents we retrieve from the database
function spawnProject( contentsHash ) {
	console.log( "Spawning new project" );

	var dest = process.cwd();

	var options = {
		dest: dest
	};

	needle.get( urls.REMOTE_URL + "/contents" + contentsHash, {}, function( error, response, body ) {
		if( body.setup === undefined ) 
			return;

		console.log( body.setup );

		spawner.spawn( dest, body.setup, options, body.contents, function() {
			console.log( "Finished spawning" );
		});
	});
}


//////////////////////////////////////////////////////////////////////////
// Crawls over a template folder and expose all of the template params
function crawlTemplate( source ) {
	console.log( "Crawling template folder" );

	console.log( "Add descriptions for template params inside of leto_params.json to add comments/tooltips in the registry" );

	// Default the source to the current working directory
	source = source || process.cwd();

	var setupJSON = require( source + "/leto.json5" );

	crawler.crawl( source, setupJSON, function() {
		console.log( "Finished crawling" );
	});
}