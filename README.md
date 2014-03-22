# Leto - Projects from the hip

Leto is a general purpose text wrangler that can help automate tasks in any language, on any major platform.

Do you find yourself writing the same code over and over? Do you waste time running search replace, looking up command line arguments, or otherwise doing non-dev work? Leto is built for you! Run complicated procedures in seconds, and automate away all your busy work.

## Installation

```
npm install -g leto
```

# Overview

Leto is designed to spawn new projects from boilerplate projects, given some information from the user. In order to do this, we need to create a 'procedure' for leto to follow. The procedure and other configuration information is placed into a file called leto.json, or leto.json5, and must sit within the main project directory.

## Command Line Usage

Leto has some built-in systems for organizing and using templates. The first is called the holster:

```
leto show holster
```

The holster holds the currently loaded set of leto templates. Templates can be added to the holster with custom names that are convenient for command line use. If you were inside the directory of a leto template, you could add it to the holster:

```
leto arm [holster name]
```

Once you've loaded that template into the holster, you can use it from the command line:

```
leto spawn [holster name]
```

If you want to see the parameters available inside of a holster parameter so you can spawn it with full info, you can do something like:

```
leto crawl [holster name]
```

If your holster is getting too large/unmanageable you can save it into a 'rack':

```
leto save rack [rack name]
```

You can view your currently available racks:

```
leto show racks
leto show rack [rack name]
```

You can load up one of your racks into the current holster:

```
leto load rack [rack name]
```

### [JSON5] (https://github.com/aseemk/json5)

JSON5 allows us to setup leto using a simple JSON-compatible format, and make it easier to read and write by allowing comments and things like trailing commas.

### Example leto.json5

```js
{   "image": "http://secure.gravatar.com/avatar/8c758b186ab9e7358188ef30672ce84e?s=496&d=retro",
    "github": {                                                           
        "user": "ZECTBynmo",                                              
        "repo": "someRepo"
    }, 

    "defaults": {
    	"projectName": "DefaultProjectName",    
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Setup procedure
    "procedure": [

        // ******************************
        // Step 1 - Move Sources
        // ******************************
        {   "title": "Move SDK sources into place",
            "type": "move",                     
            "plan": "./movingPlan",             
        }, // end move sources


        // ******************************
        // Step 2 - Search and Replace
        // ******************************
        {   "title": "Change names and paths",
            "type": "replace",                  
                                                
            "keywords": {       
                "projectName": "MyProject",     
            },                                  
                
            "extensions": [                     
                ".js",                          
                ".md",
                ".json"
            ]
        }, // end search and replace


        // ******************************
        // Step 3 - Run a script
        // ******************************
        {   "title": "Generate project files",
            "type": "execute",
            "command": "nonnode-gyp configure"
        }, // end run script

    ] // end setup procedure
}
```

The procedure consists of a series of 'steps'. Each step can have a different action, and can depend on user input where necessary.

The following basic actions are available, directly replacing what you might do manually:

#### move - move file(s) from one place into another using [mover] (https://github.com/ZECTBynmo/mover)

```js
{	title: "some title",
	type: "move",

	// Relative path to our moving plan (see the mover readme for more info)
	plan: "./somePlan"
}
```

#### replace - do batch search+replace on files and paths within a dir using [maker] (https://github.com/ZECTBynmo/maker)

This step reads through all files within a directory, and feeds them into [maker] (https://github.com/ZECTBynmo/maker), where they are searched for keywords. Where found, keywords will be replaced by variables determined by user input. In the example leto.json5 above, we were marking each instance of the string "MyProject" as an instance of the variable "projectName". Eventually, we'll figure out what the value projectName actually is, and do search replace.

```js
{	title: "some title",
	type: "replace",

	// The names of the items we want to flag for replacement
	"keywords": {       
        "whatIsTheKeyword": "TheKeyword",     
        "what is THIS keyword?": "TheOtherKeyword!",    
        "whatIsThisPath": "../../../../../../test"
    },

    // The file extensions that we want to process (we process everything if not present)
    "extensions": [                     
        ".js",                          
        ".md",
        ".json"
    ]
}
```

#### execute - run a shell command (so you can launch a script, etc...)

```js
{   "title": "Generate project files",
    "type": "execute",

    // The (optional) directory where we want to run the command
    "workingdir": "someDir/otherDir",

    // The command we want to run
    "command": "cd myDir && mkdir newDir && cd newDir"
}
```

#### template - generate text files from [maker] (https://github.com/ZECTBynmo/maker) templates

```js
{	"title": "Template a file!",
    "type": "template",

    // Directory where our template files (.tpl) are sitting
    "sourcedir": "test/test_templates",

    // A list of the template files we want to generate, and their destinations
    // Destinations can be templatized
    "templates": [
    	{	"name": "test1", 
    		"dest": "test/~~testFolderName~~/templatedScript.js"
    	}
    ]
}
```

#### change - modify a file in place, using [changer] (https://github.com/ZECTBynmo/changer)

```js
{	"title": "Change some stuff",
    "type": "change", 

    // The relative path to our rule set (a node.js module)
    "ruleset": "test/test_rulesets/testRules.js",

    // The list of changes we want to do
    // Rules can be run on a single line using 'line', or they
    // can be run on multiple lines using 'start' and 'end'.
    "changes": [
    	{
    		"rule": "insert",							// Name of the rule
    		"args": "test += 5",						// optional arguments to the rule
    		"file": "test/_TEST/TestChangerSource.js",	// File we're changing
    		"line": 16									// Line to operate on
    	},
    	{
    		"rule": "change",
    		"args": "test += 444",
    		"file": "test/_TEST/TestChangerSource.js",
    		"line": 9
    	},
        {
            "rule": "bestRuleName",
            "file": "test/_TEST/TestChangerSource.js",
            "start": 23,								// Line to start on
            "end": 26									// Line to end on
        }
	]
}
```

### Template layer

Almost everything in leto is passed through the 'template layer' using [maker] (https://github.com/ZECTBynmo/maker). Many parts of the leto.json5 configuration are inspected for 'template strings', allowing you to expose parts of your project as variables, which will be filled with user input later.

For example, lets look at one of Leto's explicit template files. Lets call this test.tpl

```js
//////////////////////////////////////////////////////////////////////////
// ~~comment~~
function ~~functionName~~(~~arguments~~) {
    ~~contents~~
} // end ~~functionName~~()
```

Leto loads in the template, and extracts the variables from it. Later, variables can be resolved by somewhere else in the leto.json5 config file, or by user input.

If we build a leto.json5 template using test.tpl, it might look something like this (lets say it lives in a directory called source/directory)

```js
{   
    procedure: {
        "type": "template",
        
        "sourcedir": "template/directory",

        "templates": [
            {   "name": "test", 
                "dest": "output/directory/~~parameter~~/test.js"
            }
        ]
    }
}
```

Notice that the 'dest' has a variable in it also. This will be passed through the same process. Now that we have a procedure, we could use it. Here's how we could make use of our parameters from the command line (assuming we've armed the template as "test")

```
leto spawn test --parameter TEST --comment Sweeeeeet --functionName testFunction --contents console.log('!');
```

This would spit out a file at output/directory/TEST/test.js that would look like:

```js
//////////////////////////////////////////////////////////////////////////
// Sweeeeeet
function testFunction() {
    console.log('sweet');
} // end testFunction()
```

Notice that we never specified any value for the "arguments" variable, leaving the space empty.

If we wanted to, we could define some default variables with a "defaults" block:

```js
{   
    procedure: {
        "type": "template",
        
        "sourcedir": "template/directory",

        "templates": [
            {   "name": "test", 
                "dest": "output/directory/~~parameter~~/test.js"
            }
        ]
    },

    defaults; {
        parameter: "something",
        comment: "Some Awesome Comment!",
        functionName: "defaultName",
        contents: "console.log('default');"
    }
}
```

We can also fill out template more dynamically by creating reference to a "functions" file. Here's an example functions file where we override a variable

```js
exports.randomNumber = function() {
    return Math.random(); 
}
```

Then we can reference it from a template file like this (othertest.tpl), and we will get a unique random number every time:

```js
var uniqueNumber = ~~randomNumber~~;
```

Some places where you can use templates

- Most file paths inside of leto.json5
- File paths inside of [mover] (https://github.com/ZECTBynmo/mover) plans
- Anything within 'change' rules
- Anything within leto template files (.tpl)
