const DSeedCage = require("../utils/DseedCage");
const RootCSB = require("./RootCSB");

function EDFS(){

    this.getDseedCage = function (localFolder) {
        return new DSeedCage(localFolder);
    };

    this.getRootCSB = function (csbIdentifier) {
        return new RootCSB(undefined, undefined, csbIdentifier);
    };
}

module.exports = EDFS;