#!/usr/bin/env node
var Spawner = require("./spawner").spawner,
	needle = require("needle"),
	spawner = new Spawner(),
	urls = require("./urls.json");

// Enum our arg indices for code clarity
var ARG_PROCESS = 0,	// node
	ARG_SCRIPT = 1,		// spawn
	ARG_ARG1 = 2,		// new/publish
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
		setupJSON = require( source + "/template_setup.json" );

	template.setup = setupJSON;

	console.log( template );

	needle.post( urls.REMOTE_URL + "/templates", template, function(){} );
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