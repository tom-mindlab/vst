import ldShuffle from 'lodash/shuffle'


class Item {
	constructor(name, URI, shelf_proportion) {
		this.name = name;
		this.URI = URI;
		this.shelf_proportion = shelf_proportion;
	}
}

class Product extends Item {
	constructor(json_product_obj) {
		super(json_product_obj.name, json_product_obj.URI, 1);
	}
}

// TODO:
// all of these
const OVERFLOW_CALLBACKS = {
	SQUASH: function () { },
	OVERWRITE: {
		LEFT: function () { },
		RIGHT: function () { }
	},
	FAIL: function () { }
};

class Shelf extends Item {
	constructor(json_shelf_obj, overflow_callback) {

		super(json_shelf_obj.name, json_shelf_obj.URI, 1);
		this.overflow_callback = overflow_callback;
		this.pack_from = json_shelf_obj.pack_from;
		this.bounds = json_shelf_obj.bounds;
		this.items = [];
	}

	pop() {
		this.items.pop();
	}

	push(item) {
		if (!(item instanceof Item)) {
			throw new TypeError('Shelf push method expects Item object argument');
		} else {
			// TODO:
			// 1.   check if we have room for another product (width measurement), invoke overflow callback if there's no room
			// 1.1  this could potentially be deferred until rendering
			// if (this.items.length < this.constraints.max) {
			// 	this.items.push(item);
			// } else {
			// 	throw new RangeError('shelf cannot accept more items (max of "' + this.constraints.max + '" already reached)');
			// }
			this.items.push(item);
		}
	}

	clear() {
		this.items.splice(0, this.items.length);
	}

}

export class ShelfRack {
	constructor(layout_arr, item_classes, product_obj) {


		// holy fuck this is bad code, needs a refactor (change in the config structure)... cba right now (16/07/18) [tom]
		this.product_classes = item_classes.products;

		this.shelf_classes = item_classes.shelves;

		this.items = [];
		this.items = parseItems(layout_arr, this.items, this.shelf_classes);
		this.product_info = product_obj;
	}

	// yields a product object
	// this generator will yield the same product from the list of products N times where
	//		N = (target count of products) / (number of product types)
	// e.g:
	//		N = 20 / 4
	//		  = 5
	// (so N is just the size of the group for each product).
	// After yielding the same product N times, it will then yield the next product in the list N times. After this, it will loop from the start.
	// If
	//		(target count of products) % (number of product types) != 0			(not cleanly divisible)
	// then the remainder of that division is captured.
	// The size of N for the products (starting at the back, moving up the array) in the product list will be increased by 1 and the
	// remainder of the division from earlier will be decreased by 1 until the remainder is zero.
	// By doing this, the leftover amount is spread as evenly as possible across the product list.
	*genProduct() {
		let group_sizes = new Array(this.product_classes.length);
		group_sizes.fill(Math.floor(this.product_info.count / this.product_classes.length));
		for (let remainder = this.product_info.count - group_sizes.reduce((s, v) => { return s + v }); remainder > 0; --remainder) {
			group_sizes[remainder]++;
		}

		while (true) {
			for (let i = 0; i < this.product_classes.length; ++i) {
				for (let j = 0; j < group_sizes[i]; ++j) {
					yield this.product_classes[i];
				}
			}
		}
	}

	populateShelves() {
		let gen = this.genProduct();
		let targets = new Array(this.items.length);
		targets.fill(Math.floor(this.product_info.count / this.items.length));
		for (let i = 0; targets.reduce((s, v) => { return s + v }) < this.product_info.count; ++i) {
			++targets[i];
		}

		for (let shelf in this.items) {

			if (this.items[shelf] instanceof Shelf) {
				this.items[shelf].clear();

				while (this.items[shelf].items.length < targets[shelf]) {
					this.items[shelf].push(new Product(gen.next().value));
				}
			}
		}

		this.product_classes = ldShuffle(this.product_classes);
	}
}


function parseItems(json_obj, item_arr, shelf_types_arr) {
	if (!Array.isArray(item_arr)) {
		throw new TypeError('parseItems requires an array-type object to build against');
	}
	if (Array.isArray(json_obj)) {
		for (let i = 0; i < json_obj.length; ++i) {
			item_arr = parseItems(json_obj[i], item_arr, shelf_types_arr);
		}
	} else {
		json_obj = Object.assign(json_obj, shelf_types_arr.find(item => item.name === json_obj.name));


		item_arr.push(new Shelf(json_obj, OVERFLOW_CALLBACKS.FAIL));
	}
	return item_arr;
}

async function $asElement(item) {
	let $DOM = $('<div></div>');
	$DOM.css('background-image', 'url(' + item.URI + ')');
	$DOM.css('background-position', 'center');
	$DOM.css('flex-grow', item.shelf_proportion);

	if (item instanceof Product) {
		// $DOM = $('<div></div>');
		// $DOM.append($('<img src="' + item.URI + '">'));
		// $DOM = $('<img src="' + item.URI + '">');
		$DOM.addClass('product ' + item.name);
	} else if (item instanceof Shelf) {
		$DOM.css('flex-direction', item.pack_from);
		$DOM.css('padding-top', item.bounds.top);
		$DOM.css('padding-bottom', item.bounds.bottom);
		$DOM.addClass('shelf ' + item.name);
	} else {
		throw new TypeError('Expected shelf rack item');
	}

	return $DOM;
}

export async function $buildDOM(item) {
	let $DOM = await $asElement(item);
	if (Array.isArray(item.items)) {
		for (let nested of item.items) {
			$DOM.append(await $buildDOM(nested));
		}
	}
	return $DOM;
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
export async function $newLayout($container_DOM, product_scale, rack) {
	let $rack_DOM = $container_DOM;
	for (let item of rack.items) {
		$rack_DOM.append(await $buildDOM(item));
	}

	$rack_DOM.find('.shelf').css('height', 100 / rack.items.length + '%');
	$rack_DOM.find('.product').each(function () {
		$(this).css('width', '100%');
		$(this).css('margin-top', ((100 - (product_scale * 100)) * $(this).height()) / 100 + 'px');
	});

	return $rack_DOM;
}
