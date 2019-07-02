const pskdb = require("pskdb");

function EDFSBlockchainProxy() {

	const blockchain = pskdb.startInMemoryDB();

	this.getCSBAnchor = function (csbIdentifier, callback) {
		const transaction = blockchain.beginTransaction({});
		const asset = transaction.lookup("global.CSBAnchor", csbIdentifier.getUid());
		callback(undefined, asset);
	};

	this.setCSBAnchor = function (csbAnchor, callback) {
		const transaction = blockchain.beginTransaction({});
		transaction.add(csbAnchor);
		blockchain.commit(transaction);
		callback();
	};
}

module.exports = EDFSBlockchainProxy;