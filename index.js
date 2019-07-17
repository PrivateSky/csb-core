const EDFS = require('./lib/EDFS');
const CSBIdentifier = require("./lib/CSBIdentifier");
const FileHandler = require("./lib/FileHandler");
module.exports.EDFS = EDFS;
module.exports.CSBIdentifier = CSBIdentifier;
module.exports.FileHandler = FileHandler;
module.exports.EDFSMiddleware = require("./EDFSMiddleware");
module.exports.createEDFSBrickStorage = require("./lib/EDFSBrickStorage").createEDFSBrickStorage;


