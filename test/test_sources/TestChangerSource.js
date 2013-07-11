// Declare a class with one name, so that we can replace it later with another
function ChangerThing() {
	
}

ChangerThing.prototype.changeTest = function() {
	var test = 0;

	test -= 15;

	return test;
}

ChangerThing.prototype.insertTest = function() {
	var test = 0;

	return test;
}

ChangerThing.prototype.bestRuleName = function() {
	var test = 0;




	return test;
}

exports.ChangerThing = ChangerThing;