var services = {
    fs: require( 'fs' ),
    path: require( 'path' )
};

module.exports.mkdir = function ( directory, root ) {
    var dirs = directory.split( services.path.sep );
    var dir = dirs.shift();

    root = ( root || '' ) + dir + services.path.sep;

    try {
        services.fs.mkdirSync( root );
    } catch ( e ) {
        if ( !services.fs.statSync( root ).isDirectory() ) {
            throw new Error( e );
        }
    }

    return !dirs.length || exports.mkdir( dirs.join( services.path.sep ), root );
};

var deleteFolderRecursive = function(path) {
    var files;
    
    if( services.fs.existsSync(path) ) {
        files = services.fs.readdirSync(path);
        files.forEach(function(file){
            var curPath = path + services.path.sep + file;
            if(services.fs.lstatSync(curPath).isDirectory()) { 
                deleteFolderRecursive(curPath);
            } else { 
                services.fs.unlinkSync(curPath);
            }
        });
        services.fs.rmdirSync(path);
    }
};

module.exports.deleteFolderRecursive = function(path) {
    return deleteFolderRecursive(path);
};

module.exports.copyFileSync = function(sourcePath, destinationPath) {
    exports.mkdir(services.path.dirname(destinationPath));
    services.fs.writeFileSync(destinationPath, services.fs.readFileSync(sourcePath), 'utf8');
};

module.exports.getFiles = function(directory, recursive) {
    var stat;
    var results = [];
    var entries;
    var path;
    var recurse = recursive || true;

    entries = services.fs.readdirSync(directory);

    entries.forEach(function(entry) {
        path = directory + services.path.sep + entry;

        stat = services.fs.statSync(path);

        if (stat && stat.isDirectory()) {
            if (recurse) {
                results = results.concat(exports.getFiles(path, recurse));
            }
        } else {
            results.push(path);
        }
    });

    return results;
};