// Declare a class with one name, so that we can replace it later with another
function SomeRandomName() {
	
}

SomeRandomName.prototype.test = function() {
	return "poop";
}

exports.SomeRandomName = SomeRandomName;