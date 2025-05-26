(function() {
    // Headless V2 Tab specific JavaScript
    console.log("headless_v2_app.js loaded and executing");

    // Store API calls history for each domain
    let partyApiCalls = [];
    let depositsApiCalls = [];
    let lendingApiCalls = [];
    
    // Store EventSource objects for Kafka event streaming
    let partyEventSource = null;
    let depositsEventSource = null;
    let lendingEventSource = null;

    // API endpoints configuration
    const apiEndpoints = {
        // Party/Customer APIs
        party: {
            createCustomer: {
                label: "Create Customer", 
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties",
                defaultMethod: "POST",
                samplePayload: {
                    "dateOfBirth": "1990-05-15",
                    "cityOfBirth": "London",
                    "firstName": "Alice",
                    "middleName": "M",
                    "lastName": "Smith",
                    "nickName": "Alice",
                    "suffix": "B.A.",
                    "alias": "Alice"
                }
            },
            getCustomerDetails: {
                label: "Get Customer Details", 
                template: "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties/{customerId}",
                defaultMethod: "GET",
                samplePayload: "",
                params: ['customerId']
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
            debitAccount: {
                label: "Debit Account",
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/transactions",
                defaultMethod: "POST",
                samplePayload: {
                    "accountId": "DDAComposable|GB0010001|YOUR_ACCOUNT_NUMBER",
                    "amount": "100.00",
                    "currency": "USD",
                    "transactionType": "DEBIT",
                    "paymentValueDate": "20250314",
                    "description": "Test debit transaction"
                }
            },
            creditAccount: {
                label: "Credit Account",
                template: "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/transactions",
                defaultMethod: "POST",
                samplePayload: {
                    "accountId": "DDAComposable|GB0010001|YOUR_ACCOUNT_NUMBER",
                    "amount": "100.00",
                    "currency": "USD",
                    "transactionType": "CREDIT",
                    "paymentValueDate": "20250314",
                    "description": "Test credit transaction"
                }
            }
        },
        
        // Lending APIs
        lending: {
            createLoan: {
                label: "Create Loan",
                template: "http://loans-sandbox.northeurope.cloudapp.azure.com/irf-TBC-loans-container/api/v2.0.0/arrangements/loans",
                defaultMethod: "POST",
                samplePayload: {
                    "partyIds": [
                        {
                            "partyId": "YOUR_PARTY_ID",
                            "partyRole": "BORROWER"
                        }
                    ],
                    "productId": "PERSONAL.LOAN",
                    "currency": "USD",
                    "commitment": {
                        "amount": "10000.00",
                        "termYears": "5"
                    },
                    "arrangementEffectiveDate": "20250314",
                    "schedule": {
                        "paymentFrequency": "MONTHLY"
                    },
                    "settlement": {
                        "disburseAccount": "DDAComposable|GB0010001|YOUR_ACCOUNT_NUMBER"
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
            }
        }
    };

    // --- Helper Functions ---
    function formatJSON(json) {
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

    function populateApiDropdowns() {
        const columns = ['party', 'deposits', 'lending'];
        columns.forEach(column => {
            const selectElement = document.getElementById(`${column}-endpoint`);
            if (selectElement) {
                // Clear existing options except for the first "Choose an API" placeholder
                while (selectElement.options.length > 1) {
                    selectElement.remove(1);
                }
                // Repopulate based on the apiEndpoints structure
                for (const apiKey in apiEndpoints[column]) {
                    if (apiEndpoints[column].hasOwnProperty(apiKey)) {
                        const option = document.createElement('option');
                        option.value = apiKey; // e.g., createCustomer, getPartyArrangements
                        option.textContent = apiEndpoints[column][apiKey].label; // e.g., "Create Customer"
                        selectElement.appendChild(option);
                    }
                }
            }
        });
    }

    function updateUri(column, endpointKey) {
        const uriField = document.getElementById(`${column}-uri`);
        const payloadField = document.getElementById(`${column}-request-payload`);
        const methodSelect = document.getElementById(`${column}-method`);

        if (!apiEndpoints[column] || !apiEndpoints[column][endpointKey]) {
            uriField.value = '';
            payloadField.value = '';
            return;
        }

        const selectedApi = apiEndpoints[column][endpointKey];

        let uri = selectedApi.template;
        if (selectedApi.params && selectedApi.params.length > 0) {
            selectedApi.params.forEach(param => {
                const paramValue = prompt(`Enter value for ${param}:`);
                uri = uri.replace(`{${param}}`, paramValue || '');
            });
        }
        uriField.value = uri;

        if (selectedApi.defaultMethod === 'GET') {
            payloadField.value = '';
        } else if (selectedApi.samplePayload) {
            if (typeof selectedApi.samplePayload === 'object') {
                payloadField.value = JSON.stringify(selectedApi.samplePayload, null, 2);
            } else {
                payloadField.value = selectedApi.samplePayload;
            }
        } else {
            payloadField.value = '';
        }

        if (selectedApi.defaultMethod) {
            methodSelect.value = selectedApi.defaultMethod;
        }
    }

    async function sendApiRequest(column) {
        const methodField = document.getElementById(`${column}-method`);
        const uriField = document.getElementById(`${column}-uri`);
        const payloadField = document.getElementById(`${column}-request-payload`);
        const responseField = document.getElementById(`${column}-response`);
        
        const method = methodField.value;
        const uri = uriField.value;
        let payload = null;
        
        // For GET requests, ensure payload is null
        if (method !== 'GET' && payloadField.value) {
            try {
                payload = JSON.parse(payloadField.value);
            } catch (e) {
                responseField.value = `Error parsing JSON payload: ${e.message}`;
                return;
            }
        }
        
        // Show loading state
        responseField.value = "Sending request...";
        
        try {
            // Make the API call
            const response = await fetch('/api/headless/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uri: uri,
                    method: method,
                    payload: payload,
                    domain: column // Track which domain the call came from
                })
            });
            
            const result = await response.json();
            
            // Update response field
            if (result.api_call && result.api_call.response) {
                // Use plain JSON.stringify for the textarea
                responseField.value = JSON.stringify(result.api_call.response, null, 2);
                
                // Store API call but don't update events display
                if (column === 'party') {
                    partyApiCalls.unshift(result.api_call);
                } else if (column === 'deposits') {
                    depositsApiCalls.unshift(result.api_call);
                } else if (column === 'lending') {
                    lendingApiCalls.unshift(result.api_call);
                }
            } else if (result.api_call && result.api_call.error) {
                responseField.value = JSON.stringify(result.api_call.error, null, 2);
            } else {
                responseField.value = "No response data received from API call";
            }
        } catch (e) {
            console.error('Error making API call:', e);
            responseField.value = `Error making API call: ${e.message}`;
        }
    }

    function updateEvents(column) {
        const eventsContainer = document.getElementById(`${column}-events`);
        let apiCalls = [];
        
        // Get the appropriate API calls history
        if (column === 'party') {
            apiCalls = partyApiCalls;
        } else if (column === 'deposits') {
            apiCalls = depositsApiCalls;
        } else if (column === 'lending') {
            apiCalls = lendingApiCalls;
        }
        
        if (apiCalls && apiCalls.length > 0) {
            // Clear placeholder text
            eventsContainer.innerHTML = '';
            
            // Add recent calls/events
            apiCalls.forEach(call => {
                const callDiv = document.createElement('div');
                callDiv.className = 'mb-2 p-1 border-b border-gray-200';
                
                // Format timestamp
                const timestamp = new Date(call.timestamp).toLocaleTimeString();
                
                callDiv.innerHTML = `
                    <div class="text-xs text-teal-700">${timestamp} - ${call.method} ${call.uri}</div>
                `;
                
                eventsContainer.appendChild(callDiv);
            });
        } else {
            // Just clear the container if no events
            eventsContainer.innerHTML = '';
        }
    }

    // --- Kafka Event Streaming Functions ---
    function startEventStream(domain) {
        const eventsContainer = document.getElementById(`${domain}-events`);
        const connectButton = document.getElementById(`${domain}-connect`);
        
        // Clear the events container
        eventsContainer.innerHTML = '';
        
        // Add loading indicator
        const loadingElement = document.createElement('div');
        loadingElement.className = 'text-xs text-blue-600 mb-2';
        loadingElement.textContent = `Connecting to ${domain} events...`;
        eventsContainer.appendChild(loadingElement);
        
        // Close existing connection if any
        stopEventStream(domain);
        
        // Update button state immediately
        connectButton.textContent = "Disconnect";
        connectButton.classList.remove("bg-teal-600");
        connectButton.classList.add("bg-red-600");
        
        // Add a small delay for party domain to prevent UI freezing
        if (domain === 'party') {
            setTimeout(() => {
                createEventSource(domain, eventsContainer, connectButton);
            }, 50);
        } else {
            createEventSource(domain, eventsContainer, connectButton);
        }
    }
    
    function createEventSource(domain, eventsContainer, connectButton) {
        // Create new EventSource
        const eventSource = new EventSource(`/api/headless-v2/events/${domain}`);
        
        // Store the EventSource in the right variable
        if (domain === 'party') {
            partyEventSource = eventSource;
        } else if (domain === 'deposits') {
            depositsEventSource = eventSource;
        } else if (domain === 'lending') {
            lendingEventSource = eventSource;
        }
        
        // Set up event handlers
        eventSource.onopen = function() {
            console.log(`${domain} EventSource connection opened`);
        };
        
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'info') {
                    // Don't show all info messages for party domain to reduce UI updates
                    if (domain !== 'party' || 
                        data.message.includes('Connecting') || 
                        data.message.includes('Connected') || 
                        data.message.includes('Found') ||
                        data.message.includes('Listening')) {
                        const infoElement = document.createElement('div');
                        infoElement.className = 'mb-1 text-blue-600';
                        infoElement.textContent = data.message;
                        eventsContainer.insertBefore(infoElement, eventsContainer.firstChild);
                    }
                } 
                else if (data.type === 'error') {
                    // Display error message
                    const errorElement = document.createElement('div');
                    errorElement.className = 'mb-1 text-red-600';
                    errorElement.textContent = data.message;
                    eventsContainer.insertBefore(errorElement, eventsContainer.firstChild);
                }
                else if (data.type === 'event') {
                    // Format and display event data
                    const eventData = data.data;
                    
                    const eventElement = document.createElement('div');
                    eventElement.className = 'mb-2 p-1 border-b border-gray-200 hover:bg-gray-50';
                    
                    // Format timestamp
                    const timestamp = eventData.timestamp ? eventData.timestamp : new Date().toLocaleTimeString();
                    
                    // Create event header with more efficient rendering for party domain
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'flex justify-between items-center text-xs text-teal-700 font-bold';
                    
                    // Use the same header format for all domains
                    headerDiv.innerHTML = `
                        <span>${timestamp}</span>
                        <span>Topic: ${eventData.topic}, Partition: ${eventData.partition}, Offset: ${eventData.offset}</span>
                    `;
                    eventElement.appendChild(headerDiv);
                    
                    // Add event payload as collapsible section
                    const payloadDiv = document.createElement('div');
                    payloadDiv.className = 'mt-1 pl-2 border-l-2 border-teal-200 text-xs';
                    
                    // Format the payload
                    if (eventData.payload) {
                        if (typeof eventData.payload === 'object') {
                            // Use the same formatting for all domains
                            payloadDiv.innerHTML = `<pre class="whitespace-pre-wrap overflow-x-auto">${formatJSON(eventData.payload)}</pre>`;
                        } else {
                            payloadDiv.innerHTML = `<pre class="whitespace-pre-wrap overflow-x-auto">${eventData.payload}</pre>`;
                        }
                    }
                    
                    eventElement.appendChild(payloadDiv);
                    
                    // Always add to the top of the events container (newest first)
                    eventsContainer.insertBefore(eventElement, eventsContainer.firstChild);
                    
                    // Limit number of events shown to prevent browser performance issues
                    const children = Array.from(eventsContainer.children);
                    // Keep only the first 25 real event elements (not info/error messages)
                    const eventElements = children.filter(child => 
                        child.classList.contains('mb-2') && 
                        child.classList.contains('p-1') && 
                        child.classList.contains('border-b')
                    );
                    
                    if (eventElements.length > 25) {
                        for (let i = 25; i < eventElements.length; i++) {
                            if (eventElements[i] && eventElements[i].parentNode === eventsContainer) {
                                eventsContainer.removeChild(eventElements[i]);
                            }
                        }
                    }
                }
                // Ignore ping messages
            } catch (e) {
                console.error(`Error processing ${domain} event data:`, e);
            }
        };
        
        eventSource.onerror = function(error) {
            console.error(`${domain} EventSource error:`, error);
            
            // Display error in the container
            const errorElement = document.createElement('div');
            errorElement.className = 'mb-1 text-red-600';
            errorElement.textContent = `Connection error: ${error.type || 'Unknown error'}`;
            eventsContainer.insertBefore(errorElement, eventsContainer.firstChild);
            
            // For party domain, don't try to reconnect as often
            const reconnectDelay = domain === 'party' ? 10000 : 5000;
            
            // Reconnect after a brief delay
            setTimeout(function() {
                if ((domain === 'party' && partyEventSource) || 
                    (domain === 'deposits' && depositsEventSource) || 
                    (domain === 'lending' && lendingEventSource)) {
                    // Only try to reconnect if we haven't manually closed
                    startEventStream(domain);
                }
            }, reconnectDelay);
        };
    }
    
    function stopEventStream(domain) {
        let eventSource = null;
        
        // Get the appropriate EventSource
        if (domain === 'party') {
            eventSource = partyEventSource;
            partyEventSource = null;
        } else if (domain === 'deposits') {
            eventSource = depositsEventSource;
            depositsEventSource = null;
        } else if (domain === 'lending') {
            eventSource = lendingEventSource;
            lendingEventSource = null;
        }
        
        // Close the EventSource if it exists
        if (eventSource) {
            eventSource.close();
            console.log(`${domain} EventSource connection closed`);
        }
        
        // Update the button state
        const connectButton = document.getElementById(`${domain}-connect`);
        connectButton.textContent = "Connect";
        connectButton.classList.remove("bg-red-600");
        connectButton.classList.add("bg-teal-600");
        
        // Inform the user
        const eventsContainer = document.getElementById(`${domain}-events`);
        const infoElement = document.createElement('div');
        infoElement.className = 'mb-1 text-gray-600';
        infoElement.textContent = 'Event streaming disconnected';
        eventsContainer.insertBefore(infoElement, eventsContainer.firstChild);
    }
    
    function toggleEventStream(domain) {
        const isConnected = 
            (domain === 'party' && partyEventSource) || 
            (domain === 'deposits' && depositsEventSource) || 
            (domain === 'lending' && lendingEventSource);
        
        if (isConnected) {
            stopEventStream(domain);
        } else {
            startEventStream(domain);
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Sequence diagram toggle
        const toggleDiagramBtn = document.getElementById('toggle-diagram');
        const diagramContainer = document.getElementById('diagram-container');
        
        if (toggleDiagramBtn && diagramContainer) {
            toggleDiagramBtn.addEventListener('click', () => {
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
        
        // Party/Customer Column
        document.getElementById('party-endpoint').addEventListener('change', (e) => {
            updateUri('party', e.target.value);
        });
        
        document.getElementById('party-send').addEventListener('click', () => {
            sendApiRequest('party');
        });
        
        document.getElementById('party-connect').addEventListener('click', () => {
            toggleEventStream('party');
        });
        
        // Deposits/Accounts Column
        document.getElementById('deposits-endpoint').addEventListener('change', (e) => {
            updateUri('deposits', e.target.value);
        });
        
        document.getElementById('deposits-send').addEventListener('click', () => {
            sendApiRequest('deposits');
        });
        
        document.getElementById('deposits-connect').addEventListener('click', () => {
            toggleEventStream('deposits');
        });
        
        // Lending Column
        document.getElementById('lending-endpoint').addEventListener('change', (e) => {
            updateUri('lending', e.target.value);
        });
        
        document.getElementById('lending-send').addEventListener('click', () => {
            sendApiRequest('lending');
        });
        
        document.getElementById('lending-connect').addEventListener('click', () => {
            toggleEventStream('lending');
        });
    }

    // --- Load Headless Data ---
    async function loadHeadlessData() {
        // Skip loading previous API calls
        return;
        
        /* Original implementation - commented out to prevent loading previous calls
        try {
            const response = await fetch('/api/headless/data');
            const data = await response.json();
            
            if (data.api_calls && data.api_calls.length > 0) {
                // Sort API calls into the correct domains
                data.api_calls.forEach(call => {
                    const uri = call.uri.toLowerCase();
                    
                    if (uri.includes('modulardemo') || uri.includes('party')) {
                        partyApiCalls.push(call);
                    } else if (uri.includes('deposits') || uri.includes('accounts')) {
                        depositsApiCalls.push(call);
                    } else if (uri.includes('lendings') || uri.includes('loans')) {
                        lendingApiCalls.push(call);
                    }
                });
                
                // Update all event displays
                updateEvents('party');
                updateEvents('deposits');
                updateEvents('lending');
            }
        } catch (e) {
            console.error('Error loading headless data:', e);
        }
        */
    }

    // --- Initialization ---
    function initHeadlessV2Tab() {
        console.log("Initializing Headless V2 Tab...");
        
        // Set up event listeners
        setupEventListeners();
        
        // Load data from backend
        loadHeadlessData();
        
        // Populate dropdowns first
        populateApiDropdowns(); // Call this before setting default values

        // Set default API for each column
        const partyEndpointSelect = document.getElementById('party-endpoint');
        if (partyEndpointSelect) {
            partyEndpointSelect.value = 'createCustomer';
            updateUri('party', 'createCustomer');
        }
        
        const depositsEndpointSelect = document.getElementById('deposits-endpoint');
        if (depositsEndpointSelect) {
            depositsEndpointSelect.value = 'createCurrentAccount';
            updateUri('deposits', 'createCurrentAccount');
        }
        
        const lendingEndpointSelect = document.getElementById('lending-endpoint');
        if (lendingEndpointSelect) {
            lendingEndpointSelect.value = 'createLoan';
            updateUri('lending', 'createLoan');
        }
        
        // Make reload function available globally
        window.reloadHeadlessData = loadHeadlessData;
    }

    // --- Global Cleanup Function --- 
    window.cleanupCurrentTab = function() {
        console.log("Running cleanup for Headless V2 Tab...");
        
        // Close all EventSource connections
        stopEventStream('party');
        stopEventStream('deposits');
        stopEventStream('lending');
        
        // Remove event listeners dynamically if they were added
        const partyEndpoint = document.getElementById('party-endpoint');
        if (partyEndpoint) partyEndpoint.replaceWith(partyEndpoint.cloneNode(true));
        const partySend = document.getElementById('party-send');
        if (partySend) partySend.replaceWith(partySend.cloneNode(true));
        const partyConnect = document.getElementById('party-connect');
        if (partyConnect) partyConnect.replaceWith(partyConnect.cloneNode(true));

        const depositsEndpoint = document.getElementById('deposits-endpoint');
        if (depositsEndpoint) depositsEndpoint.replaceWith(depositsEndpoint.cloneNode(true));
        const depositsSend = document.getElementById('deposits-send');
        if (depositsSend) depositsSend.replaceWith(depositsSend.cloneNode(true));
        const depositsConnect = document.getElementById('deposits-connect');
        if (depositsConnect) depositsConnect.replaceWith(depositsConnect.cloneNode(true));

        const lendingEndpoint = document.getElementById('lending-endpoint');
        if (lendingEndpoint) lendingEndpoint.replaceWith(lendingEndpoint.cloneNode(true));
        const lendingSend = document.getElementById('lending-send');
        if (lendingSend) lendingSend.replaceWith(lendingSend.cloneNode(true));
        const lendingConnect = document.getElementById('lending-connect');
        if (lendingConnect) lendingConnect.replaceWith(lendingConnect.cloneNode(true));

        const toggleDiagramBtn = document.getElementById('toggle-diagram');
        if (toggleDiagramBtn) {
            toggleDiagramBtn.replaceWith(toggleDiagramBtn.cloneNode(true));
        }
        
        // Remove the global functions
        delete window.reloadHeadlessData;
        delete window.cleanupCurrentTab; // Self-remove after execution if desired, or manage centrally
    };

    // --- Initial Execution ---
    // Ensure DOM is fully loaded before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeadlessV2Tab);
    } else {
        initHeadlessV2Tab();
    }
})(); 