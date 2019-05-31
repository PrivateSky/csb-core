
function EDFSServiceProxy(url) {

    function addBrick(brick, callback) {
        $$.remote.doHttpPost(url + "/CSB/" + brick.generateHash(), brick.getData(), (err) => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    function getBrick(brickHash, callback) {
        $$.remote.doHttpGet(url + "/CSB/" + brickHash, (err, data) =>{
            if (err) {
                return callback(err);
            }

            callback(undefined, data);
        });
    }

    function deleteBrick(brickHash) {
        throw new Error("Not implemented");
    }

    return {
        addBrick,
        getBrick,
        deleteBrick
    };
}

module.exports = EDFSServiceProxy;
