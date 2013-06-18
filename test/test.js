var assert = require("assert");

var Spawner = require("../spawner").spawner,
	spawner = new Spawner(),
	test_move_leto = require( __dirname + "/test_move_leto.json" ),
	test_template_leto = require( __dirname + "/test_template_leto.json" ),
	test_replace_leto = require( __dirname + "/test_replace_leto.json" ),
	test_execute_leto = require( __dirname + "/test_execute_leto.json" );

describe('spawner', function() {
	describe('#spawn()', function() {
		it('should move some files', function(done) {
			spawner.spawn( __dirname, test_move_leto, {}, {}, function() {
				// Make sure the file was moved
				if( require('path').existsSync( __dirname + "/_TEST/test_moving_plan.json") ) {
				    done();
				} else {
					done("File not moved");
				}				
			});
		});

		it('should build template files', function(done) {
			var contents = {
				testFolder:"_TEST", 
				contents:"return 'poop';"
			};

			// Generate a node module and call the function thgat it exports
			spawner.spawn( __dirname, test_template_leto, {}, contents, function() {
				// Call the function from the module we just generated
				if( require( __dirname + "/_TEST/templatedScript").test() == "poop" ) {
				    done();
				} else {
					done( "File not moved" );
				}				
			});
		});

		it('should do batch replace on files inside of a dir', function(done) {
			var contents = {
				testClassName:"MyGeneratedClass"
			};

			spawner.spawn( __dirname+"/_TEST/", test_replace_leto, {}, contents, function() {
				var MyGeneratedClass = require( __dirname + "/_TEST/TestSource" ).MyGeneratedClass;
				
				console.log( MyGeneratedClass );

				var myObject = new MyGeneratedClass();

				if( myObject.test() == "poop" ) {
				    done();
				} else {
					done( "File not moved" );
				}				
			});
		});

		it('should execute a command', function(done) {
			spawner.spawn( __dirname, test_execute_leto, {}, {}, function() {
				// Make sure the file was moved
				if( require('path').existsSync( __dirname + "/_TEST/test.txt") ) {
				    done();
				} else {
					done("Command not executed");
				}				
			});
		});
	});
});