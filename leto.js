#!/usr/bin/env nod 
//////////////////////////////////////////////////////////////////////////
// leto - main script
// Copyright Mike Vegeto, 2013. All rights reserved
//////////////////////////////////////////////////////////////////////////
//
// Welcome to leto! Hopefully you can find your way around the project
// without too much difficulty. Help me make this better, so we can all
// stop doing busy work!
//
// leto.js is the module for parsing command line arguments and dealing
// with you pesky users ;)
// 
// Basic structure of sources
// ~~~~~~~~
//
// leto.js - parse command line args and manage other files
//   ├── src/spawner.js - spawn new projects 
//   └── src/crawler.js - crawl projects for template parameters
//
//
// Other Files
// ~~~~~~~~
//
// urls.json - collection of urls to template registries
// auth.json - authorization info for remote servers
// holster.json - collection of templates 'armed' for convenient use
// racks.json - collection of holsters that can be saved and loaded
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
	racks = tryRequire("./racks.json"),
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
 	crawlTemplate( actionArgs );
 	break;

case "set": 	
 	setVariables( actionArgs );
 	break;

case "save": 	
 	saveConfig( actionArgs );
 	break;

case "load": 	
 	loadConfig( actionArgs );
 	break;

case "show": 	
 	printVariables( actionArgs );
 	break;

case "arm": 	
 	addHolsterTemplate( actionArgs );
 	break;

case "delete": 	
 	clearItem( actionArgs );
 	break;

case "init": 	
 	initLetoConfig( actionArgs );
 	break;

case "help": 	
 	runHelp( actionArgs );
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

	// If the url argument is not in our urls collection, hopefully it's a http address, so we'll use it raw
	var strurl = urls[args[0]] === undefined ? args[0] : urls[args[0]];

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

		needle.post( strurl + "templates", httpBody, function(error, response, body) {
			if( error != undefined ) {
				console.log( "Error while publishing: " + error );
			}
			
			var errorMessage = body.error || body.message;
			if( errorMessage != undefined ) {
				console.log( "Error from server: " + errorMessage );
			} else {
				console.log( "Publish successful!" );
			}
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
function crawlTemplate( args ) {
	console.log( "Crawling template folder" );

	// Default the source to the current working directory
	var source = "";

	if( args[0] != undefined && holster[args[0]] != undefined ) {
		source = holster[args[0]].path;
	} else {
		source = process.cwd();
	}

	// If there's already a leto_params.json file in the source directory,
	// assume that they've crawled before, and don't tell them about
	// registry tooltips
	try {
		var preExistingParams = require( source + "/leto_params.json" );
	} catch( err ) {
		console.log( "Add descriptions for template params inside of leto_params.json to add comments/tooltips in the registry" );
	}

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

	function printTemplate( template, name ) {
		console.log( "\n" + name );

		var strUnderline = "";
		for( var iChar in name )
			strUnderline += ".";

		console.log( strUnderline );
		
		for( iAttr in template )
			console.log( "    " + iAttr + " : " + template[iAttr] );
	}

	function printRack( rack, name ) {
		var strUnderscore = "-------------------------------------------------------------------------------",
			strNameLine = name;
		for( var iChar in strUnderscore ) {
			if( iChar > strUnderscore.length - name.length - 1)
				break;

			strNameLine = " " + strNameLine;
		}

		console.log( strNameLine );
		console.log( strUnderscore );

		if( rack === undefined ) {
			console.log( "No rack named " + name + " found" );
		} else {
			for( var iTemplate in rack ) {
				printTemplate( rack[iTemplate], iTemplate );
			}				
		}
	}

	switch( args[0] ) {
	case "holster": 	
		if( isObjectEmpty(holster) ) {
			console.log( "No holster items" );
		} else {
			for( var iItem in holster ) {
				printTemplate( holster[iItem], iItem );
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

  	case "racks":
  		if( isObjectEmpty(racks) ) {
			console.log( "No racks" );
		} else {
			for( var iRack in racks ) {
				printRack( racks[iRack], iRack );
			}
		}
	  	break;

  	case "rack":
  		if( isObjectEmpty(racks) ) {
			console.log( "No racks" );
		} else {
			var rackName = args[1];
			printRack( racks[rackName], rackName );
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

  	case "armed":
  		var templateToDelete = holster[args[1]];
		if( templateToDelete === undefined ) {
  			console.log( "No template found with name " + args[1] )
  		} else {
  			delete holster[args[1]];
  			writeSettingsFile( "holster.json", holster );
  		}
	  	break;

  	case "urls":
		urls = {};
		writeSettingsFile( "urls.json", urls );
	  	break;

  	case "url":
  		var urlToDelete = urls[args[1]];
		if( urlToDelete === undefined ) {
  			console.log( "No url found with name " + args[1] )
  		} else {
  			delete urls[args[1]];
  			writeSettingsFile( "urls.json", urls );
  		}
	  	break;

  	case "auth":
		auth = {};
		writeSettingsFile( "auth.json", auth );
	  	break;

  	case "racks":
		racks = {};
		writeSettingsFile( "racks.json", racks );
	  	break;

  	case "rack":
  		var rackToDelete = racks[args[1]];
  		if( rackToDelete === undefined ) {
  			console.log( "No rack found with name " + args[1] )
  		} else {
  			delete racks[args[1]];
  			writeSettingsFile( "racks.json", racks );
  		}
	  	break;

	default:
		return console.log( "Error: " + args[0] + " is unknown, what are you trying to clear?" );
	}
}


//////////////////////////////////////////////////////////////////////////
// Save some aspect of our current save
function saveConfig( args ) {
	if( args.length < 2 )
		return console.log( "Not enough arguments to save" );

	switch( args[0] ) {
	case "rack":
		var rackName = args[1];

		// Save the current holster as a rack
		racks[rackName] = holster;
		writeSettingsFile( "racks.json", racks );
	  	break;

	default:
		return console.log( "Error: " + args[0] + " is unknown, what are you trying to save?" );
	}
}


//////////////////////////////////////////////////////////////////////////
// Load some configuration stuff
function loadConfig( args ) {
	if( args.length < 2 )
		return console.log( "Not enough arguments to load" );

	switch( args[0] ) {
	case "rack":
		var rackName = args[1];

		if( isObjectEmpty(racks) ) {
			console.log( "No racks" );
		} else if( racks[rackName] === undefined ) {
			console.log( "No rack named " + rackName + " found" );
		} else {

			// Load the intended rack into our holster
			for( var iTemplate in racks[rackName] ) {
				holster[iTemplate] = racks[rackName][iTemplate];
			}

			writeSettingsFile( "holster.json", holster );
			console.log( "Rack " + rackName + " loaded" );
		}

	  	break;

	default:
		return console.log( "Error: " + args[0] + " is unknown, what are you trying to load?" );
	}
}



//////////////////////////////////////////////////////////////////////////
// Spit out a blank leto config file
function initLetoConfig( args ) {
	if( args[0] != undefined && args[0] == "full" ) {
		// ---------------------
		// Full initialization
		// ---------------------
		var configDir = process.cwd() + "/leto_config",
			templatesDir = configDir + "/templates";

		// Create a leto configuration directory
		wrench.mkdirSyncRecursive( configDir, 0777 );

		// Create a templates directory
		wrench.mkdirSyncRecursive( templatesDir, 0777 );

		// Write out an empty template file
		writeFile( templatesDir + "/template.tpl", "" );

		// Write out an empty changer rules file
		writeFile( configDir + "/rules.js", "exports.ruleName = function() {\n	return 'hello world'\n}" );

		// Write out a more complete config file referencing the
		// blank files we just created
		writeFile( process.cwd() + "/leto.json5", fs.readFileSync(__dirname + "/full_leto.json5", "utf8") );

	} else {
		// Basic initialization
		var blankLetoPath = __dirname + "/blank_leto.json5",
			file = fs.readFileSync( blankLetoPath, "utf8" ),
			destPath = process.cwd() + "/leto.json5";

		writeFile( destPath, file );
	}

	function writeFile( path, contents ) {
		try {
			fs.writeFile( path, contents, function(err) {
				if( err ) {
			      	console.log( err );
			    } else {
			      	console.log( "Creating: " + path );
			    }
			});
		} catch( err ) {
			console.log( "Error writing file: " + err );
		}
	}	
}


//////////////////////////////////////////////////////////////////////////
// Help out the user
function runHelp( args ) {
	if( args === undefined || args.length == 0 ) {
		console.log( "\n   Available commands (type 'leto help [some command]' for more details)\n" );
		console.log( " - spawn     run a leto procedure" );
		console.log( " - publish   push a template to the registry" );
		console.log( " - crawl     look through a template directory and find all template parameters" );
		console.log( " - set       change a single variable, like your password, username, etc." );
		console.log( " - save      save aspects of your configuration, like a template rack" );
		console.log( " - load      load aspects of your configuration" );
		console.log( " - show      display some information" );
		console.log( " - arm       load a template into your holster" );
		console.log( " - delete    delete some aspect of your configuration" );
		console.log( " - init      create a new leto.json5 in the current working dir" );
	} else {
		switch( args[0] ) {
		case "spawn":
			console.log( "\nUse a leto procedure. Procedures can come from local templates (on your hard drive), or from a remote url (like the leto registry). Either template can be used through the holster. Try 'leto help arm' for more details\n" );
			console.log( "From holster" );
			console.log( "----------------" );
			console.log( "leto spawn [template name] --param value" );
			console.log( "" );
			console.log( "From remote server" );
			console.log( "----------------" );
			console.log( "leto spawn [url] [registry username] [template name] --param value" );
		  	break;

	  	case "publish":
			console.log( "\nPush your template up to a remote leto registry. The official registry url is http://leto.io\n" );
			console.log( "Example:" );
			console.log( "----------------" );
			console.log( "leto publish [remote url]" );
			console.log( "" );
			console.log( "The remote url can be a http address, or it can be the name of a remote url saved in your urls (type 'leto help set' for more details)" );
		  	break;

	  	case "crawl":
			console.log( "\nLeto will look through your template and find all template parameters. This generates a file called leto_params.json, which contains all template parameters, and any tooltips you want to have for the registry\n" );
			console.log( "Example:" );
			console.log( "----------------" );
			console.log( "leto crawl" );
		  	break;

	  	case "set":
			console.log( "\nSet the value of a config variable. Your options are:\n" );
			console.log( " - leto set url [url name] [http://yoururl]" );
			console.log( " - leto set username [user name]" );
			console.log( " - leto set password [password]" );
		  	break;

	  	case "save":
			console.log( "\nSave more complex config variables. Your options are:\n" );
			console.log( " - leto save rack [rack name]" );
		  	break;

	  	case "load":
			console.log( "\nLoad up more complex config variables. Your options are:\n" );
			console.log( " - leto load rack [rack name]" );
		  	break;

	  	case "show":
			console.log( "\nPrint leto variables to the console. Your options are:\n" );
			console.log( " - leto show holster" );
			console.log( " - leto show armed [template name]" );
			console.log( " - leto show racks" );
			console.log( " - leto show rack [rack name]" );
			console.log( " - leto show urls" );
		  	break;

	  	case "arm":
			console.log( "\nPut a template into the holster for convenient command line use. The template can either be a local template (on disk), or a remote template (from the registry)\n" );
			console.log( "Local template:" );
			console.log( " - leto arm [holster name] ([path on disk])\n" );
			console.log( "Remote template:" );
			console.log( " - leto arm [remote from urls] [holster name] [template owner] [template name]" );
			console.log( " - leto arm [http://address] [holster name] [template owner] [template name]" );
		  	break;

	  	case "delete":
			console.log( "\nRemove a leto config item or set of items (does not delete template files on disk). Your options are:\n" );
			console.log( " - leto delete holster      (deletes all holster items)" );
			console.log( " - leto delete armed [name] (deletes a holster item)" );
			console.log( " - leto delete racks        (deletes all racks)" );
			console.log( " - leto delete rack [name]  (deletes a rack)" );
			console.log( " - leto delete urls         (clears all urls)" );
			console.log( " - leto delete url [name]   (clears a url)" );
			console.log( " - leto delete auth         (clears auth config)" );

		  	break;

		default:
			return console.log( "Error: " + args[0] + " is unknown, send me an email or something" );
		}
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


function isObjectEmpty( obj ) {
    if( obj == null ) return true;
    if( obj.length && obj.length > 0 ) return false;
    if( obj.length === 0 ) return true;

    for( var key in obj ) {
        if( hasOwnProperty.call(obj, key) ) return false;
    }

    return true;
}