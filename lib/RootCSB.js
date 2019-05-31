const RawCSB = require('./RawCSB');
const crypto = require('pskcrypto');
const CSBCache = require("./CSBCache");
const CSBIdentifier = require("./CSBIdentifier");
const Header = require("./Header");
const HeadersHistory = require("./HeadersHistory");
const EventEmitter = require('events');
const EDFSServiceProxy = require("./EDFSServiceProxy");
const EDFSBlockchainProxy = require("./EDFSBlockchainProxy");
const AsyncDispatcher = require("../utils/AsyncDispatcher");

const Brick = require("./Brick");
const url = "http://localhost:8080";
const edfsServiceProxy = new EDFSServiceProxy(url);
/**
 *
 * @param localFolder   - required
 * @param currentRawCSB - optional
 * @param csbIdentifier - required
 * @constructor
 */
function RootCSB(localFolder, currentRawCSB, csbIdentifier) {
    // if (!localFolder || !csbIdentifier) {
    //     throw new Error('Missing required parameters');
    // }


    const event = new EventEmitter();
    const edfsBlockchainProxy = new EDFSBlockchainProxy(csbIdentifier.getDomain());
    this.on = event.on;
    this.off = event.removeListener;
    this.removeAllListeners = event.removeAllListeners;
    this.emit = event.emit;

    this.getMidRoot = function (CSBPath, callback) {
        throw new Error('Not implemented');
    };

    this.createRawCSB = function () {
        return new RawCSB();
    };

    this.loadRawCSB = function (CSBPath, callback) {
        if (!currentRawCSB) {
            edfsBlockchainProxy.getCSBAnchor(csbIdentifier, (err, csbAnchor) => {
                if (err) {
                    return callback(err);
                }

                __loadRawCSB(csbIdentifier, csbAnchor.headerHistoryHash,(err, rawCSB) => {
                    if (err) {
                        return callback(err);
                    }

                    currentRawCSB = rawCSB;

                    if (CSBPath || CSBPath !== '') {
                        this.loadRawCSB(CSBPath, callback);
                        return;
                    }

                    callback(undefined, currentRawCSB);
                });
            });
            return;
        }
        if (!CSBPath || CSBPath === '') {
            return callback(null, currentRawCSB);
        }

        this.loadAssetFromPath(CSBPath, (err, asset, rawCSB) => {

            if (err) {
                return callback(err);
            }

            if (!asset || !asset.dseed) {
                return callback(new Error(`The CSBPath ${CSBPath} is invalid.`));
            }

            __loadRawCSB(new CSBIdentifier(asset.dseed), asset.headerHistoryHash, callback);
        })
    };

    this.loadAssetFromPath = function (CSBPath, callback) {
        let processedPath = __splitPath(CSBPath);
        if (!currentRawCSB) {
            return callback(new Error('currentRawCSB does not exist'));
        }

        let CSBReference = null;
        if (processedPath.CSBAliases.length > 0) {
            const nextAlias = processedPath.CSBAliases[0];
            CSBReference = currentRawCSB.getAsset('global.CSBReference', nextAlias);
        } else {
            if (!processedPath.assetType || !processedPath.assetAid) {
                return callback(new Error('Not asset type or id specified in CSBPath'));
            }

            CSBReference = currentRawCSB.getAsset(processedPath.assetType, processedPath.assetAid);
        }

        if (processedPath.CSBAliases.length === 0) {
            return callback(null, CSBReference, currentRawCSB);
        }

        processedPath.CSBAliases.shift();

        if(!CSBReference || !CSBReference.dseed){
            return callback(new Error(`The CSBPath ${CSBPath} is invalid`));
        }
        __loadAssetFromPath(processedPath, new CSBIdentifier(CSBReference.dseed), CSBReference.headerHistoryHash, 0, callback);
    };

    this.saveAssetToPath = function (CSBPath, asset, callback) {
        const splitPath = __splitPath(CSBPath, {keepAliasesAsString: true});
        this.loadRawCSB(splitPath.CSBAliases, (err, rawCSB) => {
            if (err) {
                return callback(err);
            }
            try {
                rawCSB.saveAsset(asset);
                this.saveRawCSB(rawCSB, splitPath.CSBAliases, callback);
            } catch (e) {
                callback(e);
            }
        });
    };

    this.saveRawCSB = function (rawCSB, CSBPath, callback) {
        if (!CSBPath || CSBPath === '') {
            if (rawCSB) {
                currentRawCSB = rawCSB;
            }
        }

        const transactions = rawCSB.getTransactionLog();
        let headersHistory = new HeadersHistory();
        const header = new Header();
        edfsBlockchainProxy.getCSBAnchor(csbIdentifier, (err, csbAnchor) => {
            if (csbAnchor && typeof csbAnchor.headerHistoryHash !== "undefined") {
                edfsServiceProxy.getBrick(csbAnchor.headerHistoryHash, (err, headersHistoryBrick) => {
                    if (err) {
                        return callback(err);
                    }

                    headersHistory.fromBrick(headersHistoryBrick, csbIdentifier.getDseed());
                    header.setPreviousHeaderHash(headersHistory.getLastHeaderHash());
                    return __saveRawCSB(csbAnchor, headersHistory, header, transactions, callback);
                });
            }
            csbAnchor.init(csbIdentifier.getUid(), csbIdentifier.getUid());
            __saveRawCSB(csbAnchor, headersHistory, header, transactions, callback);
        });
    };


    /* ------------------- INTERNAL METHODS ------------------- */


    /**
     *
     * @param CSBPath: string - internal path that looks like /{CSBName1}/{CSBName2}:{assetType}:{assetAliasOrId}
     * @param options:object
     * @returns {{CSBAliases: [string], assetAid: (*|undefined), assetType: (*|undefined)}}
     * @private
     */
    function __splitPath(CSBPath, options = {}) {
        const pathSeparator = '/';

        if (CSBPath.startsWith(pathSeparator)) {
            CSBPath = CSBPath.substring(1);
        }

        let CSBAliases = CSBPath.split(pathSeparator);
        if (CSBAliases.length < 1) {
            throw new Error('CSBPath too short');
        }

        const lastIndex = CSBAliases.length - 1;
        const optionalAssetSelector = CSBAliases[lastIndex].split(':');

        if (optionalAssetSelector[0] === '') {
            CSBAliases = [];
        } else {
            CSBAliases[lastIndex] = optionalAssetSelector[0];
        }

        if (!optionalAssetSelector[1] && !optionalAssetSelector[2]) {
            optionalAssetSelector[1] = 'global.CSBReference';
            optionalAssetSelector[2] = CSBAliases[lastIndex];
            CSBAliases.pop();
        }

        if (options.keepAliasesAsString === true) {
            CSBAliases = CSBAliases.join('/')
        }
        return {
            CSBAliases: CSBAliases,
            assetType: optionalAssetSelector[1],
            assetAid: optionalAssetSelector[2]
        };
    }

    function __initializeAssets(rawCSB, csbRef, backupUrls) {

        let csbMeta;
        let isMaster;

        csbMeta = rawCSB.getAsset('global.CSBMeta', 'meta');
        if (currentRawCSB === rawCSB) {
            isMaster = typeof csbMeta.isMaster === 'undefined' ? true : csbMeta.isMaster;
            if (!csbMeta.id) {
                csbMeta.init($$.uidGenerator.safe_uuid());
                csbMeta.setIsMaster(isMaster);
                rawCSB.saveAsset(csbMeta);
            }
        } else {
            backupUrls.forEach(url => {
                const uid = $$.uidGenerator.safe_uuid();
                const backup = rawCSB.getAsset('global.Backup', uid);
                backup.init(uid, url);
                rawCSB.saveAsset(backup);
            });

            isMaster = typeof csbMeta.isMaster === 'undefined' ? false : csbMeta.isMaster;
            csbMeta.init(csbRef.getMetadata('swarmId'));
            csbMeta.setIsMaster(isMaster);
            rawCSB.saveAsset(csbMeta);
        }
    }

    function __saveRawCSB(csbAnchor, headersHistory, header, transactions, callback) {
        const asyncDispatcher = new AsyncDispatcher(() => {
            const headerEncryptionKey = crypto.randomBytes(32);
            const headerBrick = header.toBrick(headerEncryptionKey);
            edfsServiceProxy.addBrick(headerBrick, (err) => {
                if (err) {
                    return callback(err);
                }

                headersHistory.addHeader(headerBrick, headerEncryptionKey);
                const historyBrick = headersHistory.toBrick(csbIdentifier.getDseed());
                edfsServiceProxy.addBrick(historyBrick, (err) => {
                    if (err) {
                        return callback(err);
                    }

                    csbAnchor.updateHeaderHistoryHash(historyBrick.generateHash());
                    edfsBlockchainProxy.setCSBAnchor(csbAnchor, (err) => {
                        if (err) {
                            return callback(err);
                        }

                        callback();
                    })
                });
            });

        });

        asyncDispatcher.dispatchEmpty(transactions.length);
        transactions.forEach(transaction => {
            const encryptionKey = crypto.randomBytes(32);
            const transactionBrick = new Brick(crypto.encrypt(transaction, encryptionKey));
            const transactionEntry = {};
            const transactionHash = transactionBrick.generateHash();
            transactionEntry[transactionHash] = encryptionKey;
            header.addTransactions(transactionEntry);
            edfsServiceProxy.addBrick(transactionBrick, (err) => {
                if (err) {
                    return callback(err);
                }

                asyncDispatcher.markOneAsFinished();
            });
        });
    }



    function __loadRawCSB(localCSBIdentifier, localHeaderHistoryHash, callback) {
        if(typeof localHeaderHistoryHash === "function"){
            callback = localHeaderHistoryHash;
        }

        const rawCSB = new RawCSB();
        edfsServiceProxy.getBrick(localHeaderHistoryHash, (err, headersHistoryBrickData) => {
            if (err) {
                return callback(err);
            }

            const headersHistory = new HeadersHistory();
            headersHistory.fromBrick(headersHistoryBrickData, localCSBIdentifier.getDseed());
            const headersAsyncDispatcher = new AsyncDispatcher((errors, results) => {
                callback(undefined, rawCSB);
            });

            const headers = headersHistory.getHeaders();
            headersAsyncDispatcher.dispatchEmpty(headers.length);
            headers.forEach(headerEntry => {
                const headerHash = Object.keys(headerEntry)[0];
                edfsServiceProxy.getBrick(headerHash, (err, headerBrick) => {
                    if (err) {
                        return callback(err);
                    }
                    const header = new Header();
                    header.fromBrick(headerBrick, headerEntry[headerHash]);
                    const transactionsEntries = header.getTransactions();
                    const transactionsAsyncDispatcher = new AsyncDispatcher((errors, results) => {
                        const resultsObj = {};
                        results.forEach(result => {
                            const key = Object.keys(result)[0];
                            resultsObj[key] = Object.values(result[key])[0];
                        });

                        transactionsEntries.forEach(transactionEntry => {
                            const transactionHash = Object.keys(transactionEntry)[0];
                            rawCSB.applyTransaction(resultsObj[transactionHash].swarm);
                        });

                        headersAsyncDispatcher.markOneAsFinished();
                    });
                    transactionsAsyncDispatcher.dispatchEmpty(transactionsEntries.length);
                    transactionsEntries.forEach(transactionEntry => {
                        const transactionHash = Object.keys(transactionEntry)[0];
                        edfsServiceProxy.getBrick(transactionHash, (err, transactionBrick) => {
                            if (err) {
                                return callback(err);
                            }

                            const transactionObj = {};
                            transactionObj[transactionHash] = crypto.decryptObject(transactionBrick, transactionEntry[transactionHash]);
                            transactionsAsyncDispatcher.markOneAsFinished(undefined, transactionObj);

                        })
                    });
                });
            })
        });
    }

    function __loadAssetFromPath(processedPath, localCSBIdentifier, localHeaderHistoryHash, currentIndex, callback) {
        __loadRawCSB(localCSBIdentifier, (err, rawCSB) => {
            if (err) {
                return callback(err);
            }

            if (currentIndex < processedPath.CSBAliases.length) {
                const nextAlias = processedPath.CSBAliases[currentIndex];
                let asset = rawCSB.getAsset("global.CSBReference", nextAlias);
                let newCSBIdentifier = new CSBIdentifier(asset.dseed);

                __loadAssetFromPath(processedPath, newCSBIdentifier, ++currentIndex, callback);
                return;
            }

            let asset = rawCSB.getAsset(processedPath.assetType, processedPath.assetAid);
            callback(null, asset, rawCSB);

        });

    }

}


module.exports = RootCSB;
