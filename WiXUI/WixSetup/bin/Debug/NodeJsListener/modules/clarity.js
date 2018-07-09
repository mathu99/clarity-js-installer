var services = {
    fs: require('fs'),
    path: require('path'),
    restify: require('restify'),
    configuration: require('./configuration'),
    sequentialDownloader: require('./sequential-downloader')(),
    compressedDownloader: require('./compressed-downloader')(),
    pusher: require('./client-pusher'),
    logger: require('./logger'),
    http: require('http'),
    io: require('./io-service')
}

var settings = services.configuration.get('application-settings');
var server = services.restify.createServer({ name: 'clarity' });
var clarityLogger = services.logger.getRotatingLog('clarity', settings.log);
var application = undefined;

var socketManager = (function (port) {
    clarityLogger.info('[class::clarity] [method::socketManager] -> Opening socket on port : ' + port);
    application = services.http.createServer(function (req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>SOCKETS IS OPENED</h2>');
	});
	application = require('http-shutdown')(application);
    var socket = require('socket.io')(application);
    application.listen(port);
    var socketsManager = {
        sendRestartMessage: function () {
            socket.emit('restart', { restart: true });
        }
    }
    return socketsManager;
})(settings.clientNotificationsPort || 51802);

var downloader = (function (sm) {
    var _isBusy = false;
    var retryCount = 0;
    var d = {
        download: function (adapter, cb) {
            clarityLogger.info('[class::clarity] [method::downloader] -> Starting a download process for the adapter : ' + adapter);
            try {
                if (_isBusy) {
                    clarityLogger.info('[class::clarity] [method::downloader] -> the download is currently running for the adapter ' + adapter);
                    if (cb) cb({ success: false, message: 'Download is in progress, be patient ...' })
                    return;
                }
                var isNewInstallation = services.fs.existsSync('./public/config.js');
                if (isNewInstallation || adapter === 'compressedDownloader') {
                    clarityLogger.info('[class::clarity] [method::downloader] -> Calling the updateSite for the adapter : ' + adapter);
                    _isBusy = true;
                    services[adapter].updateSite()
						.then(function () {
						    clarityLogger.info('[class::clarity] [method::downloader] -> Calling the sendRestartMessage to emtting the restart message to the UI');
						    sm.sendRestartMessage();
						    _isBusy = false;
						    if (cb) cb({ success: true, message: 'Download completed successfully, please refresh your browser (CTRL+F5)' });
						})
						.catch(function (error) {
						    _isBusy = false;
						    if (error && error.skipRetries) {
						        if (cb) cb({ success: false, message: '[class::clarity] [method::download] -> Clarity is up-to-date and therefore no files were downloaded' });
						        return;
						    }
						    clarityLogger.info('[class::clarity] [method::downloader] -> Failed to download files with error : ' + JSON.stringify(error));
						    retryCount++;
						    if (retryCount === 3) {
						        clarityLogger.info('[class::clarity] [method::downloader] -> changing adapter from : ' + adapter + ' to compressedDownloader');
						        retryCount = 0;
						        _isBusy = false;
						        d.download('compressedDownloader', cb);
						    }
						});
                }
				else {
					_isBusy = false;
                    d.download('compressedDownloader', cb);
                }
            }
            catch (error) {
                _isBusy = false;
                if (cb) cb({ success: false, message: 'Download failed with error : ' + +JSON.stringify(error) });
            }
            return;
        }
    }
    return d;
})(socketManager);

server.get('/download/site/allfiles', function (req, res) {
    clarityLogger.info('[class::clarity] [handler::get -> /download/site/allfiles] -> started');
    downloader.download('sequentialDownloader', function (data) {
        clarityLogger.info('[class::clarity] [handler::get -> /download/site/allfiles] -> callback after sequentialDownloader');
        if (!data.success) {
            return res.send(200, data);
        }
        clarityLogger.info('[class::clarity] [handler::get -> /download/site/allfiles] -> Calling the rehostZipFile');
        return services.compressedDownloader.rehostZipFile('./public')
			.then(function () {
			    clarityLogger.info('[class::clarity] [handler::get -> /download/site/allfiles] -> A call to rehostZipFile was successful');
			    return res.send(200, data);
			})
		.catch(function (error) {
		    clarityLogger.info('[class::clarity] [handler::get -> /download/site/allfiles] -> A call to rehostZipFile was unsuccessful');
		    return res.send(500, error);
		})
    });
});

server.get('/download/site/compressedfile', function (req, res) {
    clarityLogger.info('[class::clarity] [handler::get -> /download/site/compressedfile] -> Calling the compressedDownloader');
    downloader.download('compressedDownloader', function (data) {
        clarityLogger.info('[class::clarity] [handler::get -> /download/site/compressedfile] -> A callback handler after the compressedDownloader');
        if (!data.success) {
            return res.send(200, data);
        }
        clarityLogger.info('[class::clarity] [handler::get -> /download/site/compressedfile] -> Calling the rehostZipFile');
        return services.compressedDownloader.rehostZipFile('./public')
			.then(function () {
			    clarityLogger.info('[class::clarity] [handler::get -> /download/site/compressedfile] -> A call to was successful');
			    return res.send(200, data);
			})
			.catch(function (error) {
			    clarityLogger.info('[class::clarity] [handler::get -> /download/site/compressedfile] -> A call to was unsuccessful');
			    return res.send(500, error);
			})
    });
});

server.get('/update/server/version', function (req, res) {
    services.pusher.update();
    return res.send(200, { message: 'updated successfully' });
});

server.get('/switchto/:environment/:partition', function (req, res) {
    var environment = req.params.environment;
    var partition = req.params.partition;
    var templateName = './modules/templates/' + environment + '.' + partition + '.server.json';
    if (services.fs.existsSync(templateName)) {
        var contents = services.fs.readFileSync(templateName, 'utf8');
        services.fs.writeFileSync('./modules/configuration/server.json', contents, 'utf8');
        //refresh require cache
        services.sequentialDownloader = require('./sequential-downloader')();
        services.compressedDownloader = require('./compressed-downloader')();
        downloader.download('compressedDownloader', function (data) {
            clarityLogger.info('[class::clarity] [handler::get -> /switchto/:environment/:partition] -> Getting a site after a switch');
            if (services.fs.existsSync('./repository')) {
                services.io.deleteFolderRecursive('./repository');
            }
            return res.send(200, { message: 'switched successfully' });
        });
    }
    else {
        return res.send(404, { message: 'There is no configuration for /' + environment + '/' + partition });
    }
});

server.get(/(.(?!_api))*/, services.restify.serveStatic({
    'directory': services.configuration.baseDirectory() + 'public',
    'default': 'default.html'
}));

module.exports = {
    start: function () {
        var port = settings.clarityPortNumber || 51801;
        server.listen(port, function () {
            var message = '[class::clarity] [method::start] -> Started on port :' + port;
            clarityLogger.info(message);
            var pusherInterval = settings.pusherUpdateIntervalInMinutes * 6000;
            clarityLogger.info('[class::clarity] [method::start] -> Pusher interval set to ' + pusherInterval);
            services.pusher.update();
            setInterval(services.pusher.update, pusherInterval);
            clarityLogger.info('[class::clarity] [method::start] -> Initial download of files');
            downloader.download('sequentialDownloader', function () {
                clarityLogger.info('[class::clarity] [method::start] -> calling rehostZipFile');
                services.compressedDownloader.rehostZipFile('./public');
                clarityLogger.info('[class::clarity] [method::start] -> Starting an interval to do sequentialDownler');
                setInterval(function () {
                    clarityLogger.info('[class::clarity] [method::start] -> Calling sequentialDownloader ::: interval every : ' + settings.updateSiteIntervalInMinutes + ' minutes');
                    downloader.download('sequentialDownloader', function (data) {
                        if (data.successful) {
                            clarityLogger.info('[class::clarity] [method::start] -> Calling the rehostZipFile');
                            services.compressedDownloader.rehostZipFile('./public');
                        }
                    });
                }, settings.updateSiteIntervalInMinutes * 6000);
            });
        });
	},
	shutdown : function () { 
		if (application) application.shutdown();
	}
}