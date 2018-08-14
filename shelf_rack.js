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
		// TODO:
		// 1.   check if we have room for another product (width measurement), invoke overflow callback if there's no room
		// 1.1  this could potentially be deferred until rendering

		if (item instanceof Item) {
			this.items.push(item);
		} else {
			throw new TypeError('Shelves can only accept Items');
		}
	}

	clear() {
		this.items.splice(0, this.items.length);
	}

}

export class ShelfRack {
	constructor(layout_arr, item_classes, product_obj, dimensions) {

		this.product_classes = item_classes.products;

		this.shelf_classes = item_classes.shelves;

		this.items = parseItems(layout_arr, [], this.shelf_classes);
		if (this.items.length === 0) {
			throw new Error('ShelfRack contains zero items');
		}

		this.product_info = product_obj;

		this.items[0].bounds.bottom /= 2;

		this.dimensions = dimensions;
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
	*genProduct(skip_to_next) {
		let group_sizes = new Array(this.product_classes.length);
		group_sizes.fill(Math.floor(this.product_info.count / this.product_classes.length));
		for (let remainder = this.product_info.count - group_sizes.reduce((s, v) => { return s + v }); remainder > 0; --remainder) {
			group_sizes[remainder]++;
		}

		while (true) {
			for (let i = 0; i < this.product_classes.length; ++i) {
				for (let j = 0; j < group_sizes[i]; ++j) {
					yield this.product_classes[i];
					if (skip_to_next === true) continue;
				}
			}
		}
	}

	async generateProducts() {
		let products = [];
		const shelf_height = this.dimensions.y / this.items.length;
		const total_space = this.dimensions.x * this.items.length;
		const tallest = await this.tallestProduct();

		for (const v of this.product_classes) {
			let new_item = new Product(v);
			new_item.dim = await imageDimensions(v.URI);
			new_item.resolved_width = new_item.dim.x * (shelf_height / tallest.height);
			products.push(new_item);
		}

		const widest = (() => {
			let out = products[0];
			for (const product of products) {
				if (product.resolved_width > out.resolved_width) {
					out = product;
				}
			}
			return out;
		})();

		const slimmest = (() => {
			let out = products[0];
			for (const product of products) {
				if (product.resolved_width < out.resolved_width) {
					out = product;
				}
			}
			return out;
		})();

		const group_sizes = await (async () => {
			let gs = [];

			const allowed_width = (0.8 * total_space) / this.product_classes.length;

			for (const product of products) {
				gs.push(Math.round(allowed_width / product.resolved_width));
			}
			return gs;
		})();

		let upsample = [];
		for (let p_index in products) {
			upsample.push(Array(group_sizes[p_index]).fill(products[p_index]));
		}
		this.product_classes = ldShuffle(this.product_classes);

		return upsample;
	}

	async populateShelves() {
		const fitted_product_collection = await this.generateProducts();
		const amount_per_shelf = Math.ceil(fitted_product_collection.length / this.items.length);
		for (let shelf in this.items) {
			this.items[shelf].clear();
			let groups_to_push = fitted_product_collection.splice(0, amount_per_shelf);
			for (const group of groups_to_push) {
				this.items[shelf].items = this.items[shelf].items.concat(group);
			}
		}
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

function loadImage(URI) {
	return new Promise(res => {
		let img = new Image();
		img.addEventListener('load', () => res(img));
		img.src = URI;
	})
}

async function imageDimensions(URI) {
	let img = await loadImage(URI);
	return { x: img.width, y: img.height };
}

async function $asElement(e_item, tallest, rack) {
	let $DOM = $('<div></div>');
	$DOM.css('background-image', 'url(' + e_item.URI + ')');
	$DOM.css('background-position', 'center');

	if (e_item instanceof Product) {
		$DOM.addClass('product');
		$DOM.attr('id', e_item.name);
		const sf = (e_item.dim.y / tallest.height);
		$DOM.css('flex-basis', e_item.resolved_width);
		$DOM.css('height', sf * 100 + '%');
	} else if (e_item instanceof Shelf) {
		$DOM.css('flex-direction', e_item.pack_from);
		$DOM.css('height', rack.dimensions.y / rack.items.length);
		$DOM.css('padding-top', e_item.bounds.top);
		$DOM.css('padding-bottom', e_item.bounds.bottom);
		$DOM.addClass('shelf ' + e_item.name);
	} else {
		throw new TypeError('Expected shelf rack item');
	}

	return $DOM;
}

async function $buildDOM(item, tallest, rack) {
	let $DOM = await $asElement(item, tallest, rack);
	if (Array.isArray(item.items)) {
		for (let nested of item.items) {
			$DOM.append(await $buildDOM(nested, tallest, rack));
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

		$rack_DOM.append(await $buildDOM(item, await rack.tallestProduct(), rack));
	}

	$rack_DOM.find('.product').each(function () {
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
