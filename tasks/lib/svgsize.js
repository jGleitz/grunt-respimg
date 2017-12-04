/**
 * grunt-respimg
 * https://github.com/nwtn/grunt-respimg
 *
 * Copyright (c) 2015 David Newton
 * Licensed under the MIT license.
 *
 * Automatically resizes image assets
 *
 * Portions borrowed liberally from:
 *		<https://github.com/andismith/grunt-responsive-images>, and
 *		<https://github.com/dbushell/grunt-svg2png>, and
 *		<https://github.com/JamieMason/grunt-imageoptim>, and
 *		<https://github.com/sindresorhus/grunt-svgmin>
 *
 * @author David Newton (http://twitter.com/newtron)
 * @version 1.1.0
 */

/* global phantom, window, document, injectJs, overallStatus, messages, quit, fs */

phantom.injectJs('phantomcomm.js');
var file = phantom.args[0],
	page,
	svgdata,
	html,
	svg,

	process = function () {
		// open a new web page
		page = require('webpage').create();

		// read the SVG data from the SVG file
		svgdata = fs.read(file) || '';

		// load the SVG into a div so we can measure it’s native width and height
		var frag = window.document.createElement('div');
		frag.innerHTML = svgdata;
		svg = frag.querySelector('svg');
		var svgWidth = svg.getAttribute('width') || '1';
		svgWidth = parseFloat(svgWidth.replace('px', ''));
		var svgHeight = svg.getAttribute('height') || '1';
		svgHeight = parseFloat(svgHeight.replace('px', ''));

		var dim = {
            width: svgWidth,
            height: svgHeight
        };
        quit(dim);
	};

process();
