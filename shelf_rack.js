class Item {
	constructor(name, URI, shelf_proportion) {
		this.name = name;
		this.URI = URI;
		this.shelf_proportion = shelf_proportion;
	}
}

export class Product extends Item {
	constructor(json_product_obj) {
		super(json_product_obj.name, json_product_obj.URI, json_product_obj.shelf_proportion);
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
		super(json_shelf_obj.name, json_shelf_obj.URI, json_shelf_obj.shelf_proportion);
		this.overflow_callback = overflow_callback;
		this.pack_from = json_shelf_obj.pack_from;
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
			this.items.push(item);
		}
	}
}

export class ShelfRack {
	constructor(layout_arr, item_type_arr) {
		this.items = [];
		this.items = parseItems(layout_arr, this.items, item_type_arr);

		if (this.items.length > 0) {
			for (let index in this.items) {
				if (!(this.items[index] instanceof Shelf)) {
					throw new TypeError('ShelfRack top level must consist only of Shelf objects');
				}
			}
		}
	}
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
		console.log(json_obj);
		if (!json_obj.hasOwnProperty('shelf_proportion')) {
			console.log('FUCK');
			json_obj.shelf_proportion = 1;
		}

		if (json_obj.type === 'shelf') {
			item_arr.push(new Shelf(json_obj, OVERFLOW_CALLBACKS.FAIL));
		} else if (json_obj.type === 'product') {
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

async function getImageProps(URL) {
	return await new Promise(resolve => {
		let img = new Image();
		img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.src = URL;
	});
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

function $itemArrayToDOM(items_arr) {}
