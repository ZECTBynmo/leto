#!/usr/bin/env node
var Spawner = require("./src/spawner").spawner,
	Crawler = require("./src/crawler").crawler,
	needle = require("needle"),
	spawner = new Spawner(),
	crawler = new Crawler(),
	urls = require("./urls.json"),
	holster = require("./holster.json"),
	ares = require("ares").ares,
	wrench = require("wrench"),
	fs = require("fs");

// Setup our JSON5 require hook
require('json5/lib/require');

// Setup our optimist argument settings
var argv = require("optimist").argv;

var action = "",
	actionArgs = [],
	argContents = {},
	spawnGUIDOrPath = "",
	registryType = "";

// Parse our arguments
for( var iArg in argv ) {

	switch( iArg ) {
	case "_":
		// Parse our action items
		for( var iActionArg in argv[iArg] ) {
			if( iActionArg == 0 )
				action = argv[iArg][iActionArg];
			else
				actionArgs.push( argv[iArg][iActionArg] );
		}

		break;

	case "$0":
		// This just holds the path to the node exe, do nothing 
		break;

	default:
		// Grab contents that the user is trying to specify
		argContents[iArg] = argv[iArg]
	}
} // end for each argument

switch( action ) {
case "spawn":
	spawnProject( actionArgs, argContents );
  	break;

case "publish": 	
 	publishTemplate();
 	break;

case "crawl": 	
 	crawlTemplate();
 	break;

case "set": 	
 	setVariables( actionArgs );
 	break;

case "arm": 	
 	addHolsterTemplate( actionArgs );
 	break;

default:
  	console.log( "Action " + action + " is not recognized, try 'spawn', 'set', 'add', 'crawl', or 'publish'" );
}


//////////////////////////////////////////////////////////////////////////
// Push a project up to the registry
function publishTemplate( source ) {
	// Default the source to the current working directory
	var source = process.cwd();

	console.log( "Publishing template project in " + source );

	var template = {};
	var setupJSON = require( source + "/leto" );

	crawler.crawl( source, setupJSON, function() {
		try {
			var templateParams = require( source + "/leto_params.json" );
		} catch( err ) {
			console.log( "Couldn't find " + source + "/leto_params.json, run 'leto crawl' on the project to generate it" );
			return;
		}

		template = setupJSON;
		template.__params = templateParams;
		template.__source = source;

		console.log( template );

		var auth = JSON.parse( fs.readFileSync(__dirname + "/auth.json") );

		var httpBody = {
			template: template,
			auth: auth
		};

		needle.post( urls.REMOTE_URL + "/templates", httpBody, function(error) {
			if( error != undefined )
				console.log( error );
		});
	});
}


//////////////////////////////////////////////////////////////////////////
// Spawns a project from contents we retrieve from the database
function spawnProject( args, contents ) {
	if( args.length < 2 )
		return console.log( "Need more arguments to spawn" );

	console.log( "Spawning project" );

	var dest = process.cwd();

	var options = {
		dest: dest
	};

	if( args[0] == "local" ) {
		spawner.spawn( dest, body.template, options, body.contents, function() {
			body.template.__source
			console.log( "Finished spawning" );
		});
	} else {
		var registryUrl = registryType == "public" ? urls.REMOTE_URL : urls.LOCAL_URL;

		needle.get( registryUrl + "/contents/" + contentsHash, {}, function( error, response, body ) {
			if( body.template === undefined ) 
				return console.log( "No template found, had to give up :(");

			function spawnTemplate() {
				spawner.spawn( dest, body.template, options, body.contents, function() {
					console.log( "Finished spawning" );
				});
			}

			// If this repo has a github setup, clone down the repo
			if( body.template.github != undefined ) {

				var oldCWD = process.cwd();

				// Create temp directory for the clone of the template repo
			    if( !fs.existsSync(process.cwd() + '/__leto_template_clone/') ) {
			    	console.log( "Making directory for clone of template repo" )
			        fs.mkdirSync( process.cwd() + '/__leto_template_clone/' );
			    }

			    process.chdir( process.cwd() + "/__leto_template_clone/" );

				ares( "git clone git@github.com:" + body.template.github.user + "/" + body.template.github.repo + ".git", true, function() {
					body.template.__source = process.cwd();

					process.chdir( oldCWD );

					spawnTemplate();
				});
			} else {
				spawnTemplate();
			}		
		});
	}
}


//////////////////////////////////////////////////////////////////////////
// Crawls over a template folder and expose all of the template params
function crawlTemplate() {
	console.log( "Crawling template folder" );

	console.log( "Add descriptions for template params inside of leto_params.json to add comments/tooltips in the registry" );

	// Default the source to the current working directory
	var source = process.cwd();

	var setupJSON = require( source + "/leto.json5" );

	crawler.crawl( source, setupJSON, function() {
		console.log( "Finished crawling" );
	});
}


//////////////////////////////////////////////////////////////////////////
// Sets our local storage of variables like registy login and pass
function setVariables( args ) {
	if( args.length < 2 )
		return console.log( "No arguments to set" );

	console.log( "Setting " + args[1] );
	
	// ex: 'leto set login myname'
	switch( args[0] ) {
	case "login": 			
		var auth = JSON.parse( fs.readFileSync(__dirname + "/auth.json") );
		auth.login = args[1];
		writeSettingsFile( "auth.json", auth );
	  	break;
	
	// ex: 'leto set password mypass'
  	case "password": 		
		var auth = JSON.parse( fs.readFileSync(__dirname + "/auth.json") );
		auth.password = args[1];
		writeSettingsFile( "auth.json", auth );
	  	break;

	// ex: 'leto set url remote http://leto.io'
  	case "url":				
  		urls[args[1]] = args[2];
		writeSettingsFile( "urls.json", urls );
  		break;

	default:
	  	console.log( "leto set argument " + args[0] + " is not recognized, try 'login', 'password', or 'url'" );
	}
}


//////////////////////////////////////////////////////////////////////////
// Sets our local storage of variables like registy login and pass
function addHolsterTemplate( args ) {
	if( args.length < 2 )
		return console.log( "No arguments to set" );

	console.log( "Arming " + args[1] + " for convenient use" );
	
	// ex: 'leto arm local name C:/path/to/project'
	switch( args[0] ) {
	case "local":
		holster[args[1]] = {
			type: "local",
			path: args[2] || process.cwd()
		};

		writeSettingsFile( "holster.json", holster );
	  	break;

	// Assume we're trying to arm a remote template from one of our urls
	// ex: 'leto arm debug name username templatename'
	default:
		if( urls[args[0]] === undefined )
			return console.log( "Remote server " + args[0] + " url not found, add it using 'leto set url " + args[0] + " http://someurl.com'" );

		holster[args[1]] = {
			type: "remote",
			url: urls[arg[0]],
			user: args[2],
			template: args[3]
		};
		
		writeSettingsFile( "holster.json", holster );
		break;
	}
}


function writeSettingsFile( filename, data ) {
	var strContents = JSON.stringify( data, null, 4 );

	fs.writeFile( __dirname + "/" + filename, strContents, function(err) {
		if( err ) {
	      	console.log( err );
	    } else {
	      	console.log( filename + " saved" );
	    }
	});
}