import ldShuffle from 'lodash/shuffle'

class Item {
	constructor(name, URI) {
		this.name = name;
		this.URI = URI;
	}
}

class Product extends Item {
	constructor(product_class) {
		super(product_class.name, product_class.URI);
		this.dimensions = product_class.dimensions;
		this.resolved_dimensions = product_class.resolved_dimensions;
		this.counts = product_class.counts;
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
		this.item_groups = [];
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

		this.items[0].bounds.bottom /= this.items.length;

		this.dimensions = dimensions;
	}

	tallestProduct() {
		let largest_product = this.product_classes[0];
		for (const product of this.product_classes) {
			if (product.dimensions.y > largest_product.dimensions.y) {
				largest_product = product;
			}
		}
		return largest_product;
	}

	shortestProduct() {
		let smallest_product = this.tallestProduct();
		for (const product of this.product_classes) {
			if (product.dimensions.y < smallest_product.dimensions.y) {
				smallest_product = product;
			}
		}
		console.log(smallest_product);
		return smallest_product;
	}

	widestProduct() {
		let widest_product = this.product_classes[0];
		for (const product of this.product_classes) {
			if (product.resolved_dimensions.x > widest_product.resolved_dimensions.x) {
				widest_product = product;
			}
		}
		return widest_product;
	}

	slimmestProduct() {
		let slimmest_product = this.widestProduct();
		for (const product of this.product_classes) {
			if (product.resolved_dimensions.x < slimmest_product.resolved_dimensions.x) {
				slimmest_product = product;
			}
		}
		return slimmest_product;
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

	// async generateProducts() {
	// 	let products = [];
	// 	const shelf_height = this.dimensions.y / this.items.length;
	// 	const total_space = this.dimensions.x * this.items.length;
	// 	const tallest = await this.tallestProduct();

	// 	for (const v of this.product_classes) {
	// 		let new_item = new Product(v);
	// 		new_item.dim = await imageDimensions(v.URI);
	// 		new_item.resolved_width = new_item.dim.x * (shelf_height / tallest.height);
	// 		products.push(new_item);
	// 	}

	// 	const group_sizes = await (async () => {
	// 		let gs = [];

	// 		const allowed_width = (0.8 * total_space) / this.product_classes.length;

	// 		for (const product of products) {
	// 			gs.push(Math.round(allowed_width / product.resolved_width));
	// 		}
	// 		return gs;
	// 	})();

	// 	let upsample = [];
	// 	for (let p_index in products) {
	// 		upsample.push(Array(group_sizes[p_index]).fill(products[p_index]));
	// 	}
	// 	this.product_classes = ldShuffle(this.product_classes);

	// 	return upsample;
	// }

	// async populateShelves() {
	// 	const fitted_product_collection = await this.generateProducts();
	// 	const amount_per_shelf = Math.ceil(fitted_product_collection.length / this.items.length);
	// 	for (let shelf in this.items) {
	// 		this.items[shelf].clear();
	// 		let groups_to_push = fitted_product_collection.splice(0, amount_per_shelf);
	// 		for (const group of groups_to_push) {
	// 			this.items[shelf].items = this.items[shelf].items.concat(group);
	// 		}
	// 	}
	// }

	async generateBoundedProducts() {

		// if shelf dimensions haven't already been resolved, do this now
		// clear the current products out here too
		for (let shelf_index in this.items) {
			if (typeof this.items[shelf_index].dimensions == "undefined") {
				this.items[shelf_index].dimensions = await imageDimensions(this.items[shelf_index].URI);
				this.items[shelf_index].resolved_dimensions = {
					x: this.items[shelf_index].dimensions.x,
					y: this.dimensions.y / this.items.length
				};
			}

			this.items[shelf_index].item_groups.splice(0);
		}


		for (let product of this.product_classes) {
			if (typeof product.dimensions == "undefined") {
				product.dimensions = await imageDimensions(product.URI);
			}
		}
		// if product dimensions haven't already been resolved, do this now
		const scale_factor = this.tallestProduct().dimensions.y / this.items[0].resolved_dimensions.y; // how much we had to scale the tallest product to fit
		for (let product of this.product_classes) {
			product.resolved_dimensions = {
				x: product.dimensions.x / scale_factor,
				y: product.dimensions.y / scale_factor
			};
		}

		console.log(this.product_classes);

		let product_groups = [];
		const groupsPerShelf = () => {
			return product_groups.length / this.items.length;
		};
		const groupProductWidth = (group) => {
			return group[0].resolved_dimensions.x;
		}
		const groupWidth = (group) => {
			let cumulative_width = 0;
			for (let product of group) {
				cumulative_width += product.resolved_dimensions.x;
			}
			return cumulative_width;
		};

		// generate mandatory products
		for (let product of this.product_classes) {
			// products with a minimum count are considered mandatory
			// push these products within the range of min to max
			// if max is undefined, only min will be added in this stage
			if (typeof product.counts != "undefined" && typeof product.counts.min != "undefined") {
				const max = (typeof product.counts.max != "undefined") ? product.counts.max : product.counts.min;
				const count = Math.floor(Math.random() * (max - product.counts.min + 1)) + product.counts.min; // inclusive random range from min to max
				product_groups.push(Array(count).fill(new Product(product)));
			}
		}

		// distribute what we have randomly between the shelves
		// do this by attempting to push to shelves in a random order
		// if no shelf could accomodate the group, this is considered a fail case (not all requirements in the config could be met)
		const tryRandomPushToShelves = (p_group) => {
			let target_shelves = [];
			for (let i = 0; i < this.items.length; ++i) {
				target_shelves.push(i);
			}
			target_shelves = ldShuffle(target_shelves);
			for (let shelf_index of target_shelves) {
				if (this.items[shelf_index].dimensions.x >= groupWidth(p_group)) {
					this.items[shelf_index].item_groups.push(p_group);
					return true;
				}
			}
			return false;
		}

		for (let p_group of product_groups) {
			if (tryRandomPushToShelves(p_group) === false) {
				throw new Error("Shelf configuration cannot accomodate the minimum required products");
			}
		}

		// [x] now essential products are placed, we take measurments to determine how much room we have left to work with
		// [x] leftover room is first filled with one of each unplaced products (chosen randomly)
		// [x] if there is still room, we now randomly upscale any group which is below its maximum, if it has one defined, and on the condition that there is room

		// grab the list of product types we haven't used, make an array of groups size 1; upscale later

		let optional_product_groups = (() => {
			let out = [];
			for (let product of this.product_classes) {
				// check first for the counts field, if this exists, then check for the minimum count - products that fail both are optional and haven't been placed
				if (typeof product.counts == "undefined" || typeof product.counts.min == "undefined") {
					out.push([new Product(product)]);
				}
			}
			return out;
		})();


		const groups_per_shelf = Math.ceil((product_groups.length + optional_product_groups.length) / this.items.length);
		// raise the groups per shelf so groups are evenly distributed (bias towards upper shelves)
		for (let shelf_index in this.items) {
			if (groups_per_shelf - this.items[shelf_index].item_groups.length > 0) {
				this.items[shelf_index].item_groups = this.items[shelf_index].item_groups.concat(optional_product_groups.splice(0, groups_per_shelf - this.items[shelf_index].item_groups.length));
				let cumulative_width = (groups) => {
					let cumulative_width = 0;
					for (const pg of groups) {
						cumulative_width += groupWidth(pg);
					}
					return cumulative_width;
				};
				if (cumulative_width(this.items[shelf_index].item_groups) > this.items[shelf_index].dimensions.x) {
					const compareGroupProductWidth = (l, r) => {
						if (l[0].dimensions.x < r[0].dimensions.x) {
							return -1;
						}
						if (l[0].dimensions.x > r[0].dimensions.x) {
							return 1;
						}
						return 0;
					};
					let groups_by_width = this.items[shelf_index].item_groups.sort(compareGroupProductWidth);
					console.warn(groups_by_width);
					while (cumulative_width(groups_by_width) > this.items[shelf_index].dimensions.x) {
						groups_by_width.pop();
					}
					this.items[shelf_index].item_groups = groups_by_width;
				}
			}
		}

		for (let shelf_index in this.items) {
			let used_width = (() => {
				let used_width = 0;
				for (const p_group of this.items[shelf_index].item_groups) {
					used_width += groupWidth(p_group);
				}
				return used_width;
			})();

			const remainingWidth = () => {
				return this.items[shelf_index].resolved_dimensions.x - used_width;
			};

			const upscalableGroups = () => {
				let upscalable_groups = [];
				for (const p_group of this.items[shelf_index].item_groups) {
					if (groupProductWidth(p_group) < remainingWidth()) {
						if (typeof p_group[0].counts != "undefined" && typeof p_group[0].counts.max != "undefined") {
							console.log('attempting to upscale a group with a counts.max property (' + p_group[0].name + ')');
							if (p_group.length < p_group[0].counts.max) {
								upscalable_groups.push(p_group);
							}
						} else {
							upscalable_groups.push(p_group);
						}
					}
				}
				return upscalable_groups;
			};



			for (let upscalable_groups = upscalableGroups(); upscalable_groups.length != 0; upscalable_groups = upscalableGroups()) {
				const rnd_group = Math.floor(Math.random() * upscalable_groups.length);
				upscalable_groups[rnd_group].push(upscalable_groups[rnd_group][0]);
				used_width += groupProductWidth(upscalable_groups[rnd_group]);
			}

			this.items[shelf_index].item_groups = ldShuffle(this.items[shelf_index].item_groups);
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
		const sf = (e_item.dimensions.y / tallest.dimensions.y);
		$DOM.css('flex-basis', e_item.resolved_dimensions.x);
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
	if (Array.isArray(item.item_groups)) {
		for (let p_group of item.item_groups) {
			for (const product of p_group) {
				$DOM.append(await $buildDOM(product, tallest, rack));
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

	console.log($rack_DOM);
	return $rack_DOM;
}
