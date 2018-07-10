module.exports = function () {
	var services = {
		repository: require('./modules/repository'),
		clarity: require('./modules/clarity'),
		pushNotification: require('./modules/push-notification')
	};

	return {
		start : function () {	
			services.repository.start();
			services.clarity.start();
			services.pushNotification.start();
		},
		shutdown : function () {
			//services.repository.shutdown();	
			services.clarity.shutdown();
			services.pushNotification.shutdown();
		}
	}
}