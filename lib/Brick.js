const pskCrypto = require("pskcrypto");

function Brick(data) {

    this.generateHash = function () {
        return pskCrypto.hashValues(data);
    };

    this.getData = function () {
        return data;
    }
}

module.exports = Brick;