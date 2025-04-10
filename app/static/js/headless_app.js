(function() {
    // Headless Tab specific JavaScript
    console.log("headless_app.js loaded and executing");

    let apiCallFormListener = null;

    // --- DOM Elements ---
    function getElements() {
        return {
             uriInput: document.getElementById('api-uri'),
             methodSelect: document.getElementById('api-method'),
             requestPayloadTextarea: document.getElementById('api-request-payload'),
             responsePayloadTextarea: document.getElementById('api-response-payload'),
             eventList: document.getElementById('event-list'),
             apiCallForm: document.getElementById('api-call-form')
        }
    }

    // --- Data Loading Functions --- 
    function loadHeadlessData() {
        console.log("Fetching headless data...");
        fetch(`/api/headless/data?_=${Date.now()}`)
            .then(response => response.ok ? response.json() : Promise.reject(`HTTP error! status: ${response.status}`))
            .then(data => {
                console.log("Headless data received:", data);
                const apiCalls = data.api_calls || [];
                const events = data.events || [];
                // Display the latest API call (which is now at index 0)
                displayApiCall(apiCalls.length > 0 ? apiCalls[0] : null);
                // Display ALL events from history
                displayEvents(events);
            })
            .catch(error => {
                console.error('Error loading headless data:', error);
                const { responsePayloadTextarea, eventList } = getElements();
                if(responsePayloadTextarea) responsePayloadTextarea.value = `Error loading data: ${error}`;
                if(eventList) eventList.innerHTML = `<li class="text-red-500">Error loading events: ${error}</li>`;
            });
    }

    // --- Display Functions ---
    function displayApiCall(callData) {
        console.log("Displaying API call:", callData);
        const { uriInput, methodSelect, requestPayloadTextarea, responsePayloadTextarea } = getElements();

        if (callData && uriInput && methodSelect && requestPayloadTextarea && responsePayloadTextarea) {
            uriInput.value = callData.uri || '';
            methodSelect.value = callData.method || 'GET';
            requestPayloadTextarea.value = callData.requestPayload ? JSON.stringify(callData.requestPayload, null, 2) : '';
            responsePayloadTextarea.value = callData.responsePayload ? JSON.stringify(callData.responsePayload, null, 2) : '';
        } else {
            // Clear fields if no data
            if(uriInput) uriInput.value = '';
            if(methodSelect) methodSelect.value = 'GET';
            if(requestPayloadTextarea) requestPayloadTextarea.value = '';
            if(responsePayloadTextarea) responsePayloadTextarea.value = '';
        }
    }

    function displayEvents(eventsToDisplay) {
        console.log("Displaying events:", eventsToDisplay);
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

    // --- Initialization --- 
    function initHeadlessTab() {
        console.log("Initializing Headless Tab...");
        loadHeadlessData(); // Load initial data (all events/calls)

        const { apiCallForm } = getElements();
        if(apiCallForm) {
             apiCallFormListener = (event) => {
                event.preventDefault();
                alert('Manual API Send (Stub) functionality is not implemented yet.');
            };
            apiCallForm.addEventListener('submit', apiCallFormListener);
        }
    }

    // --- Global Cleanup Function --- 
    window.cleanupCurrentTab = function() {
        console.log("Running cleanup for Headless Tab...");
        const { apiCallForm } = getElements();
        if (apiCallForm && apiCallFormListener) {
            apiCallForm.removeEventListener('submit', apiCallFormListener);
            apiCallFormListener = null;
            console.log("Removed API call form listener.");
        }
    };

    // --- Initial Execution ---
    initHeadlessTab();

})(); // End of IIFE 