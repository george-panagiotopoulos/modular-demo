const HeadlessV2Module = (() => {
    // Constants for DOM element IDs to avoid magic strings
    const API_CONTROLS_IDS = {
        party: {
            select: 'party-endpoint',
            uriInput: 'party-uri',
            methodSelect: 'party-method',
            payloadInput: 'party-request-payload',
            responseOutput: 'party-response',
            sendButton: 'party-send',
            eventsContainer: 'party-events',
            connectButton: 'party-connect'
        },
        deposits: {
            select: 'deposits-endpoint',
            uriInput: 'deposits-uri',
            methodSelect: 'deposits-method',
            payloadInput: 'deposits-request-payload',
            responseOutput: 'deposits-response',
            sendButton: 'deposits-send',
            eventsContainer: 'deposits-events',
            connectButton: 'deposits-connect'
        },
        lending: {
            select: 'lending-endpoint',
            uriInput: 'lending-uri',
            methodSelect: 'lending-method',
            payloadInput: 'lending-request-payload',
            responseOutput: 'lending-response',
            sendButton: 'lending-send',
            eventsContainer: 'lending-events',
            connectButton: 'lending-connect'
        }
    };
    const LOG_PREFIX = '[HeadlessV2Module]';

    // Store API calls history for each domain - these are not persisted by TabManager
    let partyApiCalls = [];
    let depositsApiCalls = [];
    let lendingApiCalls = [];
    
    // Session management for concurrent connections - BackendConnector handles this now.
    // let sessionId = null; // Replaced by BackendConnector.getSessionId()

    // API endpoints configuration
    const apiEndpoints = {
        party: {
            createCustomer: {
                label: "Create Customer", 
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties",
                defaultMethod: "POST",
                params: [],
                samplePayload: {
                    "dateOfBirth": "1990-05-15",
                    "cityOfBirth": "New York",
                    "firstName": "Alice",
                    "lastName": "Smith",
                    "nickName": "Alice",
                    "nationalities": [
                        {
                            "country": "US"
                        }
                    ],
                    "addresses": [
                        {
                            "communicationNature": "MailingAddress",
                            "communicationType": "Physical",
                            "electronicAddress": "alice.smith@gmail.com",
                            "iddPrefixPhone": "1",
                            "phoneNo": "2125551234",
                            "countryCode": "US",
                            "addressFreeFormat": [
                                {
                                    "addressLine": "123 Main Street, Downtown, New York, New York"
                                }
                            ]
                        }
                    ]
                }
            },
            getCustomerDetails: {
                label: "Get Customer Details", 
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties/{customerId}",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['customerId']
            },
            getPartyByDateOfBirth: {
                label: "Get Party by Date of Birth",
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties?dateOfBirth={dateOfBirth}",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['dateOfBirth']
            },
            getPartyByLastName: {
                label: "Get Party by Last Name",
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties?lastName={lastName}",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['lastName']
            },
            getPartyByPhone: {
                label: "Get Party by Phone Number",
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties?contactNumber={phoneNumber}",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['phoneNumber']
            },
            getPartyByEmail: {
                label: "Get Party by Email",
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties?emailId={email}",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['email']
            },
            getPartyByLastNameAndDOB: {
                label: "Get Party by Last Name & DOB",
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties?lastName={lastName}&dateOfBirth={dateOfBirth}",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['lastName', 'dateOfBirth']
            }
        },
        
        // Deposits/Accounts APIs
        deposits: {
            getPartyArrangements: {
                label: "Get Party Arrangements (Deposits)", 
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/holdings/parties/{partyId}/arrangements",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['partyId']
            },
            getAccountBalance: {
                label: "Get Account Balance", 
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/{accountId}/balances",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['accountId']
            },
            createCurrentAccount: {
                label: "Create Current Account", 
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/currentAccounts",
                defaultMethod: "POST",
                params: [],
                samplePayload: {
                    "parties": [
                        {
                            "partyId": "2513533518",
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
            createTermDeposit: {
                label: "Create Term Deposit",
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-deposits-container/api/v2.0.0/holdings/deposits/termDeposits",
                defaultMethod: "POST",
                params: [],
                samplePayload: {
                    "parties": [
                        {
                            "partyId": "2513533518",
                            "partyRole": "OWNER"
                        }
                    ],
                    "accountName": "MyDepositAccount",
                    "productId": "TermDepositWor",
                    "openingDate": "20250314",
                    "currency": "USD",
                    "branchCode": "01123",
                    "quotationReference": "QUOTABC123",
                    "depositAmount": "5000",
                    "depositTerm": "1Y",
                    "interestPayoutOption": "Settle at Scheduled Frequency",
                    "interestPayoutFrequency": "Monthly",
                    "fundingAccount": "1013717563",
                    "payoutAccount": "1013717563"
                }
            },
            debitAccount: {
                label: "Debit Account",
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/order/payments/debitAccount",
                defaultMethod: "POST",
                params: [],
                samplePayload: {
                    "paymentTransactionReference": "DEBIT_UTILITYBIL_1234567890123_456",
                    "paymentReservationReference": "DEBIT_UTILITYBIL_1234567890123_456",
                    "paymentValueDate": "20250415",
                    "debitAccount": "1013717563",
                    "debitCurrency": "USD",
                    "paymentAmount": "100",
                    "paymentDescription": "Utility Bill Payment"
                }
            },
            creditAccount: {
                label: "Credit Account",
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/order/payments/creditAccount",
                defaultMethod: "POST",
                params: [],
                samplePayload: {
                    "paymentTransactionReference": "CREDIT_SALARY_1234567890123_789",
                    "paymentReservationReference": "CREDIT_SALARY_1234567890123_789",
                    "paymentValueDate": "20250415",
                    "creditAccount": "1013717563",
                    "creditCurrency": "USD",
                    "paymentAmount": "1500",
                    "paymentDescription": "Salary Deposit"
                }
            }
        },
        
        // Lending APIs
        lending: {
            createMortgageLoan: {
                label: "Create Mortgage Loan",
                template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/personalLoans",
                defaultMethod: "POST",
                params: [],
                samplePayload: {
                    "header": {},
                    "body": {
                        "partyIds": [{"partyId": "2513533518", "partyRole": "OWNER"}],
                        "productId": "MORTGAGE.PRODUCT",
                        "currency": "USD",
                        "arrangementEffectiveDate": "",
                        "commitment": [{"amount": "150000", "term": "10Y"}],
                        "schedule": [{"payment": [{}, {"paymentFrequency": "e0Y e1M e0W e0D e0F"}]}],
                        "settlement": [{
                            "payout": [{"payoutSettlement": "YES", "property": [{"payoutAccount": "DDAComposable|GB0010001|1013717563"}]}],
                            "assocSettlement": [
                                {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013717563"}]},
                                {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013717563"}]}
                            ]
                        }]
                    }
                }
            },
            createConsumerLoan: {
                label: "Create Consumer Loan",
                template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/personalLoans",
                defaultMethod: "POST",
                params: [],
                samplePayload: {
                    "header": {},
                    "body": {
                        "partyIds": [{"partyId": "2513533518", "partyRole": "OWNER"}],
                        "productId": "GS.FIXED.LOAN",
                        "currency": "USD",
                        "arrangementEffectiveDate": "",
                        "commitment": [{"amount": "5000", "term": "2Y"}],
                        "schedule": [{"payment": [{}, {"paymentFrequency": "e0Y e1M e0W e0D e0F"}]}],
                        "settlement": [{
                            "payout": [{"payoutSettlement": "YES", "property": [{"payoutAccount": "DDAComposable|GB0010001|1013717563"}]}],
                            "assocSettlement": [
                                {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013717563"}]},
                                {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013717563"}]}
                            ]
                        }]
                    }
                }
            },
            getLoanStatus: {
                label: "Get Loan Status", 
                template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loanId}/status",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['loanId']
            },
            getLoanSchedules: {
                label: "Get Loan Schedules", 
                template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loanId}/schedules",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['loanId']
            },
            disburseLoan: {
                label: "Disburse Loan",
                template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loanId}/disbursement",
                defaultMethod: "PUT",
                samplePayload: {
                    "body": {
                        "currencyId": "USD",
                        "effectiveDate": "20250314",
                        "transactionAmount": 120000
                    }
                },
                params: ['loanId']
            },
            getCustomerArrangements: {
                label: "Get Customer Arrangements",
                template: "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/customers/{customerId}/arrangements",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['customerId']
            }
        }
    };

    // Global color mapping to ensure consistent colors across all streams
    let globalEventColorMap = {};
    let colorAssignmentIndex = 0; // Track next color to assign

    function getEventColor(eventType) {
        // Check if we already have a color assigned to this event type
        if (globalEventColorMap[eventType]) {
            return globalEventColorMap[eventType];
        }
        
        // Expanded color palette with 30 distinct colors for better event type differentiation
        const colors = [
            '#3B82F6', // Blue
            '#10B981', // Green
            '#F59E0B', // Yellow
            '#EF4444', // Red
            '#8B5CF6', // Purple
            '#06B6D4', // Cyan
            '#F97316', // Orange
            '#84CC16', // Lime
            '#EC4899', // Pink
            '#6B7280', // Gray
            '#14B8A6', // Teal
            '#F472B6', // Hot Pink
            '#A855F7', // Violet
            '#22C55E', // Emerald
            '#FB923C', // Amber
            '#38BDF8', // Sky Blue
            '#FBBF24', // Golden Yellow
            '#F87171', // Light Red
            '#A78BFA', // Light Purple
            '#34D399', // Light Green
            '#60A5FA', // Light Blue
            '#FBBF24', // Amber
            '#FB7185', // Rose
            '#C084FC', // Lavender
            '#4ADE80', // Light Lime
            '#FACC15', // Bright Yellow
            '#F472B6', // Magenta
            '#06B6D4', // Bright Cyan
            '#8B5CF6', // Indigo
            '#EAB308'  // Gold
        ];
        
        // Sequential assignment - no collisions possible
        const selectedColor = colors[colorAssignmentIndex % colors.length];
        
        // Store the color mapping globally for this session
        globalEventColorMap[eventType] = selectedColor;
        
        // Move to next color for the next new event type
        colorAssignmentIndex++;
        
        console.log(`Event type: "${eventType}" -> Sequential Index: ${colorAssignmentIndex - 1} -> Color: ${selectedColor}`);
        console.log(`Total unique event types seen: ${Object.keys(globalEventColorMap).length}`);
        
        return selectedColor;
    }

    // --- Utility Functions ---
    function _log(message, type = 'info', data = null) {
        const LOG_LEVELS = { 'info': '#1abc9c', 'warn': '#f1c40f', 'error': '#e74c3c' }; // Teal, Yellow, Red
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

    function formatJSON(json) {
        if (typeof json === 'string') {
            try {
                json = JSON.parse(json);
        } catch (e) {
                return json; // Return as is if not valid JSON string
        }
        }
        return JSON.stringify(json, null, 2);
    }

    // --- API Call UI Functions ---
    function populateApiDropdowns() {
        _log('Populating API dropdowns...');
        Object.keys(API_CONTROLS_IDS).forEach(domain => {
            const selectElement = document.getElementById(API_CONTROLS_IDS[domain].select);
            if (!selectElement) {
                _log(`API select dropdown not found for domain: ${domain}`, 'warn');
                return;
            }
            selectElement.innerHTML = '<option value="">Select API...</option>'; // Clear existing
            if (apiEndpoints[domain]) {
                Object.keys(apiEndpoints[domain]).forEach(apiKey => {
                        const option = document.createElement('option');
                    option.value = apiKey;
                    option.textContent = apiEndpoints[domain][apiKey].label || apiKey;
                        selectElement.appendChild(option);
                });
            }
        });
        _log('API dropdowns populated.');
    }

    function updateUri(domain, endpointKey) {
        const ids = API_CONTROLS_IDS[domain];
        const endpoint = apiEndpoints[domain]?.[endpointKey];
        const uriInput = document.getElementById(ids.uriInput);
        const methodSelect = document.getElementById(ids.methodSelect);
        const payloadInput = document.getElementById(ids.payloadInput);

        if (!uriInput || !methodSelect || !payloadInput) {
             _log(`DOM elements for URI/Method/Payload not found for domain: ${domain}`, 'error');
            return;
        }

        if (endpoint) {
            let uri = endpoint.template;
            methodSelect.value = endpoint.defaultMethod || 'GET';
            
            // Handle parameters by prompting user
            if (endpoint.params && endpoint.params.length > 0) {
                endpoint.params.forEach(param => {
                const paramValue = prompt(`Enter value for ${param}:`);
                uri = uri.replace(`{${param}}`, paramValue || '');
            });
        }
            
            uriInput.value = uri;

            // Handle payload
            if (endpoint.defaultMethod === 'GET') {
                payloadInput.value = '';
            } else if (endpoint.samplePayload) {
                if (typeof endpoint.samplePayload === 'object') {
                    payloadInput.value = JSON.stringify(endpoint.samplePayload, null, 2);
            } else {
                    payloadInput.value = endpoint.samplePayload;
            }
        } else {
                payloadInput.value = '';
            }

             _log(`URI field updated for ${domain} - ${endpointKey}`, 'info', {uri: uriInput.value});
        } else {
            uriInput.value = '';
            methodSelect.value = 'GET';
            payloadInput.value = '';
            _log(`Cleared URI for ${domain} as endpointKey ${endpointKey} is invalid`, 'info');
        }
    }

    async function sendApiRequest(domain) {
        const ids = API_CONTROLS_IDS[domain];
        const method = document.getElementById(ids.methodSelect)?.value;
        const uri = document.getElementById(ids.uriInput)?.value;
        const payloadString = document.getElementById(ids.payloadInput)?.value;
        const responseOutput = document.getElementById(ids.responseOutput);

        if (!method || !uri || !responseOutput) {
            _log('Missing method, URI, or response output element.', 'error', {domain});
            if (responseOutput) responseOutput.textContent = 'Error: Missing required fields.';
            return;
        }

        let payload = null;
        
        // For GET requests, ensure payload is null
        if (method !== 'GET' && payloadString) {
            try {
                payload = JSON.parse(payloadString);
            } catch (e) {
                responseOutput.textContent = `Error parsing JSON payload: ${e.message}`;
                return;
            }
        }
        
        // Show loading state
        responseOutput.textContent = "Sending request...";
        
        try {
            // Make the API call using the original /api/headless/track endpoint
            const response = await fetch('/api/headless/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uri: uri,
                    method: method,
                    payload: payload,
                    domain: domain // Track which domain the call came from
                })
            });
            
            const result = await response.json();
            
            // Update response field
            if (result.api_call && result.api_call.response) {
                // Use plain JSON.stringify for the textarea
                responseOutput.textContent = JSON.stringify(result.api_call.response, null, 2);
                
                // Store API call but don't update events display
                if (domain === 'party') {
                    partyApiCalls.unshift(result.api_call);
                } else if (domain === 'deposits') {
                    depositsApiCalls.unshift(result.api_call);
                } else if (domain === 'lending') {
                    lendingApiCalls.unshift(result.api_call);
                }
            } else if (result.api_call && result.api_call.error) {
                responseOutput.textContent = JSON.stringify(result.api_call.error, null, 2);
            } else {
                responseOutput.textContent = "No response data received from API call";
            }
        } catch (e) {
            console.error('Error making API call:', e);
            responseOutput.textContent = `Error making API call: ${e.message}`;
        }
    }

    // --- Event Streaming UI Functions ---
    function updateEventsUI(domain, eventData) {
        const ids = API_CONTROLS_IDS[domain];
        const eventsContainer = document.getElementById(ids.eventsContainer);
        if (!eventsContainer) {
            _log(`Events container not found for domain: ${domain}`, 'warn');
            return;
        }

        if (eventData.type === 'info') {
                    // Don't show all info messages for party domain to reduce UI updates
                    if (domain !== 'party' || 
                eventData.message.includes('Connecting') || 
                eventData.message.includes('Connected') || 
                eventData.message.includes('Found') ||
                eventData.message.includes('Listening')) {
                        const infoElement = document.createElement('div');
                        infoElement.className = 'mb-1 text-blue-600';
                infoElement.textContent = eventData.message;
                        eventsContainer.insertBefore(infoElement, eventsContainer.firstChild);
                    }
                } 
        else if (eventData.type === 'error') {
                    // Display error message
                    const errorElement = document.createElement('div');
                    errorElement.className = 'mb-1 text-red-600';
            errorElement.textContent = eventData.message;
                    eventsContainer.insertBefore(errorElement, eventsContainer.firstChild);
                }
        else if (eventData.type === 'event') {
            // Format and display event data with original color-coded expandable UI
            displayEventSummary(eventData.data, eventsContainer);
                }
                // Ignore ping messages
    }
    
    function displayEventSummary(eventData, eventsContainer) {
        // Extract event information - use timestamp from eventData, fallback to payload.time
        let timestamp;
        if (eventData.timestamp) {
            // Backend sends timestamp as H:M:S format, convert to full datetime
            const today = new Date();
            const timeStr = eventData.timestamp;
            const [hours, minutes, seconds] = timeStr.split(':');
            today.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds));
            timestamp = today.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } else if (eventData.payload && eventData.payload.time) {
            timestamp = new Date(eventData.payload.time).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } else {
            timestamp = new Date().toLocaleString();
        }
        
        const topicName = eventData.topic || 'Unknown Topic';
        
        // Extract type and businesskey from payload
        let eventType = 'Unknown Type';
        let businessKey = 'Unknown Business Key';
        
        if (eventData.payload && typeof eventData.payload === 'object') {
            eventType = eventData.payload.type || 'Unknown Type';
            businessKey = eventData.payload.businesskey || 'Unknown Business Key';
        }
        
        // Generate a color based on event type
        const eventColor = getEventColor(eventType);
        
        // Create the summary button
        const summaryButton = document.createElement('button');
        summaryButton.className = `w-full text-left p-2 mb-1 rounded text-xs font-medium text-white hover:opacity-80 transition-opacity`;
        summaryButton.style.backgroundColor = eventColor;
        
        summaryButton.innerHTML = `
            <div class="font-bold">${timestamp}</div>
            <div class="mt-1">Topic: ${topicName}</div>
            <div class="mt-1">Type: ${eventType}</div>
            <div class="mt-1">Business Key: ${businessKey}</div>
        `;
        
        // Create the full event details container (initially hidden)
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'hidden mb-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs';
        detailsContainer.innerHTML = `
            <div class="mb-2 font-bold text-teal-700">Full Event Details:</div>
            <div class="mb-2">
                <span class="font-medium">Topic:</span> ${eventData.topic}<br>
                <span class="font-medium">Partition:</span> ${eventData.partition}<br>
                <span class="font-medium">Offset:</span> ${eventData.offset}
            </div>
            <div class="font-medium mb-1">Payload:</div>
            <pre class="whitespace-pre-wrap overflow-x-auto bg-white p-2 rounded border">${formatJSONForDisplay(eventData.payload)}</pre>
        `;
        
        // Add click handler to toggle details
        summaryButton.addEventListener('click', () => {
            if (detailsContainer.classList.contains('hidden')) {
                detailsContainer.classList.remove('hidden');
                summaryButton.style.opacity = '0.7';
            } else {
                detailsContainer.classList.add('hidden');
                summaryButton.style.opacity = '1';
            }
        });
        
        // Create wrapper for the event
        const eventWrapper = document.createElement('div');
        eventWrapper.className = 'mb-2';
        eventWrapper.appendChild(summaryButton);
        eventWrapper.appendChild(detailsContainer);
        
        // Add to the top of the events container (newest first)
        eventsContainer.insertBefore(eventWrapper, eventsContainer.firstChild);
        
        // Limit number of events shown to prevent browser performance issues
        limitEventCount(eventsContainer, 25);
    }
    
    function formatJSONForDisplay(json) {
        if (!json) return '';
        
        try {
            if (typeof json === 'string') {
                json = JSON.parse(json);
            }
            
            const formatted = JSON.stringify(json, null, 2)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
                    function (match) {
                        let cls = 'text-blue-600'; // number
                        if (/^"/.test(match)) {
                            if (/:$/.test(match)) {
                                cls = 'text-teal-700 font-medium'; // key
                            } else {
                                cls = 'text-green-600'; // string
                            }
                        } else if (/true|false/.test(match)) {
                            cls = 'text-purple-600'; // boolean
                        } else if (/null/.test(match)) {
                            cls = 'text-red-600'; // null
                        }
                        return '<span class="' + cls + '">' + match + '</span>';
                    }
                );
                
            return formatted;
        } catch (e) {
            console.error('Error formatting JSON:', e);
            return String(json);
        }
    }

    function limitEventCount(container, maxCount) {
        // Limit number of events shown to prevent browser performance issues
        const children = Array.from(container.children);
        // Keep only the first maxCount real event elements (not info/error messages)
        const eventElements = children.filter(child => 
            child.classList.contains('mb-2') && 
            (child.classList.contains('p-1') || child.querySelector('button'))
        );
        
        if (eventElements.length > maxCount) {
            for (let i = maxCount; i < eventElements.length; i++) {
                if (eventElements[i] && eventElements[i].parentNode === container) {
                    container.removeChild(eventElements[i]);
                }
            }
        }
    }

    function startEventStream(domain) {
        const connectBtn = _getElement(API_CONTROLS_IDS[domain].connectButton);
        const eventsContainer = _getElement(API_CONTROLS_IDS[domain].eventsContainer);
        
        if (!connectBtn || connectBtn.disabled) {
            _log(`Event stream for ${domain} is already active or button is disabled`, 'warn');
            return;
        }
        
        // Show connection in progress
        eventsContainer.innerHTML = '<div class="text-blue-600 font-medium">Connecting to event stream...</div>';
        
        // Create event stream with proper parameter order: url, onMessage, onError, tabName
        BackendConnector.createEventStream(
            `/api/headless-v2/events/${domain}`,
            (eventData) => {
                updateEventsUI(domain, eventData);
            },
            (error) => {
                _log(`Event stream error for ${domain}: ${error}`, 'error');
                eventsContainer.innerHTML = `<div class="text-red-600 font-medium">Connection failed: ${error}</div>`;
                
                // Reset button to connect state with proper blue styling
                connectBtn.disabled = false;
                connectBtn.textContent = 'Connect';
                connectBtn.className = connectBtn.className.replace(/bg-(red|green)-\d+/g, 'bg-blue-600').replace(/hover:bg-(red|green)-\d+/g, 'hover:bg-blue-700');
                if (!connectBtn.className.includes('bg-blue-600')) {
                    connectBtn.className += ' bg-blue-600 hover:bg-blue-700';
                }
                connectBtn.onclick = () => startEventStream(domain);
            },
            'headless-v2' // Pass tabName for TabManager registration
        );
        
        // Update button to disconnect state with red styling immediately
        connectBtn.disabled = false;
        connectBtn.textContent = 'Disconnect';
        // Remove any existing color classes and add red styling
        connectBtn.className = connectBtn.className.replace(/bg-(blue|green)-\d+/g, 'bg-red-600').replace(/hover:bg-(blue|green)-\d+/g, 'hover:bg-red-700');
        if (!connectBtn.className.includes('bg-red-600')) {
            connectBtn.className += ' bg-red-600 hover:bg-red-700';
        }
        
        // Update click handler to disconnect
        connectBtn.onclick = () => stopEventStream(domain);
        
        _log(`Starting event stream for ${domain}`);
    }

    function stopEventStream(domain) {
        _log(`Attempting to stop event stream for domain: ${domain}`);
        const ids = API_CONTROLS_IDS[domain];
        const connectButton = document.getElementById(ids.connectButton);

        BackendConnector.callApi(`/api/headless-v2/events/${domain}/disconnect`, 'POST', { session_id: BackendConnector.getSessionId() })
            .then(() => _log(`Backend disconnect request sent for ${domain}`, 'info'))
            .catch(err => _log(`Backend disconnect request failed for ${domain}`, 'error', err));

        if (connectButton) {
            connectButton.disabled = false;
            connectButton.textContent = 'Connect';
            // Remove any existing color classes and add blue styling
            connectButton.className = connectButton.className.replace(/bg-(red|green)-\d+/g, 'bg-blue-600').replace(/hover:bg-(red|green)-\d+/g, 'hover:bg-blue-700');
            if (!connectButton.className.includes('bg-blue-600')) {
                connectButton.className += ' bg-blue-600 hover:bg-blue-700';
            }
            
            // Restore the original click handler
            connectButton.onclick = () => startEventStream(domain);
        }
        
        const eventsContainer = document.getElementById(ids.eventsContainer);
        if(eventsContainer){
            const p = document.createElement('p');
            p.className = 'text-yellow-400';
            p.textContent = `Event stream for ${domain} disconnected.`;
            eventsContainer.insertBefore(p, eventsContainer.firstChild);
        }
        _log(`Event stream stopped for ${domain}.`, 'info');
    }
    
    function _getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            _log(`Element with ID '${id}' not found.`, 'warn');
        }
        return element;
    }

    const eventListeners = [];

    function _addManagedEventListener(element, type, listener) {
        if (element) {
            element.addEventListener(type, listener);
            eventListeners.push({ element, type, listener });
        } 
    }
    
    function _removeAllManagedEventListeners() {
        _log('Removing all managed event listeners for HeadlessV2Module...');
        eventListeners.forEach(({ element, type, listener }) => {
            if (element) {
                element.removeEventListener(type, listener);
            }
        });
        eventListeners.length = 0; 
        _log('All managed event listeners removed.');
    }

    function setupEventListeners() {
        _log('Setting up event listeners for Headless V2...');
        _removeAllManagedEventListeners(); 

        // Sequence diagram toggle
        const toggleDiagramBtn = document.getElementById('toggle-diagram');
        const diagramContainer = document.getElementById('diagram-container');
        
        if (toggleDiagramBtn && diagramContainer) {
            _addManagedEventListener(toggleDiagramBtn, 'click', () => {
                // Toggle diagram visibility
                if (diagramContainer.style.display === 'none') {
                    diagramContainer.style.display = 'flex';
                    toggleDiagramBtn.textContent = 'Hide Diagram';
                } else {
                    diagramContainer.style.display = 'none';
                    toggleDiagramBtn.textContent = 'Show Diagram';
                }
            });
        }
        
        Object.keys(API_CONTROLS_IDS).forEach(domain => {
            const ids = API_CONTROLS_IDS[domain];
            _addManagedEventListener(_getElement(ids.select), 'change', () => updateUri(domain, _getElement(ids.select).value));
            _addManagedEventListener(_getElement(ids.sendButton), 'click', () => sendApiRequest(domain));
            
            // Set up connect button with proper initial state
            const connectBtn = _getElement(ids.connectButton);
            if(connectBtn) {
                connectBtn.disabled = false;
                connectBtn.textContent = 'Connect';
                // Ensure button starts with blue styling
                connectBtn.className = connectBtn.className.replace(/bg-(red|green)-\d+/g, 'bg-blue-600').replace(/hover:bg-(red|green)-\d+/g, 'hover:bg-blue-700');
                if (!connectBtn.className.includes('bg-blue-600')) {
                    connectBtn.className += ' bg-blue-600 hover:bg-blue-700';
                }
                _addManagedEventListener(connectBtn, 'click', () => startEventStream(domain));
            }
        });
        _log('Event listeners set up for Headless V2.');
    }

    return {
        _domReady: false,
        _pollIntervalId: null,
        _isActivating: false,
        _KEY_ELEMENT_IDS_V2: [
            'party-endpoint',
            'party-send',
            'party-request-payload',
            'party-response',
            'party-uri',
            'party-method',
            'party-connect',
            'party-events',
            'deposits-endpoint',
            'deposits-send',
            'deposits-request-payload',
            'deposits-response',
            'deposits-uri',
            'deposits-method',
            'deposits-connect',
            'deposits-events',
            'lending-endpoint',
            'lending-send',
            'lending-request-payload',
            'lending-response',
            'lending-uri',
            'lending-method',
            'lending-connect',
            'lending-events',
            'toggle-diagram',
            'diagram-container'
        ],
        onInit: function() {
            _log('Initializing...');
            this._domReady = false; 
            this._isActivating = false;
            if (this._pollIntervalId) {
                clearInterval(this._pollIntervalId);
            }
            this._pollIntervalId = null;
        },

        onActivate: function() {
            _log('HeadlessV2 app activated.');
            this._isActivating = true;
            
            // Clear any existing polling intervals
            if (this._pollIntervalId) {
                clearInterval(this._pollIntervalId);
                this._pollIntervalId = null;
            }
            
            // Check if DOM is already ready
            if (this._checkDOMReadyV2()) {
                _log('HeadlessV2 DOM already ready on activation.', 'info');
                this._domReady = true;
                this._initializeHeadlessV2View();
            } else {
                _log('HeadlessV2 DOM not ready on activation. Starting polling...', 'info');
                this._domReady = false;
                this._waitForHeadlessV2DOM();
            }
        },

        onDeactivate: function(isUnloading) {
            _log('HeadlessV2 app deactivated.');
            this._isActivating = false;
            
            // Clear any polling intervals immediately
            if (this._pollIntervalId) {
                clearInterval(this._pollIntervalId);
                this._pollIntervalId = null;
                _log('HeadlessV2 DOM polling stopped due to deactivation.');
            }
            
            // Clean up event listeners and resources
            _removeAllManagedEventListeners();
            
            // Event streams are managed by BackendConnector, no need to clean up here
            
            _log('HeadlessV2 app cleanup completed.');
        },

        onDestroy: function(isUnloading) {
            _log(`Destroying (isUnloading: ${isUnloading})...`);
            this._isActivating = false;
            if (this._pollIntervalId) {
                clearInterval(this._pollIntervalId);
                this._pollIntervalId = null;
            }
            this._domReady = false; 
            _log('Destroyed.');
        },

        // --- Internal DOM Helper Methods (Moved and Updated) ---
        _checkDOMReadyV2: function() {
            for (const id of this._KEY_ELEMENT_IDS_V2) {
                if (!document.getElementById(id)) {
                    _log(`Element ${id} not found yet... (HeadlessV2)`, 'info'); 
                    return false;
                }
            }
            _log('All key DOM elements for HeadlessV2 found!', 'success');
            return true;
        },

        _initializeHeadlessV2View: function() {
            _log('Initializing HeadlessV2 View (DOM is ready)...');
            this._domReady = true;
            populateApiDropdowns();
        setupEventListeners();
            _log('Headless V2 View setup complete.');
        },

        _waitForHeadlessV2DOM: function() {
            if (this._domReady && this._isActivating) {
                _log('_waitForHeadlessV2DOM: DOM already ready and still activating.', 'info');
                this._initializeHeadlessV2View();
                return;
            }
            if (!this._isActivating) {
                 _log('_waitForHeadlessV2DOM: Not activating. Aborting DOM poll.', 'warn');
                 if (this._pollIntervalId) clearInterval(this._pollIntervalId);
                 this._pollIntervalId = null;
                 return;
            }

            _log('_waitForHeadlessV2DOM: Starting to poll for DOM elements...');
            
            if (this._pollIntervalId) clearInterval(this._pollIntervalId);

            let pollCount = 0;
            const maxPolls = 80; // Increased from 40 to 80 (20 seconds)
            const pollInterval = 250; // 250ms intervals
            const self = this; // For setInterval context

            this._pollIntervalId = setInterval(() => {
                if (!self._isActivating) { 
                    clearInterval(self._pollIntervalId);
                    self._pollIntervalId = null;
                    _log('Polling stopped (HeadlessV2): Tab deactivated during DOM check.', 'warn');
                    return;
                }
                pollCount++;
                _log(`HeadlessV2 DOM check attempt ${pollCount}/${maxPolls}`, 'info');
                
                if (self._checkDOMReadyV2()) { 
                    clearInterval(self._pollIntervalId);
                    self._pollIntervalId = null;
                    _log('HeadlessV2 DOM ready! Initializing view...', 'success');
                    self._initializeHeadlessV2View(); 
                } else if (pollCount >= maxPolls) {
                    clearInterval(self._pollIntervalId);
                    self._pollIntervalId = null;
                    _log('Failed to find all HeadlessV2 DOM elements after timeout.', 'error');
                    const tabContentArea = document.getElementById('headless-v2-content-area') || document.getElementById('tab-content-area'); 
                    if (tabContentArea && self._isActivating) { 
                        tabContentArea.innerHTML = '<div class="p-4 text-red-500">Error: Headless V2 interface failed to load. Key elements missing.</div>';
                    }
                }
            }, pollInterval);
        }
    };
})();

// Register with TabManager
function registerHeadlessV2App() {
    if (window.TabManager) {
        window.TabManager.registerTab('headless-v2', HeadlessV2Module);
        console.log('[HeadlessV2Module] Successfully registered with TabManager');
        return true;
    } else {
        console.warn('[HeadlessV2Module] TabManager not found yet. Will retry...');
        return false;
    }
}

// Try to register immediately
if (!registerHeadlessV2App()) {
    // If TabManager not ready, wait and retry
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max
    const retryInterval = setInterval(() => {
        retryCount++;
        if (registerHeadlessV2App()) {
            clearInterval(retryInterval);
        } else if (retryCount >= maxRetries) {
            clearInterval(retryInterval);
            console.error('[HeadlessV2Module] TabManager not found after maximum retries. Ensure tab-manager.js is loaded first.');
        }
    }, 100);
}