'use strict';
var services = {
    http: require('http'),
    fs: require('fs'),
    fse: require('fs-extra'),
    mkdirp: require('mkdirp'),
    getDirName: require('path').dirname,
    configuration: require('./modules/configuration'),
    logger: require('./modules/logger'),
    io: require('./modules/io-service'),
    md5File: require('md5-file'),
    zlib: require('zlib'),
    crypto: require('crypto'),
    request: require('request'),
    ioAdapter: require('./modules/io-adapter-legacy'),
    extensions: require('./modules/extensions'),
    path: require('path'),
    server: require('./server.js')()
};

function Configuration() {
    var serviceUpdaterConfig = services.configuration.get('service-updater');
    var serverUpdaterConfig = services.configuration.get('server');
    var config = {       
        deploymentManifestFileName: serviceUpdaterConfig.deploymentmanifest || "/deploymentmanifest.json",
        temporaryDownloadFolder: serviceUpdaterConfig.temporaryDownloadFolder || "./TempFolder",
        hostedUpdateFilesFolder: serviceUpdaterConfig.hostedUpdateFilesFolder || "./public/UpdateFiles",
        updateUrl: serverUpdaterConfig.updateUrl || "",
        serviceUpdateInterval: serviceUpdaterConfig.serviceUpdateIntervalInMinutes * 60000,
        log: serviceUpdaterConfig.log || { "level": "trace" },
        port: serviceUpdaterConfig.port || '51803'
    };
    return config;
}

function ClarityService(config) {
    var app = {
        manifest: {},
        listener: undefined,
        application: undefined,
        logger: services.logger.getRotatingLog('service-updater', config.log),
        errorLog: function (error, nextFunction) {
            var logger = app.logger;
            if (error.message) {
                console.error(error.message);
                logger.error(error.message);
                if (nextFunction) nextFunction(error.message);
            }
            else {
                console.error(error);
                logger.error(error);
                if (nextFunction) nextFunction(error);
            }
        },
        traceLog: function (msg) {
            var logger = app.logger;
            logger.info(msg);
            console.log(msg);
        },       
        replaceExecutionDirectory: function (processedFiles) {
            app.traceLog('[class::clarityservice] [method::replaceExecutionDirectory] -> started');
            return new Promise(function (onSuccess, onError) {
                try {
                    var failedDownloads = processedFiles.filter(function (file) {
                        return file.hasValidHashKey === false;
                    });
                    if (failedDownloads.length !== 0) {
                        return onError('[class::clarityservice] [method::replaceExecutionDirectory] -> The download was not successful, it partially downloaded some files');
                    }
                    if (app.listener) {
                        app.listener.emit('serviceUpdate', { serviceUpdate: true });
                    }
                    services.fse.copySync(config.temporaryDownloadFolder, '.');
                    app.traceLog('[class::clarityservice] [method::replaceExecutionDirectory] -> working directory replaced successfully');
                    services.server.shutdown();
                    services.server = require('./server.js')();
                    services.server.start();
                    if (app.listener) {
                        app.listener.emit('serviceUpdate', { serviceUpdate: false });
                    }
                    return onSuccess();
                }
                catch (error) {
                    app.traceLog('[class::clarityservice] [method::replaceExecutionDirectory] -> unsuccessfully with error : ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        replaceUpdateFilesDirectory: function (processedFiles) {
            app.traceLog('[class::clarityservice] [method::replaceUpdateFilesDirectory] -> started');
            return new Promise(function (onSuccess, onError) {
                try {
                    var failedDownloads = processedFiles.filter(function (file) {
                        return file.hasValidHashKey === false;
                    });
                    if (failedDownloads.length !== 0) {
                        return onError('[class::clarityservice] [method::replaceUpdateFilesDirectory] -> The download was not successful, it partially downloaded some files');
                    }
                    services.fse.copySync(config.temporaryDownloadFolder, config.hostedUpdateFilesFolder);
                    return onSuccess();
                }
                catch (error) {
                    app.traceLog('[class::clarityservice] [method::replaceUpdateFilesDirectory] -> unsuccessfully with error : ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        readFileAsJson: function (data) {
            app.traceLog('[class::clarityservice] [method::readFileAsJson] -> started');
            return new Promise(function (onSuccess, onError) {
                try {
                    var contents = services.fs.readFileSync(data.path, "utf8");
                    if (contents) {
                        data.contents = JSON.parse(contents);
                        return onSuccess(data);
                    }
                    else {
                        var error = "Failed to read file : [" + data.path + "], empty contents";
                        app.traceLog('[class::clarityservice] [method::readFileAsJson] -> error : ' + error);
                        return onError(error);
                    }
                }
                catch (error) {
                    app.traceLog('[class::clarityservice] [method::readFileAsJson] -> unsuccessfully with error : ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        downloadFile: function (data) {
            app.traceLog('[class::servicebootstrapper] [method::downloadFile] -> started');
            return new Promise(function (onSuccess, onError) {
                try {
                    var uri = config.updateUrl + data.remotepath;
                    return services.ioAdapter
                        .download(uri)
                        .then(function (contents) {
                            data.contents = contents;
                            return onSuccess(data);
                        })
                        .catch(function (error) {
                            app.traceLog('[class::clarityservice] [method::downloadFile] -> unsuccessfully with error : ' + JSON.stringify(error));
                            return onError(error);
                        });
                }
                catch (error) {
                    app.traceLog('[class::clarityservice] [method::downloadFile] -> unsuccessfully with error : ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        buildPath: function (directory, file) {
            return services.extensions.replace(directory + (services.extensions.startsWith(file, '/') ? '' : '/') + file,
                '/',
                services.path.sep);
        },
        processManifestEntries: function (deploymentManifest, workingDirectory) {
            app.traceLog('[class::clarityservice] [method::processManifestEntries] -> started');
            return new Promise(function (onSuccess, onError) {
                try {
                    var index = 0;
                    var processedFiles = [];
                    var processFile = function () {
                        var file = deploymentManifest.files[index];
                        var filename = file.name;
                        var path = app.buildPath(config.temporaryDownloadFolder, filename);

                        var hasFileChanged =
                            (services.fs.existsSync(workingDirectory + filename) &&
                                (services.md5File.sync(workingDirectory + filename).toLowerCase() !== file.hash.toLowerCase())) ||
                            (services.fs.existsSync(path) &&
                                services.md5File.sync(path).toLowerCase() !== file.hash.toLowerCase()) ||
                            !services.fs.existsSync(workingDirectory);

                        if (hasFileChanged) {
                            app.traceLog('[class::clarityservice] [method::processManifestEntries] -> beginning download process for the file : ' + filename);
                            app.downloadFile({
                                file: services.path.basename(path),
                                directory: services.path.dirname(path),
                                path: path,
                                remotepath: filename,
                            })
                                .then(services.ioAdapter.writeFileToDisk)
                                .then(app.nullifyContents)
                                .then(app.computeFileHash)
                                .then(function (data) {
                                    return app.validateHash(data, deploymentManifest);
                                })
                                .then(function (data) {
                                    index++;
                                    processedFiles.push(data);
                                    if (index === deploymentManifest.files.length) {
                                        return processedFiles.length === 0 ? onError('[method::processdeploymentManifestEntries] ALL FILES ARE UP-TO-DATE') : onSuccess(processedFiles);
                                    }
                                    processFile();
                                })
                                .catch(function (error) {
                                    return onError(error);
                                });
                        }
                        else {
                            index++;
                            if (index === deploymentManifest.files.length) {
                                return processedFiles.length === 0 ? onError('[method::processdeploymentManifestEntries] ALL FILES ARE UP-TO-DATE') : onSuccess(processedFiles);
                            }
                            processFile();
                        }
                    }
                    processFile();
                }
                catch (error) {
                    app.traceLog('[class::clarityservice] [method::processdeploymentManifestEntries] -> unsuccessfully with error : ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        findByManifestItemName: function (array, value) {
            if (Array.isArray(array)) {
                for (var i = 0; i < array.length; i++) {
                    if (array[i].name === value) {
                        return array[i];
                    }
                }
            }
            return null;
        },
        nextRefreshDate: new Date(),
        startTime: new Date(),
        calculateExecutionTime: function () {
            var minutesInExecution = (new Date().getTime() - app.timeToExecute.getTime()) / 1000;
            app.traceLog("#### DOWNLOAD TIME : " + minutesInExecution + " SECONDS");
        },
        nullifyContents: function (data) {
            return new Promise(function (onSuccess) {
                data.contents = null;
                return onSuccess(data);
            });
        },
        computeFileHash: function (data) {
            app.traceLog("[class::clarityservice] [method::computeFileHash] -> started");
            return new Promise(function (onSuccess, onError) {
                try {
                    data.hash = services.md5File.sync(data.path);
                    return onSuccess(data);
                }
                catch (error) {
                    app.traceLog('[class::clarityservice] [method::computeFileHash] -> unsuccessfully with error : ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        validateHash: function (data, deploymentManifest) {
            app.traceLog('[class::clarityservice] [method::validateHash] -> started');
            return new Promise(function (onSuccess, onError) {
                try {
                    var mainfestItem = app.findByManifestItemName(deploymentManifest.files, data.remotepath) || { hash: '####' };
                    data.hasValidHashKey = mainfestItem.hash.toLowerCase() === data.hash.toLowerCase();
                    return onSuccess(data);
                }
                catch (error) {
                    app.traceLog('[class::clarityservice] [method::validateHash] -> unsuccessfully with error : ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        cleanUp: function () {
            try {
                if (services.fs.existsSync(config.temporaryDownloadFolder)) {
                    services.io.deleteFolderRecursive(config.temporaryDownloadFolder);
                }
            }
            catch (error) {
                app.errorLog(error);
            }
        },
        updateFiles: function (finalizeHandler, path, cb) {
            var deploymentManifest;          
            var isBusyDownloading;
            if (!isBusyDownloading) {
                isBusyDownloading = true;
                app.timeToExecute = new Date();
                app.downloadDeploymentManifest()
                    .then(function (data) {
                        deploymentManifest = data.contents;                      
                        return app.processManifestEntries(deploymentManifest, finalizeHandler === 'replaceExecutionDirectory' ? '.' : './public/UpdateFiles')
                            .then(function (processedFiles) {
                                return app[finalizeHandler](processedFiles);
                            });                       
                    })
                    .then(function () {
                        isBusyDownloading = false;
                        app.cleanUp();
                        if (cb) cb();
                    })
                    .catch(function (error) {
                        isBusyDownloading = false;
                        app.errorLog(error);
                        app.cleanUp();
                        if (cb) cb();
                    });
            }
        },
        downloadDeploymentManifest: function () {
            app.traceLog('[class::clarityservice] [method::downloadDeploymentManifest] -> started');
            var path = app.buildPath(config.temporaryDownloadFolder, config.deploymentManifestFileName);
            return app.downloadFile({
                directory: services.path.dirname(path),
                path: path,
                remotepath: config.deploymentManifestFileName,
            })
                .then(services.ioAdapter.writeFileToDisk)
                .then(app.readFileAsJson);
        },
        openSocketsPort: function () {
            app.traceLog('[class::clarityservice] [method::openSocketsPort] -> started]');
            try {
                if (!app.listener) {
                    app.application = services.http.createServer(function (req, res) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h2>SOCKETS IS OPENED</h2>');
                    });
                    app.listener = require('socket.io')(app.application);
                    app.application.listen(config.port);
                    app.traceLog('[openSocketsPort] -  Listened on port : ' + config.port);
                }
            }
            catch (error) {
                app.errorLog(error);
            }
        },
    };
    return app;
}

var configuration = new Configuration();
var app = new ClarityService(configuration);

module.exports = {
    start: function () {
        app.openSocketsPort();
        services.server.start();
    },
    updateFiles: function (onComplete, deploymentManifestPath, cb) {
        app.updateFiles(onComplete, deploymentManifestPath, cb);
    }
};

process.on('SIGINT', function () {
    services.server.shutdown();
    process.exit(0);
});

process.on('EXIT', function () {
    services.server.shutdown();
    process.exit(0);
});