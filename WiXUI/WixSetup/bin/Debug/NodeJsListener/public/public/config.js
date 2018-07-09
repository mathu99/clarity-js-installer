var KomodoConfiguration;
var Infrastructure = Infrastructure || {};
Infrastructure.Core = Infrastructure.Core || {};
Infrastructure.Core.Configuration = KomodoConfiguration = {
	"dateFormat": "DD/MM/YYYY",
	"timeFormat": "HH:mm:ss",
	"dateTimeFormat": "DD/MM/YYYY HH:mm:ss",
	"esbDateTimeFormat": "DD/MM/YYYY HH:mm:ss.SSS",
	"version": "LoweTest",
	"apiUrl": "https://clarityafrica.multichoice.co.za/FEFMiddleTier/api",
	"ibsApiUrl": "https://integrationservicesafrica.multichoice.co.za/KomodoQueryAPI/api/",
	"apiRoot": "https://integrationservicesafrica.multichoice.co.za/api",
	"microServiceServer": "#microServiceServer#",
	"reportsUrl": "http://iconnectreports/africa/ICC/Forms/AllItems.aspx",
	"printServerUrl": "#printServerUrl#",
	"microServicePort": 8888,
	"localStorageApiUrl": "http://localhost:51800",
	"localServerRequiredVersion": "2.0.6",
	"pollServerMessagesIntervals": [
		1000,
		1000,
		1000,
		1500,
		1500,
		1500,
		2000,
		2000,
		2000,
		2500,
		2500,
		2500,
		3000,
		3000,
		3000,
		3500,
		3500,
		3500,
		4000,
		4000,
		4000,
		4500,
		4500,
		4500,
		5000,
		5000,
		5000
	],
	"invalidCustomerTypeForHolidayHome": "10,12,13,38,6",
	"maxDaysForPreActivatedQuote": "3",
	"minDaysForPreActivatedQuote": "1",
	"reasonForPreActivateQuote": "890",
	"preActivateQuote": {
		"af": {
			"maxDays": "3",
			"minDays": "1",
			"reason": "1231"
		},
		"nam": {
			"maxDays": "3",
			"minDays": "1",
			"reason": "1231"
		},
		"zaf": {
			"maxDays": "6",
			"minDays": "1",
			"reason": "890",
			"reasons": {
				"gracePeriod": "890",
				"reconnectWithoutPayment": "1134",
				"upDowngradeWithoutPayment": "1234"
			}
		}
	},
	"isCustomerIndicatorlandingScreen": false,
	"homeTileUrls": {
		"nam": {
			"main": "http://en-namibia.selfservice.dstv.com/self-service/",
			"faqs": "http://en-namibia.selfservice.dstv.com/self-service/faqs/",
			"errorCodes": "http://en-namibia.selfservice.dstv.com/self-service/error-codes/",
			"howTos": "http://en-namibia.selfservice.dstv.com/self-service/faqs/troubleshooting/",
			"news": "http://helloafrica/SitePages/default.aspx",
			"navigator": "http://navigatordevportal.somee.com/BusinessProcess.aspx?Country=Namibia"
		},
		"zaf": {
			"main": "http://selfservice.dstv.com/",
			"faqs": "http://selfservice.dstv.com/self-service/faqs/",
			"errorCodes": "http://selfservice.dstv.com/self-service/clear-errors",
			"howTos": "http://selfservice.dstv.com/self-service/how-to/",
			"navigator": "http://navigator/default.aspx"
		}
	},
	"themes": [
		"default",
		"dark",
		"clear"
	],
	"passwordChangeUrl": "https://persona.multichoice.co.za/Persona_FrontEnd/",
	"defaultLanguage": "en",
	"fallbackLanguage": "en",
	"ajaxTimeout": 60000,
	"extendedAjaxTimeout": 180000,
	"searchProcessResponse": {
		"defaultPageSize": 10
	},
	"elasticSearchConfig": {
		"numberOfRecords": 5,
		"default_field": "_all",
		"default_operator": "AND"
	},
	"finiancialAccountTransactionCount": 10,
	"financialAcountsCount": 10,
	"recentCustomerCount": 10,
	"interactionCount": 20,
	"CSICommandValidationInterval": 5,
	"AllowToVisibleNavigationPanel": true,
	"DCCClaimStatus": "Active,Awaiting Payment",
	"exportToExcelCallCount": 500,
	"finance": {
		"paymentArrangementMaximumTerm": 36,
		"paymentArrangementApprovalPageSize": 20,
		"IPDayTolerance": 6
	},
	"sendCaseEmail": {
		"from": "feedback@multichoice.co.za"
	},
	"overrideEmber": false,
	"compatabilityMode": false,
	"channelSplitCompatability": false,
	"stolenDevice": {
		"interactionLocation": "FEF",
		"interactionMedium": "1",
		"category": "2",
		"subCategory": "20",
		"outcome": "89",
		"status": "1",
		"toBeStatus": "10"
	},
	"securityEnvironments": [
		{
			"key": "DevTest AF",
			"value": "Dev Test Africa"
		},
		{
			"key": "UAT AF",
			"value": "UAT Africa"
		},
		{
			"key": "PROD AF",
			"value": "Production Africa"
		},
		{
			"key": "SS AF",
			"value": "Support Slot Africa"
		}
	],
	"downloadUrls": {
		"nodejs": {
			"windows": {
				"installer": "https://clarityafrica.multichoice.co.za/downloads/nodejs/clarityservice.exe"
			}
		}
	}
};