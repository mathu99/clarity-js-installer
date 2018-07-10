var rewire = require('rewire');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var request = require('request');
var expect = chai.expect;
var fs = require('fs');

var should = require('chai').should();
chai.use(chaiAsPromised);

var app = rewire('../modules/clarity-updater.js');

clarityUpdaterService = app.__get__('ClarityUpdaterService');

describe('Clarity Updater', function () {
    
    describe('Extract7ZipSiteToPublicFolder',
        function () {
            //Setup: files directory with a must have public.7z file
            //Extracts the zip file to the files/public directory
            //requires 7z.exe and 7z.dll in the same folder as this test file to execute.
        
            var clarityUpdater;
            var services = sinon.sandbox.create();
        
            beforeEach(function () {
                //Istanbul coverage test executes in a different location
                //This is to check if the folder file exists in the same place the test is executed
                var config;
                if (fs.existsSync('..\\tests\\files\\public.7z')) {
                    config = {
                        publicStagingDirectory: '../tests/files',
                        publicDirectory: '..\\tests\\files\\public\\'
                    };
                } else {
                    config = {
                        publicStagingDirectory: 'tests/files',
                        publicDirectory: 'tests\\files\\public\\'
                    };
                }
            
                app.__set__("ClarityUpdaterConfig", config);
                app.__set__("ClarityUpdaterService", new app.__get__("ClarityUpdater")(config));
            
                clarityUpdater = app.__get__("ClarityUpdaterService");
            });
        
            afterEach(function () {
                if (fs.existsSync('..\\tests\\files\\public\\config.js')) {
                    fs.unlinkSync('..\\tests\\files\\public\\config.js');
                }
                services.restore();
            });
            //Integration Test
            it('should extract the public.7z zip file',
                function () {
                    return clarityUpdater.Extract7ZipSiteToPublicFolder().should.eventually.be.true;
            });
            it('should throw exception due to extraction errors',
                function () {
                    var config = {
                        publicStagingDirectory: undefined,
                        publicDirectory: undefined
                    };
                    app.__set__("ClarityUpdaterConfig", config);
                    app.__set__("ClarityUpdaterService", new app.__get__("ClarityUpdater")(config));
            
                    var clarityUpdaterFailure = app.__get__("ClarityUpdaterService");
            
                    return clarityUpdaterFailure.Extract7ZipSiteToPublicFolder().catch(function (error) {
                    error.should.include('[extract7zipsitetopublicfolder - error] : undefined');
                });
            });
            it('should throw an exception',
                function () {
                    services.stub(app.__get__('Services'));
            
                    return clarityUpdater.Extract7ZipSiteToPublicFolder().catch(function (error) {
                    error.should.include('[extract7zipsitetopublicfolder - error] : TypeError:');
                });
            });
    });
    describe('CreateArrayIterator',
        function () {
        it('should return a function', function () {
            var tech = [50, 20];
            expect(clarityUpdaterService.CreateArrayIterator(tech)).to.be.a('function');
        });
    });
    describe('Data',
        function () {
            it('should return values given on the input',
                function () {
                    var data = new clarityUpdaterService.Data({ "file": "site.json" }, -1);
                    expect(data.siteItem).to.deep.equal({ "file": "site.json" });
                    expect(data.index).to.deep.equal(-1);
                    expect(data.downloadedSuccessfully).to.be.false;
                    expect(data.contents).to.deep.equal.undefined;
                });
    });
    describe('FlattenSite',
        function () {
            it('should return a array with 4 items',
                function() {
                    var siteString =
                        '{"folders": [{"folder": "/Components/connected-clients", "files": [{ "file": "connected-clients-filter-behavior.html", "version": "A00F70B050CA5029035E7A2932160672"}, { "file": "connected-clients-filter-component.html", "version": "572ADC4658C854FA04664BD2839422BE"}, { "file": "connected-clients-list-behavior.html", "version": "A7CB65A41EA77CD3F6D28E0CEAD4864D"}, { "file": "connected-clients-list-component.html", "version": "308B3CF3722FE7441499E1CD31CFD495"}]}]}';
                    var json = JSON.parse(siteString);

                    //var expected = [{ "file": "connected-clients-filter-behavior.html", "version": "A00F70B050CA5029035E7A2932160672" },
                    //    { "file": "connected-clients-filter-component.html", "version": "572ADC4658C854FA04664BD2839422BE" },
                    //    { "file": "connected-clients-list-behavior.html", "version": "A7CB65A41EA77CD3F6D28E0CEAD4864D" },
                    //    { "file": "connected-clients-list-component.html", "version": "308B3CF3722FE7441499E1CD31CFD495" }];

                    var result = clarityUpdaterService.FlattenSite(json);
                    expect(result.length).to.be.equal(4);
                    expect(result).should.be.iterable;
                });
    });
    describe('FindSiteItem',
        function () {
            it('should find site item in JSON file list', function() {
                var siteString = '{"folders": [{"folder": "/Components/connected-clients", "files": [{ "file": "connected-clients-filter-behavior.html", "version": "A00F70B050CA5029035E7A2932160672"}, { "file": "connected-clients-filter-component.html", "version": "572ADC4658C854FA04664BD2839422BE"}, { "file": "connected-clients-list-behavior.html", "version": "A7CB65A41EA77CD3F6D28E0CEAD4864D"}, { "file": "connected-clients-list-component.html", "version": "308B3CF3722FE7441499E1CD31CFD495"}]}]}';
                var expectedResult = {
                    "file": "/Components/connected-clients/connected-clients-list-component.html",
                    "version": "308B3CF3722FE7441499E1CD31CFD495"
                };
                var json = JSON.parse(siteString);
                var site= clarityUpdaterService.FlattenSite(json);
                var result = clarityUpdaterService.FindSiteItem(site, '/Components/connected-clients/connected-clients-list-component.html');           
                expect(result).to.deep.equal(expectedResult);
            });

            it('should not find site item in JSON file list', function () {
                var siteString = '{"folders": [{"folder": "/Components/connected-clients", "files": [{ "file": "connected-clients-filter-behavior.html", "version": "A00F70B050CA5029035E7A2932160672"}, { "file": "connected-clients-filter-component.html", "version": "572ADC4658C854FA04664BD2839422BE"}, { "file": "connected-clients-list-behavior.html", "version": "A7CB65A41EA77CD3F6D28E0CEAD4864D"}, { "file": "connected-clients-list-component.html", "version": "308B3CF3722FE7441499E1CD31CFD495"}]}]}';
                var expectedResult = undefined;
                var json = JSON.parse(siteString);
                var site = clarityUpdaterService.FlattenSite(json);
                var result = clarityUpdaterService.FindSiteItem(site, 'nothing');
                expect(result).to.deep.equal(expectedResult);
            });
    });
    describe('EachLimit',
        function() {
            it('should resolve promise with null values',
                function() {
                    var result = clarityUpdaterService.EachLimit(null, null, null);

                    return expect(result).to.eventually.be.fulfilled;
                });
            it('should iterate a list and resolve once a specified entry has been iterated',
                function () {
                    array = [10, 20, 30, 51, 22, 123, 33, 99];
                    var result = clarityUpdaterService.EachLimit(array, 3, 99);
                    expect(result).to.eventually.be.fufilled;
                });
            it('should iterate through list of files to download, call a custom function defined in this test and fulfill the promise',
                function () {
                    var result = clarityUpdaterService.EachLimit([1],
                        1,
                        function() {
                            return new Promise(function(onSuccess, onError) {
                                return onSuccess(true);
                            });
                        });
                    return expect(result).to.eventually.be.fulfilled;
                });

            //Integration testing
            it('should iterate through list of files to download, call the Download function and try download files within the 3 file limit',
                function () {
                    chai.use(chaiAsPromised);                    
                    var siteString = '{"folders": [{"folder": "/Components/connected-clients", "files": [{ "file": "connected-clients-filter-behavior.html", "version": "A00F70B050CA5029035E7A2932160672"}, { "file": "connected-clients-filter-component.html", "version": "572ADC4658C854FA04664BD2839422BE"}, { "file": "connected-clients-list-behavior.html", "version": "A7CB65A41EA77CD3F6D28E0CEAD4864D"}, { "file": "connected-clients-list-component.html", "version": "308B3CF3722FE7441499E1CD31CFD495"}]}]}';
                    var siteJsonObject = JSON.parse(siteString);
                    var flattenedSite = clarityUpdaterService.FlattenSite(siteJsonObject);
                    var fileChanges = clarityUpdaterService.GetFileChanges(flattenedSite);


                    var result = clarityUpdaterService.EachLimit(fileChanges, 3, clarityUpdaterService.DownloadFile).then(function() {
                        return expect(result).to.eventually.be.rejectedWith("[downloadFile - error] : TypeError: Cannot read property 'length' of undefined");
                    });                   
                });
        });
    describe('SetNewRefreshDate',
        function () {
            it('should return the date and time that is the same as the current date',
                function () {
                    var now = new Date();
                    expect(clarityUpdaterService.SetNewRefreshDate().toString()).to.equal(now.toString());
                }); 
        });
    
    describe('UpdateSite',
        function () {
            //stub the downloadMethod
            var clarityUpdater;
            var services = sinon.sandbox.create();

            var Services = {
                configuration: require('../modules/configuration')
            };

            beforeEach(function () {

            });

            afterEach(function () {
                services.restore();
            });

            it('should reinitialise the nextRefreshDate by 30 minutes', function () {
                var fileConfig = Services.configuration.get('clarity-updater');
                var config = {
                    enabled: true,
                    refreshFrequencyMinutes: fileConfig.refreshFrequencyMinutes
                };
                app.__set__("ClarityUpdaterConfig", config);
                app.__set__("ClarityUpdaterService", new app.__get__("ClarityUpdater")(config));
                clarityUpdater = app.__get__("ClarityUpdaterService");


                services.stub(clarityUpdater, "DownloadMethod",
                    function () { });
                var expectNextRefreshDate = new Date();
                expectNextRefreshDate.setMinutes(expectNextRefreshDate.getMinutes() + 30);
                clarityUpdater.UpdateSite();
                expect(clarityUpdater.nextRefreshDate.toString()).to.equal(expectNextRefreshDate.toString());
            });

            it('should not reinitialise the nextRefreshDate if configuration is set to disabled',
                function() {
                    var fileConfig = Services.configuration.get('clarity-updater');
                    var config = {
                        enabled: false,
                        refreshFrequencyMinutes: fileConfig.refreshFrequencyMinutes,
                        refreshing: undefined
                };
                    app.__set__("ClarityUpdaterConfig", config);
                    app.__set__("ClarityUpdaterService", new app.__get__("ClarityUpdater")(config));
                    clarityUpdater = app.__get__("ClarityUpdaterService");


                    services.stub(clarityUpdater,
                        "DownloadMethod",
                        function() {});
                    var expectNextRefreshDate = new Date();
                    clarityUpdater.UpdateSite();
                    expect(clarityUpdater.nextRefreshDate.toString()).to.equal(expectNextRefreshDate.toString());
                });
            it('should not reinitialise the nextRefreshDate if refreshing is set to true');
            it('should not reinitialise the nextRefreshDate if the current datetime has not reach the intended refresh datetime');
        });
    describe('DownloadMethod',
        function () {
        it('should throw exception');
    });
    describe('DownloadZipFile',
        function () {              
            var errorResult = "[downloadZipFile - error] : Error: Stub";

            beforeEach(function () {
                sinon.stub(request, 'get').throws(new Error("Stub"));
            });

            after(function () {
                request.get.restore();
            });
            
            it('Should throw exception due to invalid request',
                function() {

                    return clarityUpdaterService.DownloadZipFile()
                        .then(function fulfilled(result) {
                                throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
                            },
                            function rejected(error) {
                                expect(error).to.include(errorResult);
                            });
                });
    });
    describe('OpenSiteJson',
        function () {
            it('should throw exception due to null file input',
                function () {
                    return clarityUpdaterService.OpenSiteJson(null)
                        .then(function fulfilled(result) {
                            throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
                        },
                        function rejected(error) {
                            expect(error).to.include('[openSiteJson - error] : failed to process site json');
                        });
                });
            it('should fail with an file that is less than 2 characters',
                function() {
                    var data = new clarityUpdaterService.Data({ "file": "b" }, -1);
                    return clarityUpdaterService.OpenSiteJson(data)
                        .then(function fulfilled(result) {
                                throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
                            },
                            function rejected(error) {
                                expect(error).to.include('[openSiteJson - error] : [openSiteJson - url too short] : url = ');
                            });
                });
            it('should download the site.json file from the server',
                function () {
                    var data = new clarityUpdaterService.Data({ "file": "site.json" }, -1);
                    return clarityUpdaterService.OpenSiteJson(data)
                        .then(function fulfilled(result) {
                                expect(result.contents).to.not.be.null;
                            });
                });
        });
    describe('ProcessSiteJson',
        function () {
            var services = sinon.sandbox.create();

            beforeEach(function () {
                services.stub(clarityUpdaterService, "GetFileChanges", function () { return []; });
                services.stub(clarityUpdaterService, "EachLimit", function () { return true; });
                services.stub(clarityUpdaterService, "CopyFilesFromStaging", function () { return true; });
                services.stub(clarityUpdaterService, "UpdateSiteJson", function () { return true; });
                services.stub(clarityUpdaterService, "DeleteStaging", function () { return true; });
                services.stub(clarityUpdaterService, "RemoveOrphanedFiles", function () { return true; });
                services.stub(clarityUpdaterService, "EmitRestartMessage", function () { return true; });
            });

            afterEach(function () {
                services.restore();
            });

            it('should throw exception due to null file input', function() {
                return clarityUpdaterService.ProcessSiteJson(null)
                    .then(function fulfilled(result) {
                            throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
                        },
                        function rejected(error) {
                            expect(error).to.include('[processSiteJson - error] : failed to process site json - ');
                        });
            });

            it('should process site.json from dev shared debug and find no changes',
                function() {                   
                    var data = new clarityUpdaterService.Data({ "file": "site.json" }, -1);
                    return clarityUpdaterService.OpenSiteJson(data)
                        .then(clarityUpdaterService.ProcessSiteJson).should.be.fulfilled;
                });
        });
    describe('DownloadFile',
        function () {
        it('should throw exception');
    });
    describe('GetFileChanges',
        function () {
        it('should throw exception');
    });
    describe('CopyFilesFromStaging',
            function () {
        it('should throw exception');
    });
    describe('UpdateSiteJson',
        function () {
        it('should throw exception');
    });
    describe('DeleteStaging',
        function () {
        it('should throw exception');
    });
    describe('RemoveOrphanedFiles',
        function () {
        it('should throw exception');
    });
    describe('EmitRestartMessage',
        function () {
        it('should throw exception');
    });
    describe('OpenSocketsPort',
        function () {
        it('should throw exception');
    });


});