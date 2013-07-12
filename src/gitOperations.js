var ares = require("ares").ares,
	mkdirp = require("mkdirp");


//////////////////////////////////////////////////////////////////////////
// Clone a repository locally
exports.cloneRepo = function( options, branch, SHA, callback ) {
	console.log( "Cloning repo " + options.github.user + "::" + options.github.repo );

	mkdirp.sync( options.tempRepoDest );
	
	var hasSha = true;

	// branch and SHA are optional arguments
	if( callback === undefined ) {
		callback = SHA;
		hasSHA = false;
	}

	if( SHA === undefined ) {
		callback = branch;
		branch = "master";
	}

	// Grab the current working directory
	var originalCWD = process.cwd();

	// Change locations to the destination of the repo clone
	process.chdir( options.tempRepoDest );

	var command = "git clone -b " + branch + " " + "git@github.com:" + options.github.user + "/" + options.github.repo + ".git";

	console.log( command );

	ares( command, true, function() {
		if( hasSHA ) {
			process.chdir( options.tempRepoDest + "/" + options.github.repo );

			ares( "git checkout " + SHA );
		}

		// Change the working directory back to its original state
		process.chdir( originalCWD );

		callback();
	});

	// Change the working directory back to its original state
	process.chdir( originalCWD );

} // end nptm.cloneRepo()