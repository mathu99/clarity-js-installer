var services = {
	configuration: require('./configuration'),
	logger: require('./logger'),  
	http : require('http'),
	url : require('url')
}

function Configuration() {
	var settings = services.configuration.get('application-settings');
	var config = {
		enabled: settings.enabled == undefined ? true : settings.enabled,
		log: settings.log,
		port: settings.pushNotificationPort || '51804'
	}
	return config;
}

function PushNotification(configuration) {
	var notification = {
		listener : undefined,
		application : undefined,
		logger: services.logger.getRotatingLog('push-notification', configuration.log),		
		traceLog : function (message) {
			console.log(message);
			notification.logger.info(message);
		},
		errorLog: function (error, nextFunction) {
			var logger = notification.logger;
			if (error.message) {
				logger.error("[Push Notification Service] : " + error.message);
				console.log("[Push Notification Service] : " + error.message);
				if (nextFunction) nextFunction(error.message);
			}
			else {
				logger.error("[Push Notification Service] : " + error);
				console.log("[Push Notification Service] : " + error);
				if (nextFunction) nextFunction(error);
			}
		},
		openSocketsPort : function () {
			notification.traceLog('[openSocketsPort - started]');
			try {
				if (!notification.listener) {
					notification.application = services.http.createServer(function (req, res) {
						try {
							if (req.method === 'POST') {
								var url = req.url;
								notification.traceLog('Posting to URL: ' + url);
								var urlParts = services.url.parse(url, true);
								var route = urlParts.pathname.split('/');
								var routeHasThreeParts = route.length >= 3;
								var pushNotificationIndex = url.toLowerCase().indexOf("pushnotification");
								if (pushNotificationIndex >= 0 && routeHasThreeParts) {
									var messageType = route[pushNotificationIndex + 1];
									var body = '';
									req.on('data', function (data) {
										body += data;
									});
									req.on('end', function () {
										notification.traceLog('Receive message body : ' + body);
										try {
											var payload = body ? JSON.parse(body) : {}
											if (notification.doesUrlHaveQueryParamers(url)) {
												for (var property in urlParts.query) {
													if (urlParts.query.hasOwnProperty(property)) {
														payload[property] = urlParts.query[property];
													}
												}
											}
											var message = { messageType : messageType , payload : payload }
											notification.listener.emit('pushNotification', message);
											res.writeHead(200, { 'Content-Type': 'text/html' });
											res.end('Message got published successfully');
										}
									    catch (error) {
											res.writeHead(400, { 'Content-Type': 'text/html' });
											res.end('<h2>Bad request. Could not parse message body</h2>');
											notification.errorLog(error);
										}
									});
								}							
								else {
									res.writeHead(404, { 'Content-Type': 'text/html' });
									res.end('<h2>Not Found</h2>');
								}
							}
							
							if (req.method === 'GET') {
								res.writeHead(200, { 'Content-Type': 'text/html' });
								res.end('<h2>Push Notification Service is waiting for messages</h2>');
							}
						}
						catch (err) {
							res.writeHead(400, { 'Content-Type': 'text/html' });
							res.end('<h2>Bad request</h2>');
							notification.errorLog(err);
						}
																
					});
					notification.application = require('http-shutdown')(notification.application);
					notification.listener = require('socket.io')(notification.application);
					notification.application.listen(configuration.port);
					notification.traceLog('[openSocketsPort] -  Listened on port : ' + configuration.port);
				}
			}
				catch (error) {
				notification.errorLog(error);
			}
		},
		doesUrlHaveQueryParamers : function (url) {
			if (!url) return false;
			var urlParts = services.url.parse(url, true);
			if (urlParts.query.constructor === Object && Object.keys(urlParts.query).length !== 0) {
				return true;
			}
			return false;
		},
	}
	return notification;
}

module.exports = (function () {
	var config = new Configuration();
	var notification = new PushNotification(config);
	return {
		start : function () {
			notification.openSocketsPort();
		},
		shutdown : function () {
			if (notification.application) notification.application.shutdown();
		}
	};
}());
