const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const PskHash = require('pskcrypto').PskHash;

const folderNameSize = process.env.FOLDER_NAME_SIZE || 5;
const FILE_SEPARATOR = '-';
let rootfolder;
let aliasesPath;

$$.flow.describe("BricksManager", {
    init: function (rootFolder, callback) {
        if (!rootFolder) {
            callback(new Error("No root folder specified!"));
            return;
        }
        rootFolder = path.resolve(rootFolder);
        this.__ensureFolderStructure(rootFolder, function (err, pth) {
            rootfolder = rootFolder;
            aliasesPath = path.join(rootfolder, "aliases");
            callback(err, rootFolder);
        });
    },
    write: function (fileName, readFileStream, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        if (!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function") {
            callback(new Error("Something wrong happened"));
            return;
        }

        const folderName = path.join(rootfolder, fileName.substr(0, folderNameSize));

        this.__ensureFolderStructure(folderName, (err) => {
            if (err) {
                return callback(err);
            }

            this.__writeFile(readFileStream, folderName, fileName, callback);
        });

    },
    read: function (fileName, writeFileStream, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        const folderPath = path.join(rootfolder, fileName.substr(0, folderNameSize));
        const filePath = path.join(folderPath, fileName);

        this.__verifyFileExistence(filePath, (err, result) => {
            if (!err) {
                this.__readFile(writeFileStream, filePath, callback);
            } else {
                callback(new Error(`File ${filePath} was not found.`));
            }
        });
    },
    addAlias: function (fileName, readStream, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        this.__streamToString(readStream, (err, alias) => {
            if (err) {
                return callback(err);
            }
            if (!alias) {
                return callback(new Error("No alias was provided"));
            }

            this.__readAliases((err, aliases) => {
                if (err) {
                    return callback(err);
                }

                if (!aliases[alias]) {
                    aliases[alias] = [];
                }

                if(!aliases[alias].includes(fileName)) {
                    aliases[alias].push(fileName);
                    this.__writeAliases(aliases, callback);
                }

                callback();
            });

        });
    },
    writeWithHash: function (fileHash, readStream, callback) {
        this.write(fileHash, readStream, (err, computedDigest) => {
            if (err) {
                return callback(err);
            }

            if (fileHash !== computedDigest) {
                fs.unlink(fileHash, (err) => {
                    if (err) {
                        return callback(err);
                    }

                    callback(new Error("The specified file hash is incorrect"));
                });
            }

            callback();
        });
    },
    writeWithAlias: function (alias, readStream, callback) {
        const fileName = encodeURIComponent(crypto.randomBytes(20).toString("base64"));
        this.write(fileName, readStream, (err, fileHash) => {
            if (err) {
                return callback(err);
            }

            this.__renameFile(fileName, fileHash, (err) => {
                if (err) {
                    return callback(err);
                }

                this.__readAliases((err, aliases) => {
                    if (err) {
                        return callback(err);
                    }

                    if (typeof aliases[alias] === "undefined") {
                        aliases[alias] = [];
                    }

                    if (!aliases[alias].includes(fileHash)) {
                        aliases[alias].push(fileHash);
                        this.__writeAliases(aliases, callback);
                    }else{
                        callback();
                    }
                });
            });
        });
    },
    readWithAlias: function (alias, writeStream, callback) {
        this.__readAliases((err, aliases) => {
            if (err) {
                return callback(err);
            }

            const fileName = this.__getFileName(aliases, alias);
            this.read(fileName, writeStream, callback);
        });

    },
    readVersion: function (fileName, fileVersion, writeFileStream, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        const folderPath = path.join(rootfolder, fileName.substr(0, folderNameSize));
        const filePath = path.join(folderPath, fileName, fileVersion);
        this.__verifyFileExistence(filePath, (err, result) => {
            if (!err) {
                this.__readFile(writeFileStream, path.join(filePath), callback);
            } else {
                callback(new Error("No file found."));
            }
        });
    },
    getVersionsForFile: function (fileName, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        const folderPath = path.join(rootfolder, fileName.substr(0, folderNameSize), fileName);
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                return callback(err);
            }

            const totalNumberOfFiles = files.length;
            const filesData = [];

            let resolvedFiles = 0;

            for (let i = 0; i < totalNumberOfFiles; ++i) {
                fs.stat(path.join(folderPath, files[i]), (err, stats) => {
                    if (err) {
                        filesData.push({version: files[i], creationTime: null, creationTimeMs: null});
                        return;
                    }

                    filesData.push({
                        version: files[i],
                        creationTime: stats.birthtime,
                        creationTimeMs: stats.birthtimeMs
                    });

                    resolvedFiles += 1;

                    if (resolvedFiles >= totalNumberOfFiles) {
                        filesData.sort((first, second) => {
                            const firstCompareData = first.creationTimeMs || first.version;
                            const secondCompareData = second.creationTimeMs || second.version;

                            return firstCompareData - secondCompareData;
                        });
                        callback(undefined, filesData);
                    }
                });
            }
        });
    },
    compareVersions: function (bodyStream, callback) {
        let body = '';

        bodyStream.on('data', (data) => {
            body += data;
        });

        bodyStream.on('end', () => {
            try {
                body = JSON.parse(body);
                this.__compareVersions(body, callback);
            } catch (e) {
                callback(e);
            }
        });
    },
    __verifyFileName: function (fileName, callback) {
        if (!fileName || typeof fileName !== "string") {
            return callback(new Error("No fileId specified."));
        }

        if (fileName.length < folderNameSize) {
            return callback(new Error("FileId too small. " + fileName));
        }

        return true;
    },
    __ensureFolderStructure: function (folder, callback) {
        fs.mkdir(folder, {recursive: true}, callback);
    },
    __writeFile: function (readStream, folderPath, fileName, callback) {
        const hash = require("crypto").createHash("sha256");
        const filePath = path.join(folderPath, fileName);
        fs.access(filePath, (err) => {
            if (err) {
                readStream.on('data', (data) => {
                    hash.update(data);
                });

                const writeStream = fs.createWriteStream(filePath, {mode: 0o444});

                writeStream.on("finish", () => {
                    callback(undefined, hash.digest("hex"));
                });

                writeStream.on("error", (err) => {
                    writeStream.close();
                    callback(err);
                });

                readStream.pipe(writeStream);
            } else {
                callback();

            }
        });
    },
    __getNextVersionFileName: function (folderPath, fileName, callback) {
        this.__getLatestVersionNameOfFile(folderPath, (err, fileVersion) => {
            if (err) {
                console.error(err);
                return callback(err);
            }

            callback(undefined, fileVersion.numericVersion + 1);
        });
    },
    __getLatestVersionNameOfFile: function (folderPath, callback) {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error(err);
                callback(err);
                return;
            }

            let fileVersion = {numericVersion: 0, fullVersion: '0' + FILE_SEPARATOR};

            if (files.length > 0) {
                try {
                    const allVersions = files.map(file => file.split(FILE_SEPARATOR)[0]);
                    const latestFile = this.__maxElement(allVersions);
                    fileVersion = {
                        numericVersion: parseInt(latestFile),
                        fullVersion: files.filter(file => file.split(FILE_SEPARATOR)[0] === latestFile.toString())[0]
                    };

                } catch (e) {
                    e.code = 'invalid_file_name_found';
                    callback(e);
                }
            }

            callback(undefined, fileVersion);
        });
    },
    __maxElement: function (numbers) {
        let max = numbers[0];

        for (let i = 1; i < numbers.length; ++i) {
            max = Math.max(max, numbers[i]);
        }

        if (isNaN(max)) {
            throw new Error('Invalid element found');
        }

        return max;
    },
    __compareVersions: function (files, callback) {
        const filesWithChanges = [];
        const entries = Object.entries(files);
        let remaining = entries.length;

        if (entries.length === 0) {
            callback(undefined, filesWithChanges);
            return;
        }

        entries.forEach(([fileName, fileHash]) => {
            this.getVersionsForFile(fileName, (err, versions) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        versions = [];
                    } else {
                        callback(err);
                    }

                }

                const match = versions.some(version => {
                    const hash = version.version.split(FILE_SEPARATOR)[1];
                    return hash === fileHash;
                });

                if (!match) {
                    filesWithChanges.push(fileName);
                }

                if (--remaining === 0) {
                    callback(undefined, filesWithChanges);
                }
            })
        });
    },
    __readFile: function (writeFileStream, filePath, callback) {
        const readStream = fs.createReadStream(filePath);

        writeFileStream.on("finish", callback);
        writeFileStream.on("error", callback);

        readStream.pipe(writeFileStream);
    },
    __verifyFileExistence: function (filePath, callback) {
        fs.access(filePath, callback);
    },
    __getFileName: function (aliases, alias) {
        const lastIndex = aliases[alias].length - 1;
        return aliases[alias][lastIndex];
    },
    __writeAliases: function (aliases, callback) {
        fs.writeFile(aliasesPath, JSON.stringify(aliases), callback);
    },
    __readAliases: function (callback) {
        fs.readFile(aliasesPath, (err, aliases) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return callback(undefined, {});
                }else{
                    return callback(err);
                }
            }
            callback(undefined, JSON.parse(aliases.toString()));
        });
    },
    __checkIfFileHasAlias: function (aliases, alias, fileName) {
        return !!aliases[alias].find(el => el === fileName);
    },
    __streamToString: function (readStream, callback) {
        let str = '';
        readStream.on("data", (chunk) => {
            str += chunk;
        });

        readStream.on("end", () => {
            callback(undefined, str);
        });

        readStream.on("error", callback);
    },
    __renameFile: function (oldFileName, newFileName, callback) {
        const oldFolderPath = path.join(rootfolder, path.basename(oldFileName).substring(0, folderNameSize));
        const newFolderPath = path.join(rootfolder, path.basename(newFileName).substring(0, folderNameSize));
        const oldFilePath = path.join(oldFolderPath, oldFileName);
        const newFilePath = path.join(newFolderPath, newFileName);

        fs.stat(newFolderPath, (err, stats) => {
            if (err) {
                if (err.code === "ENOENT") {
                    fs.mkdir(newFolderPath, {recursive: true}, (err) => {
                        if (err) {
                            return callback(err);
                        }
                        __moveFile(callback);
                    });
                } else {
                    return callback(err);
                }
            } else {
                __moveFile(callback);
            }
        });

        function __moveFile(callback) {
            fs.access(newFilePath, (err) => {
                if (!err) {
                    __removeFile(callback);
                    return;
                }

                fs.copyFile(oldFilePath, newFilePath, (err) => {
                    if (err) {
                        return callback(err);
                    }

                    __removeFile(callback);
                });
            });

        }

        function __removeFile(callback) {
            fs.unlink(oldFilePath, (err) => {
                if (err) {
                    return callback(err);
                }

                fs.readdir(oldFolderPath, (err, files) => {
                    if (err) {
                        return callback(err);
                    }

                    if (files.length === 0) {
                        fs.rmdir(oldFolderPath, callback);
                    }
                });
            });
        }
    }
});
