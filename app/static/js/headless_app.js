console.log('[HeadlessModule] Script loaded and executing...');

const HeadlessModule = (() => {
    // Private properties
    let apiCalls = [];
    let apiCallFormListener = null;
    let _domElements = null;
    let _domReady = false;
    let _pollIntervalId = null;
    let _isActivating = false;

    // Key element IDs to check for DOM readiness
    const _KEY_ELEMENT_IDS = [
        'api-uri', 'api-method', 'api-endpoint', 
        'api-request-payload', 'api-response-payload', 
        'event-list', 'api-call-form'
    ];

    const LOG_PREFIX = '[HeadlessModule]';

    // API endpoints configuration
    const apiEndpoints = {
        custom: { 
            label: "Custom URI", 
            template: "" 
        },
        createCustomer: {
            label: "Create Customer", 
            template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties",
            defaultMethod: "POST",
            samplePayload: {
                "dateOfBirth": "2003-05-25",
                "cityOfBirth": "Paris",
                "firstName": "Hannah",
                "middleName": "W",
                "lastName": "Wilson",
                "nickName": "Hannah",
                "suffix": "M.D.",
                "alias": "Hannah"
            }
        },
        createCurrentAccount: {
            label: "Create Current Account", 
            template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/currentAccounts",
            defaultMethod: "POST",
            samplePayload: {
                "parties": [
                    {
                        "partyId": "YOUR_PARTY_ID",
                        "partyRole": "OWNER"
                    }
                ],
                "accountName": "current",
                "openingDate": "20250314",
                "productId": "CHECKING.ACCOUNT",
                "currency": "USD",
                "branchCode": "01123",
                "quotationReference": "QUOT246813"
            }
        },
        branchCreateAccount: {
            label: "Branch - Create Account",
            template: "/api/accounts/create",
            defaultMethod: "POST",
            samplePayload: {
                "partyId": "YOUR_PARTY_ID",
                "productId": "CHECKING.ACCOUNT",
                "currency": "USD"
            }
        },
        getAccountBalance: {
            label: "Get Account Balance", 
            template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/{accountReference}/balances",
            placeholders: { 
                accountReference: "1013715226" 
            },
            defaultMethod: "GET"
        },
        getPartyArrangements: {
            label: "Get Party Arrangements", 
            template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/holdings/parties/{partyId}/arrangements",
            placeholders: { 
                partyId: "YOUR_PARTY_ID" 
            },
            defaultMethod: "GET"
        },
        createLoan: {
            label: "Create Loan", 
            template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/consumerLoans",
            defaultMethod: "POST",
            samplePayload: {
                "header": {},
                "body": {
                    "partyIds": [
                        {
                            "partyId": "YOUR_PARTY_ID",
                            "partyRole": "OWNER"
                        }
                    ],
                    "productId": "MORTGAGE.PRODUCT",
                    "currency": "USD",
                    "arrangementEffectiveDate": "",
                    "commitment": [
                        {
                            "amount": "263388",
                            "term": "106M"
                        }
                    ],
                    "schedule": [
                        {
                            "payment": [
                                {},
                                {
                                    "paymentFrequency": "e0Y e1M e0W e0D e0F"
                                }
                            ]
                        }
                    ],
                    "settlement": [
                        {
                            "payout": [
                                {
                                    "payoutSettlement": "YES",
                                    "property": [
                                        {
                                            "payoutAccount": "DDAComposable|GB0010001|1013715226"
                                        }
                                    ]
                                }
                            ],
                            "assocSettlement": [
                                {
                                    "payinSettlement": "YES",
                                    "reference": [
                                        {
                                            "payinAccount": "DDAComposable|GB0010001|1013715226"
                                        }
                                    ]
                                },
                                {
                                    "payinSettlement": "YES",
                                    "reference": [
                                        {
                                            "payinAccount": "DDAComposable|GB0010001|1013715226"
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        },
        branchCreateLoan: {
            label: "Branch - Create Loan",
            template: "/api/loans/create",
            defaultMethod: "POST",
            samplePayload: {
                "partyId": "YOUR_PARTY_ID",
                "productId": "GS.FIXED.LOAN",
                "currency": "USD",
                "amount": 50000,
                "termYears": 5
            }
        },
        disburseLoan: {
            label: "Disburse Loan",
            template: "http://loans-sandbox.northeurope.cloudapp.azure.com/irf-TBC-loans-container/api/v2.0.0/arrangements/loans/disbursements",
            defaultMethod: "POST",
            samplePayload: {
                "arrangementId": "YOUR_LOAN_ID",
                "amount": "1000.00",
                "currency": "USD",
                "effectiveDate": "20250314",
                "debitAccount": "DDAComposable|GB0010001|YOUR_ACCOUNT_NUMBER"
            }
        },
        arrangements: { 
            label: "Customer Arrangements", 
            template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v7.0.0/holdings/customers/{customerId}/arrangements",
            placeholders: { 
                customerId: "YOUR_CUSTOMER_ID" 
            },
            defaultMethod: "GET"
        },
        schedules: { 
            label: "Loan Schedules", 
            template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loanId}/schedules",
            placeholders: { 
                loanId: "AA250735Y2GS" 
            },
            defaultMethod: "GET"
        },
        status: { 
            label: "Loan Status", 
            template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loanId}/status",
            placeholders: { 
                loanId: "AA250735Y2GS" 
            },
            defaultMethod: "GET"
        }
    };

    // --- Logging ---
    function _log(message, type = 'info', data = null) {
        const LOG_LEVELS = { 'info': '#1abc9c', 'warn': '#f1c40f', 'error': '#e74c3c' };
        const timestamp = new Date().toISOString();
        const consoleMethod = console[type] || console.log;
        const styleHeader = `color: ${LOG_LEVELS[type] || '#1abc9c'}; font-weight: bold;`;
        const styleTimestamp = 'color: #7f8c8d; font-weight: normal;';

        if (data) {
            consoleMethod(
                `%c${LOG_PREFIX}%c [${timestamp}] ${message}`,
                styleHeader,
                styleTimestamp,
                data
            );
        } else {
            consoleMethod(
                `%c${LOG_PREFIX}%c [${timestamp}] ${message}`,
                styleHeader,
                styleTimestamp
            );
        }
    }

    // --- DOM Elements ---
    function getElements() {
        if (!_domElements) {
            _domElements = {
                uriInput: document.getElementById('api-uri'),
                methodSelect: document.getElementById('api-method'),
                endpointSelect: document.getElementById('api-endpoint'),
                requestPayloadTextarea: document.getElementById('api-request-payload'),
                responsePayloadTextarea: document.getElementById('api-response-payload'),
                eventList: document.getElementById('event-list'),
                apiCallForm: document.getElementById('api-call-form')
            };
        }
        return _domElements;
    }

    // --- Data Loading Functions --- 
    function loadHeadlessData() {
        _log("Fetching headless data...");
        fetch(`/api/headless/data?_=${Date.now()}`)
            .then(response => response.ok ? response.json() : Promise.reject(`HTTP error! status: ${response.status}`))
            .then(data => {
                _log("Headless data received:", 'info', data);
                _log(`Found ${data.api_calls ? data.api_calls.length : 0} API calls in history`, 'info');
                apiCalls = data.api_calls || [];
                const events = data.events || [];
                
                // Display all API calls or the first one if multiple exist
                if (apiCalls.length > 0) {
                    _log(`Displaying most recent API call: ${apiCalls[0].uri}`, 'info');
                    // By default show the first API call (most recent)
                    displayApiCall(apiCalls[0]);
                } else {
                    _log("No API calls found in history", 'info');
                }
                
                // Display ALL events from history
                displayEvents(events);
            })
            .catch(error => {
                _log('Error loading headless data:', 'error', error);
                const { responsePayloadTextarea, eventList } = getElements();
                if(responsePayloadTextarea) responsePayloadTextarea.value = `Error loading data: ${error}`;
                if(eventList) eventList.innerHTML = `<li class="text-red-500">Error loading events: ${error}</li>`;
            });
    }

    // Function to show a specific API call (used when viewing loan schedules)
    function showLoanSchedulesApiCall() {
        _log("Showing loan schedules API call");
        // Look for the loan schedules API in our cached API calls
        if (!apiCalls || apiCalls.length === 0) {
            _log("No API calls found in history");
            return false;
        }
        
        // Find the schedules API call
        const schedulesApiCall = apiCalls.find(call => 
            call.uri && call.uri.includes('/loans/') && call.uri.includes('/schedules')
        );
        
        if (schedulesApiCall) {
            _log("Found loan schedules API call:", 'info', schedulesApiCall);
            displayApiCall(schedulesApiCall);
            return true;
        } else {
            _log("No loan schedules API call found in history");
            
            // If no schedules API call found but we have loan API calls, 
            // find the first loan API call to display as a fallback
            const loanApiCall = apiCalls.find(call => 
                call.uri && call.uri.includes('/loans/') && !call.uri.includes('/schedules')
            );
            
            if (loanApiCall) {
                _log("Displaying loan API call as fallback:", 'info', loanApiCall);
                displayApiCall(loanApiCall);
                return true;
            }
        }
        
        _log("No relevant API calls found");
        return false;
    }

    // --- Display Functions ---
    function displayApiCall(callData) {
        _log("Displaying API call:", 'info', callData);
        const { uriInput, methodSelect, requestPayloadTextarea, responsePayloadTextarea, endpointSelect } = getElements();

        if (callData && uriInput && methodSelect && requestPayloadTextarea && responsePayloadTextarea) {
            // Set method
            methodSelect.value = callData.method || 'GET';
            
            // Set URI (include query parameters for GET requests)
            let displayUri = callData.uri || '';
            if (callData.method === 'GET' && callData.params && Object.keys(callData.params).length > 0) {
                // For GET requests, we display parameters in the URI
                const queryParams = new URLSearchParams();
                for (const [key, value] of Object.entries(callData.params)) {
                    queryParams.append(key, value);
                }
                displayUri += '?' + queryParams.toString();
            }
            uriInput.value = displayUri;
            
            // Try to detect which endpoint this is
            let endpointDetected = 'custom';
            for (const [key, endpoint] of Object.entries(apiEndpoints)) {
                if (key !== 'custom' && displayUri.includes(endpoint.template.split('{')[0])) {
                    endpointDetected = key;
                    break;
                }
            }
            endpointSelect.value = endpointDetected;
            
            // Set request payload - only for non-GET methods
            try {
                if (callData.method !== 'GET' && callData.payload) {
                    requestPayloadTextarea.value = JSON.stringify(callData.payload, null, 2);
                } else if (callData.method !== 'GET' && callData.params && Object.keys(callData.params).length > 0) {
                    requestPayloadTextarea.value = JSON.stringify(callData.params, null, 2);
                } else {
                    requestPayloadTextarea.value = callData.method === 'GET' 
                        ? '// No request payload needed for GET requests' 
                        : '// Enter your JSON payload here';
                }
            } catch (error) {
                _log("Error formatting request payload:", 'error', error);
                requestPayloadTextarea.value = '// Error formatting request payload';
            }
            
            // Set response payload - prioritize the most informative response data
            try {
                if (callData.error) {
                    // Show error details if the API call failed
                    responsePayloadTextarea.value = JSON.stringify(callData.error, null, 2);
                } else if (callData.response) {
                    responsePayloadTextarea.value = JSON.stringify(callData.response, null, 2);
                } else {
                    responsePayloadTextarea.value = '// No response data available';
                }
            } catch (error) {
                _log("Error formatting response payload:", 'error', error);
                responsePayloadTextarea.value = '// Error formatting response payload';
            }
        } else {
            // Clear fields if no data
            if(uriInput) uriInput.value = '';
            if(methodSelect) methodSelect.value = 'GET';
            if(requestPayloadTextarea) requestPayloadTextarea.value = '';
            if(responsePayloadTextarea) responsePayloadTextarea.value = '';
        }
    }

    function displayEvents(eventsToDisplay) {
        _log("Displaying events:", 'info', eventsToDisplay);
        const { eventList } = getElements();
        if (!eventList) return;

        eventList.innerHTML = ''; // Clear previous events
        if (eventsToDisplay && eventsToDisplay.length > 0) {
            eventsToDisplay.forEach(event => {
                const listItem = document.createElement('li');
                const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleString() : 'No Timestamp';
                // Basic formatting, consider a more robust approach for complex payloads
                let payloadString = JSON.stringify(event.payload || {});
                if (payloadString.length > 150) { // Truncate long payloads
                    payloadString = payloadString.substring(0, 150) + '...';
                }
                listItem.innerHTML = `
                    <span class="text-teal-600">[${timestamp}]</span> 
                    <span class="font-medium text-gray-700">${event.sourceService || 'Unknown'}</span> - 
                    <span class="italic text-gray-600">${event.eventType || 'Unknown'}</span>: 
                    <span class="text-gray-500">${payloadString}</span>`;
                eventList.appendChild(listItem);
            });
        } else {
             eventList.innerHTML = '<li class="text-gray-400">No relevant events to display.</li>';
        }
    }

    // --- API Handling Functions ---
    function handleEndpointChange() {
        const { endpointSelect, uriInput, methodSelect, requestPayloadTextarea } = getElements();
        const selectedEndpoint = endpointSelect.value;
        const endpointConfig = apiEndpoints[selectedEndpoint];
        
        if (endpointConfig) {
            if (selectedEndpoint === 'custom') {
                // Don't change anything for custom endpoint
                return;
            }
            
            // Set the method
            if (endpointConfig.defaultMethod) {
                methodSelect.value = endpointConfig.defaultMethod;
            }
            
            // Create the URI by replacing placeholders in the template
            let uri = endpointConfig.template;
            if (endpointConfig.placeholders) {
                for (const [key, value] of Object.entries(endpointConfig.placeholders)) {
                    uri = uri.replace(`{${key}}`, value);
                }
            }
            
            uriInput.value = uri;
            
            // Clear or set appropriate request payload
            if (methodSelect.value === 'GET') {
                requestPayloadTextarea.value = '// No request payload needed for GET requests';
            } else if (endpointConfig.samplePayload) {
                // Add sample payload if available
                requestPayloadTextarea.value = JSON.stringify(endpointConfig.samplePayload, null, 2);
            } else {
                requestPayloadTextarea.value = '// Enter your JSON payload here';
            }
        }
    }

    async function sendApiRequest(event) {
        event.preventDefault();
        
        const { uriInput, methodSelect, requestPayloadTextarea, responsePayloadTextarea } = getElements();
        const method = methodSelect.value;
        const uri = uriInput.value.trim();
        
        if (!uri) {
            alert('Please enter a valid URI');
            return;
        }
        
        // Show loading in response textarea
        responsePayloadTextarea.value = 'Loading...';
        
        try {
            // Prepare request options
            const requestOptions = {
                method: method,
                headers: { 'Accept': 'application/json' }
            };
            
            // Add payload for non-GET requests
            if (method !== 'GET' && requestPayloadTextarea.value.trim() && !requestPayloadTextarea.value.startsWith('//')) {
                try {
                    const payload = JSON.parse(requestPayloadTextarea.value);
                    requestOptions.body = JSON.stringify(payload);
                    requestOptions.headers['Content-Type'] = 'application/json';
                } catch (error) {
                    responsePayloadTextarea.value = `Error parsing JSON payload: ${error.message}`;
                    return;
                }
            }
            
            // Make the actual API request
            _log(`Making ${method} request to ${uri}`);
            const response = await fetch(uri, requestOptions);
            
            // Handle the response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                responsePayloadTextarea.value = JSON.stringify(data, null, 2);
                
                // Store API call in history (for display purposes only)
                const apiCall = {
                    uri: uri,
                    method: method,
                    response: data,
                    timestamp: new Date().toISOString()
                };
                
                if (method !== 'GET' && requestOptions.body) {
                    apiCall.payload = JSON.parse(requestOptions.body);
                }
                
                // Add to API calls at the beginning
                apiCalls.unshift(apiCall);
                
                // Send to server to track
                trackApiCall(apiCall);
            } else {
                const text = await response.text();
                responsePayloadTextarea.value = text;
            }
        } catch (error) {
            _log("API request error:", 'error', error);
            responsePayloadTextarea.value = `Error making API request: ${error.message}`;
        }
    }
    
    async function trackApiCall(apiCall) {
        try {
            // Send the API call to the server to track
            const response = await fetch('/api/headless/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uri: apiCall.uri,
                    method: apiCall.method,
                    payload: apiCall.payload,
                    response: apiCall.response
                })
            });
            
            if (!response.ok) {
                _log('Failed to track API call on server', 'warn');
            }
        } catch (error) {
            _log('Error tracking API call:', 'error', error);
        }
    }

    // --- DOM Checking Functions ---
    function _checkDOMReady() {
        for (const id of _KEY_ELEMENT_IDS) {
            if (!document.getElementById(id)) {
                _log(`Element ${id} not found yet...`, 'info'); 
                return false;
            }
        }
        _log('All key DOM elements for Headless found!', 'info');
        return true;
    }

    function _initializeHeadlessView() {
        _log('Initializing Headless View (DOM is ready)...');
        _domReady = true;
        
        // Initialize the headless tab
        loadHeadlessData(); // Load initial data (all events/calls)

        const { apiCallForm, endpointSelect } = getElements();
        
        if (endpointSelect) {
            endpointSelect.addEventListener('change', handleEndpointChange);
        }
        
        if (apiCallForm) {
            apiCallFormListener = sendApiRequest;
            apiCallForm.addEventListener('submit', apiCallFormListener);
        }

        // Make reload function available globally
        window.reloadHeadlessData = loadHeadlessData;
        
        // Make the function to show loan schedules API call available globally
        window.showLoanSchedulesApiCall = showLoanSchedulesApiCall;
        
        _log('Headless View setup complete.');
    }

    function _waitForHeadlessDOM() {
        if (_domReady && _isActivating) {
            _log('_waitForHeadlessDOM: DOM already ready and still activating.', 'info');
            _initializeHeadlessView();
            return;
        }
        if (!_isActivating) {
             _log('_waitForHeadlessDOM: Not activating. Aborting DOM poll.', 'warn');
             if (_pollIntervalId) clearInterval(_pollIntervalId);
             _pollIntervalId = null;
             return;
        }

        _log('_waitForHeadlessDOM: Starting to poll for DOM elements...');
        
        if (_pollIntervalId) clearInterval(_pollIntervalId);

        let pollCount = 0;
        const maxPolls = 80; // 20 seconds
        const pollInterval = 250; // 250ms intervals

        _pollIntervalId = setInterval(() => {
            if (!_isActivating) { 
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                _log('Polling stopped (Headless): Tab deactivated during DOM check.', 'warn');
                return;
            }
            pollCount++;
            _log(`Headless DOM check attempt ${pollCount}/${maxPolls}`, 'info');
            
            if (_checkDOMReady()) { 
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                _log('Headless DOM ready! Initializing view...', 'info');
                _initializeHeadlessView(); 
            } else if (pollCount >= maxPolls) {
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                _log('Failed to find all Headless DOM elements after timeout.', 'error');
                const tabContentArea = document.getElementById('headless-content-area') || document.getElementById('tab-content-area'); 
                if (tabContentArea && _isActivating) { 
                    tabContentArea.innerHTML = '<div class="p-4 text-red-500">Error: Headless interface failed to load. Key elements missing.</div>';
                }
            }
        }, pollInterval);
    }

    // --- Cleanup Functions ---
    function _cleanupEventListeners() {
        _log('Running cleanup for Headless Tab...');
        const { apiCallForm, endpointSelect } = getElements();
        
        if (endpointSelect) {
            endpointSelect.removeEventListener('change', handleEndpointChange);
            _log("Removed endpoint select listener.");
        }
        
        if (apiCallForm && apiCallFormListener) {
            apiCallForm.removeEventListener('submit', apiCallFormListener);
            apiCallFormListener = null;
            _log("Removed API call form listener.");
        }
        
        // Remove the global functions
        if (window.reloadHeadlessData) delete window.reloadHeadlessData;
        if (window.showLoanSchedulesApiCall) delete window.showLoanSchedulesApiCall;
    }

    // --- TabManager Interface ---
    return {
        onInit() {
            _log('onInit called');
            _domReady = false;
            _domElements = null;
            apiCalls = [];
        },

        onActivate(isRestoring) {
            _log(`Activating headless app (isRestoring: ${isRestoring})...`);
            _isActivating = true;
            
            // Clear any existing polling interval
            if (_pollIntervalId) {
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
            }

            if (_domReady && _domElements) {
                _log('DOM already ready, re-initializing view...', 'info');
                _initializeHeadlessView();
                // Always refresh data when tab is activated to show latest API calls
                _log('Refreshing headless data on activation...', 'info');
                loadHeadlessData();
            } else {
                _log('DOM not ready, starting DOM polling...', 'info');
                _waitForHeadlessDOM();
            }
            
            _log('Headless app activation process initiated.');
        },

        onDeactivate(isUnloading) {
            _log('Headless app deactivated.');
            _isActivating = false;
            
            // Clear any polling intervals immediately
            if (_pollIntervalId) {
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                _log('Headless DOM polling stopped due to deactivation.');
            }
            
            // Clean up event listeners
            _cleanupEventListeners();
            
            _log('Headless app cleanup completed.');
        },

        onDestroy(isUnloading) {
            _log(`Destroying headless app (isUnloading: ${isUnloading})...`);
            _isActivating = false;
            if (_pollIntervalId) {
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
            }
            _domReady = false;
            _domElements = null;
            apiCalls = [];
            _cleanupEventListeners();
            _log('Headless app destroyed.');
        }
    };
})();

// Register with TabManager
function registerHeadlessApp() {
    if (window.TabManager) {
        window.TabManager.registerTab('headless', HeadlessModule);
        console.log('[HeadlessModule] Successfully registered with TabManager');
        return true;
    } else {
        console.warn('[HeadlessModule] TabManager not found yet. Will retry...');
        return false;
    }
}

// Try to register immediately
if (!registerHeadlessApp()) {
    // If TabManager not ready, wait and retry
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max
    const retryInterval = setInterval(() => {
        retryCount++;
        if (registerHeadlessApp()) {
            clearInterval(retryInterval);
        } else if (retryCount >= maxRetries) {
            clearInterval(retryInterval);
            console.error('[HeadlessModule] TabManager not found after maximum retries. Ensure tab-manager.js is loaded first.');
        }
    }, 100);
} 