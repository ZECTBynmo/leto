exports.change = function( lineNum, line, newText ) {
	return line = newText;
}

exports.insert = function( lineNum, line, newText ) {
	return line = newText + "\n" + line;
}

exports.~~templateFunctionName~~ = function( lineNum, line ) {
	return "test += 4;";
}