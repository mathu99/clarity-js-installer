// string extensions

module.exports.startsWith = function(str, startsWith) {
    return str.indexOf(startsWith) == 0;
};

module.exports.endsWith = function(str, endsWith) {
    return str.indexOf(endsWith, str.length - endsWith.length) !== -1;
};

var escapeRegExp = function(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
};

module.exports.replace = function(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}