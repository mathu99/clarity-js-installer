// CustomActionBase.js 
// 
// Template for WIX Custom Actions written in Javascript.
// This gets compiled with environment variables at build-time

// ===================================================================

if (typeof JSON !== "object") {
    JSON = {};
}

(function () {
    "use strict";

    var rx_one = /^[\],:{}\s]*$/;
    var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
    var rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
    var rx_four = /(?:^|:|,)(?:\s*\[)+/g;
    var rx_escapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    var rx_dangerous = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

    function f(n) {
        // Format integers to have at least two digits.
        return (n < 10)
            ? "0" + n
            : n;
    }

    function this_value() {
        return this.valueOf();
    }

    if (typeof Date.prototype.toJSON !== "function") {

        Date.prototype.toJSON = function () {

            return isFinite(this.valueOf())
                ? (
                    this.getUTCFullYear()
                    + "-"
                    + f(this.getUTCMonth() + 1)
                    + "-"
                    + f(this.getUTCDate())
                    + "T"
                    + f(this.getUTCHours())
                    + ":"
                    + f(this.getUTCMinutes())
                    + ":"
                    + f(this.getUTCSeconds())
                    + "Z"
                )
                : null;
        };

        Boolean.prototype.toJSON = this_value;
        Number.prototype.toJSON = this_value;
        String.prototype.toJSON = this_value;
    }

    var gap;
    var indent;
    var meta;
    var rep;


    function quote(string) {

        // If the string contains no control characters, no quote characters, and no
        // backslash characters, then we can safely slap some quotes around it.
        // Otherwise we must also replace the offending characters with safe escape
        // sequences.

        rx_escapable.lastIndex = 0;
        return rx_escapable.test(string)
            ? "\"" + string.replace(rx_escapable, function (a) {
                var c = meta[a];
                return typeof c === "string"
                    ? c
                    : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
            }) + "\""
            : "\"" + string + "\"";
    }


    function str(key, holder) {

        // Produce a string from holder[key].

        var i;          // The loop counter.
        var k;          // The member key.
        var v;          // The member value.
        var length;
        var mind = gap;
        var partial;
        var value = holder[key];

        // If the value has a toJSON method, call it to obtain a replacement value.

        if (
            value
            && typeof value === "object"
            && typeof value.toJSON === "function"
        ) {
            value = value.toJSON(key);
        }

        // If we were called with a replacer function, then call the replacer to
        // obtain a replacement value.

        if (typeof rep === "function") {
            value = rep.call(holder, key, value);
        }

        // What happens next depends on the value's type.

        switch (typeof value) {
            case "string":
                return quote(value);

            case "number":

                // JSON numbers must be finite. Encode non-finite numbers as null.

                return (isFinite(value))
                    ? String(value)
                    : "null";

            case "boolean":
            case "null":

                // If the value is a boolean or null, convert it to a string. Note:
                // typeof null does not produce "null". The case is included here in
                // the remote chance that this gets fixed someday.

                return String(value);

            // If the type is "object", we might be dealing with an object or an array or
            // null.

            case "object":

                // Due to a specification blunder in ECMAScript, typeof null is "object",
                // so watch out for that case.

                if (!value) {
                    return "null";
                }

                // Make an array to hold the partial results of stringifying this object value.

                gap += indent;
                partial = [];

                // Is the value an array?

                if (Object.prototype.toString.apply(value) === "[object Array]") {

                    // The value is an array. Stringify every element. Use null as a placeholder
                    // for non-JSON values.

                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || "null";
                    }

                    // Join all of the elements together, separated with commas, and wrap them in
                    // brackets.

                    v = partial.length === 0
                        ? "[]"
                        : gap
                            ? (
                                "[\n"
                                + gap
                                + partial.join(",\n" + gap)
                                + "\n"
                                + mind
                                + "]"
                            )
                            : "[" + partial.join(",") + "]";
                    gap = mind;
                    return v;
                }

                // If the replacer is an array, use it to select the members to be stringified.

                if (rep && typeof rep === "object") {
                    length = rep.length;
                    for (i = 0; i < length; i += 1) {
                        if (typeof rep[i] === "string") {
                            k = rep[i];
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (
                                    (gap)
                                        ? ": "
                                        : ":"
                                ) + v);
                            }
                        }
                    }
                } else {

                    // Otherwise, iterate through all of the keys in the object.

                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (
                                    (gap)
                                        ? ": "
                                        : ":"
                                ) + v);
                            }
                        }
                    }
                }

                // Join all of the member texts together, separated with commas,
                // and wrap them in braces.

                v = partial.length === 0
                    ? "{}"
                    : gap
                        ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}"
                        : "{" + partial.join(",") + "}";
                gap = mind;
                return v;
        }
    }

    // If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== "function") {
        meta = {    // table of character substitutions
            "\b": "\\b",
            "\t": "\\t",
            "\n": "\\n",
            "\f": "\\f",
            "\r": "\\r",
            "\"": "\\\"",
            "\\": "\\\\"
        };
        JSON.stringify = function (value, replacer, space) {

            // The stringify method takes a value and an optional replacer, and an optional
            // space parameter, and returns a JSON text. The replacer can be a function
            // that can replace values, or an array of strings that will select the keys.
            // A default replacer method can be provided. Use of the space parameter can
            // produce text that is more easily readable.

            var i;
            gap = "";
            indent = "";

            // If the space parameter is a number, make an indent string containing that
            // many spaces.

            if (typeof space === "number") {
                for (i = 0; i < space; i += 1) {
                    indent += " ";
                }

                // If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === "string") {
                indent = space;
            }

            // If there is a replacer, it must be a function or an array.
            // Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== "function" && (
                typeof replacer !== "object"
                || typeof replacer.length !== "number"
            )) {
                throw new Error("JSON.stringify");
            }

            // Make a fake root object containing our value under the key of "".
            // Return the result of stringifying the value.

            return str("", { "": value });
        };
    }


    // If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== "function") {
        JSON.parse = function (text, reviver) {

            // The parse method takes a text and an optional reviver function, and returns
            // a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

                // The walk method is used to recursively walk the resulting structure so
                // that modifications can be made.

                var k;
                var v;
                var value = holder[key];
                if (value && typeof value === "object") {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


            // Parsing happens in four stages. In the first stage, we replace certain
            // Unicode characters with escape sequences. JavaScript handles many characters
            // incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            rx_dangerous.lastIndex = 0;
            if (rx_dangerous.test(text)) {
                text = text.replace(rx_dangerous, function (a) {
                    return (
                        "\\u"
                        + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
                    );
                });
            }

            // In the second stage, we run the text against regular expressions that look
            // for non-JSON patterns. We are especially concerned with "()" and "new"
            // because they can cause invocation, and "=" because it can cause mutation.
            // But just to be safe, we want to reject all unexpected forms.

            // We split the second stage into 4 regexp operations in order to work around
            // crippling inefficiencies in IE's and Safari's regexp engines. First we
            // replace the JSON backslash pairs with "@" (a non-JSON character). Second, we
            // replace all simple value tokens with "]" characters. Third, we delete all
            // open brackets that follow a colon or comma or that begin the text. Finally,
            // we look to see that the remaining characters are only whitespace or "]" or
            // "," or ":" or "{" or "}". If that is so, then the text is safe for eval.

            if (
                rx_one.test(
                    text
                        .replace(rx_two, "@")
                        .replace(rx_three, "]")
                        .replace(rx_four, "")
                )
            ) {

                // In the third stage we use the eval function to compile the text into a
                // JavaScript structure. The "{" operator is subject to a syntactic ambiguity
                // in JavaScript: it can begin a block or an object literal. We wrap the text
                // in parens to eliminate the ambiguity.

                j = eval("(" + text + ")");

                // In the optional fourth stage, we recursively walk the new structure, passing
                // each name/value pair to a reviver function for possible transformation.

                return (typeof reviver === "function")
                    ? walk({ "": j }, "")
                    : j;
            }

            // If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError("JSON.parse");
        };
    }
}());

// http://msdn.microsoft.com/en-us/library/sfw6660x(VS.85).aspx
var Buttons = {
    OkOnly: 0,
    OkCancel: 1,
    AbortRetryIgnore: 2,
    YesNoCancel: 3
};

var Icons = {
    Critical: 16,
    Question: 32,
    Exclamation: 48,
    Information: 64
};

var MsgKind = {
    Error: 0x01000000,
    Warning: 0x02000000,
    User: 0x03000000,
    Log: 0x04000000
};

function ServerFile(countryConfig) {
    this.clarityUpdateUrl = countryConfig + "/komodoui.ui";
    this.updateUrl = countryConfig + "/komodoui.ui/UpdateFiles";
    this.pusherUrl = countryConfig + "/Fefmiddletier/api/ConnectedUsers";
}

ServerFile.prototype.toJsonString = function() {    /* Returns the server.json structure */
    return '{\n\t\"clarityUpdateUrl\": \"http://' + this.clarityUpdateUrl + '\",\n\t\"updateUrl\": \"http://' + this.updateUrl + '\",\n\t\"pusherUrl\": \"http://' + this.pusherUrl + '\"\n}';
}

// http://msdn.microsoft.com/en-us/library/aa371254(VS.85).aspx
var MsiActionStatus = {
    None: 0,
    Ok: 1, // success
    Cancel: 2,
    Abort: 3,
    Retry: 4, // aka suspend?
    Ignore: 5  // skip remaining actions; this is not an error.
};

// http://msdn.microsoft.com/en-us/library/d5fk67ky(VS.85).aspx
var WindowStyle = {
    Hidden: 0,
    Minimized: 1,
    Maximized: 2
};

// http://msdn.microsoft.com/en-us/library/314cz14s(v=VS.85).aspx
var OpenMode = {
    ForReading: 1,
    ForWriting: 2,
    ForAppending: 8
};

// http://msdn.microsoft.com/en-us/library/a72y2t1c(v=VS.85).aspx
var SpecialFolders = {
    WindowsFolder: 0,
    SystemFolder: 1,
    TemporaryFolder: 2
};

var urlEndpoint = 'http://03rnb-esbsyn96.za.ds.naspers.com:9998'; //'http://10.100.27.213/fefmiddletier-tripod/api/installationconfiguration';/* 'http://03rnb-esbsyn96.za.ds.naspers.com:9998';

function GetCountiresCA() {
    try {
        LogMessage("Initiating GetCountires");
        var countries = HttpGet(urlEndpoint + '/api/servers');
        if (countries.servers === null || countries.servers.length === 0) {
            LogMessage('Unable to retrieve country list, installer will exit.  please contact support', MsgKind.Error);
        } else {
            for (var i = 0; i < countries.servers.length; i++) {
                FillComboBox('COUNTRIES', i, countries.servers[i].name, countries.servers[i].alias);
            }
        }
        Session.Property("COUNTRIES") = countries.servers[0].alias;   /* Default to first */
    }
    catch (err) {
        Session.Property("CA_EXCEPTION") = err.message;
        LogMessage('GetCountiresCA - ' + err.message, MsgKind.Error);
        return MsiActionStatus.Abort;
    }
    LogMessage("Goodbye from GetCountires");
    return MsiActionStatus.Ok;
}

function GetBranchesCA() {
    try {
        LogMessage("Initiating GetBranchesCA");
        var branches = HttpGet(urlEndpoint + '/api/branchServers/' + Session.Property('SELECTEDCOUNTRY'));
        if (branches.branches === null || branches.branches.length === 0) {
            LogMessage('Unable to retrieve branch server list, installer will exit. Please contact support', MsgKind.Error);
        } else {
            for (var i = 0; i < branches.branches.length; i++) {
                FillComboBox('BRANCHES', i, branches.branches[i].name, branches.branches[i].server);
            }
        }
        LogMessage('Branch selection default: ' + branches.branches[0].name);
        Session.Property("BRANCHES") = branches.branches[0].server;   /* Default to first */
    }
    catch (err) {
        Session.Property("CA_EXCEPTION") = err.message;
        LogMessage('GetBranchesCA - ' + err.message, MsgKind.Error);
        return MsiActionStatus.Abort;
    }
    LogMessage("Goodbye from GetBranchesCA");
    return MsiActionStatus.Ok;
}

function CreateServerFileCA() {
    var caData = Session.Property("CustomActionData").split(';');    //[0] INSTALLEDPATH [1] SELECTEDCOUNTRY [2] SELECTEDBRANCH
    var installedPath = caData[0].split('INSTALLEDPATH=')[1],
        selectedCountry = caData[1].split('SELECTEDCOUNTRY=')[1],
        selectedBranch = caData[2].split('SELECTEDBRANCH=')[1];
    LogMessage('server.json file will be written to: ' + installedPath + ' for country: ' + selectedCountry);
    var serverFile = new ServerFile(selectedBranch);
    LogMessage(serverFile.toJsonString());
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var createdFile = fso.CreateTextFile(installedPath + '\\modules\\configuration\\server.json', true);
    createdFile.WriteLine(serverFile.toJsonString());
    createdFile.Close();
    LogMessage('Goodbye from CreateServerFile');
}


function FillComboBox(property, index, text, value) {
    try {
        var controlView = Session.Database.OpenView("SELECT * FROM ComboBox");
        controlView.Execute();
        var record = Session.Installer.CreateRecord(4);
        record.StringData(1) = property;
        record.IntegerData(2) = index;
        record.StringData(3) = value;
        record.StringData(4) = text;
        controlView.Modify(7, record);
        controlView.Close();
    }
    catch (err) {
        LogMessage('Couldn\'t add ListItem entry, error occured: ' + err.message, MsgKind.Warning);
    }
}

function HttpGet(url) {
    LogMessage('GET call to: ' + url);
    var xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');
    xmlhttp.open('GET', url, false);
    xmlhttp.send();
    var strResponse = xmlhttp.ResponseText;
    var jsonStr = JSON.parse(strResponse);
    LogMessage('JSON response: ' + strResponse);
    return jsonStr;
}


// spool a message into the MSI log, if it is enabled - if Warn or Error will pop up msg box
function LogMessage(msg, options) {
    if (options == null) {
        var options = MsgKind.Log;
    }
    var oRecord = Session.Installer.CreateRecord(1);
    oRecord.StringData(1) = 'Clarity Service Installer:: ' + msg;
    var response = Session.Message(options, oRecord);
    oRecord.ClearData();
    oRecord = null;
    response = null;
}


// Run a command via cmd.exe from within the MSI
function RunCmd(command, parseOutput) {
    var wshell = new ActiveXObject("WScript.Shell");
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var tmpdir = fso.GetSpecialFolder(SpecialFolders.TemporaryFolder);
    var tmpFileName = fso.BuildPath(tmpdir, fso.GetTempName());
    var deleteOutput = false;

    LogMessage("shell.Run(" + command + ")");
    LogMessage(tmpFileName)


    
    // use cmd.exe to redirect the output
    //wshell.run("cmd.exe /c curl http://localhost:9998/api/servers > C:\\Temp\\txt.txt")
    var rc = wshell.exec("%comspec% /c " + command + "> C:\\Temp\\txt.txt");
    //var rc = wshell.run("%comspec% /c " + command + "> C:\\Temp\\txt.txt", WindowStyle.Hidden, true);
    //LogMessage("shell.Run rc = " + rc);

    // here, optionally parse the output of the command 
    /*if (parseOutput) {
        var textStream = fso.OpenTextFile(tmpFileName, OpenMode.ForReading);
        while (!textStream.AtEndOfStream) {
            var oneLine = textStream.ReadLine();
            LogMessage(oneLine);
            var line = ParseOneLine(oneLine);
        }
        textStream.Close();
    }

    if (deleteOutput) {
        fso.DeleteFile(tmpFileName);
    }

    return {
        rc: rc,
        outputfile: (deleteOutput) ? null : tmpFileName
    };*/
}