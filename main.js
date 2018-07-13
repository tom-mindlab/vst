import './visual-search-t.less';
import { screen, utils, controls } from 'wombat';
import template from './visual-search-t.html';
import languages from './lang.json';

import { Product, Shelf, ShelfRack } from './shelf_rack';

function onClick($element) {
	return new Promise(function(resolve) {
		$element.on('click', resolve);
	});
}

function getImageProps(URL) {
	return new Promise(resolve => {
		let img = new Image();

		img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.src = URL;
	});
}

async function $generateDOM(shelf_rack) {
	let $DOM = $('<div class="rack"></div>');
	for (let index in shelf_rack.items) {
		$DOM.append($generateDOMTree(this.items[index]));
	}
	return $DOM;
}

async function asElement(item) {
	let $DOM = $('<div></div>');
	$DOM.css('background-image', 'url(' + item.URI + ')');
	$DOM.css('background-position', 'center');
	let dim = await getImageProps(item.URI);

	// $DOM.css('max-width', '65vw');
	// $DOM.css('height', dim.height);

	if (item instanceof Product) {
		// $DOM.css('margin-top', 'auto');
		// $DOM.css('margin-bottom', '4%');
		// $DOM.css('background-position', 'center bottom');
		// $DOM.css('background-repeat', 'no-repeat');
		// let scale = 40;
		// let percent = (input, scale) => {
		// 	return (scale * input) / 100;
		// };

		// // $DOM.css('width', percent(dim.width, scale));
		// // $DOM.css('height', percent(dim.height, scale));
		// $DOM.css('height', '90%');
		// $DOM.css('width', 'auto');
		// $DOM.css('background-size', '100%');

		$DOM.addClass('product ' + item.name);
	} else if (item instanceof Shelf) {
		// $DOM.css('display', 'flex');
		// $DOM.css('justify-content', 'space-between');
		// $DOM.css('margin-left', 'auto');
		// $DOM.css('margin-right', 'auto');
		// $DOM.css('background-position', 'center');
		// $DOM.css('background-repeat', 'no-repeat');
		// $DOM.css('height', '50%');
		// $DOM.css('max-height', dim.height);

		$DOM.addClass('shelf ' + item.name);
	} else {
		throw new TypeError('Expected shelf rack item');
	}

	return $DOM;
}

function $generateDOMTree(parent) {
	let $DOM = parent.$DOM;
	for (let child of parent.items) {
		if (child instanceof Shelf) {
			$DOM.append($generateDOMTree(child));
		} else {
			$DOM.append(child.$DOM);
		}
	}
	return $DOM;
}

async function showScreen($DOM, replacements) {
	$DOM.fadeIn(200);

	$DOM.find('.message').text(replacements.message);
	$DOM.find('.continue').val(replacements.continue_button);

	return onClick($DOM.find('.continue')).then(() => {
		return $DOM.fadeOut(200);
	});
}

async function blah(item) {
	// let $DOM = $('<div class="rack">');
	// for (let item in items) {
	// 	console.log(items[item].name);
	// 	console.log('>> ' + asElement(items[item])[0].outerHTML);
	// 	$DOM = asElement(items[item]);

	// 	if (Array.isArray(items[item].items)) {
	// 		// console.log('push...');
	// 		// console.group('>');
	// 		// console.log(item.items);
	// 		// console.groupEnd();
	// 		console.group('recursion...');
	// 		$DOM.append(await blah(items[item].items));
	// 		console.groupEnd('done');
	// 	}
	// }

	let $DOM = await asElement(item);
	if (Array.isArray(item.items)) {
		for (let nested of item.items) {
			$DOM.append(await blah(nested));
		}
	}
	return $DOM;
}

async function main($DOM, configuration) {
	let rack = new ShelfRack(configuration.layout, configuration.item_classes);
	let $rack_DOM = $('<div class="rack">');
	//$rack_DOM.css('width', '100%');
	//$rack_DOM.css('height', '100%');
	// $rack_DOM.css('display', 'flex');
	// $rack_DOM.css('flex-direction', 'column');
	for (let item of rack.items) {
		$rack_DOM.append(await blah(item));
	}

	$DOM.find('.stimuli').append($rack_DOM);

	console.log($DOM);

	$DOM.fadeIn(200);

	let product_scale = 0.85;

	console.log(100 / $('.rack').children().length);
	$('.shelf').css('height', 100 / $('.rack').children().length + '%');
	$('.shelf').each(function() {
		console.log(this);
		console.log('>> ' + $(this).height());
	});

	$('.product').each(function() {
		console.log('>>> ' + $(this).parent()[0].outerHTML);
		console.log(
			'>>> ' +
				$(this)
					.parent()
					.css('height')
		);
		console.log(
			$(this)
				.parent()
				.children().length
		);
		$(this).css(
			'width',
			100 /
				$(this)
					.parent()
					.children().length +
				'%'
		);
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
		$(this).css('background-position', 'center ' + 100 - product_scale * 100 + '%');
	});

	await onClick($DOM);
	return await $DOM.fadeOut(200);
}

export default async function(configuration, callback) {
	let lang = utils.buildLanguage(languages, configuration);

	let $DOM = $(template).clone();

	let $intro_screen = $DOM.find('.introduction').hide();
	let $pause_screen = $DOM.find('.pause-screen').hide();
	let $main = $DOM.find('.main').hide();

	screen.enter($DOM, 'fade');

	if (document.body) {
		console.log('yes');
	}
	showScreen($intro_screen, lang.screens.intro)
		.then(() => {
			return main($main, configuration);
		})
		.then(() => {
			// todo...
			callback({}, {});
		});
}
