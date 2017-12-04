/**
 * Size system for grunt-respimg
 * Licensed under the MIT license.
 *
 * This module handles size definitions for image resizing. It was written for grunt-respimg, but is not limited to it.
 * Sizes are defined using sizeObjects (see below). The two functions toIMString and toPixelSize will take a sizeObject
 * and translate it either to a geometry string that can be passed to ImageMagick or an absolute pixel dimension,
 * respectively.
 *
 *
 *
 * The following methods of defining dimensions are supported:
 *
 * 	- Absolute pixel dimension:
 * 		The dimension is defined in absolute pixels and must be >= 0. No decimals are accepted.
 *
 * 		absolute pixel dimensions can be defined by:
 * 			- A natural number >= 0 optionally followed by 'px'
 *
 * - Relative dimension
 * 		The dimension is defined relative to the image's actualy dimension, such that
 * 		effective dimension = value * actualDimension.
 * 		A value >= 0 is expected, decimals are accepted. A value < 1 will downscale the dimension, a value > 1 will
 * 		upscale it.
 *
 * 		Relative dimensions can be defined by:
 * 			- A decimal number >=0 follwed by 'x'
 * 			- A decimal number >= 0 follwed by '%' or 'pc' (will be divided by 100)
 *
 *
 *
 * A valid sizeObject is one of the following:
 *
 * - A valid dimension definition, defining the desired width. The default sizing function will be used.
 *
 * - A string of the form "wXh", where w and h are valid dimension definitions of the desired width and height,
 *   respectively. The default sizing function will be used. (Note the uppercase X, not to be confused with the
 *   lowercase x of a relative dimension definition).
 *
 * - An object, having the following properties:
 * 		- height:      A valid dimension definition, defining the desired height.
 * 		- width:       A valid dimension definition, defining the desired width.
 * 		- function:    A scaling function, defining how to scale the image to match the specified dimension. This can
 *   					either be a user defined function (see below) one of the following string:
 *   						- 'contain': Scale the image proportionally to the maximum size, such that the
 *   						  dimension box is not exceeded.
 *   						- 'cover': Scale the image proportionally to the minimum size, such that the dimension box
 *   						  is fully covered.
 *   						- 'exact': Scale the image to the exact size defined by the dimension. Requires both width
 *   						  and height to be set.
 *   						- 'check': Will only check whether the the sizeObject is valid.
 *
 *           			Scaling functions can be chained: ["factor", "contain"] will first execute factor and contain
 *           			afterwards.
 *           			Contain and cover will have the same effect if only one of height or width is specified.
 *
 *
 *
 * The default sizing function is 'contain'.
 *
 * Writing your own sizing function.
 * 	A sizing function will take an enhandced sizeObject as only argument and must return a valid sizeObject. Note that
 * 	to allow custom dimension definitions, the sizeObject will be enhanced but not be checked for validity before being
 * 	passed to the sizing function. You can, however, chain the "check" sizing function before your custom function.
 *
 * 	The enhanced size object passed to the function differs from a "normal" sizeObject, such that dimensions will
 * 	already be splitted into unit and value, like this:
 * 		width: {
 * 			unit: 'x', // the unit
 * 			value: 0.5 // the value
 * 		}
 * 	Absolute dimension definitions will always be converted to the "px" unit, relative ones will always be converted
 * 	to the "x" unit. If the definition is neither, 'unit' and 'value' will be set to null and you'll have to parse
 * 	sizeObject.original yourself.
 *
 * 	IMPORTANT: As most sizing functions will alter the value and/or the unit property, make sure to be the first one
 * 	to do so, if you are parsing sizeObject.original. You'll otherwise override the results of the other functions.
 *
 * 	The custom sizing function should alter the sizeObject as desired and then return it. It may as well alter the
 * 	function property, to execute other sizing functions after itself. The sizing function itself will already be
 * 	removed from the function array. You do not need to return an enhanced size object, any valid sizeObject as defined
 * 	above is okay.
 *
 * 	Examples:
 * 		- Overrides any definitions and forces a exact sizing to 100pxX100px:
 *   		function override(sizeObject) {
 *   			return {
 *   				width: 100,
 *   				height: 100,
 *   				function: 'exact'
 *   			}
 *   		};
 *
 * 		- Halves any dimension definition:
 * 			function halve(sizeObject) {
 * 				sizeObject.width.value /= 2;
 * 				sizeObject.height.value /= 2;
 * 				return sizeObject;
 * 			};
 *
 *
 *
 * @author Joshua Gleitze <git@joshuagleitze.de>
 * @version 1.0
 */

'use strict';

module.exports = function(log) {

	/**
	 * Name of the default size function to fall back to.
	 * @type {string}
	 */
	var defaultFunction = 'contain';
	/**
	 * Regular expressions for recognizing and parsing all dimension definition types.
	 * @type {Object}
	 */
	var dimensionRegex = {
		relativePercent: /^([0-9]*\.?[0-9]+)(%|pc)$/,
		relativeFactor: /^([0-9]*\.?[0-9]+)(x)$/,
		pixel: /^([0-9]+)(px)?$/
	};

	var check = function(sizeObject) {
		if (notSpecified(sizeObject.width) && notSpecified(sizeObject.height)) {
			log.error("Invalid sizeObject: Please specify at least width or height\n For sizeObject: " +
				JSON.stringify(sizeObject.original));
		}
		if (getDimensionType(sizeObject.width) === 'invalid') {
			log.error('Invalid width \'' + toSizeObject(sizeObject.original)
				.width + '\' specified');
		}
		if (getDimensionType(sizeObject.height) === 'invalid') {
			log.warn('Invalid height \'' + toSizeObject(sizeObject.original)
				.width + '\' specified');
		}
	};

	/**
	 * The default size functions for translating into absolute pixel dimensions. All functions expect the property
	 * realDimension, containing the image's actual width and height in pixels, and will add a property
	 * effectiveDimension to the sizeObject, containing the calculated width and height in pixels.
	 *
	 * @type {Object}
	 */
	var calcFunctions = {
		contain: function(sizeObject, realDim) {
			check(sizeObject);
			proportionallyForUnspecified(sizeObject, realDim);
			var min = Math.min(relDim(sizeObject.height, realDim.height), relDim(sizeObject.width, realDim.width));
			sizeObject.height = min + "x";
			sizeObject.width = min + "x";
			return sizeObject;
		},
		cover: function(sizeObject, realDim) {
			check(sizeObject);
			proportionallyForUnspecified(sizeObject, realDim);
			var max = Math.max(relDim(sizeObject.height, realDim.height), relDim(sizeObject.width, realDim.width));
			sizeObject.width = max + 'x';
			sizeObject.height = max + 'x';
			return sizeObject;
		},
		exact: function(sizeObject, realDim) {
			check(sizeObject);
			if (notSpecified(sizeObject.width) || notSpecified(sizeObject.height)) {
				log.error(
					"When using exact sizing, both size and width have to be specified!\n For sizeObject:" +
					JSON.stringify(sizeObject.original));
			}
			return sizeObject;
		},
		check: function(sizeObject, realDim) {

		},
		hello: 'world'
	};

	var proportionallyForUnspecified = function(sizeObject, realDim) {
		if (notSpecified(sizeObject.width)) {
			sizeObject.width = relDim(sizeObject.height, realDim.height) * realDim.width;
			sizeObject.width = normalizeDimension(sizeObject.width);
		}
		if (notSpecified(sizeObject.height)) {
			sizeObject.height = relDim(sizeObject.width, realDim.width) * realDim.height;
			sizeObject.height = normalizeDimension(sizeObject.height);
		}
		return sizeObject;
	};

	/**
	 * Recognizes the type of a dimension definition.
	 *
	 * @method getDimensionType
	 * @param  {number|string|null}         dim
	 *         A dimension defintion
	 * @return {string}
	 *         One of the types defined in dimensionRegex or:
	 *         		'invalid'      –   If the definition is invalid.
	 *         		'unspecified'  –   If the dimension was not specifed.
	 */
	var getDimensionType = function(dim) {
		if (!dim) {
			return 'unspecified';
		} else if (typeof dim === 'object') {
			if (dim.value === null) {
				return 'unspecified';
			} else if (dim.unit === 'x') {
				return 'relativeFactor';
			} else if (dim.unit === 'px') {
				return 'pixel';
			}
		} else {
			for (var type in dimensionRegex) {
				if (dimensionRegex.hasOwnProperty(type)) {
					if (dimensionRegex[type].test(dim)) {
						return type;
					}
				}
			}
		}
		return 'invalid';
	};

	var notSpecified = function(dim) {
		return getDimensionType(dim) === 'unspecified';
	};

	var absDim = function(dim, realDim) {
		switch (dim.unit) {
			case "x":
				return dim.value * realDim;
			case "px":
				return dim.value;
			default:
				return realDim;
		}
	};

	var relDim = function(dim, realDim) {
		switch (dim.unit) {
			case "x":
				return dim.value;
			case "px":
				return dim.value / realDim;
			default:
				return realDim;
		}
	};

	var functionNames = function(functions) {
		var result = '';
		for (var func in functions) {
			if (functions.hasOwnProperty(func)) {
				result += (result.length > 0) ? ', ' : '';
				result += "'" + func + "'";
			}
		}
		return result;
	};

	var toSizeObject = function(sizeObject) {
		var normalized;
		if (typeof sizeObject !== 'object') {
			normalized = {};
			if (typeof sizeObject === 'number') {
				normalized.width = sizeObject;
			} else if (typeof sizeObject === 'string') {
				if (sizeObject.indexOf('X') > -1) {
					var dim = sizeObject.split('X', 1);
					normalized.width = dim[0];
					normalized.height = dim[1];
				} else {
					normalized.width = sizeObject;
				}
			}
		} else {
			normalized = sizeObject;
		}
		if (!normalized.original) {
			normalized.original = clone(sizeObject);
		}
		return normalized;
	};

	var normalizeDimension = function(dim) {
		var type = getDimensionType(dim);
		var dimension;
		if (typeof dim === 'object') {
			if (type !== 'invalid') {
				return dim;
			} else {
				dimension = dim;
				dimension.value = null;
				dimension.unit = null;
			}
		} else {
			dimension = {};
			var regex = dimensionRegex[type] || /^.*$/;
			var regexResult = regex.exec(dim);
			switch (type) {
				case 'pixel':
					dimension.value = parseInt(regexResult[1]);
					dimension.unit = 'px';
					break;
				case 'relativeFactor':
					dimension.value = parseFloat(regexResult[1]);
					dimension.unit = 'x';
					break;
				case 'relativePercent':
					dimension.value = parseFloat(regexResult[1]) / 100;
					dimension.unit = 'x';
					break;
				default:
					dimension.value = null;
					dimension.unit = null;
			}
		}
		return dimension;
	};

	var normalizeSizeObject = function(sizeObject, functions) {
		var normalized = toSizeObject(sizeObject);
		if (!normalized.function) {
			normalized.function = defaultFunction;
		}
		if (!(normalized.function instanceof Array)) {
			if (normalized.function) {
				normalized.function = [normalized.function];
			} else {
				normalized.function = [];
			}
		}
		for (var i = 0; i < normalized.function.length; i++) {
			var func = normalized.function[i];
			if (typeof func !== 'function') {
				if (typeof func === 'string') {
					if (!functions[func]) {
						log.warn("Unknown size function '" + func + "', using '" + defaultFunction +
							"' instead.\n" + "(expected one of " + functionNames(functions) + ")");
						func = defaultFunction;
					}
					func = functions[func];
				} else {
					log.warn("Invalid object of type " + (typeof func) + " provided as size function, using '" +
						defaultFunction + "' instead.\n" + "(expected a function or one of " +
						functionNames(functions) + ")");
					func = functions[defaultFunction];
				}
				normalized.function[i] = func;
			}
		}
		normalized.width = normalizeDimension(normalized.width);
		normalized.height = normalizeDimension(normalized.height);
		return normalized;
	};

	var calculateSizeObject = function(sizeObject, functions, realSize) {
		sizeObject = normalizeSizeObject(sizeObject, functions);
		if (sizeObject.function.length === 0) {
			return sizeObject;
		}
		var func = sizeObject.function.shift();
		var newSizeObject = func(sizeObject, realSize) || sizeObject;
		return calculateSizeObject(newSizeObject, functions, realSize);
	};

	var clone = function(object) {
		if (object == null || typeof object !== 'object') {
			return object;
		}
		var result;
		if (object instanceof Array) {
			result = [];
			for (var i = 0; i < object.length; i++) {
				result[i] = clone(object[i]);
			}
		} else if (object instanceof Object) {
			result = {};
			for (var prop in object) {
				if (object.hasOwnProperty(prop)) {
					result[prop] = clone(object[prop]);
				}
			}
		}
		return result;
	};

	return {
		toPixel: function(sizeObject, realWidthOrDimension, realHeight) {
			var realDimension;
			if (typeof realWidthOrDimension === 'object') {
				realDimension = realWidthOrDimension;
			} else {
				realDimension = {
					width: realWidthOrDimension,
					height: realHeight
				};
			}
			// calculate all sizing
			var resDim = calculateSizeObject(clone(sizeObject), calcFunctions, realDimension);
			// convert any relative definitions to pixels.
			var absWidth = absDim(resDim.width, realDimension.width);
			var absHeight = absDim(resDim.height, realDimension.height);
			return {
				width: Math.round(absWidth),
				height: Math.round(absHeight)
			};
		},
		elaborate: function(sizeObject) {
			return toSizeObject(clone(sizeObject));
		}
	};
};