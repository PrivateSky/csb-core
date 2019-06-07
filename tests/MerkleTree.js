const crypto = require("crypto");
function MerkleTree(leaves, hashFunction) {

    let root = null;

    function TreeNode(leftChild, rightChild) {
            if (typeof leftChild === "string") {
                this.left = null;
                this.right = null;
                this.hash = leftChild;
            }else{
                if(rightChild && rightChild.hash){
                    this.left = leftChild;
                    this.right = rightChild;
                    this.hash = hashFunction(leftChild.hash + rightChild.hash);
                }else{
                    return leftChild
                }
            }


    }

     this.createTree = function() {
        leaves = leaves.map(leaf => new TreeNode(hashFunction(leaf)));
         let height = Math.ceil(Math.log2(leaves.length));
         let level = leaves;
         while (height) {
             let aboveLevel = [];
             for (let i = 0; i < level.length; i += 2) {
                 aboveLevel.push(new TreeNode(level[i], level[i + 1]));
             }

             level = aboveLevel;
             height--;
         }

         root = level[0];
         return root;
    }
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

const mt = new MerkleTree(['a', 'b', 'c', 'd', 'e'], hashing);
console.log(mt.createTree().hash);
