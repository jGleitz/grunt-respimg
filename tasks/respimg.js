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

'use strict';

module.exports = function(grunt) {

	/* beautify preserve:start */
	var async =				require('async'),
		childProcess =		require('child_process'),
		fs =				require('fs-extra'),
		im =				require('node-imagemagick'),
		path =				require('path'),
		phantomjs =			require('phantomjs'),
		q =					require('q'),
		SVGO =				require('svgo'),
		size = 				require('./lib/size.js')({
								warn: grunt.log.error,
								error: grunt.fail.warn
							}),

		cpSpawn =			childProcess.spawn,
		binPaths =			{
			image_optim:		[
									'/usr/local/sbin/image_optim',
									'/usr/local/bin/image_optim',
									'/usr/sbin/image_optim',
									'/usr/bin/image_optim',
									'/sbin/image_optim',
									'/bin/image_optim'
								].map(function(dir) {
									return path.resolve(__dirname, dir);
								}),
			picopt:				[
									'/usr/local/sbin/picopt',
									'/usr/local/bin/picopt',
									'/usr/sbin/picopt',
									'/usr/bin/picopt',
									'/sbin/picopt',
									'/bin/picopt'
								].map(function(dir) {
									return path.resolve(__dirname, dir);
								}),
			imageOptim:			[
									'../node_modules/imageoptim-cli/bin',
									'../../imageoptim-cli/bin'
								].map(function(dir) {
									return path.resolve(__dirname, dir);
								})
		},

		DEFAULT_OPTIONS = {
			// options: Activate, Associate, Background, Copy, Deactivate, Disassociate, Extract, Off, On, Opaque, Remove, Set, Shape, Transparent
			alpha :						null,

			// options: an ImageMagick-compatible color (see http://www.imagemagick.org/script/color.php)
			background :				null,

			// options: CMY, CMYK, Gray, HCL, HCLp, HSB, HSI, HSL, HSV, HWB, Lab, LCHab, LCHuv, LMS, Log, Luv, OHTA, Rec601YCbCr, Rec709YCbCr, RGB, scRGB, sRGB, Transparent, xyY, XYZ, YCbCr, YCC, YDbDr, YIQ, YPbPr, YUV
			colorspace :				'sRGB',

			// options: FloydSteinberg, None, plus, Riemersma
			dither :					'None',

			// options: Bartlett, Bessel, Blackman, Bohman, Box, Catrom, Cosine, Cubic, Gaussian, Hamming, Hann, Hanning, Hermite, Jinc, Kaiser, Lagrange, Lanczos, Lanczos2, Lanczos2Sharp, LanczosRadius, LanczosSharp, Mitchell, Parzen, Point, Quadratic, Robidoux, RobidouxSharp, Sinc, SincFast, Spline, Triangle, Welch, Welsh
			filter :					'Triangle',

			// options: (float)
			filterSupport :				2,

			// options: GIF, JPEG, line, none, partition, plane, PNG
			interlace :					'none',

			// options: off, on
			jpegFancyUpsampling :		'off',

			// options for each: true, false
			optimize :		{
				svg:					false,	// deprecated
				rasterInput:			false,	// deprecated
				rasterOutput:			false,	// deprecated

				input: {
					svgo:				0,
					image_optim:		0,
					imageOptim:			0,
					picopt:				0
				},

				output: {
					svgo:				3,
					image_optim:		1,
					imageOptim:			1,
					picopt:				1
				}
			},

			// options: (int) 0–9
			pngCompressionFilter :		5,

			// options: (int) 0–9
			pngCompressionLevel :		9,

			// options: (int) 0–9
			pngCompressionStrategy :	1,

			// options: “all”, “date”, “none”, or the name(s) of chunk(s) to be excluded (see http://www.imagemagick.org/script/command-line-options.php#define)
			pngExcludeChunk :			'all',

			// options: true, false
			// note that “false” is equivalent to “null”; actually passing “false” behaves the same as passing “true”
			pngPreserveColormap :		null,

			// options: (int)
			posterize :					136,

			// options: (int) 0–100
			quality :					82,

			// options: adaptive, distort, geometry, interpolative, liquid, resize, sample, scale, thumbnail
			resizeFunction :			'thumbnail',

			// options: true, false
			// note that “false” is equivalent to “null”
			// no-optim default: true
			strip :						null,

			// see https://github.com/sindresorhus/grunt-svgmin/blob/master/readme.md and https://github.com/svg/svgo/tree/master/plugins
			svgoPlugins :	[
				{
					removeUnknownsAndDefaults :	false
				}
			],

			// options: each one is a (float)
			// no-optim default: 0.25x0.25+8+0.065
			unsharp : {
				radius :				0.25,
				sigma :					0.08,
				gain :					8.3,
				threshold :				0.045
			},

			// options: true, false
			widthAsDir :				false,

			// Deprecated Use sizes instead. options: (int)s
			widths : [
										320,
										640,
										1280
			],

			// Defaults to the widths option.
			sizes: 						[],

			name: 						"{%= file.name %}-w{%= size.width %}",
		},
		/* beautify preserve:end */


		/**
		 * Gets the destination path
		 *
		 * @private
		 * @param   {Object}          file   The processed file's file object
		 * @param   {Object}          sizeObject   The momentary processed sizeObject
		 * @param   {Object}          options   Options
		 * @return                    The complete path and filename
		 */
		getDestination = function(file, sizeObject, options) {
			var src = file.src[0];
			var ext = path.extname(src);
			var destExt = '.png'; // For the moment, png output is hardcoded.
			var destDir = path.dirname(file.dest);
			var nameOptions = {
				options: options,
				file: extend({}, file, {
					extension: ext,
					name: path.basename(src, ext),
					dirname: path.dirname(src)
				}),
				size: sizeObject
			};
			grunt.template.addDelimiters('respimg', '{%', '%}');
			var name = file.name || sizeObject.name || options.name;
			var dest = grunt.template.process(name, {
				delimiters: 'respimg',
				data: nameOptions
			});
			return path.join(destDir, dest + destExt);
		},

		/**
		 * Gets the destination path for the copies of source files (e.g. SVG, PDF)
		 * @method getSourceCopyDestination
		 * @private
		 * @param  {Object}                  file    The processed file's file object
		 * @param  {Object}                  options The options
		 * @return {String}                          Path to place a copy of the source file at
		 */
		getSourceCopyDestination = function(file, options) {
			var src = file.src[0];
			var dest = file.dest;
			return path.join(dest);
		},


		/**
		 * Ensure the image optimization binaries are accessible
		 * @return {String}
		 */
		getPathToBin = function(bin) {
			return binPaths[bin].filter(function(binPath) {
				return grunt.file.exists(binPath);
			})[0];
		},


		/**
		 * Determine if the file is an animated GIF
		 *
		 * @private
		 * @param   {Object}          data      The image data
		 * @param   {string}          srcPath   The source path
		 */
		isAnimatedGif = function(data, srcPath) {
			// GIF87 cannot be animated.
			// data.delay and scene can identify an animation GIF
			if (data.format.toUpperCase() === 'GIF' && data.delay && data.scene) {
				grunt.verbose.warn(srcPath + ' is animated - skipping');
				return true;
			}
		},


		/**
		 * @param  {String[]}  files             Array of paths to files
		 * @param  {String}    binPath           Path to image_optim binary
		 * @return {Promise}
		 */
		optimizeImage_optim = function(files, binPath) {
			var image_optim,
				deferred = q.defer(),
				errorMessage = 'image_optim exited with a failure status',
				ymlPath = path.resolve(__dirname, 'lib/i_o.yml'),
				exts = ['.gif', '.jpeg', '.jpg', '.png', '.svg'];

			for (var i = 0; i < files.length; i++) {
				if (exts.indexOf(path.extname(files[i]).toLowerCase()) === -1) {
					files.splice(i, 1);
					i--;
				}
			}
			grunt.verbose.ok("Optimizing: " + JSON.stringify(files));

			image_optim = cpSpawn(binPath, ['--config-paths', ymlPath].concat(files), {});

			image_optim.stdout.on('data', function(message) {
				grunt.verbose.ok(String(message.toString('utf8') || '').replace(/\n+$/, ''));
			});

			image_optim.stderr.on('data', function(data) {
				grunt.verbose.ok(data.toString('utf8'));
			});

			image_optim.on('exit', function(code, signal) {
				if (code === 0) {
					deferred.resolve(true);
				} else {
					deferred.reject(new Error(errorMessage));
				}
			});

			image_optim.stdin.setEncoding('utf8');

			return deferred.promise;
		},


		/**
		 * @param  {String[]}  files             Array of paths to files
		 * @param  {String}    binPath           Path to imageOptim binary
		 * @return {Promise}
		 */
		optimizeImageOptim = function(files, binPath) {
			var imageOptimCli,
				deferred = q.defer(),
				errorMessage = 'ImageOptim-CLI exited with a failure status';

			imageOptimCli = cpSpawn('./imageOptim', ['--quit'], {
				cwd: binPath
			});

			imageOptimCli.stdout.on('data', function(message) {
				grunt.verbose.ok(String(message || '').replace(/\n+$/, ''));
			});

			imageOptimCli.on('exit', function(code) {
				return code === 0 ? deferred.resolve(true) : deferred.reject(new Error(errorMessage));
			});

			imageOptimCli.stdin.setEncoding('utf8');
			imageOptimCli.stdin.end(files.join('\n') + '\n');

			return deferred.promise;
		},


		/**
		 * @param  {String[]}  files             Array of paths to files
		 * @param  {String}    binPath           Path to picopt binary
		 * @return {Promise}
		 */
		optimizePicopt = function(files, binPath) {
			var picopt,
				deferred = q.defer(),
				errorMessage = 'picopt exited with a failure status';

			picopt = cpSpawn(binPath, files, {});

			picopt.stdout.on('data', function(message) {
				grunt.verbose.ok(String(message || '')
					.replace(/\n+$/, ''));
			});

			picopt.stderr.on('data', function(data) {
				grunt.verbose.ok(data.toString('utf8'));
			});

			picopt.on('exit', function(code, signal) {
				return code === 0 ? deferred.resolve(true) : deferred.reject(new Error(errorMessage));
			});

			picopt.stdin.setEncoding('utf8');

			return deferred.promise;
		},


		/**
		 * @param  {String[]}  files             Array of paths to files
		 * @param  {Object}    options           Options
		 * @return {Promise}
		 */
		optimizeSVGO = function(file, options) {
			// setup the promise and SVGO
			var deferred = q.defer(),
				svgo = new SVGO({
					plugins: options.svgoPlugins
				});

			// bail if it’s not an SVG
			var extName = path.extname(file.dest).toLowerCase();
			if (extName !== '.svg') {
				deferred.resolve(false);
				return deferred.promise;
			}

			// get the path and load the SVG
			var srcPath = file.src[0],
				srcSvg = grunt.file.read(srcPath);

			// optimize the SVG
			svgo.optimize(srcSvg, function(result) {
				if (result.error) {

					// if there’s an error, fail
					deferred.reject('Error parsing SVG:', result.error);

				} else {

					// calculate the savings
					var saved = srcSvg.length - result.data.length,
						percentage = saved / srcSvg.length * 100;

					// write the file and resolve the promise
					grunt.file.write(file.dest, result.data);
					deferred.resolve(srcPath + ' (saved ' + saved + ' bytes — ' + Math.round(percentage) + '%)');
				}
			});

			return deferred.promise;
		},

		/**
		 * Resize the image
		 *
		 * @private
		 * @param   {string}          srcPath   The source path
		 * @param   {string}          dstPath   The destination path
		 * @param   {Object}          options   Options
		 * @param   {int}             width     Width
		 */
		resizeImage = function(srcPath, dstPath, options, dimension, prepData) {
			var deferred = q.defer();

			// determine the image type by looking at the file extension
			// TODO: do this better, maybe with something like <https://github.com/mscdex/mmmagic>
			var extName = path.extname(srcPath).toLowerCase();

			// if it’s an SVG, generate a PNG using PhantomJS
			if (extName === '.svg') {
				deferred = resizeSVG(deferred, srcPath, dstPath, dimension, prepData);

				// if it’s a PDF, generate a PNG using ImageMagick
			} else if (extName === '.pdf') {
				deferred = resizePDF(deferred, srcPath, dstPath, options, dimension, prepData);

				// all other images get loaded into ImageMagick
			} else {
				deferred = resizeRaster(deferred, srcPath, dstPath, extName, options, dimension, prepData);
			}

			return deferred.promise;
		},

		prepareImage = function(srcPath) {
			var deferred = q.defer();

			// determine the image type by looking at the file extension
			// TODO: do this better, maybe with something like <https://github.com/mscdex/mmmagic>
			var extName = path.extname(srcPath)
				.toLowerCase();

			// if it’s an SVG, get the size using PhantomJS
			if (extName === '.svg') {
				deferred = prepareSVG(deferred, srcPath);

				// if it’s a PDF, generate a PNG using ImageMagick
			} else if (extName === '.pdf') {
				deferred = preparePDF(deferred, srcPath);

				// all other images get identified by ImageMagick
			} else {
				deferred = prepareRaster(deferred, srcPath);
			}

			return deferred.promise;
		},

		prepareSVG = function(deferred, srcPath) {
			var SVGdim;
			var getDimensionData = function(buffer) {
				try {
					SVGdim = handlePhantomResponse(buffer);
				} catch (error) {
					grunt.warn("Unable to determine the dimension of " + srcPath + ":\n" + error.message);
					return deferred.reject(error);
				}
			};

			// spawn a phantomjs instance to get the SVG's dimension.
			var spawnDimension = grunt.util.spawn({
					cmd: phantomjs.path,
					args: [
						path.resolve(__dirname, 'lib/svgsize.js'),
						srcPath
					]
				},
				function doneFunction(error, result, code) {
					if (error) {
						return deferred.reject(error);
					}
					return deferred.resolve(SVGdim);
				});

			// capture phantomjs' results
			spawnDimension.stdout.on('data', getDimensionData);
			return deferred;
		},

		preparePDF = function(deferred, srcPath) {
			// get properties about the image
			im.identify(srcPath, function(error, data) {

				if (error) {
					grunt.fail.warn("Unable to identify " + srcPath + ":\n" + error);
					return deferred.reject(error);
				}

				return deferred.resolve(data);
			});

			return deferred;

		},

		prepareRaster = function(deferred, srcPath) {
			var extName = path.extname(srcPath)
				.toLowerCase();
			im.identify(srcPath, function(error, data) {
				// bail if there’s an error
				if (error) {
					grunt.fail.warn("Unable to identify " + srcPath + ":\n" + error);
					return deferred.reject(error);
				}

				// bail if it’s an animated GIF
				if (extName === '.gif') {
					if (isAnimatedGif(data, srcPath)) {
						return deferred.resolve(false);
					}
				}

				return deferred.resolve(data);
			});
			return deferred;
		},

		/**
		 * Resize a PDF
		 *
		 * @private
		 * @param   {Object}          deferred  The deferred promise
		 * @param   {string}          srcPath   The source path
		 * @param   {string}          dstPath   The destination path
		 * @param   {Object}          options   Options
		 * @param   {int}             width     Width
		 */
		resizePDF = function(deferred, srcPath, dstPath, options, dimension, prepData) {

			// figure out 2x density
			var pdfWidth = prepData.width,
				pdfHeight = prepData.height,
				pdfResolutionStrings = ('' + prepData.resolution).split('x'),
				pdfResolutionX = parseInt(pdfResolutionStrings[0], 10),
				pdfResolutionY = parseInt(pdfResolutionStrings[1], 10),
				density = Math.max(dimension.width / pdfWidth * pdfResolutionX * 2,
					dimension.height / pdfHeight * pdfResolutionY * 2);

			// render
			var args = [
				'-density',
				density,
				srcPath + '[0]',
				dstPath
			];

			im.convert(args, function(err, stdout, stderr) {
				// bail if there’s an error
				if (err) {
					grunt.fail.warn(err);
					return deferred.reject(err);
				}

				// resize to final width using standard IM stuff
				return resizeRaster(deferred, dstPath, dstPath, '.png', options, dimension, prepData);
			});


			return deferred;

		},


		/**
		 * Resize a raster image
		 *
		 * @private
		 * @param   {Object}          deferred  The deferred promise
		 * @param   {string}          srcPath   The source path
		 * @param   {string}          dstPath   The destination path
		 * @param   {string}          extName   File extension
		 * @param   {Object}          options   Options
		 * @param   {int}             width     Width
		 */
		resizeRaster = function(deferred, srcPath, dstPath, extName, options, dimension) {
			var args = [srcPath];

			// set the resize filter
			if (options.filter !== null) {
				args.push('-filter');
				args.push(options.filter);
			}

			// set the filter support
			if (options.filterSupport !== null) {
				args.push('-define');
				args.push('filter:support=' + options.filterSupport);
			}

			// set the resize function
			if (options.resizeFunction !== null) {
				args.push('-' + options.resizeFunction);
				if (options.resizeFunction === 'Distort') {
					args.push('Resize');
				}
			}

			var sizeString = dimension.width + "x" + dimension.height + "!";
			// set the geometry
			args.push(sizeString);

			// set the unsharp mask
			if (options.unsharp.radius !== null &&
				options.unsharp.sigma !== null &&
				options.unsharp.gain !== null &&
				options.unsharp.threshold !== null) {
				args.push('-unsharp');
				args.push(options.unsharp.radius + 'x' + options.unsharp.sigma + '+' + options.unsharp.gain + '+' + options.unsharp
					.threshold);
			} else if (options.unsharp.radius !== null &&
				options.unsharp.sigma !== null &&
				options.unsharp.gain !== null) {
				args.push('-unsharp');
				args.push(options.unsharp.radius + 'x' + options.unsharp.sigma + '+' + options.unsharp.gain);
			} else if (options.unsharp.radius !== null &&
				options.unsharp.sigma !== null) {
				args.push('-unsharp');
				args.push(options.unsharp.radius + 'x' + options.unsharp.sigma);
			} else if (options.unsharp.radius !== null) {
				args.push('-unsharp');
				args.push(options.unsharp.radius);
			}

			// set the dither
			if (options.dither !== null) {
				if (options.dither === 'plus') {
					args.push('+dither');
				} else {
					args.push('-dither');
					args.push(options.dither);
				}
			}

			// set posterize
			if (options.posterize !== null) {
				args.push('-posterize');
				args.push(options.posterize);
			}

			// set background
			if (options.background !== null) {
				args.push('-background');
				args.push(options.background);
			}

			// set alpha
			if (options.alpha !== null) {
				args.push('-alpha');
				args.push(options.alpha);
			}

			// set the quality
			if (options.quality !== null) {
				args.push('-quality');
				args.push(options.quality);
			}

			// set pngPreserveColormap
			if (options.pngPreserveColormap === true) {
				args.push('-define');
				args.push('png:preserve-colormap=true');
			}

			// set jpegFancyUpsampling
			if (options.jpegFancyUpsampling !== null) {
				args.push('-define');
				args.push('jpeg:fancy-upsampling=' + options.jpegFancyUpsampling);
			}

			// set pngCompressionFilter
			if (options.pngCompressionFilter !== null) {
				args.push('-define');
				args.push('png:compression-filter=' + options.pngCompressionFilter);
			}

			// set pngCompressionLevel
			if (options.pngCompressionLevel !== null) {
				args.push('-define');
				args.push('png:compression-level=' + options.pngCompressionLevel);
			}

			// set pngCompressionStrategy
			if (options.pngCompressionStrategy !== null) {
				args.push('-define');
				args.push('png:compression-strategy=' + options.pngCompressionStrategy);
			}

			// set pngExcludeChunk
			if (options.pngExcludeChunk !== null) {
				args.push('-define');
				args.push('png:exclude-chunk=' + options.pngExcludeChunk);
			}

			// set interlace
			if (options.interlace !== null) {
				args.push('-interlace');
				args.push(options.interlace);
			}

			// colorspace
			if (options.colorspace !== null) {
				args.push('-colorspace');
				args.push(options.colorspace);
			}

			// set strip
			if (options.strip === true) {
				args.push('-strip');
			}

			// add output filename
			args.push(dstPath);
			// do the resizing
			im.convert(args, function(err, stdout, stderr) {
				// bail if there’s an error
				if (err) {
					grunt.fail.warn(err);
					return deferred.reject(err);
				}

				// output data about the saved image
				return deferred.resolve(true);
			});
			return deferred;
		},

		handlePhantomResponse = function(responseBuffer) {
			var resultString = responseBuffer.toString();
			var result;
			try {
				result = JSON.parse(resultString);
			} catch (error) {
				throw new Error("PhantomJS returned: " + resultString);
			}

			if (result.status && result.status !== 'error') {
				if (result.status === 'warn') {
					grunt.log.error(result.message);
				}
				return result.data;
			} else {
				if (result.message) {
					throw new Error(result.message);
				} else {
					throw new Error("Unknown error!");
				}
			}
		},
		/**
		 * Resize an SVG image
		 *
		 * @private
		 * @param   {Object}          deferred  The deferred promise
		 * @param   {string}          srcPath   The source path
		 * @param   {string}          dstPath   The destination path
		 * @param   {int}             width     Width
		 */
		resizeSVG = function(deferred, srcPath, dstPath, dimension) {

			var resizeResult = function(buffer) {
				try {
					var result = handlePhantomResponse(buffer);
				} catch (error) {
					grunt.warn("Unable to render " + srcPath + ":\n" + error.message);
					return deferred.reject(error);
				}
			};

			// spawn a phantomjs instance to show the SVG and render the output as an image
			var spawnResize = grunt.util.spawn({
					cmd: phantomjs.path,
					args: [
						path.resolve(__dirname, 'lib/svg2png.js'),
						srcPath,
						dstPath,
						dimension.width,
						dimension.height
					]
				},
				function doneFunction(error, result, code) {
					if (error) {
						return deferred.reject(error);
					}
					deferred.resolve(true);
				}
			);

			// once phantomjs is done it will output a status
			// we capture this and use it to verify that the render was successful
			spawnResize.stdout.on('data', resizeResult);

			return deferred;
		},


		validateAlpha = function(alpha) {
			var whitelist = [null, 'Activate', 'Associate', 'Background', 'Copy', 'Deactivate', 'Disassociate', 'Extract',
				'Off', 'On', 'Opaque', 'Remove', 'Set', 'Shape', 'Transparent'
			];
			return validateWhitelist(whitelist, alpha, 'alpha');
		},


		/**
		 * Checks for a valid array, and that there are items in the array.
		 *
		 * @private
		 * @param   {object}          obj       The object to check
		 * @return  {boolean}         Whether it is a valid array with items.
		 */
		validateArray = function(obj) {
			return (Array.isArray(obj) && obj.length > 0);
		},


		validateBackground = function(background) {
			// TODO: this is pretty complex… need to figure out a good way to validate
			return true;
		},


		validateColorspace = function(colorspace) {
			var whitelist = [null, 'CMY', 'CMYK', 'Gray', 'HCL', 'HCLp', 'HSB', 'HSI', 'HSL', 'HSV', 'HWB', 'Lab', 'LCHab', 'LCHuv', 'LMS', 'Log', 'Luv', 'OHTA', 'Rec601YCbCr', 'Rec709YCbCr', 'RGB', 'scRGB', 'sRGB', 'Transparent', 'xyY', 'XYZ', 'YCbCr', 'YCC', 'YDbDr', 'YIQ', 'YPbPr', 'YUV'];
			return validateWhitelist(whitelist, colorspace, 'colorspace');
		},


		validateDither = function(dither) {
			var whitelist = [null, 'FloydSteinberg', 'None', 'plus', 'Riemersma'];
			return validateWhitelist(whitelist, dither, 'dither');
		},


		validateFilter = function(filter) {
			var whitelist = [null, 'Bartlett', 'Bessel', 'Blackman', 'Bohman', 'Box', 'Catrom', 'Cosine', 'Cubic', 'Gaussian', 'Hamming', 'Hann', 'Hanning', 'Hermite', 'Jinc', 'Kaiser', 'Lagrange', 'Lanczos', 'Lanczos2', 'Lanczos2Sharp', 'LanczosRadius', 'LanczosSharp', 'Mitchell', 'Parzen', 'Point', 'Quadratic', 'Robidoux', 'RobidouxSharp', 'Sinc', 'SincFast', 'Spline', 'Triangle', 'Welch', 'Welsh'];
			return validateWhitelist(whitelist, filter, 'filter');
		},


		validateFilterSupport = function(filterSupport) {
			if (filterSupport !== null && !validateFloat(filterSupport)) {
				grunt.fail.fatal('Invalid value for filterSupport: ' + filterSupport);
				return false;
			}
			return true;
		},


		validateFloat = function(float) {
			return (typeof float === 'number' && float >= 0);
		},


		validateInteger = function(int) {
			return (typeof int === 'number' && (int % 1) === 0 && int >= 0);
		},


		validateInterlace = function(interlace) {
			var whitelist = [null, 'GIF', 'JPEG', 'line', 'none', 'partition', 'plane', 'PNG'];
			return validateWhitelist(whitelist, interlace, 'interlace');
		},


		validateJpegFancyUpsampling = function(jpegFancyUpsampling) {
			var whitelist = [null, 'off', 'on'];
			return validateWhitelist(whitelist, jpegFancyUpsampling, 'jpegFancyUpsampling');
		},


		validateOptimize = function(optimize) {
			// setting it to false is equivalent to zeroes e’rywhere
			/* beautify preserve:start */
			if (optimize === false) {
				optimize = {
					input: {
						svgo:				0,
						image_optim:		0,
						picopt:				0,
						imageOptim:			0
					},
					output: {
						svgo:				0,
						image_optim:		0,
						picopt:				0,
						imageOptim:			0
					}
				};
				/* beautify preserve:end */
				return optimize;
			}

			// validate parent and children
			if (optimize === null || typeof(optimize) !== 'object') {
				grunt.fail.fatal('Invalid value for optimize: ' + optimize);
				return false;
			}

			// recreate defaults if a deprecated parent has been passed
			if (optimize.input === null || typeof(optimize.input) !== 'object') {
			/* beautify preserve:start */
				optimize.input = {
					svgo:				0,
					image_optim:		0,
					picopt:				0,
					imageOptim:			0
				};
			}
			if (optimize.output === null || typeof(optimize.output) !== 'object') {
				optimize.output = {
					svgo:				3,
					image_optim:		1,
					picopt:				1,
					imageOptim:			1
				};
				/* beautify preserve:end */
			}

			// validate grandchildren
			if (optimize.input.svgo !== parseInt(optimize.input.svgo, 10) || optimize.input.svgo < 0) {
				grunt.fail.fatal('Invalid value for optimize.input.svgo: ' + optimize.input.svgo);
				return false;
			}
			if (optimize.input.image_optim !== parseInt(optimize.input.image_optim, 10) || optimize.input.image_optim < 0) {
				grunt.fail.fatal('Invalid value for optimize.input.image_optim: ' + optimize.input.image_optim);
				return false;
			}
			if (optimize.input.picopt !== parseInt(optimize.input.picopt, 10) || optimize.input.picopt < 0) {
				grunt.fail.fatal('Invalid value for optimize.input.picopt: ' + optimize.input.picopt);
				return false;
			}
			if (optimize.input.imageOptim !== parseInt(optimize.input.imageOptim, 10) || optimize.input.imageOptim < 0) {
				grunt.fail.fatal('Invalid value for optimize.imageOptim: ' + optimize.imageOptim);
				return false;
			}
			if (optimize.output.svgo !== parseInt(optimize.output.svgo, 10) || optimize.output.svgo < 0) {
				grunt.fail.fatal('Invalid value for optimize.output.svgo: ' + optimize.output.svgo);
				return false;
			}
			if (optimize.output.image_optim !== parseInt(optimize.output.image_optim, 10) || optimize.output.image_optim < 0) {
				grunt.fail.fatal('Invalid value for optimize.output.image_optim: ' + optimize.image_optim);
				return false;
			}
			if (optimize.output.picopt !== parseInt(optimize.output.picopt, 10) || optimize.output.picopt < 0) {
				grunt.fail.fatal('Invalid value for optimize.picopt: ' + optimize.picopt);
				return false;
			}
			if (optimize.output.imageOptim !== parseInt(optimize.output.imageOptim, 10) || optimize.output.imageOptim < 0) {
				grunt.fail.fatal('Invalid value for optimize.imageOptim: ' + optimize.imageOptim);
				return false;
			}

			// convert deprecated settings
			if (optimize.svg === true || optimize.svg === 1) {
				optimize.input.svgo = 1;
				optimize.svg = null;
			}
			if (optimize.rasterInput === true || optimize.rasterInput === 1) {
				optimize.input.imageOptim = 1;
				optimize.rasterInput = null;
			}
			if (optimize.rasterOutput === true || optimize.rasterOutput === 1) {
				optimize.output.imageOptim = 1;
				optimize.rasterOutput = null;
			}

			// return the options object with this new converted monstrosity
			return optimize;
		},


		validatePngCompressionFilter = function(pngCompressionFilter) {
			var whitelist = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
			return validateWhitelist(whitelist, pngCompressionFilter, 'pngCompressionFilter');
		},


		validatePngCompressionLevel = function(pngCompressionLevel) {
			var whitelist = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
			return validateWhitelist(whitelist, pngCompressionLevel, 'pngCompressionLevel');
		},


		validatePngCompressionStrategy = function(pngCompressionStrategy) {
			var whitelist = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
			return validateWhitelist(whitelist, pngCompressionStrategy, 'pngCompressionStrategy');
		},


		validatePngExcludeChunk = function(pngExcludeChunk) {
			var whitelist = ['all', 'bkgd', 'chrm', 'date', 'exif', 'gama', 'gama', 'iccp', 'itxt', 'none', 'offs', 'phys', 'srgb', 'text', 'trns', 'vpag', 'zccp', 'ztxt'],
				exclude,
				valid = true;

			if (pngExcludeChunk) {
				exclude = pngExcludeChunk.split(',');
			}

			if (pngExcludeChunk === null) {
				return true;
			}

			var chunk;
			for (var i in exclude) {
				chunk = exclude[i];
				if (chunk.trim) {
					chunk = chunk.trim();
				}
				valid = valid * validateWhitelist(whitelist, chunk, 'validatePngExcludeChunk');
			}

			return valid;
		},


		validatePngPreserveColormap = function(pngPreserveColormap) {
			var whitelist = [null, true, false];
			return validateWhitelist(whitelist, pngPreserveColormap, 'pngPreserveColormap');
		},


		validatePosterize = function(posterize) {
			if (posterize !== null && !validateInteger(posterize)) {
				grunt.fail.fatal('Invalid value for posterize: ' + posterize);
				return false;
			}
			return true;
		},


		/**
		 * Checks for a valid quality
		 *
		 * @private
		 * @param   {int}             quality     The quality, a value from 0–100
		 * @return  {boolean}         Whether the quality is valid.
		 */
		validateQuality = function(quality) {
			if ((quality !== null && !validateInteger(quality)) || quality > 100) {
				grunt.fail.fatal('Invalid value for quality: ' + quality);
				return false;
			}
			return true;
		},


		validateResizeFunction = function(resizeFunction) {
			var whitelist = [null, 'adaptive', 'distort', 'geometry', 'interpolative', 'liquid', 'resize', 'sample', 'scale', 'thumbnail'];
			return validateWhitelist(whitelist, resizeFunction, 'resizeFunction');
		},


		/**
		 * Check that there is only one source file in compact/files object format.
		 *
		 * @private
		 * @param   {object}          files         The files object
		 */
		validateSource = function(files) {
			// more than 1 source.
			if (files.src.length > 1) {
				return grunt.fail.warn('Unable to resize more than one image in compact or files object format.\n' +
					'For multiple files please use the files array format.\nSee http://gruntjs.com/configuring-tasks');
			}
		},


		validateStrip = function(strip) {
			var whitelist = [null, true, false];
			return validateWhitelist(whitelist, strip, 'strip');
		},

		validateSvgoPlugins = function(svgoPlugins) {
			var whitelist = [true, false];

			if (!validateArray(svgoPlugins)) {
				grunt.fail.fatal('Invalid value for svgoPlugins: ' + svgoPlugins);
				return false;
			}

			var i, j, obj, val;
			for (i in svgoPlugins) {
				obj = svgoPlugins[i];
				if (obj === null || typeof(obj) !== 'object') {
					grunt.fail.fatal('Invalid value for svgoPlugins[' + i + ']: ' + obj);
					return false;
				}

				for (j in obj) {
					val = obj[j];
					if (!validateWhitelist(whitelist, val, 'svgoPlugins[' + i + '].' + j)) {
						return false;
					}
				}
			}

			return true;
		},


		/**
		 * Check the target has been set up properly in Grunt.
		 * Graceful handling of https://github.com/andismith/grunt-responsive-images/issues/2
		 *
		 * @private
		 * @param   {object}          files         The files object
		 */
		validateTarget = function(files) {
			var test;
			try {
				test = files.src;
			} catch (exception) {
				grunt.fail.fatal('Unable to read configuration.\n' +
					'Have you specified a target? See: http://gruntjs.com/configuring-tasks');
			}
		},


		validateUnsharp = function(unsharp) {
			if (unsharp === null || typeof(unsharp) !== 'object') {
				grunt.fail.fatal('Invalid value for unsharp: ' + unsharp);
				return false;
			}
			if (!validateFloat(unsharp.radius)) {
				grunt.fail.fatal('Invalid value for unsharp.radius: ' + unsharp.radius);
				return false;
			}
			if (!validateFloat(unsharp.sigma)) {
				grunt.fail.fatal('Invalid value for unsharp.sigma: ' + unsharp.sigma);
				return false;
			}
			if (!validateFloat(unsharp.gain)) {
				grunt.fail.fatal('Invalid value for unsharp.gain: ' + unsharp.gain);
				return false;
			}
			if (!validateFloat(unsharp.threshold)) {
				grunt.fail.fatal('Invalid value for unsharp.threshold: ' + unsharp.threshold);
				return false;
			}
			return true;
		},

		validateWhitelist = function(whitelist, value, name) {
			if (whitelist.indexOf(value) === -1) {
				grunt.fail.fatal('Invalid value for ' + name + ': ' + value);
				return false;
			}
			return true;
		},

		extend = function(target) {
			var sources = [].slice.call(arguments, 1);
			sources.forEach(function(source) {
				for (var prop in source) {
					if (source.hasOwnProperty(prop)) {
						target[prop] = source[prop];
					}
				}
			});
			return target;
		};

	// let’s get this party started
	grunt.registerMultiTask('respimg', 'Automatically resizes image assets.', function() {
		var task = this;

		// Merge task-specific and/or target-specific options with these defaults.
		var options = this.options(DEFAULT_OPTIONS);

		// change some default options if we’re not optimizing images
		if (!options.optimize ||
			!options.optimize.output ||
			(!options.optimize.output.image_optim &&
				!options.optimize.output.picopt &&
				!options.optimize.output.imageOptim
			)
		) {
			DEFAULT_OPTIONS.strip = true;
			DEFAULT_OPTIONS.unsharp.sigma = 0.25;
			DEFAULT_OPTIONS.unsharp.gain = 8;
			DEFAULT_OPTIONS.unsharp.threshold = 0.065;
			options = this.options(DEFAULT_OPTIONS);
		}

		grunt.verbose.writeln('Real options: ');
		grunt.verbose.ok(JSON.stringify(options));

		// now some setup
		/* beautify preserve:start */
		var done =				this.async(),
			i =					0,
			series =			[],
			promise =			q(),
			promise2 =			q(),
			binPath =			{
				image_optim:		getPathToBin('image_optim'),
				picopt:				getPathToBin('picopt'),
				imageOptim:			getPathToBin('imageOptim')
			},
			outputFiles = 		[],
			totalSaved =		0;
		/* beautify preserve:end */
		async.series([

				// do some validation
				function(callback) {
					// tell the user what we’re doing
					grunt.verbose.writeln('Validating options…');

					// make sure alpha is valid
					if (!validateAlpha(options.alpha)) {
						return grunt.fail.fatal('Invalid `alpha` option');
					}
					grunt.verbose.writeln('`alpha` option OK');

					// make sure background is valid
					if (!validateBackground(options.background)) {
						return grunt.fail.fatal('Invalid `background` option');
					}
					grunt.verbose.writeln('`background` option OK');

					// make sure colorspace is valid
					if (!validateColorspace(options.colorspace)) {
						return grunt.fail.fatal('Invalid `colorspace` option');
					}
					grunt.verbose.writeln('`colorspace` option OK');

					// make sure dither is valid
					if (!validateDither(options.dither)) {
						return grunt.fail.fatal('Invalid `dither` option');
					}
					grunt.verbose.writeln('`dither` option OK');

					// make sure filter is valid
					if (!validateFilter(options.filter)) {
						return grunt.fail.fatal('Invalid `filter` option');
					}
					grunt.verbose.writeln('`filter` option OK');

					// make sure filterSupport is valid
					if (!validateFilterSupport(options.filterSupport)) {
						return grunt.fail.fatal('Invalid `filterSupport` option');
					}
					grunt.verbose.writeln('`filterSupport` option OK');

					// make sure interlace is valid
					if (!validateInterlace(options.interlace)) {
						return grunt.fail.fatal('Invalid `interlace` option');
					}
					grunt.verbose.writeln('`interlace` option OK');

					// make sure jpegFancyUpsampling is valid
					if (!validateJpegFancyUpsampling(options.jpegFancyUpsampling)) {
						return grunt.fail.fatal('Invalid `jpegFancyUpsampling` option');
					}
					grunt.verbose.writeln('`jpegFancyUpsampling` option OK');

					// make sure optimize is valid
					var optimize = validateOptimize(options.optimize);
					if (!optimize) {
						return grunt.fail.fatal('Invalid `optimize` option');
					} else {
						options.optimize = optimize;
					}
					grunt.verbose.writeln('`optimize` option OK');

					// make sure image_optim is available
					if ((options.optimize.input.image_optim > 0 || options.optimize.output.image_optim > 0) && !binPath.image_optim) {} else if (
						options.optimize.input.image_optim > 0 || options.optimize.output.image_optim > 0) {
						grunt.verbose.writeln('image_optim located');
					} else {
						grunt.verbose.writeln('image_optim not needed');
					}

					// make sure picopt is available
					if ((options.optimize.input.picopt > 0 || options.optimize.output.picopt > 0) && !binPath.picopt) {
						return grunt.fail.fatal('Unable to locate picopt.');
					} else if (options.optimize.input.picopt > 0 || options.optimize.output.picopt > 0) {
						grunt.verbose.writeln('picopt located');
					} else {
						grunt.verbose.writeln('picopt not needed');
					}

					// make sure ImageOptim is available
					if ((options.optimize.input.imageOptim > 0 || options.optimize.output.imageOptim > 0) && !binPath.imageOptim) {
						return grunt.fail.fatal('Unable to locate ImageOptim-CLI.');
					} else if (options.optimize.input.imageOptim > 0 || options.optimize.output.imageOptim > 0) {
						grunt.verbose.writeln('ImageOptim-CLI located');
					} else {
						grunt.verbose.writeln('ImageOptim-CLI not needed');
					}

					// make sure pngCompressionFilter is valid
					if (!validatePngCompressionFilter(options.pngCompressionFilter)) {
						return grunt.fail.fatal('Invalid `pngCompressionFilter` option');
					}
					grunt.verbose.writeln('`pngCompressionFilter` option OK');

					// make sure pngCompressionLevel is valid
					if (!validatePngCompressionLevel(options.pngCompressionLevel)) {
						return grunt.fail.fatal('Invalid `pngCompressionLevel` option');
					}
					grunt.verbose.writeln('`pngCompressionLevel` option OK');

					// make sure pngCompressionStrategy is valid
					if (!validatePngCompressionStrategy(options.pngCompressionStrategy)) {
						return grunt.fail.fatal('Invalid `pngCompressionStrategy` option');
					}
					grunt.verbose.writeln('`pngCompressionStrategy` option OK');

					// make sure pngExcludeChunk is valid
					if (!validatePngExcludeChunk(options.pngExcludeChunk)) {
						return grunt.fail.fatal('Invalid `pngExcludeChunk` option');
					}
					grunt.verbose.writeln('`pngExcludeChunk` option OK');

					// make sure pngPreserveColormap is valid
					if (!validatePngPreserveColormap(options.pngPreserveColormap)) {
						return grunt.fail.fatal('Invalid `pngPreserveColormap` option');
					}
					grunt.verbose.writeln('`pngPreserveColormap` option OK');

					// make sure posterize is valid
					if (!validatePosterize(options.posterize)) {
						return grunt.fail.fatal('Invalid `posterize` option');
					}
					grunt.verbose.writeln('`posterize` option OK');

					// make sure quality is valid
					if (!validateQuality(options.quality)) {
						return grunt.fail.fatal('Invalid `quality` option');
					}
					grunt.verbose.writeln('`quality` option OK');

					// make sure resizeFunction is valid
					if (!validateResizeFunction(options.resizeFunction)) {
						return grunt.fail.fatal('Invalid `resizeFunction` option');
					}
					grunt.verbose.writeln('`resizeFunction` option OK');

					// make sure strip is valid
					if (!validateStrip(options.strip)) {
						return grunt.fail.fatal('Invalid `strip` option');
					}
					grunt.verbose.writeln('`strip` option OK');

					// make sure svgoPlugins is valid
					if (!validateSvgoPlugins(options.svgoPlugins)) {
						return grunt.fail.fatal('Invalid `svgoPlugins` option');
					}
					grunt.verbose.writeln('`svgoPlugins` option OK');

					// make sure unsharp is valid
					if (!validateUnsharp(options.unsharp)) {
						return grunt.fail.fatal('Invalid `unsharp` option');
					}
					grunt.verbose.writeln('`unsharp` option OK');

					// make sure there are images to resize
					if (task.files.length === 0) {
						return grunt.fail.fatal('No valid source files were found.');
					}
					grunt.verbose.writeln('Source files found');

					if (!options.sizes || options.sizes.length === 0) {
						if (options.widths && options.widths.length > 0) {
							options.sizes = options.widths;
							grunt.verbose.warn('Using deprecated widths option.');
						} else {
							return grunt.fail.fatal('No sizes provided!');
						}
					}

					if (options.widthAsDir && (!options.name || options.name === DEFAULT_OPTIONS.name)) {
						options.name = "{%= size.width %}/{%= file.name %}";
					}

					// loop through each input
					async.each(task.files, function(file, callback2) {
						// make sure we have a valid target and source
						validateTarget(file);
						validateSource(file);
						callback2();
					}, callback);
				},

				// optimize inputs - SVGO
				function(callback) {

					// optimize as many times as the user wants
					async.timesSeries(options.optimize.input.svgo, function(i, next) {

						// tell the user that we’re optimizing
						grunt.log.writeln('Optimizing inputs with SVGO (pass ' + (i + 1) + ' of ' + options.optimize.input.svgo +
							')…');

						// asynchronously loop through the files
						async.each(task.files, function(file, callback2) {

							// create a promise to optimize the SVGs
							promise = optimizeSVGO(file, options);

							// when that promise is finished, print the results onscreen
							// (if we’re being verbose)
							// and continue onwards
							promise.done(function(results) {
								if (results) {
									grunt.verbose.ok(results);
								}
								callback2(null);
							});

						}, next);

					}, callback);

				},

				// optimize inputs - image_optim
				function(callback) {

					// build a list of individual files
					var rasterFiles = [];
					task.files.forEach(function(file) {
						if (!grunt.file.isDir(file.src[0]) && path.extname(file.dest).toLowerCase() !== '.svg') {
							rasterFiles.push(file.src[0]);
						}
					});

					// if there’s anything to optimize…
					if (rasterFiles.length > 0) {

						// get absolute paths to the stuff we’re optimizing
						var rasterFilesResolved = rasterFiles.map(function(dir) {
							return path.resolve(__dirname, '../' + dir);
						});

						// optimize as many times as the user wants
						async.timesSeries(options.optimize.input.image_optim, function(i, next) {

							// let the user know that we’re optimizing inputs
							grunt.log.writeln('Optimizing inputs with image_optim (pass ' + (i + 1) + ' of ' + options.optimize.input.image_optim + ')…');

							// do the optimizations (with promises)
							optimizeImage_optim(rasterFilesResolved, binPath.image_optim).then(function() {
									next();
								});

						}, callback);

					} else {
						callback(null);
					}

				},

				// optimize inputs - picopt
				function(callback) {

					// build a list of individual files
					var rasterFiles = [];
					task.files.forEach(function(file) {
						if (!grunt.file.isDir(file.src[0]) && path.extname(file.dest).toLowerCase() !== '.svg') {
							rasterFiles.push(file.src[0]);
						}
					});

					// if there’s anything to optimize…
					if (rasterFiles.length > 0) {

						// get absolute paths to the stuff we’re optimizing
						var rasterFilesResolved = rasterFiles.map(function(dir) {
							return path.resolve(__dirname, '../' + dir);
						});

						// optimize as many times as the user wants
						async.timesSeries(options.optimize.input.picopt, function(i, next) {

							// let the user know that we’re optimizing inputs
							grunt.log.writeln('Optimizing inputs with picopt (pass ' + (i + 1) + ' of ' + options.optimize.input.picopt + ')…');

							// do the optimizations (with promises)
							optimizePicopt(rasterFilesResolved, binPath.picopt).then(function() {
									next();
								});

						}, callback);

					} else {
						callback(null);
					}

				},

				// optimize inputs - ImageOptim
				function(callback) {

					// build a list of individual files
					var rasterFiles = [];
					task.files.forEach(function(file) {
						if (!grunt.file.isDir(file.src[0]) && path.extname(file.dest).toLowerCase() !== '.svg') {
							rasterFiles.push(file.src[0]);
						}
					});

					// if there’s anything to optimize…
					if (rasterFiles.length > 0) {

						// get absolute paths to the stuff we’re optimizing
						var rasterFilesResolved = rasterFiles.map(function(dir) {
							return path.resolve(__dirname, '../' + dir);
						});

						// optimize as many times as the user wants
						async.timesSeries(options.optimize.input.imageOptim, function(i, next) {

							// let the user know that we’re optimizing inputs
							grunt.log.writeln('Optimizing inputs with ImageOptim (pass ' + (i + 1) + ' of ' + options.optimize.input.imageOptim + ')…');

							// do the optimizations (with promises)
							optimizeImageOptim(rasterFilesResolved, binPath.imageOptim).then(function() {
									next();
								});

						}, callback);

					} else {
						callback(null);
					}

				},

				// copy SVGs and PDFs
				function(callback) {
					async.each(task.files, function(file, callback2) {
						var srcPath = file.src[0],
							extName = path.extname(srcPath).toLowerCase();

						// if it’s an SVG or a PDF, copy the file to the output dir
						if (extName === '.svg' || extName === '.pdf') {
							var dstPath = getSourceCopyDestination(file, options);
							fs.copy(srcPath, dstPath, function(err) {
								if (err) {
									grunt.fail.fatal(err);
								}

								outputFiles.push(dstPath);
								callback2(null);
							});
							grunt.verbose.ok("Copied " + srcPath + " to " + dstPath);
						} else {
							callback2(null);
						}

					}, callback);
				},

				// resize images
				function(callback) {

					// tell the user what we’re doing
					grunt.log.writeln('Resizing images…');

					// loop through each input file
					async.each(task.files, function(file, fileLoopCallback) {
						var srcPath = file.src[0];

						// prepare the image with a promise
						var preparationPromise = q();
						preparationPromise = prepareImage(srcPath);

						preparationPromise.done(function(prepData) {
							if (prepData) {
								grunt.verbose.ok("Found " + srcPath + " (" + prepData.width + "x" + prepData.height + " px)");
								// loop through each size
								async.each(options.sizes, function(sizeObject, sizeLoopCallback) {
									// elaborate the size object to make height and width available as properties
									sizeObject = size.elaborate(sizeObject);


									var dstPath = getDestination(file, sizeObject, options);

									// assure the destination path exists
									grunt.file.mkdir(path.dirname(dstPath));
									// process the image with a promise
									var resizePromise = q();
									// build an individual copy (!) of the size object with some options added for sizing functions
									var individualSizeObject = extend({}, sizeObject, {
										options: options,
										file: extend({}, file, {
											src: srcPath + '', // important! clone the string object!
											dest: dstPath + '' // clone the string object!
										})
									});
									var resizeDimension = size.toPixel(individualSizeObject, prepData);
									resizePromise = resizeImage(srcPath, dstPath, options, resizeDimension, prepData);
									// once the image has been processed
									resizePromise.done(function(results) {

										if (results) {

											grunt.verbose.ok("Resized " + srcPath + " to " + resizeDimension.width + "x" + resizeDimension.height + " px, saved to " + dstPath);
											// record the output path for optimization
											// record absolute paths already at this point
											outputFiles.push(path.resolve(dstPath));
										}

										sizeLoopCallback(null);
									});
								}, function() {
									grunt.verbose.ok("Resized " + srcPath + " to all sizes.");
									fileLoopCallback();
								});
							} else {
								fileLoopCallback();
							}

						});

					}, callback);

				},

				// optimize outputs - SVGO

				function(callback) {
					// optimize as many times as the user wants
					async.timesSeries(options.optimize.output.svgo, function(i, next) {

						// tell the user that we’re optimizing
						grunt.log.writeln('Optimizing outputs with SVGO (pass ' + (i + 1) + ' of ' + options.optimize.output.svgo +
							')…');

						// asynchronously loop through the files
						async.each(outputFiles, function(file, callback2) {

							// create a promise to optimize the SVGs
							promise = optimizeSVGO({src: [file], dest: file}, options);

							// when that promise is finished, print the results onscreen
							// (if we’re being verbose)
							// and continue onwards
							promise.done(function(results) {
								if (results) {
									grunt.verbose.ok(results);
								}
								callback2(null);
							});

						}, next);

					}, callback);

				},

				// optimize outputs - image_optim
				function(callback) {
					// if there’s anything to optimize…
					if (outputFiles.length > 0) {

						// optimize as many times as the user wants
						async.timesSeries(options.optimize.output.image_optim, function(i, next) {

							// let the user know that we’re optimizing inputs
							grunt.log.writeln('Optimizing outputs with image_optim (pass ' + (i + 1) + ' of ' + options.optimize.output
								.image_optim + ')…');

							// do the optimizations (with promises)
							optimizeImage_optim(outputFiles, binPath.image_optim)
								.then(function() {
									next();
								});

						}, callback);

					} else {
						callback(null);
					}

				},

				// optimize outputs - picopt
				function(callback) {
					// if there’s anything to optimize…
					if (outputFiles.length > 0) {

						// optimize as many times as the user wants
						async.timesSeries(options.optimize.output.picopt, function(i, next) {

							// let the user know that we’re optimizing inputs
							grunt.log.writeln('Optimizing outputs with picopt (pass ' + (i + 1) + ' of ' + options.optimize.output.picopt +
								')…');

							// do the optimizations (with promises)
							optimizePicopt(outputFiles, binPath.picopt)
								.then(function() {
									next();
								});

						}, callback);

					} else {
						callback(null);
					}

				},

				// optimize outputs - ImageOptim
				function(callback) {
					// if there’s anything to optimize…
					if (outputFiles.length > 0) {

						// optimize as many times as the user wants
						async.timesSeries(options.optimize.output.imageOptim, function(i, next) {

							// let the user know that we’re optimizing inputs
							grunt.log.writeln('Optimizing outputs with ImageOptim (pass ' + (i + 1) + ' of ' + options.optimize.output
								.imageOptim + ')…');

							// do the optimizations (with promises)
							optimizeImageOptim(outputFiles, binPath.imageOptim)
								.then(function() {
									next();
								});

						}, callback);

					} else {
						callback(null);
					}

				}

			],

			function(err, results) {
				done();
			});
	});
};
