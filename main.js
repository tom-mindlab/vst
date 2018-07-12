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

async function getImageProps(URL) {
	return await new Promise(resolve => {
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
	$DOM.css('background-repeat', 'no-repeat');
	$DOM.css('width', getImageProps(item.URI).width / item.percent_width);
	$DOM.css('height', getImageProps(item.URI).height);

	if (item instanceof Product) {
		$DOM.addClass('rack-product ' + item.name);
	} else if (item instanceof Shelf) {
		$DOM.addClass('rack-shelf ' + item.name);
	} else {
		throw new TypeError('Expected shelf rack item');
	}
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

async function blah(items) {
	let $DOM;
	for (let item of items) {
		$DOM = await asElement(item);
		if (Array.isArray(item.items)) {
			// console.log('push...');
			// console.group('>');
			// console.log(item.items);
			// console.groupEnd();
			$DOM.append(await blah(item.items));
		}
	}
	return $DOM;
}

async function main($DOM, configuration) {
	let rack = new ShelfRack(configuration.layout, configuration.item_classes);
	console.group();
	console.warn(rack.items);
	console.groupEnd();
	console.log(await blah(rack.items));
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
