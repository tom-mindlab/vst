import './visual-search-t.less';
import { screen, utils, controls } from 'wombat';
import template from './visual-search-t.html';
import languages from './lang.json';

import ldExtend from 'lodash/extend';

import { ShelfRack } from './shelf_rack';
import { $newLayout } from './shelf_rack';

function onClick($element) {
	return new Promise(function (resolve) {
		$element.on('click', async (e) => {

			resolve(e);
		});
	});
}

async function showScreen($DOM, replacements) {
	$DOM.fadeIn(200);

	$DOM.find('.message').text(replacements.message);
	$DOM.find('.continue').val(replacements.continue_button);

	await onClick($DOM.find('.continue'));
	return await $DOM.fadeOut(200);
}

// //////////////////////////////////////////////////////////////
// MAIN SCRIPT LOOP                                            //
// //////////////////////////////////////////////////////////////
// args:
// 	[0]: $DOM			:	object (jQuery element)
//			the jQuery DOM element handle to the .main div
// 	[1]: configuration	:	object (parsed json)
// return:
// 		array
// desc:
// 		the main stimuli display and input recording loop, generates shelves on the fly from the config
// 		and records user input (which it returns as an array)
async function main($DOM, configuration, pause, pause_replacements) {
	const rack_dimensions = {
		x: $DOM.width(),
		y: $DOM.height()
	}
	let rack = new ShelfRack(configuration.layout, configuration.item_classes, configuration.product_info, rack_dimensions);
	console.log(rack);
	let click_data = [];

	let pause_experiment = async function (reset_timer) {
		reset_timer ? timer.stop() : timer.pause();
		$DOM.fadeOut(configuration.timer.reset_duration / 2);
		await showScreen(pause, pause_replacements);

		await Promise.all([reset_timer ? timer.resetAsync() : async () => { }, $DOM.fadeIn(configuration.timer.reset_duration).promise()]);

		reset_timer ? timer.start() : timer.unpause();
	}

	let timer = controls.timer($DOM.find('.timer'));
	timer.duration(configuration.timer.duration);
	timer.resetDuration(configuration.timer.reset_duration);

	let pause_button = controls.pause($DOM.find('.pause-button'));
	pause_button.click(async () => pause_experiment(false));

	$DOM.show();
	let $stimuli = $DOM.find('.stimuli');
	let $instruction = $DOM.find('.instruction');

	let trial_count = controls.progress($DOM.find('.progress'));
	trial_count.setTotal(configuration.iterations);
	trial_count.update(0);
	// MAIN LOOP
	for (let i = 0, repeat = false; i < configuration.iterations; repeat ? i : ++i, repeat = false) {

		timer.timeout(async () => {
			pause_experiment(true);
			console.log(configuration.repeat_behavior);
			if (configuration.repeat_behavior.triggers.timeout === true) {
				if (configuration.repeat_behavior.rearrange === true) {
					console.log("reconfigure");
					$stimuli.empty();
					$stimuli.append(await $newLayout($stimuli, configuration.product_info.scale, rack, configuration.mouseover_classes));
					await rack.generateBoundedProducts();
				}
			}
		});

		await rack.generateBoundedProducts();

		$stimuli.append(await $newLayout($stimuli, configuration.product_info.scale, rack, configuration.mouseover_classes));
		$stimuli.hide();
		console.log($stimuli);

		// abstract this into the config
		//let requested_product = rack.product_classes[Math.floor(Math.random() * rack.product_classes.length)].name;

		let requested_product = $('.product').eq(Math.floor(Math.random() * $('.product').length)).attr('id');

		console.warn(pause_replacements);
		await showScreen(pause, Object.assign(pause_replacements, { message: ('Please click on the ' + requested_product) }));

		$instruction.text('Please click on the ' + requested_product);
		$stimuli.fadeIn(configuration.timer.reset_duration);
		$instruction.fadeIn(configuration.timer.reset_duration);
		timer.start();
		let click_info = {
			m_pos: {
				x: NaN,
				y: NaN
			},
			product_type: {
				requested: requested_product,
				clicked: null
			},
			time_taken: NaN
		};

		let event_info = await onClick($stimuli);

		let $target = $(event_info.target);
		let target_class = $target.attr('class');
		click_info.m_pos.x = event_info.pageX;
		click_info.m_pos.y = event_info.pageY;
		click_info.product_type.clicked = $target.attr('id');

		$target.addClass('clicked');
		let $overlay = $('<div></div>');
		$overlay.css('position', 'absolute');
		$overlay.css('top', '0');
		$overlay.css('left', '0');
		$overlay.css('height', '100%');
		$overlay.css('width', '100%');
		$overlay.css('filter', 'opacity(50%)');

		(click_info.product_type.requested != click_info.product_type.clicked) ? $overlay.addClass('incorrect') : $overlay.addClass('correct');

		if (target_class.split(' ')[0] === 'product') $target.append($overlay);

		timer.stop();
		click_info.time_taken = timer.value();
		click_data.push(click_info);


		if (configuration.repeat_behavior.triggers.wrong_answer) {
			if (click_info.product_type.requested != click_info.product_type.clicked) {
				repeat = true;
			}
		}

		if (!repeat) trial_count.update(i + 1);
		await timer.resetAsync();
		$instruction.empty();
		$stimuli.empty();
	}

	return click_data;
}

// //////////////////////////////////////////////////////////////
// ENTRY POINT (DEFAULT EXPORTED FUNCTION)                     //
// //////////////////////////////////////////////////////////////
// args:
// [0]: configuration	:	object (parsed json)
//		the .json data passed into the component, see the examples
// [1]: callback		: 	function
// 		the function to execute on element completion, expects two parameters:
//		[0]: meta		:	object
//			 the meta data which will be written to the user's session objects (maintained between elements)
//		[1]: data		:	array
//			 the data produced by the user running through the element
export default async function (configuration, callback) {
	// language
	let lang = utils.buildLanguage(languages, configuration);
	ldExtend(lang, configuration.language_options);

	let $DOM = $(template).clone();
	let $intro_screen = $DOM.find('.introduction').hide();
	let $pause_screen = $DOM.find('.pause-screen').hide();
	let $main = $DOM.find('.main').hide();

	let $title = $DOM.find('.title');
	$title.find('.header').text(lang.title.header);
	$title.find('.message').text(lang.title.message);

	screen.enter($DOM, 'fade');

	await showScreen($intro_screen, lang.screens.intro);

	let meta = null;
	let data = await main($main, configuration, $pause_screen, lang.screens.pause);

	screen.exit('fade', async function () {
		callback(meta, data);
	});
}
