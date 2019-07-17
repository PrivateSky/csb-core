require("psk-http-client");
const bar = require("bar");


function EDFSBrickStorage(url) {

    this.putBrick = function (brick, callback) {
        $$.remote.doHttpPost(url + "/EDFS/" + brick.getHash(), brick.getData(), callback);
    };

    this.getBrick = function (brickHash, callback) {
        $$.remote.doHttpGet(url + "/EDFS/" + brickHash, callback);
    };

    this.deleteBrick = function (brickHash, callback) {
        throw new Error("Not implemented");
    };

    this.getBarMap = function (mapDigest, callback) {
        if (typeof mapDigest === "function") {
            callback = mapDigest;
            mapDigest = undefined;
        }

        if (typeof mapDigest === "undefined") {
            return callback(undefined, new bar.FolderBarMap());
        }

        this.getBrick(mapDigest, (err, mapBrick) => {
            callback(err, new bar.FolderBarMap(JSON.parse(mapBrick.toString())));
        });
    }
}

module.exports.createEDFSBrickStorage = function (url) {
    return new EDFSBrickStorage(url);
};
