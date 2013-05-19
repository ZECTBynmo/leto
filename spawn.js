#!/usr/bin/env node
var spawner = new require("./spawner").spawner(),
	needle = require("needle");

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
case "new":
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

	needle.post( "http://localhost:3000/templates", template, function(){} );
}


//////////////////////////////////////////////////////////////////////////
// Spawns a project
function spawnProject( contents ) {
	console.log( "Spawning new project" );

	contents = JSON.parse( contents );

	spawner.spawn( options, contents, function() {
		console.log( "Finished spawning" );
	});
}