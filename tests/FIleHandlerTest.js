const FileHandler = require("../lib/FileHandler");

const filePath = "./big.file";
const brickSize = 256;

const fh = new FileHandler(filePath, brickSize);

fh.saveFile((err) => {
    if (err) {
        throw err;
    }

    console.log("Donne");
});