var services = {
	request: require('request'), // https://github.com/mikeal/request
	zlib: require('zlib'),
	fs: require('fs'),
	md5File: require('md5-file'),
	path: require('path'),
	configuration: require('./configuration'),
	io: require('./io-service'),
	extensions: require('./extensions'),
	logger: require('./logger'),
	http: require('http'),
	fse: require('fs-extra'),
	ioAdapter: require('./io-adapter-legacy')
}

function Configuration() {
	var settings = services.configuration.get('application-settings');
	var updateServer = services.configuration.get('server');
	var rootFolder = process.env['claritynodejs_rootfolder'];
	var baseDirectory = services.configuration.baseDirectory();
	var configuration = {
		listener: undefined,
		enabled: settings.enabled == undefined ? true : settings.enabled,
		baseDirectory: baseDirectory,
		publicStagingDirectory: baseDirectory + 'public-staging',
		publicDirectory: baseDirectory + 'public',
		updateUrl: services.extensions.endsWith(updateServer.clarityUpdateUrl, '/') ? updateServer.clarityUpdateUrl : updateServer.clarityUpdateUrl + '/',
		folder: (rootFolder ? rootFolder : '.') + services.path.sep + 'repository',
		log: settings.log
	}
	return configuration;
}

function SequentialDownloader(configuration) {
	var logger = services.logger.getRotatingLog('sequential-downloader', configuration.log);
	var downloader = {
		fileChanges: [],
		siteJsonData: {},
		flattenedSite: undefined,
		traceLog: function (message) {
			console.log(message);
			logger.trace(message);
		},
		errorLog: function (message) {
			console.error(message);
			logger.error(message);
		},
		findSiteItem: function (site, file) {
			var matchingItem;
			site.forEach(function (candidate) {
				if (matchingItem) {
					return;
				}
				if (candidate.file.toLowerCase() === file.toLowerCase()) {
					matchingItem = candidate;
				}
			});
			return matchingItem;
		},
		updateSite: function () {
			downloader.traceLog('[class::sequential-downloader] [method::updateSite] -> started');
			return new Promise(function (onSuccess, onError) {
				var path = downloader.buildPath(configuration.publicStagingDirectory, 'site.json');
				var data = {
					file: 'site.json',
					directory: services.path.dirname(path),
					path: path,
					remotepath: 'site.json'
				}
				downloader.traceLog('[class::sequential-downloader] [method::updateSite] -> path : ' + JSON.stringify(path));
				return downloader.downloadFile(data)
					.then(downloader.processSiteJson)
					.then(downloader.copyFilesFromStaging)
					.then(downloader.updateSiteJson)
					.then(downloader.removeOrphanedFiles)
					.then(downloader.deleteStaging)
					.then(function () {
						downloader.traceLog('[class::sequential-downloader] [method::updateSite] -> completed successfully');
						return onSuccess();
					})
					.catch(function (error) {
						downloader.traceLog('[class::sequential-downloader] [method::updateSite] -> unsuccessfully with error : ' + JSON.stringify(error));
						return onError(error);
					});
			})
		},
		copyFilesFromStaging: function () {
			downloader.traceLog('[class::sequential-downloader] [method::copyFilesFromStaging] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					var sourcePath = services.extensions.replace(configuration.publicStagingDirectory, '/', services.path.sep);
					var destinationPath = services.extensions.replace(configuration.publicDirectory, '/', services.path.sep);
					if (services.fs.existsSync(sourcePath)) {
						services.fse.copySync(sourcePath, destinationPath);
						downloader.traceLog('[class::sequential-downloader] [method::copyFilesFromStaging] -> files copied successfully from [' + sourcePath + '] to [' + destinationPath + ']');
					}
					return onSuccess();
				}
				catch (error) {
					downloader.traceLog('[class::sequential-downloader] [method::copyFilesFromStaging] -> unsuccessfully with error : ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		updateSiteJson: function () {
			downloader.traceLog('[class::sequential-downloader] [method::updateSiteJson] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					var siteJsonFile = configuration.publicDirectory + services.path.sep + 'site.json';
					var stringifiedSiteJson = JSON.stringify(downloader.siteJsonData);
					services.fs.writeFileSync(siteJsonFile, stringifiedSiteJson, 'utf8');
					downloader.traceLog('[class::sequential-downloader] [method::updateSiteJson] -> site.json updated successfully path : [' + siteJsonFile + ']');
					return onSuccess();
				}
				catch (error) {
					downloader.traceLog('[class::sequential-downloader] [method::updateSiteJson] -> unsuccessfully with error : ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		deleteStaging: function () {
			downloader.traceLog('[class::sequential-downloader] [method::deleteStaging] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					if (services.fs.existsSync(configuration.publicStagingDirectory)) {
						services.io.deleteFolderRecursive(configuration.publicStagingDirectory);
						downloader.traceLog('[class::sequential-downloader] [method::deleteStaging] ->  successfully deleted path : [' + configuration.publicStagingDirectory + ']');
					}
					return onSuccess();
				}
				catch (error) {
					downloader.traceLog('[class::sequential-downloader] [method::deleteStaging] -> unsuccessfully with error : ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		getFileChanges: function (serverSiteJson) {
			downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] -> started');
			var localSitePath = configuration.publicDirectory + services.path.sep + 'site.json';
			var result = [];
			if (services.fs.existsSync(localSitePath)) {
				downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] ->  site.json file : [' + localSitePath + '] exists locally');
				var localSiteJson = downloader.flattenSite(JSON.parse(services.fs.readFileSync(localSitePath, 'utf8')));
				serverSiteJson.forEach(function (serverSiteItem) {
					var stagingFilePath = downloader.buildPath(configuration.publicStagingDirectory, serverSiteItem.file);
					if (services.fs.existsSync(stagingFilePath)) {
						downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] -> the file : [' + stagingFilePath + '] exists locally');
						var localVersion = services.md5File.sync(stagingFilePath);
						var serverHash = serverSiteItem.version.toUpperCase();
						downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] -> checking hash againts staging file contents:- server hash : [' + serverHash + '], local hash : [' + localVersion.toUpperCase() + ']');
						if (serverHash === localVersion.toUpperCase()) {
							return;
						}
					}

					var fileObject = { file: serverSiteItem.file, version: serverSiteItem.version }
					var localSiteItem = downloader.findSiteItem(localSiteJson, serverSiteItem.file);
					if (!localSiteItem) {
						downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] ->  file : [' + serverSiteItem.file + '], does not exist on the local site.json and will be added as a new file');
						result.push(fileObject);
						return;
					}

					var publicFilePath = downloader.buildPath(configuration.publicDirectory, serverSiteItem.file);
					if (!services.fs.existsSync(publicFilePath)) {
						downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] ->  file : [' + serverSiteItem.file + '], does not exist on locally on disk and will be added as a new file');
						result.push(fileObject);
						return;
					}
					if (localSiteItem.version !== serverSiteItem.version) {
						downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] -> checking hash against local site.json :- server hash : [' + serverSiteItem.version.toUpperCase() + '], local hash : [' + localSiteItem.version.toUpperCase() + ']');
						result.push(fileObject);
						return;
					}
				});
			}
			else {
				downloader.traceLog('[class::sequential-downloader] [method::getFileChanges] ->  will download all files in the server site.json');
				serverSiteJson.forEach(function (serverSiteItem) {
					result.push({ file: serverSiteItem.file, version: serverSiteItem.version });
				});
			}
			return result;
		},
		buildPath: function (directory, file) {
			return services.extensions.replace(directory + (services.extensions.startsWith(file, '/') ? '' : '/') + file,
				'/',
				services.path.sep);
		},
		flattenSite: function (site) {
			downloader.traceLog('[class::sequential-downloader] [method::flattenSite] -> started');
			var result = [];
			for (var folderIndex = 0; folderIndex < site.folders.length; folderIndex++) {
				var folderItem = site.folders[folderIndex];
				var folder = folderItem.folder;
				if (folder.length > 0 && !services.extensions.startsWith(folder, '/')) {
					folder = '/' + folder;
				}

				for (var fileIndex = 0; fileIndex < folderItem.files.length; fileIndex++) {
					var fileItem = folderItem.files[fileIndex];

					result.push({
						file: folder + (services.extensions.startsWith(fileItem.file, '/') ? '' : '/') + fileItem.file,
						version: fileItem.version
					});
				}
			}
			return result;
		},
		removeOrphanedFiles: function () {
			downloader.traceLog('[class::sequential-downloader] [method::removeOrphanedFiles] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					var flattenedSite = downloader.flattenedSite;
					var rootFolder = configuration.publicDirectory;
					var siteJsonPath = rootFolder + services.path.sep + 'site.json';
					var files = services.io.getFiles(rootFolder);
					var relativePath;
					files.forEach(function (file) {
						if (file === siteJsonPath ||
							file.indexOf('UpdateFiles') > -1 ||
							file.indexOf('public.zip') > -1 ||
							file.indexOf('public.7z') > -1) { //ensure the UpdateFiles is not deleted (we use this to re-host the UpdateFiles for the incountry servers)
							return;
						}
						relativePath = services.extensions.replace(file.substr(rootFolder.length), services.path.sep, '/');
						if (downloader.findSiteItem(flattenedSite, relativePath)) {
							return;
						}

						if (services.fs.existsSync(file)) {
							services.fs.unlinkSync(file);
						}
						downloader.traceLog('[class::sequential-downloader] [method::removeOrphanedFiles] -> removed file = \'' + file + '\'');
					});
					return onSuccess();
				}
				catch (error) {
					downloader.traceLog('[class::sequential-downloader] [method::removeOrphanedFiles] -> unsuccessfully with error : ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		downloadFile: function (data) {
			downloader.traceLog('[class::sequential-downloader] [method::downloadFile] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					var uri = configuration.updateUrl + data.remotepath;
					return services.ioAdapter
						.download(uri)
						.then(function (contents) {
							data.contents = contents;
							return onSuccess(data);
						})
						.catch(function (error) {
							return onError('[class::sequential-downloader] [method::downloadFile] -> error ::' + JSON.stringify(error));
						});
				}
				catch (error) {
					downloader.traceLog('[class::sequential-downloader] [method::downloadFile] -> unsuccessfully with error : ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		processSiteJson: function (data) {
			downloader.traceLog('[class::sequential-downloader] [method::processSiteJson] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					var siteJsonObject = downloader.siteJsonData = JSON.parse(data.contents);
					downloader.flattenedSite = downloader.flattenSite(siteJsonObject);
					var fileChanges = downloader.getFileChanges(downloader.flattenedSite);
					var fileChangesLength = fileChanges.length;
					if (fileChangesLength === 0) {
						downloader.traceLog('[class::sequential-downloader] [method::processSiteJson] -> ALL FILES ARE UP-TO-DATE');
						return onError({ skipRetries: true });
					}
					downloader.traceLog('[class::sequential-downloader] [method::processSiteJson] -> change files count = ' + fileChangesLength);
					var index = 0;
					var successFullyDownloadedAllFiles = true;
					var processFile = function () {
						var siteItem = fileChanges[index];
						var path = downloader.buildPath(configuration.publicStagingDirectory, siteItem.file);
						downloader.downloadFile({
							file: services.path.basename(path),
							directory: services.path.dirname(path),
							path: path,
							remotepath: siteItem.file,
							version: siteItem.version
						})
							.then(services.ioAdapter.writeFileToDisk)
							.then(downloader.validateHash)
							.then(function () {
								index++;
								if (index === fileChangesLength) {
									if (successFullyDownloadedAllFiles) {
										return onSuccess();
									}
									return onError('[class::sequential-downloader] [method::processSiteJson] -> error :: could not download all files in the site.json');
								}
								processFile();
							})
							.catch(function (error) {
								downloader.traceLog('[class::sequential-downloader] [method::processSiteJson] -> unsuccessfully with error : ' + JSON.stringify(error));
								return onError(error);
							});
					}
					processFile();
				}
				catch (error) {
					downloader.traceLog('[class::sequential-downloader] [method::processSiteJson] -> unsuccessfully with error : ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		validateHash: function (data) {
			downloader.traceLog('[class::sequential-downloader] [method::validateHash] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					downloader.traceLog('[class::sequential-downloader] [method::validateHash] -> data.path = \'' + data.path + '\'');
					var fileHash = services.md5File.sync(data.path);
					if (data.version.toUpperCase() === fileHash.toUpperCase()) {
						return onSuccess(data);
					} else {
						var errorMessage = '[validateHash - versions do not match] : data.path = \''
							+ data.path + '\' / server version = \'' + data.version
							+ '\' / local version = \'' + fileHash + '\'';
						data.downloadedSuccessfully = false;
						return onError('[class::sequential-downloader] [method::validateHash] -> error :: ' + errorMessage);
					}
					return onSuccess(data);
				}
				catch (error) {
					downloader.traceLog('[class::sequential-downloader] [method::validateHash] -> unsuccessfully with error : ' + JSON.stringify(error));
					return onError(error);
				}
			});
		}
	}
	return downloader;
}

module.exports = function () {	
var downloader = new SequentialDownloader(new Configuration());
	return {
		updateSite: downloader.updateSite
	}
}