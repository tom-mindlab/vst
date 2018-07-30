import './visual-search-t.less';
import { screen, utils, controls } from 'wombat';
import template from './visual-search-t.html';
import languages from './lang.json';

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
	let rack = new ShelfRack(configuration.layout, configuration.item_classes, configuration.product_info);
	let click_data = [];

	let timer = controls.timer($DOM.find('.timer'));
	timer.duration(configuration.timer.duration);
	timer.resetDuration(configuration.timer.reset_duration);
	timer.timeout(async function () {
		timer.stop();
		$DOM.fadeOut(configuration.timer.reset_duration / 2);
		await showScreen(pause, pause_replacements);
		await Promise.all([timer.reset(), $DOM.fadeIn(configuration.timer.reset_duration).promise()]);
		timer.start();
	});

	$DOM.show();
	let $stimuli = $DOM.find('.stimuli');
	let $instruction = $DOM.find('.instruction');

	// MAIN LOOP
	for (let i = 0, repeat = false; i < configuration.iterations; repeat ? i : ++i, repeat = false) {

		console.log("iteration: " + i);
		// console.log("repetition? " + repeat);

		if (repeat === true) {
			if (configuration.repeat_behavior.regenerate) {
				rack.populateShelves();
			}
		} else {
			rack.populateShelves();
		}

		$stimuli.append(await $newLayout($stimuli, configuration.product_info.scale, rack));
		$stimuli.hide();

		// abstract this into the config
		let requested_product = rack.product_classes[Math.floor(Math.random() * rack.product_classes.length)].name;
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
		console.log(click_info);
		console.log('.');


		let event_info = await onClick($stimuli);

		let $target = $(event_info.target);
		let target_class = $target.attr('class');
		click_info.m_pos.x = event_info.pageX;
		click_info.m_pos.y = event_info.pageY;
		click_info.product_type.clicked = target_class.substr(target_class.indexOf(' ') + 1);
		console.log(click_info.product_type.requested);
		console.log(click_info.product_type.clicked);
		console.log((click_info.product_type.requested != click_info.product_type.clicked));

		$target.addClass('clicked');
		(click_info.product_type.requested != click_info.product_type.clicked) ? $target.addClass('incorrect') : $target.addClass('correct');

		timer.stop();
		click_info.time_taken = timer.value();
		click_data.push(click_info);
		await timer.reset();
		$instruction.empty();
		$stimuli.empty();
		// console.log(click_info);
		// console.log(click_info.product_type.requested);
		// console.log(click_info.product_type.clicked);

		if (configuration.repeat_behavior.triggers.wrong_answer) {
			if (click_info.product_type.requested != click_info.product_type.clicked) {
				repeat = true;
			}
		}
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

	let $DOM = $(template).clone();
	let $intro_screen = $DOM.find('.introduction').hide();
	let $pause_screen = $DOM.find('.pause-screen').hide();
	let $main = $DOM.find('.main').hide();

	screen.enter($DOM, 'fade');

	await showScreen($intro_screen, lang.screens.intro);

	let meta = {};
	let data = await main($main, configuration, $pause_screen, lang.screens.pause);

	screen.exit('fade', async function () {
		callback(meta, data);
	});
}
