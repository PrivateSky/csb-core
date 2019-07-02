const pskCrypto = require("pskcrypto");

function Brick(data) {
    if (typeof data === "string") {
        data = Buffer.from(data);
    }

    this.generateHash = function () {
        return pskCrypto.pskHash(data).toString("hex");
    };

    this.getData = function () {
        return data;
    };
}

module.exports = Brick;