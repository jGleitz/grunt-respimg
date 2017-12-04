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

/* global phantom */

var fs = require('fs'),
	overallStatus = (function () {
		var value = 0;
		return {
			update: function (status) {
				value = Math.max(value, status);
			},
			toString: function () {
				switch (value) {
				case 0:
					return 'success';
				case 1:
					return 'warn';
				case 2:
					return 'error';
				}
			},
			toExitStatus: function () {
				return value > 0 ? 1 : 0;
			}
		};
	})(),
	messages = (function () {
		var messages = '';
		return {
			append: function (text) {
				messages += text + "\n";
			},
			getAll: function () {
				return messages;
			}
		};
	})(),
	quit = function (data) {
		console.log(JSON.stringify({
			"status": overallStatus.toString(),
			"message": messages.getAll(),
			"data": data
		}));
		phantom.exit(overallStatus.toExitStatus());
	};
