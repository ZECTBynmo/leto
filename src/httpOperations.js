var http = require("http");
var https = require("https");

//////////////////////////////////////////////////////////////////////////
/* OBJECT STRUCTURES
//////////////////////////////////////////////////////////////////////////

    var options = {
        host: 'somesite.com',
        port: 443,
        path: '/some/path',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

//////////////////////////////////////////////////////////////////////////
*/

//////////////////////////////////////////////////////////////////////////
// HTTP request returning JSON object(s)
exports.getJSON = function( options, callback ) {
    console.log( "rest::getJSON" );

    var prot = options.port == 443 ? https : http;
    var req = prot.request( options, function(res) {
        var output = '';
        
        console.log( options.host + ':' + res.statusCode );
        res.setEncoding( 'utf8' );

        res.on( 'data', function (chunk) {
            console.log( chunk );
            output += chunk;
        });

        res.on( 'end', function() {
            var obj = JSON.parse( output );
            callback( res.statusCode, obj );
        });
    });

    req.on('error', function(err) {
        //res.send('error: ' + err.message);
    });

    req.end();
};