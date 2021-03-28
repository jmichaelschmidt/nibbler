"use strict";

// Non-blocking loader objects. Currently just for books. The callback is only called if data is successfully gathered.
// Implementation rule: The callback property is non-null iff it's possible that the load will succeed.
// ------------------------------------------------------------------------------------------------------------------------------

function NewPolyglotBookLoader(filename, callback) {

	let loader = Object.create(null);
	loader.type = "book";							// hub looks at this
	loader.callback = callback;

	loader.abort = function() {
		this.callback = null;
	};

	loader.load = function(filename) {
		fs.readFile(filename, (err, data) => {		// Docs: "If no encoding is specified, then the raw buffer is returned."
			if (err) {
				console.log(err);
				this.abort();
				return;
			}
			if (this.callback) {
				let cb = this.callback; cb(data);
				this.callback = null;
			}
		});
	};

	loader.load(filename);
	return loader;
}

// ------------------------------------------------------------------------------------------------------------------------------

function NewPGNBookLoader(filename, callback) {

	let loader = Object.create(null);
	loader.type = "book";							// hub looks at this
	loader.callback = callback;

	loader.buf = null;
	loader.book = [];
	loader.pgn_choices = null;
	loader.n = 0;

	loader.abort = function() {
		this.callback = null;
		this.buf = null;							// For the GC's benefit
		this.book = null;							// For the GC's benefit
	};

	loader.load = function(filename) {
		fs.readFile(filename, (err, data) => {
			if (err) {
				console.log(err);
				this.abort();
				return;
			}
			if (this.callback) {					// We might already have aborted
				this.buf = data;
				this.continue();
			}
		});
	};

	loader.continue = function() {

		if (!this.callback) {
			return;
		}

		let continuetime = performance.now();

		if (!this.pgn_choices) {
			this.pgn_choices = PreParsePGN(this.buf);
			setTimeout(() => {this.continue();}, 5);
		}

		while (true) {

			if (this.n >= this.pgn_choices.length) {
				this.finish();
				return;
			}

			let o = this.pgn_choices[this.n];

			try {
				let root = LoadPGNRecord(o);					// Note that this calls DestroyTree() itself if needed.
				this.book = AddTreeToBook(root, this.book);
				DestroyTree(root);
			} catch (err) {
				//
			}

			this.n++;

			if (this.n % 100 === 0) {
				if (performance.now() - continuetime > 20) {
					setTimeout(() => {this.continue();}, 5);
					return;
				}
			}
		}
	};

	loader.finish = function() {
		if (this.book && this.callback) {
			SortAndDeclutterPGNBook(this.book);
			let cb = this.callback; cb(this.book);
		}
		this.abort();
	};

	loader.load(filename);
	return loader;
}