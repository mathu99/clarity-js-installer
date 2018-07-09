var services = {
	request: require('request'), // https://github.com/mikeal/request
	zlib: require('zlib'),
	fs: require('fs'),
	crypto: require('crypto'),
	path: require('path'),
	configuration: require('./configuration'),
	io: require('./io-service'),
	extensions: require('./extensions'),
	logger: require('./logger'),
	http: require('http'),
	fse: require('fs-extra'),	
	extract : require('extract-zip'),
	resolve: require('path').resolve,
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
	var logger = services.logger.getRotatingLog('compressed-downloader', configuration.log);
	logger.trace('[class::compressed-downloader] [method::Configuration::ctor] -> config :: ' + JSON.stringify(configuration));
	return configuration;
}

function CompressedDownloader(configuration) {
	var logger = services.logger.getRotatingLog('compressed-downloader', configuration.log);
	var downloader = {
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
		rehostZipFile: function (destinationFolder) {
			downloader.traceLog('[class::compressed-downloader] [method::rehostZipFile] -> started ');
			return new Promise(function (onSuccess, onError) {
				if (!process.env.ISCLARITYPROXY || process.env.ISCLARITYPROXY !== 'TRUE') {
					downloader.traceLog('[class::compressed-downloader] [method::rehostZipFile] -> machine is not configured as a server');
					return onSuccess();
				}
				
				try {
					return downloader.downloadFile({
						file: 'public.zip',
						directory: destinationFolder,
						remotepath: 'public.zip',
						path: downloader.buildPath(destinationFolder, 'public.zip')
					})
					.then(services.ioAdapter.writeFileToDisk)
					.then(function () {
						return onSuccess();
					})
					.catch(function (error) {
						downloader.traceLog('');
						downloader.errorLog(error);
						return onError(error);
					});
				}
				catch (error) {
					downloader.traceLog('[class::compressed-downloader] [method::rehostZipFile] -> encountered an error : ' + error);
					return onError(error);
				}
			});
		},
		updateSite: function () {
			downloader.traceLog('[class::compressed-downloader] [method::updateSite] -> started');
			return new Promise(function (onSuccess, onError) {
				downloader.traceLog('[class::compressed-downloader] [method::updateSite] -> Calling the deleteStaging');
				return downloader.deleteStaging()
					.then(function () {
					downloader.traceLog('[class::compressed-downloader] [method::downloadFile] -> Calling the downloadFile');
					return downloader.downloadFile({
						file: 'public.zip',
						directory: configuration.publicStagingDirectory,
						remotepath: 'public.zip',
						path: downloader.buildPath(configuration.publicStagingDirectory, 'public.zip')
					})
					.then(services.ioAdapter.writeFileToDisk)
					.then(downloader.decompressFile)
					.then(downloader.deleteFile)
					.then(downloader.copyFilesFromStaging)
					.then(downloader.deleteStaging)
					.then(function () {
						downloader.traceLog('[class::compressed-downloader] [method::downloadFile] -> Completed Successfully');
						return onSuccess();
					})
					.catch(function (error) {
						downloader.traceLog('[class::compressed-downloader] [method::downloadFile] -> encountered an error ' + JSON.stringify(error));
						return onError(error);
					});
				});
			});
		},
		copyFilesFromStaging: function (data) {
			downloader.traceLog('[class::compressed-downloader] [method::copyFilesFromStaging] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					var sourcePath = services.extensions.replace(configuration.publicStagingDirectory, '/', services.path.sep);
					var destinationPath = services.extensions.replace(configuration.publicDirectory, '/', services.path.sep);
					if (services.fs.existsSync(sourcePath)) {
						services.fse.copySync(sourcePath, destinationPath);
						downloader.traceLog('[class::compressed-downloader] [method::copyFilesFromStaging] -> files copied successfully from [' + sourcePath + '] to [' + destinationPath + ']');
					}
					return onSuccess(data || {});
				}
				catch (error) {
					downloader.traceLog('[class::compressed-downloader] [method::copyFilesFromStaging] -> error ::' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		decompressFile: function (data) {
			downloader.traceLog('[class::compressed-downloader] [method::decompressFile] -> started');
			return new Promise(function (onSuccess, onError) {
				downloader.traceLog('[class::compressed-downloader] [method::decompressFile] -> extracting file : ' + data.file);
				services.extract(services.resolve(data.path), { dir: services.resolve(configuration.publicStagingDirectory) }, function (error) {
					if (error) {
						downloader.traceLog('[class::compressed-downloader] [method::decompressFile] -> error:: ' + JSON.stringify(error));
						return onError(error);
					}
					return onSuccess(data || {});
				});
			});
		},
		deleteStaging: function () {
			downloader.traceLog('[class::compressed-downloader] [method::deleteStaging] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					if (services.fs.existsSync(configuration.publicStagingDirectory)) {
						services.io.deleteFolderRecursive(configuration.publicStagingDirectory);
						downloader.traceLog('[class::compressed-downloader] [method::deleteStaging] ->  successfully deleted path : [' + configuration.publicStagingDirectory + ']');
					}
					return onSuccess();
				}
				catch (error) {
					downloader.traceLog('[class::compressed-downloader] [method::deleteStaging] -> error:: ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		deleteFile: function (data) {
			downloader.traceLog('[class::compressed-downloader] [method::deleteFile] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					if (services.fs.existsSync(data.path)) {
						services.fs.unlinkSync(data.path);
						downloader.traceLog('[class::compressed-downloader] [method::deleteFile] ->  successfully deleted path : [' + data.path + ']');
					}
					return onSuccess(data || {});
				}
				catch (error) {
					downloader.traceLog('[class::compressed-downloader] [method::deleteFile] -> error:: ' + JSON.stringify(error));
					return onError(error);
				}
			});
		},
		buildPath: function (directory, file) {
			return services.extensions.replace(directory + (services.extensions.startsWith(file, '/') ? '' : '/') + file,
				'/',
				services.path.sep);
		},
		downloadFile: function (data) {
			downloader.traceLog('[class::compressed-downloader] [method::downloadFile] -> started');
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
						downloader.traceLog('[class::compressed-downloader] [method::downloadFile] -> error:: ' + JSON.stringify(error));
						return onError(error);
					});
				}
				catch (error) {
					downloader.traceLog('[class::compressed-downloader] [method::downloadFile] -> error:: ' + JSON.stringify(error));
					return onError(error);
				}
			});
		}
	}
	return downloader;
}

module.exports = function () {
	var downloader = new CompressedDownloader(new Configuration());
	return {
		updateSite: downloader.updateSite,
		rehostZipFile: downloader.rehostZipFile
	}
}