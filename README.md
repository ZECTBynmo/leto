# Leto - Projects from the hip

Leto is a language agnostic text templating library designed to help automate project setup.

### [Website] (http://leto.io)

## Installation

```
npm install -g leto
```

## Overview

Leto is tailored specifically to perform one task: spawn a new project from a boilerplate project, given some information from the user. In order to do this, we need to create a 'procedure' for leto to follow. The procedure and other configuration information is placed into a file called leto.json, or leto.json5, and must sit within the main project directory.

### [JSON5] (https://github.com/aseemk/json5)

JSON5 allows us to setup leto using a simple JSON-compatible fomat, and make it easier to read and write by allowing comments and things like trailing commas.

### Example leto.json5

```js
{   "image": "https://1.gravatar.com/avatar/8c758b186ab9e7358188ef30672ce84e?d=https%3A%2F%2Fidenticons.github.com%2F56ca7c648bd9fadcb06a6722aa86ab1c.png&s=420",                                                 
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
            "type": "move",                     // Move some files
            "plan": "./movingPlan",             // Our moving plan (see https://github.com/ZECTBynmo/mover)
        }, // end move sources


        // ******************************
        // Step 2 - Search and Replace
        // ******************************
        {   "title": "Change names and paths",
            "type": "replace",                  // Search through the folder and find instances of keywords
                                                // (ex: project name)
            "keywords": {       
                "MyProject": "projectName",     // The (case sensitive) strings we're searching for, and
            },                                  // the title of the value it represents
                
            "extensions": [                     // We'll only open files with these extensions (we search
                ".js",                          // through all files if this is omitted)
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
        }, // end search and replace

    ] // end setup procedure 
}
```