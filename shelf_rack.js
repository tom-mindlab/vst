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
		// if (!(item instanceof Item)) {
		// 	throw new TypeError('Shelf push method expects Item object argument');
		// } else {
		// TODO:
		// 1.   check if we have room for another product (width measurement), invoke overflow callback if there's no room
		// 1.1  this could potentially be deferred until rendering
		// if (this.items.length < this.constraints.max) {
		// 	this.items.push(item);
		// } else {
		// 	throw new RangeError('shelf cannot accept more items (max of "' + this.constraints.max + '" already reached)');
		// }
		this.items.push(item);
		// }
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
		this.product_info = product_obj;

		// console.log(this.items.length);
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

	async fittedProductCollection() {

		let products = [];
		const tallest = await this.tallestProduct();
		console.error(tallest);
		const shelf_dim = await imageDimensions(this.items[0].URI);
		console.error(shelf_dim);
		const total_space = shelf_dim.x * this.items.length; // megashelf width
		const shelf_height = this.dimensions.y / this.items.length;
		console.log("this.dimensions");
		console.log(this.dimensions);
		console.log(tallest);
		for (const v of this.product_classes) {
			let new_item = new Product(v);
			new_item.dim = await imageDimensions(v.URI);
			new_item.resolved_width = (new_item.dim.x * (shelf_height * this.items.length) / tallest.height);
			console.log('resolved width is: ' + new_item.resolved_width);
			console.log('native width is: ' + new_item.dim.x)
			products.push(new_item);
		}

		console.log('products[]:');
		console.warn(products);
		console.groupEnd();

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

		console.group('widest:');
		console.warn(widest);
		console.groupEnd();

		console.group('slimmest:');
		console.warn(slimmest);
		console.groupEnd();

		function normaliseToRange(x, t_min, t_max) {
			return (((x - slimmest.resolved_width) / (widest.resolved_width - slimmest.resolved_width)) * (t_max - t_min) + t_min);
		}

		const scale_factors = (() => {
			let sf = [];
			let average_width = products.reduce((s, v) => (
				{ resolved_width: s.resolved_width + v.resolved_width }
			)).resolved_width / products.length;

			console.warn("aw: " + average_width);
			for (const product of products) {
				console.log('sfr: ' + normaliseToRange(product.resolved_width, average_width * 0.5, average_width * 1.5));
				sf.push(widest.resolved_width / normaliseToRange(product.resolved_width, average_width * 0.5, average_width * 1.5));
			}
			return sf;
		})();

		console.group('sf:');
		console.warn(scale_factors);
		console.groupEnd();

		const roundToNearest = function (x, N) {
			console.log('x: ' + x + ', N: ' + N);
			console.log('so: ' + N * Math.round(x / N));
			return N * Math.round(x / N);
		}


		// this is equal to the sum of the scale factors each rounded to the nearest integer
		const rounded_divisor = scale_factors.map((v) => {
			return Math.round(v);
		}).reduce((s, v) => {
			return s + v;
		});

		console.group('rd:');
		console.warn(rounded_divisor);
		console.groupEnd();

		const product_counts = (() => {
			let counts = [];
			for (const sf in scale_factors) {
				counts.push(Math.round(scale_factors[sf]));
			}
			return counts;
		})();
		console.log('here');
		console.warn(product_counts);
		console.log(product_counts.length);


		return (() => {
			let out = [];
			for (let i = 0; i < product_counts.length; ++i) {
				console.log(product_counts[i])
				for (let j = 0; j < product_counts[i]; ++j) {
					out.push(products[i]);
				}
			}
			return out;
		})();


	}

	async populateShelves() {
		// let gen = this.genProduct();
		// let targets = new Array(this.items.length);
		// targets.fill(Math.floor(this.product_info.count / this.items.length));
		// for (let i = 0; targets.reduce((s, v) => { return s + v }) < this.product_info.count; ++i) {
		// 	++targets[i];
		// }


		let fitted_product_collection = await this.fittedProductCollection();
		const amount_per_shelf = fitted_product_collection.length / this.items.length;
		console.log('fitted:');
		for (const p in fitted_product_collection) {
			console.log(fitted_product_collection[p]);
		}

		for (let shelf in this.items) {
			this.items[shelf].clear();
			this.items[shelf].items = fitted_product_collection.splice(0, amount_per_shelf + 1);
		}

		// for (let shelf in this.items) {


		// 	if (this.items[shelf] instanceof Shelf) {
		// 		this.items[shelf].clear();
		// 		// let used_width = 0;
		// 		// let shelf_dim = await imageDimensions(this.items[shelf].URI);
		// 		// console.log(shelf_dim);
		// 		// console.log("shelf: " + shelf_dim.x);
		// 		// while (used_width < shelf_dim.x) {
		// 		// 	this.items[shelf].push(new Product(gen.next().value));

		// 		// 	const product_dim = await imageDimensions(this.items[shelf].items[this.items[shelf].items.length - 1].URI);
		// 		// 	used_width += product_dim.x;
		// 		// 	console.log("prod: " + product_dim.x);
		// 		// 	console.log("used:" + used_width);
		// 		// }

		// 		// while (this.items[shelf].items.length < targets[shelf]) {
		// 		// 	this.items[shelf].push(new Product(gen.next().value));
		// 		// }

		// 		const shelf_dim = imageDimensions(this.items[shelf].URI);
		// 		let remaining_space = shelf_dim.x;

		// 		let tested_products = 0;
		// 		while(tested_products < this.product_classes.length)
		// 		{
		// 			const new_item = new Product(gen.next().value);
		// 			const item_dim = imageDimensions(new_item.URI);
		// 			const required_space = item_dim.x * (Math.min((shelf_height) * (shelf_count), tallest.height) / Math.max((shelf_height) * (shelf_count), tallest.height));
		// 			if(remaining_space - required_space > 0)
		// 			{
		// 				remaining_space -= required_space;
		// 				this.items[shelf].push(new_item);
		// 				tested_products = 0;
		// 			} else 
		// 			{
		// 				tested_products
		// 			}
		// 		}


		// 	}
		// }

		// this.product_classes = ldShuffle(this.product_classes);
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

async function $asElement(e_item, tallest) {
	let $DOM = $('<div></div>');
	$DOM.css('background-image', 'url(' + e_item.URI + ')');
	$DOM.css('background-position', 'center');

	if (e_item instanceof Product) {
		const dim = await imageDimensions(e_item.URI);
		$DOM.addClass('product ' + e_item.name);
		$DOM.attr('id', e_item.name);
		const sf = (e_item.dim.y / tallest.height);
		$DOM.css('flex-basis', e_item.resolved_width);

		$DOM.css('height', sf * 100 + '%');
	} else if (e_item instanceof Shelf) {
		$DOM.css('flex-direction', e_item.pack_from);
		$DOM.css('padding-top', e_item.bounds.top);
		$DOM.css('padding-bottom', e_item.bounds.bottom);
		$DOM.addClass('shelf ' + e_item.name);
	} else {
		throw new TypeError('Expected shelf rack item');
	}

	return $DOM;
}

// async function $buildDOM(tallest, smallest, item, shelf_height, shelf_count) {
// 	let $DOM = await $asElement(item);
// 	if (Array.isArray(item.items)) {
// 		const shelf_dim = await imageDimensions(item.URI);
// 		let remaining_width = shelf_dim.x;


// 		//console.log('rem: ' + remaining_width + '\tsmallest.width: ' + smallest.width * (Math.min((shelf_height) * (shelf_count), tallest.height) / Math.max((shelf_height) * (shelf_count), tallest.height)) * (1.5 * shelf_count))
// 		for (let nested of item.items) {
// 			const item_dim = await imageDimensions(nested.URI);
// 			const needed_space = item_dim.x * (Math.min((shelf_height) * (shelf_count), tallest.height) / Math.max((shelf_height) * (shelf_count), tallest.height)) * 0.75;
// 			if (remaining_width - needed_space >= 0) {
// 				remaining_width -= needed_space;
// 				$DOM.append(await $buildDOM(tallest, smallest, nested));
// 			}
// 		}


// 	}
// 	return $DOM;
// }

async function $buildDOM(item, tallest) {
	console.log('i: ' + item);
	let $DOM = await $asElement(item, tallest);
	if (Array.isArray(item.items)) {
		for (let nested of item.items) {
			$DOM.append(await $buildDOM(nested, tallest));
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

		$rack_DOM.append(await $buildDOM(item, await rack.tallestProduct()));
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
