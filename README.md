# Leto - Projects from the hip

Leto will help you automate tasks for starting new projects in any language, on any major platform. Stop doing redundant project bring-up work, and help us do the same!

### [Website] (http://leto.io)

## Installation

```
npm install -g leto
```

## Overview

Leto is tailored specifically to perform one task: spawn a new project from a boilerplate project, given some information from the user. In order to do this, we need to create a 'procedure' for leto to follow. The procedure and other configuration information is placed into a file called leto.json, or leto.json5, and must sit within the main project directory.

### [JSON5] (https://github.com/aseemk/json5)

JSON5 allows us to setup leto using a simple JSON-compatible format, and make it easier to read and write by allowing comments and things like trailing commas.

### Example leto.json5

```js
{   "image": "http://secure.gravatar.com/avatar/8c758b186ab9e7358188ef30672ce84e?s=496&d=retro",
    "github": {                                                           
        "user": "ZECTBynmo",                                              
        "repo": "someRepo"
    }, 

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

The procedure consists of a series of 'steps'. Each step can have a different action, and can depend on user input where necessary. Things like file paths, names, etc. can be easily left for leto to 'templatize' using [maker] (https://github.com/ZECTBynmo/maker). A deeper explanation and examples will follow, but first...

The following basic actions are available, directly replacing what you might do manually:

#### move - move file(s) from one place into another using [mover] (https://github.com/ZECTBynmo/mover)

```js
{	title: "some title",
	type: "move",

	// Relative path to our moving plan (see the mover readme for more info)
	plan: "./somePlan"
}
```

#### replace - do batch search+replace on files and file paths within a directory

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

    // The command we want to run
    "command": "cd myDir && mkdir newDir && cd newDir"
}
```

#### template - generate text files from maker templates

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
    "changes": [
    	{
    		"rule": "insert",
    		"args": "test += 5",
    		"file": "test/_TEST/TestChangerSource.js",
    		"line": 16
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
            "start": 23,
            "end": 26
        }
	]
}
```