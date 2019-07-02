const crypto = require("crypto");

/**
 *
 * @param leaves: Array, data upon which the Merkle tree is constructed
 * @param hashFunction: function, hashing function used to construct the Merkle tree
 * @constructor
 */

function MerkleTree(leaves, hashFunction) {

    let tree = null;

    this.createTree = function () {
        let exponent = Math.ceil(Math.log2(leaves.length)) + 1;
        tree = new Array((1 << exponent) - 1);
        leaves = leaves.map((leaf) => hashFunction(leaf));
        --exponent;
        for (let i = (1 << exponent) - 1; i < tree.length; i++) {
            const leafIndex = i - ((1 << exponent) - 1);
            if (leaves[leafIndex]) {
                tree[i] = leaves[leafIndex];
            }
        }

        while (exponent > 0) {
            for (let i = (1 << (exponent - 1)) - 1; i < (1 << exponent) - 1; i++) {
                if (tree[2 * i + 2]) {
                    tree[i] = hashFunction(tree[2 * i + 1] + tree[2 * i + 2]);
                } else {
                    tree[i] = tree[2 * i + 1];
                }

            }
            --exponent;
        }

        tree = tree.filter( (el) => el !== null && typeof el !== "undefined");

        return tree;
    };

    //TODO: empty function
    /*this.updateLeaf = function (leafIndex, newLeafData) {

    };*/
}

function hashing(data) {
    if (typeof data === 'object') {
        data = JSON.stringify(data);
    }

    data = Buffer.from(data);
    const hash = crypto.createHash("sha256");
    hash.update(data);

    return hash.digest("hex");

}

const mt = new MerkleTree([ 'a', 'b', 'c', 'd', 'e' ], hashing);
console.log(mt.createTree());
