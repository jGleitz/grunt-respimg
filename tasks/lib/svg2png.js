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
var	file = phantom.args[0],
	dest = phantom.args[1],
	width = phantom.args[2],
	height = phantom.args[3],

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

		// set the viewport to the size of the image
		page.viewportSize = {
			width: width,
			height: height
		};

		// open a page containing the image we just created
		html = 'data:text/html,<!DOCTYPE html><title>svg!</title><body style="padding:0;margin:0"></body>';
		page.open(html, function (status) {

			var inject = page.evaluate(function (svgdata) {
				document.body.innerHTML = svgdata;
				document.querySelector('svg').setAttribute('style', 'width:100%;height:100%');
				return true;
			}, svgdata);

			// render the page to a PNG
			page.render(dest);

			overallStatus.update(status === 'success' ? 0 : 2);
			// done!
			quit();
			return;
		});
	};

process();
