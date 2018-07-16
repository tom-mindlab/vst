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

async function $asElement(item) {
	let $DOM = $('<div></div>');
	$DOM.css('background-image', 'url(' + item.URI + ')');
	$DOM.css('background-position', 'center');

	if (item instanceof Product) {
		$DOM.addClass('product ' + item.name);
	} else if (item instanceof Shelf) {
		console.log('pack dir: ' + item.pack_from);
		$DOM.css('flex-direction', item.pack_from);
		$DOM.addClass('shelf ' + item.name);
	} else {
		throw new TypeError('Expected shelf rack item');
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

async function $buildDOM(item) {
	let $DOM = await $asElement(item);
	if (Array.isArray(item.items)) {
		for (let nested of item.items) {
			$DOM.append(await $buildDOM(nested));
		}
	}
	return $DOM;
}

async function main($DOM, configuration) {
	let rack = new ShelfRack(configuration.layout, configuration.item_classes);
	let $rack_DOM = $('<div class="rack">');
	for (let item of rack.items) {
		$rack_DOM.append(await $buildDOM(item));
	}

	$DOM.find('.stimuli').append($rack_DOM);

	$DOM.fadeIn(200);

	$('.shelf').css('height', 100 / $('.rack').children().length + '%');

	$('.product').each(function() {
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
					configuration.product_scale *
					100) /
					100 +
				'px'
		);
		$(this).css('background-position', 'center ' + 100 - configuration.product_scale * 100 + '%');
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

	showScreen($intro_screen, lang.screens.intro)
		.then(() => {
			return main($main, configuration);
		})
		.then(() => {
			// todo...
			callback({}, {});
		});
}
