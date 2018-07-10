'use strict';

var services = {
	fs : require('fs'),		
	configuration: require('./modules/configuration'),
	clarityService : require('./clarityservice')
};

function Configuration() {
	var serviceUpdaterConfig = services.configuration.get('application-settings');
	var config = {
		serviceUpdateInterval : (serviceUpdaterConfig.serviceUpdateIntervalInMinutes || 480) * 6000,
		rehostUpdateInterval : (serviceUpdaterConfig.rehostUpdateIntervalInMinutes || 240) * 6000
	};
	return config;
}

function rehostUpdateFiles(cb) {
	services.clarityService.updateFiles('replaceUpdateFilesDirectory', './public/UpdateFiles/deploymentmanifest.json', cb);
}

function updateClarityService(cb) {
	services.clarityService.updateFiles('replaceExecutionDirectory', './applicationmanifest.json', cb);
}

var configuration = new Configuration();

(function autoUpdateClarity() {
	services.clarityService.start();	
})();

(function autoUpdateClarityService() {
	updateClarityService(function () {
		if (process.env.ISCLARITYPROXY && process.env.ISCLARITYPROXY === 'TRUE') {			
			rehostUpdateFiles(function () {
				setInterval(rehostUpdateFiles, configuration.rehostUpdateInterval);
			});
		}
		setInterval(updateClarityService, configuration.serviceUpdateInterval);
	});
})();