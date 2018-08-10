import ldShuffle from 'lodash/shuffle'


class Item {
	constructor(name, URI) {
		this.name = name;
		this.URI = URI;
	}
}

class Product extends Item {
	constructor(json_product_obj) {
		super(json_product_obj.name, json_product_obj.URI);
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

		super(json_shelf_obj.name, json_shelf_obj.URI);
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

		this.product_classes = item_classes.products;

		this.shelf_classes = item_classes.shelves;

		this.items = parseItems(layout_arr, [], this.shelf_classes);
		this.product_info = product_obj;

		console.log(this.items.length);
		this.items[0].bounds.bottom /= 2;
	}

	async tallestProduct() {
		let largest_product = {
			height: 0,
			width: 0
		};
		for (const product in this.product_classes) {
			const dim = await imageDimensions(this.product_classes[product].URI);
			if (dim.y > largest_product.height) {
				largest_product.width = dim.x;
				largest_product.height = dim.y;
			}
		}
		return largest_product;
	}

	async smallestProduct() {
		let smallest_product = await this.tallestProduct();
		for (const product in this.product_classes) {
			const dim = await imageDimensions(this.product_classes[product].URI);
			if (dim.y < smallest_product.height) {
				smallest_product.width = dim.x;
				smallest_product.height = dim.y;
			}
		}
		console.log(smallest_product);
		return smallest_product;
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

	async populateShelves() {
		let gen = this.genProduct();
		let targets = new Array(this.items.length);
		targets.fill(Math.floor(this.product_info.count / this.items.length));
		for (let i = 0; targets.reduce((s, v) => { return s + v }) < this.product_info.count; ++i) {
			++targets[i];
		}

		for (let shelf in this.items) {

			if (this.items[shelf] instanceof Shelf) {
				console.warn(this.items[shelf].bounds.bottom);
				this.items[shelf].clear();
				// let used_width = 0;
				// let shelf_dim = await imageDimensions(this.items[shelf].URI);
				// console.log(shelf_dim);
				// console.log("shelf: " + shelf_dim.x);
				// while (used_width < shelf_dim.x) {
				// 	this.items[shelf].push(new Product(gen.next().value));

				// 	const product_dim = await imageDimensions(this.items[shelf].items[this.items[shelf].items.length - 1].URI);
				// 	used_width += product_dim.x;
				// 	console.log("prod: " + product_dim.x);
				// 	console.log("used:" + used_width);
				// }

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

function imageDimensions(URI) {
	let img = new Image();
	img.src = URI;
	return new Promise(res => { img.onload = res({ x: img.width, y: img.height }); });
}

async function $asElement(tallest, item) {
	let $DOM = $('<div></div>');
	$DOM.css('background-image', 'url(' + item.URI + ')');
	$DOM.css('background-position', 'center');

	if (item instanceof Product) {
		const dim = await imageDimensions(item.URI);
		$DOM.addClass('product ' + item.name);
		$DOM.attr('id', item.name);
		$DOM.css('flex-basis', dim.x);
		const sf = (dim.y / tallest.height);
		$DOM.css('height', sf * 100 + '%');
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

async function $buildDOM(tallest, smallest, item, shelf_height, shelf_count) {
	//console.log('ye');
	let $DOM = await $asElement(tallest, item);
	if (Array.isArray(item.items)) {
		const shelf_dim = await imageDimensions(item.URI);
		let remaining_width = shelf_dim.x;
		console.log(smallest);


		//console.log('rem: ' + remaining_width + '\tsmallest.width: ' + smallest.width * (Math.min((shelf_height) * (shelf_count), tallest.height) / Math.max((shelf_height) * (shelf_count), tallest.height)) * (1.5 * shelf_count))
		for (let nested of item.items) {
			const item_dim = await imageDimensions(nested.URI);
			const needed_space = item_dim.x * (Math.min((shelf_height) * (shelf_count), tallest.height) / Math.max((shelf_height) * (shelf_count), tallest.height)) * 0.75;
			if (remaining_width - needed_space >= 0) {
				remaining_width -= needed_space;
				$DOM.append(await $buildDOM(tallest, smallest, nested));
			}
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
export async function $newLayout($container_DOM, product_scale, rack, mouseover_classes) {
	let $rack_DOM = $container_DOM;
	for (let item of rack.items) {
		$rack_DOM.append(await $buildDOM(await rack.tallestProduct(), await rack.smallestProduct(), item, $container_DOM.height() / rack.items.length, rack.items.length));
	}

	$rack_DOM.find('.shelf').css('height', 100 / rack.items.length + '%');
	$rack_DOM.find('.product').each(function () {
		//$(this).css('width', '100%');
		for (const css_class of mouseover_classes) {

			$(this).hover(
				function () {
					$(this).addClass(css_class);
				}, function () {
					$(this).removeClass(css_class);
				}
			);


		}

	});

	return $rack_DOM;
}
