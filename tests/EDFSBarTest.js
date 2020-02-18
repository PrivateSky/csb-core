require('../../../psknode/bundles/testsRuntime');
require("../../../psknode/bundles/pskruntime");
require("../../../psknode/bundles/consoleTools");
require('../../../psknode/bundles/edfsBar');
require("../../../psknode/bundles/virtualMQ");
const utils = require("./utils/utils");

const edfs = require("edfs-brick-storage");
const bar = require("bar");
const assert = require("../../double-check").assert;

const createFsAdapter = bar.createFsAdapter;

const ArchiveConfigurator = bar.ArchiveConfigurator;

ArchiveConfigurator.prototype.registerFsAdapter("fsAdapter", createFsAdapter);
const archiveConfigurator = new ArchiveConfigurator();
archiveConfigurator.setFsAdapter("fsAdapter");
archiveConfigurator.setBufferSize(256);

const folders = ["fld/fld2", 'dot'];
const files = [
    "fld/a.txt", "fld/fld2/b.txt"
];

const text = ["asta e un text", "asta e un alt text"];
const folderPath = "fld";
let savePath = "dot";

let PORT = 9090;
const tempFolder = "../../tmp";

const VirtualMQ = require("virtualmq");
function createServer(callback) {
    let server = VirtualMQ.createVirtualMQ(PORT, tempFolder, undefined, (err, res) => {
        if (err) {
            console.log("Failed to create VirtualMQ server on port ", PORT);
            console.log("Trying again...");
            if (PORT > 0 && PORT < 50000) {
                PORT++;
                createServer(callback);
            } else {
                return callback(err);
            }
        } else {
            console.log("Server ready and available on port ", PORT);
            let url = `http://127.0.0.1:${PORT}`;
            callback(undefined, server, url);
        }
    });
}

assert.callback("StoreBarInEDFSTest", (callback) => {
    utils.ensureFilesExist(folders, files, text, (err) => {
        assert.true(err === null || typeof err === "undefined", "Received error");

        utils.computeFoldersHashes([folderPath], (err, initialHashes) => {
            assert.true(err === null || typeof err === "undefined", "Received error");

            createServer((err, server, url) => {
                assert.true(err === null || typeof err === "undefined", "Received error");

                archiveConfigurator.setStorageProvider("EDFSBrickStorage", url);
                const archive = new bar.Archive(archiveConfigurator);

                console.log("about to add folder");
                archive.addFolder(folderPath, (err, mapDigest) => {
                    console.log("added folder", mapDigest);
                    assert.true(err === null || typeof err === "undefined", "Failed to add folder");
                    assert.true(typeof mapDigest !== "undefined", "Did not receive mapDigest");

                    archive.extractFolder(savePath, (err) => {
                        assert.true(err === null || typeof err === "undefined", "Failed to extract folder");

                        utils.computeFoldersHashes([savePath], (err, decompressedHashes) => {
                            assert.true(err === null || typeof err === "undefined", "Failed to compute folders hashes");
                            assert.true(utils.hashArraysAreEqual(initialHashes, decompressedHashes), "Files are not identical");

                            server.close(err => {
                                assert.true(err === null || typeof err === "undefined", "Failed to close server");

                                utils.deleteFolders([folderPath, savePath], (err) => {
                                    assert.true(err === null || typeof err === "undefined", "Failed to delete test folders");

                                    callback();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}, 1000);


