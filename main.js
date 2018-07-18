import './visual-search-t.less';
import { screen, utils, controls } from 'wombat';
import template from './visual-search-t.html';
import languages from './lang.json';

import { Product, Shelf, ShelfRack } from './shelf_rack';
import { $buildDOM } from './shelf_rack';

function onClick($element, click_info) {
	return new Promise(function(resolve) {
		$element.on('click', e => {
			if (typeof click_info === 'object') {
				click_info.m_pos.x = e.pageX;
				click_info.m_pos.y = e.pageY;
				click_info.product_type.clicked = $(e.target)
					.attr('class')
					.split(' ')
					.pop();
			}
			resolve();
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
// generate new DOM for generated shelf rack                   //
// //////////////////////////////////////////////////////////////
// args:
// 		[0]: $DOM	:	object (jQuery element)
//				the stimuli div element
//		[1]: product_scale	:	number
//				the scale of products on the shelf
// return:
// 		object (jQuery element)
// desc:
//		generates a DOM for a given shelf rack layout, using the input $DOM as a base
//		returns a completed DOM in the <div class="rack"><div class="shelf ...">... style
async function $newLayout($container_DOM, product_scale, rack) {
	let $rack_DOM = $container_DOM;
	for (let item of rack.items) {
		$rack_DOM.append(await $buildDOM(item));
	}

	//$rack_DOM.append($rack_DOM);
	//$rack_DOM.show();

	//$rack_DOM.find('.shelf').css('height', 100 / $rack_DOM.children().length + '%');

	$rack_DOM.find('.product').each(function() {
		$(this).css(
			'background-size',
			'auto ' +
				($(this)
					.parent()
					.height() *
					product_scale *
					100) /
					100 +
				'px'
		);
	});

	return $rack_DOM;
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
	let rack = new ShelfRack(configuration.layout, configuration.item_classes, configuration.product);
	let click_data = [];

	let timer = controls.timer($DOM.find('.timer'));
	timer.duration(configuration.timer_duration);
	let reset_duration = 500;
	timer.resetDuration(reset_duration);
	timer.timeout(async function() {
		timer.stop();
		$DOM.fadeOut(reset_duration);
		await showScreen(pause, pause_replacements);
		timer.reset();
		await new Promise(res =>
			setTimeout(() => {
				$DOM.fadeIn(reset_duration);
				res();
			}, reset_duration)
		);
		timer.start();
	});

	$DOM.show();
	let $stimuli = $DOM.find('.stimuli');
	let $instruction = $DOM.find('.instruction');
	for (let i = 0; i < configuration.repeats; ++i) {
		$instruction.hide();
		rack.populateShelves();
		$stimuli.empty();
		$stimuli.append(await $newLayout($stimuli, configuration.product.scale, rack));
		$stimuli.hide();
		let requested_product = rack.product_classes[Math.floor(Math.random() * rack.product_classes.length)].name;
		$instruction.text('Please click on the ' + requested_product);
		await new Promise(res =>
			setTimeout(() => {
				$stimuli.fadeIn(reset_duration);
				$instruction.fadeIn(reset_duration);
				res();
			}, reset_duration)
		);
		timer.start();
		let click_info = {
			m_pos: {
				x: NaN,
				y: NaN
			},
			product_type: {
				requested: rack.product_classes[Math.floor(Math.random() * rack.product_classes.length)].name,
				clicked: null
			},
			time_taken: NaN
		};
		await onClick($stimuli, click_info);
		timer.stop();
		click_info.time_taken = timer.value();
		click_data.push(click_info);
		timer.reset();
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
export default async function(configuration, callback) {
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

	screen.exit('fade', async function() {
		callback(meta, data);
	});
}
