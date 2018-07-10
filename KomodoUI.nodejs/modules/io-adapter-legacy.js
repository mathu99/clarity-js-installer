var services = {
	request: require('request'),
	logger: require('./logger'),
	configuration: require('./configuration'),
	fs: require('fs'),
	io: require('./io-service'),
	zlib : require('zlib'),
	//fetch : require('node-fetch') //This requires a new package. It makes code (method::download) concise, though.
}

var Adapter = function () {
	var settings = services.configuration.get('application-settings');
	var logger = services.logger.getRotatingLog('io-adapter', settings.log);
	var adapter = {
		traceLog: function (message) {
			console.log(message);
			logger.trace(message);
		},
		errorLog: function (message) {
			console.error(message);
			logger.error(message);
		},
		//download: function (uri) {
		//	adapter.traceLog('[class::io-adapter] [method::download] -> started');
		//	return new Promise(function (onSuccess, onError) {
		//		try {
		//			services.fetch(uri).then(function (res) {
		//				return onSuccess(res.buffer());
		//			});
		//		}
		//		catch (error) { 
		//			return onError(error);
		//		}
		//	});
		//},			
		download: function (uri) {
			adapter.traceLog('[class::io-adapter] [method::download] -> started');
			return new Promise(function (onSuccess, onError) {
				
				var options = {
					uri: uri,
					headers: { "accept-encoding": "gzip,deflate" },
					connection: "keep-alive"
				}
				
				var request = services.request.get(options);
				request.on('response', function (res) {
					
					if (res.statusCode !== 200) {
						adapter.traceLog('[class::io-adapter] [method::download] -> could not download resource :: ' + uri + ' status code :: ' + res.statusCode);
						return onError('could not download resource :: ' + uri + ' status code :: ' + res.statusCode);
					}

					var chunks = [];
					res.on('data', function (chunk) {
						chunks.push(chunk);
					});
					res.on('end', function () {
						var buffer = Buffer.concat(chunks);
						var encoding = res.headers['content-encoding'];
						if (encoding === 'gzip') {
							services.zlib.gunzip(buffer, function (error, decoded) {
								if (error) return onError(error);
								return onSuccess(decoded);
							});
						} else if (encoding === 'deflate') {
							services.zlib.inflate(buffer, function (error, decoded) {
								if (error) return onError(error);
								return onSuccess(decoded);
							});
						} else {
							return onSuccess(buffer);
						}
					});
					res.on('error', function (error) {
						adapter.traceLog('[class::io-adapter] [method::download] -> error:: ' + JSON.stringify(error));
						return onError(error);
					});
				});
				
				request.on('error', function (error) {
					var errorMessage = error + ", could not connect to url : [" + uri + "]";
					adapter.traceLog('[class::io-adapter] [method::download] -> error:: ' + errorMessage);
					return onError(errorMessage);
				});
			});
		},
		writeFileToDisk: function (data) {
			adapter.traceLog('[class::io-adapter] [method::writeFileToDisk] -> started');
			return new Promise(function (onSuccess, onError) {
				try {
					adapter.traceLog('[class::io-adapter] [method::writeFileToDisk] -> fileName :: ' + data.path);
					if (data.directory && !services.fs.existsSync(data.directory)) {
						services.io.mkdir(data.directory);
					}
					services.fs.writeFileSync(data.path, data.contents, 'utf8');
					return onSuccess(data);
				}
		        catch (error) {
					adapter.traceLog('[class::io-adapter] [method::writeFileToDisk] -> error :: ' + JSON.stringify(error));
					return onError(error);
				}
			});
		}
	}
	return adapter;
}

var ioAdapter = new Adapter();

module.exports = {
	download: ioAdapter.download,
	writeFileToDisk: ioAdapter.writeFileToDisk
}