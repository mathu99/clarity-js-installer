var services = {
    fs: require('fs'),
    path: require('path'),
    restify: require('restify'),
    configuration: require('./configuration'),
    io: require('./io-service'),
    logger: require('./logger'),
    printing: require('printer')
};

var _configuration = services.configuration.get('repository');
var _enabled = _configuration.enabled == undefined ? true : _configuration.enabled;
var _log = services.logger.getRotatingLog( 'repository', _configuration.log );
var _repositoryFolder = services.configuration.baseDirectory('repository');

services.restify.CORS.ALLOW_HEADERS.push('komodo-sessiontoken');

var server = services.restify.createServer({ name: 'komodo-api' });

server
    .use(services.restify.queryParser())
	.use(services.restify.bodyParser())
	.use(services.restify.CORS())
	.use(services.restify.fullResponse())
    .use(function (req, res, next) {
        if (req.route.method.toUpperCase() != 'POST') {
            if (!req.accepts('application/json')) {
                res.send(406);
            }
        }
        else if (!req.is('application/json')) {
            res.send(415);
        }

        return next();
    });

function unknownMethodHandler(req, res) {
    if (req.method.toLowerCase() === 'options') {
        var allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'Origin', 'X-Requested-With', 'komodo-sessiontoken', 'countryisocode']; // added Origin & X-Requested-With

        if (res.methods.indexOf('OPTIONS') === -1) res.methods.push('OPTIONS');

        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
        res.header('Access-Control-Allow-Methods', res.methods.join(', '));
        res.header('Access-Control-Allow-Origin', req.headers.origin);

        return res.send(204);
    }
    else
        return res.send(new services.restify.MethodNotAllowedError());
}

server.on('MethodNotAllowed', unknownMethodHandler);

server.get('/', function (req, res, next) {
	if (_enabled) {
		res.charSet('utf-8');
		res.json({
		    version: '2.0.6'
		});
	} else {
		res.send(503);
	}
	
    return next();
});

server.get('/repository/:name/:key', function (req, res, next) {
	var file = _repositoryFolder + req.params.name + services.path.sep + req.params.key + '.json';
	
	if (_enabled) {
		if (services.fs.existsSync(file)) {
			try {
				res.charSet('utf-8');
				res.json(JSON.parse(services.fs.readFileSync(file, 'utf8')));
			} catch (e) {
				res.send(500, e);
			}
		} else {
			res.send(404);
		}
	} else {
		res.send(503);
	}

    return next();
});

server.get('/repository/:name/', function (req, res, next) {
    var i;
    var files;
    var result = [];
    var keysonly = (req.query.keysonly || 'false').toString().toLowerCase() === 'true';
    var folder = _repositoryFolder + req.params.name + services.path.sep;

	if (_enabled) {
		if (services.fs.existsSync(folder)) {
			try {
				files = services.fs.readdirSync(folder);

				for (i = 0; i < files.length; i++) {
					if (keysonly) {
						result.push(services.path.basename(files[i], services.path.extname(files[i])));
					} else {
						result.push(JSON.parse(services.fs.readFileSync(_repositoryFolder + req.params.name + services.path.sep + files[i], 'utf8')));
					}
				}

				res.charSet('utf-8');
				res.json(result);
			} catch (e) {
				res.send(500, e);
			}
		} else {
			res.charSet('utf-8');
			res.json(result);
		}
	} else {
		res.send(503);
	}

    return next();
});

server.post('/repository/:name/:key', function (req, res, next) {
    var folder = _repositoryFolder + req.params.name + services.path.sep;

	if (_enabled) {
		services.io.mkdir(folder);

		services.fs.writeFileSync(folder + req.params.key + '.json', JSON.stringify(req.body));
		res.charSet('utf-8');
		res.json({});
	} else {
		res.send(503);
	}

    return next();
});

server.del('/repository/:name/:key', function (req, res, next) {
    var file = _repositoryFolder + req.params.name + services.path.sep + req.params.key + '.json';

	if (_enabled) {
		if (services.fs.existsSync(file)) {
			services.fs.unlinkSync(file);
		}

		res.charSet('utf-8');
		res.json({});
	} else {
		res.send(503);
	}

    return next();
});

server.del('/repository/:name/', function (req, res, next) {
    var i;
    var files;
    var result = [];
    var folder = _repositoryFolder + req.params.name + services.path.sep;

	if (_enabled) {
		if (services.fs.existsSync(folder)) {
			try {
				files = services.fs.readdirSync(folder);

				for (i = 0; i < files.length; i++) {
					services.fs.unlinkSync(folder + files[i]);
				}

				res.charSet('utf-8');
				res.json(result);
			} catch (e) {
				res.send(500, e);
			}
		}

		res.charSet('utf-8');
		res.json({});
	} else {
		res.send(503);
	}

    return next();
});

server.post('/printReceipt', function (req, res, next) {
    print(req.params, res);
});

function print(options, res) {
    services.printing.print({
        printerText: options.receiptText,
        printerName: options.printer,
        printerType: options.printerType,
        printerIpAddress: options.ipAddress,
        success: function () {
            console.log("Receipt Printed.");
            res.send(204);
        },
        error: function (err) {
            console.log(err);
            res.send(500, err);
        }
    });
   
}

module.exports.start = function() {
	server.listen(_configuration.port, '127.0.0.1', function() {
		_log.info('%s listening at %s', server.name, server.url);
	});
};


