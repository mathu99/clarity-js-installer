var services = {
    io: require( './io-service' ),
    bunyan: require( 'bunyan' ),
    configuration: require('./configuration')
};

module.exports.getRotatingLog = function ( name, options ) {
    var o = options || {};
    var baseDirectory = services.configuration.baseDirectory('logs');
    
    services.io.mkdir( baseDirectory );

    return services.bunyan.createLogger( {
        name: name,
        level: o.level || 'info',
        streams: [{
            type: 'rotating-file',
            path: baseDirectory + name + '.log',
            period: o.period || '1d',
            count: o.count || 5
        }]
    });
};
