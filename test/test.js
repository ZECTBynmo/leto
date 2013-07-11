var assert = require("assert");

var Spawner = require("../src/spawner").spawner,
	Crawler = require("../src/crawler").crawler,
	spawner = new Spawner(),
	crawler = new Crawler(),
	test_move_leto = 	 require( __dirname + "/test_letos/test_move_leto.json" ),
	test_change_leto = 	 require( __dirname + "/test_letos/test_change_leto.json" ),
	test_replace_leto =  require( __dirname + "/test_letos/test_replace_leto.json" ),
	test_execute_leto =  require( __dirname + "/test_letos/test_execute_leto.json" ),
	test_publish_leto =  require( __dirname + "/test_letos/test_publish_leto.json" ),
	test_template_leto = require( __dirname + "/test_letos/test_template_leto.json" );

// Set some fake sources for our letos, these would be set by the server otherwise
test_move_leto.__source		 = process.cwd();
test_change_leto.__source	 = process.cwd();
test_replace_leto.__source 	 = process.cwd();
test_execute_leto.__source   = process.cwd();
test_publish_leto.__source   = process.cwd();
test_template_leto.__source  = process.cwd();


describe('spawner', function() {
	describe('#spawn()', function() {

		it('should move some files', function(done) {
			spawner.spawn( __dirname, test_move_leto, {}, {}, function() {
				// Make sure the file was moved
				var movedMovingPlan = require( __dirname + "/_TEST/test_moving_plan.json" );
				if( movedMovingPlan != undefined ) {
				    done();
				} else {
					done("File not moved");
				}
			});
		});

		it('should change some stuff', function(done) {
			var contents = {
				templateFunctionName: "bestRuleName"
			};

			spawner.spawn( __dirname, test_change_leto, {}, contents, function() {
				
				var Thing = require( __dirname + "/_TEST/TestChangerSource" ).ChangerThing;

				var thing = new Thing();

				if( thing === undefined )
					done( "Failed to move our file into place to setup our 'change' test" );

				if( thing.changeTest() != 444 )
					done( "Failed to change line" );
				else if( thing.insertTest() != 5 )
					done( "Failed to insert line" );
				else if( thing[contents.templateFunctionName]() != 16 )
					done( "Failed to templatize ruleset contents" );
				else
					done();
				
			});
		});

		it('should build template files', function(done) {
			var contents = {
				testFolder: "_TEST", 
				contents: "return 'poop';"
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
					done( "Command not executed" );
				}
			});
		});
	});	// end describe spawn()
}); // end describe spawner


describe('crawler', function() {

	describe('#crawl()', function() {

		crawler.crawl( __dirname, test_publish_leto, function() {

			it('should create a leto_params.json file', function(done) {

				// Make sure the file was moved
				if( require(__dirname + "/leto_params.json") != undefined ) {
				    done();
				} else {
					done( "Can't load leto_params.json" );
				}
			});

			it('should load params from "template" steps destination paths', function(done) {
				var templateParams = require(__dirname + "/leto_params.json");

				if( templateParams["templateDestParam"] != undefined ) {
				    done();
				} else {
					done( "Can't load params from 'template' destination paths" );
				}
			});

			it('should load params from "template" steps template files', function(done) {
				var templateParams = require(__dirname + "/leto_params.json");

				if( templateParams.contents != undefined ) {
				    done();
				} else {
					done( "Can't load params from template file contents" );
				}
			});

			it('should load params from "replace" steps keywords', function(done) {
				var templateParams = require(__dirname + "/leto_params.json");

				if( templateParams["replaceKeyword1"] != undefined && templateParams["replaceKeyword2"] != undefined ) {
				    done();
				} else {
					done( "Replace params not properly setup" );
				}
			});

		});

	});	// end describe crawl()

}); // end describe crawler