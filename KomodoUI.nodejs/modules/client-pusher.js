var services = {
    request: require('request'), // https://github.com/mikeal/request
    zlib: require('zlib'),
    crypto: require('crypto'),
    http: require('http'),
    path: require('path'),
    fs: require('fs'),
    configuration: require('./configuration'),
    extensions: require('./extensions'),
    logger: require('./logger'),
    os: require('os')
}

function Configuration() {
    var settings = services.configuration.get('application-settings');
    var serverConfiguration = services.configuration.get('server');
	var baseDirectory = services.configuration.baseDirectory();	
    var config = {
        enabled: settings.enabled == undefined ? true : settings.enabled,
        log: settings.log,
        hostUrl: services.extensions.endsWith(serverConfiguration.pusherUrl, '/') ? serverConfiguration.pusherUrl : serverConfiguration.pusherUrl + '/',
        path: settings.path,
        baseDirectory: baseDirectory,
        publicDirectory: baseDirectory + 'public'
	}
	var logger = services.logger.getRotatingLog('client-pusher', config.log);
	logger.trace('[class::client-pusher] [method::Configuration::ctor] -> config :: ' + JSON.stringify(config));
    return config;
}

function ClarityPusher(configuration) {
    var logger = services.logger.getRotatingLog('client-pusher', configuration.log);
    var pusher = {        
        getSelectedCountryFile: function(){
            return '.' +
                services.path.sep +
                'repository' +
                services.path.sep +
                'Cache' +
                services.path.sep +
                'selectedCountry.json';
        },
        baseDirectory: services.configuration.baseDirectory(),
        getClientIpAddress: function () {			
			pusher.traceLog('[class::client-pusher] [method::getClientIpAddress] -> started ');
            var addresses = [];
            var networkInterfaces = services.os.networkInterfaces();
            for (var networkInterface in networkInterfaces) {
                if (networkInterfaces.hasOwnProperty(networkInterface)) {
                    var interfaces = networkInterfaces[networkInterface];
                    for (var specificNetworkInterface in interfaces) {
                        if (interfaces.hasOwnProperty(specificNetworkInterface)) {
                            var address = interfaces[specificNetworkInterface];
                            if (address.family === 'IPv4' && !address.internal) {
                                addresses.push(address.address);
                            }
                        }
                    }
                }
            }
            return addresses;
        },
        getClientDetails: function () {
            pusher.traceLog('[class::client-pusher] [method::getClientDetails] -> started ');
            return new Promise(function (onSuccess, onError) {
                try {
                    var countryCodeContent = JSON.parse(services.fs.readFileSync(pusher.getSelectedCountryFile(), "utf8"));
                    var versionPath = '.' + services.path.sep + 'public' + services.path.sep + 'version.json';
                    var version = JSON.parse(services.fs.readFileSync(versionPath, "utf8"));
                    var ipAddresses = pusher.getClientIpAddress();
                    var obj = {
                        IpAddress: ipAddresses.length > 0 ? ipAddresses[0] : '0.0.0.0',
                        MachineName: services.os.hostname(),
                        Version: version.release,
                        DateLastUpdated: new Date(),
                        CountryCode: countryCodeContent.data.countryId
                    }
                    pusher.traceLog('[class::client-pusher] [method::getClientDetails] -> obj :: ' + JSON.stringify(obj));
                    return onSuccess(obj);
                }
                catch (error) {
                    pusher.traceLog('[class::client-pusher] [method::getClientDetails] -> got an error :: ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        update: function () {

            if (!services.fs.existsSync(pusher.getSelectedCountryFile()) ||
                !services.fs.existsSync('.' + services.path.sep + 'public')) {
                return;
            }
            
            pusher.traceLog('');
            pusher.getClientDetails()
			   .then(pusher.sendClientDetailsToServer)
			   .then(function () {
			       pusher.traceLog('');
			   })
			   .catch(function (error) {
			       pusher.traceLog('');
			       pusher.errorLog(error);
			   });


        },
        sendClientDetailsToServer: function (clientDetails) {
			//pusher.traceLog('[sendClientDetailsToServer]');
			pusher.traceLog('[class::client-pusher] [method::sendClientDetailsToServer] -> started ');
            return new Promise(function (onSuccess, onError) {
                try {                  
                    var data = JSON.stringify(clientDetails);                    
                    services.request({
                        uri: configuration.hostUrl,
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        body: data
                    },
				    function (error, res, body) {
						if (error || res.statusCode !== 200) {
							pusher.errorLog('[class::client-pusher] [method::sendClientDetailsToServer] -> failed with error ' + JSON.stringify(error));
				            return onError('[sendClientDetailsToServer - error from server] : ' + (error || body));
						}
						pusher.errorLog('[class::client-pusher] [method::sendClientDetailsToServer] -> successful ');
				        return onSuccess();
				    });
                }
                catch (error) {
					pusher.errorLog('[class::client-pusher] [method::sendClientDetailsToServer] -> failed with error ' + JSON.stringify(error));
                    return onError(error);
                }
            });
        },
        traceLog: function (message) {
            console.log(message);
            logger.trace(message);
        },
        errorLog: function (message) {
            console.error(message);
            logger.error(message);
        }
    }
    return pusher;
}

var configuration = new Configuration();
var pusher = new ClarityPusher(configuration);

module.exports = {
    update: function () {
        pusher.update();
    }
}