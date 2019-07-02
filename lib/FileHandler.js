const fs = require("fs");
const EDFSServiceProxy = require("./EDFSServiceProxy");
const Brick = require("./Brick");
const pskCrypto = require("pskcrypto");
const AsyncDispatcher = require("../utils/AsyncDispatcher");
const url = "http://localhost:8080";

function FileHandler(filePath, brickSize, fileBricksHashes, lastBrickSize) {

    const edfsServiceProxy = new EDFSServiceProxy(url);


    this.getFileBricksHashes = function () {
        return fileBricksHashes;

    };

    this.saveFile = function (callback) {
        __initialSaving(callback);
    };

    function __initialSaving(callback) {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                return callback((err));
            }

            lastBrickSize = stats.size % brickSize;
            const fileSize = stats.size;

            fs.open(filePath, "r", (err, fd) => {
                if (err) {
                    return callback(err);
                }

                const asyncDispatcher = new AsyncDispatcher((errors, results) => {
                    callback();
                });

                const noBricks = Math.round(fileSize / brickSize + 1);
                asyncDispatcher.dispatchEmpty(noBricks);

                for (let i = 0; i < noBricks; i++) {
                    let brickData = Buffer.alloc(brickSize);
                    fs.read(fd, brickData, 0, brickSize, i * brickSize, (err, bytesRead, buffer) => {
                        if (err) {
                            return callback(err);
                        }

                        const brick = new Brick(buffer);
                        edfsServiceProxy.addBrick(brick, (err) => {

                            if (err) {
                                return callback(err);
                            }

                            asyncDispatcher.markOneAsFinished();
                        });
                    });
                }
            });
        });
    }

    function __readFileFromStart(fd, brickSize, fileSize, position, bricksHashes = [], callback) {
        let brickData = Buffer.alloc(brickSize);
        fs.read(fd, brickData, 0, brickSize, position, (err, bytesRead, buffer) => {
            if (err) {
                return callback(err);
            }

            position += brickSize;
            bricksHashes.push(pskCrypto.pskHash(buffer));
            if (position <= fileSize) {
                __readFileFromStart(fd, brickSize, fileSize, position, bricksHashes, callback);
            }else{
                lastBrickSize = bytesRead;
                callback(undefined, bricksHashes);
            }
        });
    }

    function __readFileBackwards(fd, brickSize, fileSize, position = lastBrickSize, bricksHashes = [], callback) {

        let brickData = Buffer.alloc(brickSize);
        fs.read(fd, brickData, 0, brickSize, fileSize - position, (err, bytesRead, buffer) => {
            if (err) {
                return callback(err);
            }

            bricksHashes.push(pskCrypto.pskHash(buffer));
            if (position <= fileSize) {
                position += brickSize;
                __readFileBackwards(fd, brickSize, fileSize, position, callback)
            } else {
                callback();
            }
        });
    }
}

module.exports = FileHandler;

//rdiff algorithm
//
