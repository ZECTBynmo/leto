#!/usr/bin/env node
//////////////////////////////////////////////////////////////////////////
// leto - main script
// Copyright Mike Vegeto, 2013. All rights reserved
//////////////////////////////////////////////////////////////////////////
//
// Main module for parsing command line arguments and dealing with users
//
var Spawner = require("./src/spawner").spawner,
	Crawler = require("./src/crawler").crawler,
	request = require('request'),
	spawner = new Spawner(),
	crawler = new Crawler(),
	wrench = require("wrench"),
	needle = require("needle"),
	spawn = require("child_process").spawn,
	JSON5 = require('json5'),
	
	ares = require("ares").ares,
	fs = require("fs");

function tryRequire( thingToRequire ) {
	try {
		return require( thingToRequire );
	} catch( error ) {
		return {};
	}
}

var holster = tryRequire("./holster.json"),
	urls = tryRequire("./urls.json"),
	auth = tryRequire("./auth.json");

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
		argContents[iArg] = argv[iArg];
	}
} // end for each argument

switch( action ) {
case "spawn":
	spawnProject( actionArgs, argContents );
  	break;

case "publish": 	
 	publishTemplate( actionArgs );
 	break;

case "crawl": 	
 	crawlTemplate();
 	break;

case "set": 	
 	setVariables( actionArgs );
 	break;

case "show": 	
 	printVariables( actionArgs );
 	break;

case "arm": 	
 	addHolsterTemplate( actionArgs );
 	break;

case "clear": 	
 	clearItem( actionArgs );
 	break;

case "init": 	
 	initLetoConfig();
 	break;

default:
  	console.log( "Action " + action + " is not recognized, try 'spawn', 'set', 'add', 'crawl', or 'publish'" );
}


//////////////////////////////////////////////////////////////////////////
// Push a project up to the registry
function publishTemplate( args ) {
	if( args.length < 1 )
		return console.log( "Need more arguments to publish" );

	if( urls[args[0]] === undefined )
		return console.log( "Remote url " + args[0] + " not found, add it using 'leto set url " + args[0] + " http://someurl.com'" );

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

		if( auth.login == undefined )
			return console.log( "Login not set, use 'leto set login yourname'" );
		if( auth.password == undefined )
			return console.log( "Password not set, use 'leto set password yourpass'" );

		var httpBody = {
			template: template,
			auth: auth
		};

		needle.post( urls[args[0]] + "/templates", httpBody, function(error, response, body) {
			if( error != undefined )
				console.log( error );
			
			var errorMessage = body.error || body.message;
			if( errorMessage != undefined )
				console.log( errorMessage );
			else
				console.log( "Publish successful!" );
		});
	});
}


//////////////////////////////////////////////////////////////////////////
// Spawns a project from contents we retrieve from the database
function spawnProject( args, contents ) {
	if( args.length < 1 )
		return console.log( "Need more arguments to spawn" );

	console.log( "Spawning project" );

	var dest = process.cwd();

	var options = {
		dest: dest
	};

	function spawnLocalTemplate( source, localContents ) {
		try { 
			var localTemplate = require( source + "/leto" );
		} catch( err ) {
			console.log( "Error loading local template at: " + source );
			console.log( err );
			return;
		}

		localTemplate.__source = source;

		spawner.spawn( dest, localTemplate, options, localContents, function() {
			console.log( "Finished spawning" );
		});
	}

	function spawnRemoteTemplate( url, hashOrUser, templateName ) {

		function cloneAndSpawn(template, spawnContents) {
			var oldCWD = process.cwd();

			// Create temp directory for the clone of the template repo
		    if( !fs.existsSync(process.cwd() + '/__leto_template_clone/') ) {
		    	console.log( "Making directory for clone of template repo" )
		        fs.mkdirSync( process.cwd() + '/__leto_template_clone/' );
		    }

		    process.chdir( process.cwd() + '/__leto_template_clone/' );

		    var gitClone = spawn( 'git', ['clone', "git@github.com:" + template.github.user + "/" + template.github.repo] );

		    gitClone.stdout.on('data', function (data) {
			  	console.log( data + "" );
			});

			gitClone.stderr.on('data', function (data) {
			  	console.log( data + "" );
			});

			gitClone.on('close', function (code) {
			  	if( code == 0 ) {
					template.__source = process.cwd() + "/" + template.github.repo;

					process.chdir( oldCWD );

					spawner.spawn( dest, template, options, spawnContents, function() {
						console.log( "Finished spawning" );
					});
			  	} else {
			  		console.log( "git clone exited with code: " + code );
			  	}
			});
		}

		// Create an auth object in the way needle wants it
		var authObj = {
			'auth': {
			    'user': auth.login,
			    'pass': auth.password,
			    'sendImmediately': true
		  	}
		};

		// If the template name is undefined, that probably means we're trying
		// to spawn using a registry content hash
		if( templateName === undefined ) { 
			var fullUrl = url + "/contents/" + hashOrUser;

			// We're assuming they're using a hash for some contents coming from a registry gui
			console.log( "Cloning " + hashOrUser );
			request.get( fullUrl, authObj, function( error, response, body ) {
				if( error != undefined )
					console.log( error );
				else if( Math.floor(response.statusCode/100) != 2 )
					console.log( body );
				else {
					var bodyObj = JSON.parse(body);
					cloneAndSpawn( bodyObj.template, bodyObj.contents );
				}
			});
		} else {
			var fullUrl = url + "/templates/" + hashOrUser + "/" + templateName;

			console.log( "Cloning " + hashOrUser + ": " + templateName );
			request.get( fullUrl, authObj, function( err, response, body ) {
				if( err != undefined )
					console.log( err );
				else if( Math.floor(response.statusCode/100) != 2 )
					console.log( body + "" );
				else {
					var receivedTemplate = JSON5.parse( body + "" );
					cloneAndSpawn( receivedTemplate, contents );
				}
			});
		}
	} // end spawnRemoteTemplate()

	// Is the user trying to spawn a project from their holster?
	// 'leto spawn someproject'
	var holsterItem = holster[args[0]];
	if( holsterItem != undefined ) {
		if( holsterItem.type == "local" ) {
			spawnLocalTemplate( holsterItem.path, contents );
		} else if( holsterItem.type == "remote" ) {
			spawnRemoteTemplate( holsterItem.url, holsterItem.user, holsterItem.template );
		} else {
			return console.log( "Unknown holster item type, abort!" );
		}
	} else if( args.length > 1 ) {

		// Is the user trying to call out a registry template by name?
		// 'leto spawn someremote someuser someproject'
		// 'leto spawn http://something.else 2348723984ydf89f67dc98xfg9876dfg'	
		if( urls[args[0]] != undefined ) {
			spawnRemoteTemplate( urls[args[0]], args[1], args[2] );
		} else if( args[0].indexOf("http") == 0 ) {
			spawnRemoteTemplate( args[0], args[1], args[2] );
		} else {
			console.log( "No remote url '" + args[0] + "' found, use 'leto set url " + args[0] + " http://something...' to set a url" );
		}
	} else {
		console.log( "No idea how to spawn a template from your input :/" );
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
		auth.login = args[1];
		writeSettingsFile( "auth.json", auth );
	  	break;
	
	// ex: 'leto set password mypass'
  	case "password": 		
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
// Prints variables
function printVariables( args ) {
	// ex: 'leto set login myname'
	switch( args[0] ) {
	case "holster": 	
		if( isObjectEmpty(holster) ) {
			console.log( "No holster items" );
		} else {
			for( var iItem in holster ) {
				console.log( iItem );
				console.log( "    " + holster[iItem].type );
			}
		}		
	  	break;

  	case "urls": 
  		if( isObjectEmpty(urls) ) {
			console.log( "No urls" );
		} else {
			for( var iUrl in urls ) {
				console.log( iUrl + ": " + urls[iUrl] );
			}
		}
	  	break;

	default:
	  	console.log( "leto set argument " + args[0] + " is not recognized, try 'login', 'password', or 'url'" );
	}
}


//////////////////////////////////////////////////////////////////////////
// Sets our local storage of variables like registy login and pass
function addHolsterTemplate( args ) {
	var holsterItemName,
		type,
		path,
		remoteName;

	// Parse our arguments
	if( args.length == 0 ) {
		// 'leto arm'
		try {
			var templateToArm = require( process.cwd() + "/leto" );
			holsterItemName = templateToArm.name;
			type = "local";
		} catch( err ) {
			return console.log( "Couldn't find template to arm" );
		}		
	} else if( args.length == 1 ) { 
		// 'leto arm holstername'
		holsterItemName = args[0];
		type = "local";
	} else if( args[0] != undefined && urls[args[0]] != undefined ) {
		// 'leto arm remote'
		type = "remote";
		remoteName = args[0];
		holsterItemName = args[1];
	} else {
		return console.log( "Error: Not sure what template you're trying to arm" );
	}

	console.log( "Arming " + holsterItemName + " for convenient use" );
	
	// ex: 'leto arm local name C:/path/to/project'
	switch( type ) {
	case "local":
		holster[holsterItemName] = {
			type: "local",
			path: path || process.cwd()
		};

		writeSettingsFile( "holster.json", holster );
	  	break;

  	case "remote":
		holster[args[1]] = {
			type: "remote",
			url: urls[args[0]],
			user: args[2],
			template: args[3]
		};
		
		writeSettingsFile( "holster.json", holster );
		break;

	// Assume we're trying to arm a remote template from one of our urls
	// ex: 'leto arm debug holstername username templatename'
	default:
		return console.log( "Error: Not sure what template you're trying to arm" );
	}
}


//////////////////////////////////////////////////////////////////////////
// Clear some item (holster, urls, auth, etc)
function clearItem( args ) {
	if( args.length < 1 )
		return console.log( "No arguments to clear" );

	switch( args[0] ) {
	case "holster":
		holster = {};
		writeSettingsFile( "holster.json", holster );
	  	break;

  	case "urls":
		urls = {};
		writeSettingsFile( "urls.json", urls );
	  	break;

  	case "auth":
		auth = {};
		writeSettingsFile( "auth.json", auth );
	  	break;

	default:
		return console.log( "Error: " + args[0] + " is unknown, what are you trying to clear?" );
	}
}


//////////////////////////////////////////////////////////////////////////
// Spit out a blank leto config file
function initLetoConfig() {
	var path = __dirname + "/blank_leto.json5",
		file = fs.readFileSync( path, "utf8" );

	fs.writeFile( process.cwd() + "/leto.json5", file, function(err) {
		if( err ) {
	      	console.log( err );
	    } else {
	      	console.log( "leto.json5 created at " + process.cwd() );
	    }
	});
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

function isObjectEmpty( obj ) {
    if( obj == null ) return true;
    if( obj.length && obj.length > 0 ) return false;
    if( obj.length === 0 ) return true;

    for( var key in obj ) {
        if( hasOwnProperty.call(obj, key) ) return false;
    }

    return true;
}