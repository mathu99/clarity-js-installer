var services = {
    fs: require( 'fs' ),
    path: require( 'path' ),
    extensions: require('./extensions')
};

var _baseDirectory;
var _rootFolderType = process.env['claritynodejs_rootfolder_type'] || 'system';

if (_rootFolderType.toLowerCase() == 'user') {
    _baseDirectory = process.env['APPDATA'];

    if (!services.extensions.endsWith(_baseDirectory, services.path.sep)) {
        _baseDirectory = _baseDirectory + services.path.sep;
    }

    _baseDirectory = _baseDirectory + 'MultiChoice' + services.path.sep + 'NodeJSListener';
} else {
    _baseDirectory = (process.env['claritynodejs_rootfolder'] ? process.env['claritynodejs_rootfolder'] : '.');
}

if (!services.extensions.endsWith(_baseDirectory, services.path.sep)) {
    _baseDirectory = _baseDirectory + services.path.sep;
}

module.exports.baseDirectory = function(relativePath) {
    var baseDirectory = _baseDirectory;

    if (relativePath) {
        baseDirectory = services.extensions.startsWith(baseDirectory, services.path.sep)
            ? baseDirectory + relativePath.substr(1)
            : baseDirectory + relativePath;

        baseDirectory = services.extensions.startsWith(_baseDirectory, services.path.sep)
            ? baseDirectory
            : baseDirectory + services.path.sep;
    }

    return baseDirectory;
};

module.exports.get = function ( name ) {
    var file = __dirname + services.path.sep + 'configuration' + services.path.sep + name + '.json';

    if ( services.fs.existsSync( file ) ) {
        return JSON.parse( services.fs.readFileSync( file ) );
    } else {
        throw new Error( '[configuration file not found] : file = \'' + file + '\'' );
    }
}