class Item {
	constructor(name, URI, shelf_proportion) {
		this.name = name;
		this.URI = URI;
		this.shelf_proportion = shelf_proportion;
	}
}

export class Product extends Item {
	constructor(json_product_obj) {
		super(json_product_obj.name, json_product_obj.URI, 1);
	}
}

// TODO:
// all of these
const OVERFLOW_CALLBACKS = {
	SQUASH: function() {},
	OVERWRITE: {
		LEFT: function() {},
		RIGHT: function() {}
	},
	FAIL: function() {}
};

export class Shelf extends Item {
	constructor(json_shelf_obj, overflow_callback) {
		super(json_shelf_obj.name, json_shelf_obj.URI, 1);
		this.overflow_callback = overflow_callback;
		this.pack_from = json_shelf_obj.pack_from;
		this.items = [];
		this.constraints = json_shelf_obj.constraints;
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
			if (this.items.length < this.constraints.max) {
				this.items.push(item);
			} else {
				throw new RangeError('shelf cannot accept more items (max of "' + this.constraints.max + '" already reached)');
			}
		}
	}

	clear() {
		this.items.splice(0, this.items.length);
	}

	capacity() {
		let capacity = this.constraints.max || 0;
		for (let item of this.items) {
			if (item instanceof Shelf) {
				capacity += item.capacity();
			}
		}
		return capacity;
	}
}

export class ShelfRack {
	constructor(layout_arr, item_type_arr, product_obj) {
		this.items = [];
		this.items = parseItems(layout_arr, this.items, item_type_arr);
		this.product_info = product_obj;

		// holy fuck this is bad code, needs a refactor (change in the config structure)... cba right now (16/07/18)
		this.product_classes = (() => {
			let arr = [];
			for (let item_type of item_type_arr) {
				if (item_type.type === 'product') {
					arr.push(item_type);
				}
			}
			return arr;
		})();

		this.shelf_classes = (() => {
			let arr = [];
			for (let item_type of item_type_arr) {
				if (item_type.type === 'shelf') {
					arr.push(item_type);
				}
			}
			return arr;
		})();

		if (this.product_info.count > rack_capacity(this.items)) {
			throw new RangeError(
				'Shelf rack capacity (' +
					rack_capacity(this.items) +
					') cannot contain required amount of products (' +
					this.product_info.count +
					')'
			);
		}

		if (this.items.length > 0) {
			for (let index in this.items) {
				if (!(this.items[index] instanceof Shelf)) {
					throw new TypeError('ShelfRack top level must consist only of Shelf objects');
				}
			}
		}
	}

	*genProduct() {
		let i = Math.floor(Math.random() * this.product_classes.length);
		let group_size = this.product_info.count / (this.product_classes.length * this.items.length);
		while (true) {
			if (i >= this.product_classes.length) {
				i = 0;
			}
			for (let j = 0; j < group_size * this.product_classes[i].bias; ++j) {
				yield this.product_classes[i];
			}
			i++;
		}
	}

	populateShelves() {
		for (let shelf of this.items) {
			if (shelf instanceof Shelf) {
				shelf.clear();
				// todo:
				// instead of randomising, utilise product_info.count?
				let target = Math.floor(Math.random() * (shelf.constraints.max - shelf.constraints.min + 1)) + shelf.constraints.min;
				let gen = this.genProduct();
				while (shelf.items.length < target) {
					shelf.push(new Product(gen.next().value));
				}
			}
		}
	}
}

// why isnt this a member function?? dont remember
function rack_capacity(shelf_rack_items) {
	let cap = 0;
	for (let item in shelf_rack_items) {
		cap += shelf_rack_items[item].capacity();
	}
	return cap;
}

function parseItems(json_obj, item_arr, item_types_arr) {
	if (!Array.isArray(item_arr)) {
		throw new TypeError('parseItems requires an array-type object to build against');
	}
	if (Array.isArray(json_obj)) {
		for (let i = 0; i < json_obj.length; ++i) {
			item_arr = parseItems(json_obj[i], item_arr, item_types_arr);
		}
	} else {
		json_obj = Object.assign(json_obj, item_types_arr.find(item => item.name === json_obj.name));

		if (json_obj.type === 'shelf') {
			item_arr.push(new Shelf(json_obj, OVERFLOW_CALLBACKS.FAIL));
		} else if (json_obj.type === 'product') {
			if (!json_obj.hasOwnProperty('bias')) {
				json_obj.bias = 1;
			}
			item_arr.push(new Product(json_obj));
		} else {
			throw new Error('parsed json object with invalid "type" property: ' + json_obj.type);
		}
		// here we scan for nested items
		for (let key in json_obj) {
			if (Array.isArray(json_obj[key])) {
				item_arr[item_arr.length - 1].items = parseItems(json_obj[key], item_arr[item_arr.length - 1].items, item_types_arr);
			}
		}
	}
	return item_arr;
}

async function $asElement(item) {
	let $DOM = $('<div></div>');
	$DOM.css('background-image', 'url(' + item.URI + ')');
	$DOM.css('background-position', 'center');
	$DOM.css('flex-grow', item.shelf_proportion);

	if (item instanceof Product) {
		$DOM.addClass('product ' + item.name);
	} else if (item instanceof Shelf) {
		$DOM.css('flex-direction', item.pack_from);
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
