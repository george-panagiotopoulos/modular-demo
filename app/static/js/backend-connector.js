/**
 * BackendConnector IIFE
 * Manages connections to backend services, including API calls and EventSource streams.
 */
window.BackendConnector = (() => {
    const SCRIPT_NAME = 'BackendConnector';
    const LOG_LEVELS = { 'info': '#8e44ad', 'warn': '#d35400', 'error': '#c0392b', 'success': '#27ae60' }; // Purple, Orange, Red, Green
    
    let activeEventSources = {}; // { id: { eventSource: EventSource, onMessage: Function, onError: Function, tabName: string } }
    let currentSessionId = null; // Stores the session ID received from the first EventSource connection

    function _log(message, type = 'info', data = null) {
        const timestamp = new Date().toISOString();
        const consoleMethod = console[type] || console.log;
        const styleHeader = `color: ${LOG_LEVELS[type] || '#8e44ad'}; font-weight: bold;`;
        const styleTimestamp = 'color: #bdc3c7; font-weight: normal;';

        if (data) {
            consoleMethod(
                `%c[${SCRIPT_NAME}]%c [${timestamp}] ${message}`,
                styleHeader,
                styleTimestamp,
                data
            );
        } else {
            consoleMethod(
                `%c[${SCRIPT_NAME}]%c [${timestamp}] ${message}`,
                styleHeader,
                styleTimestamp
            );
        }
    }

    function _generateEventSourceId(url) {
        return `eventSource_${url.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    }

    // Function to get or generate a session ID
    function _getSessionId() {
        if (!currentSessionId) {
            // Attempt to retrieve from local storage if persisted by a previous session
            currentSessionId = localStorage.getItem('backendConnectorSessionId');
            if (!currentSessionId) {
                currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('backendConnectorSessionId', currentSessionId);
                _log(`Generated new session ID: ${currentSessionId}`, 'info');
            } else {
                _log(`Retrieved session ID from localStorage: ${currentSessionId}`, 'info');
            }
        }
        return currentSessionId;
    }

    return {
        /**
         * Creates and manages an EventSource connection.
         * @param {string} url - The URL to connect to for the event stream.
         * @param {function} onMessage - Callback function for successful messages from the stream.
         * @param {function} [onError] - Optional callback function for errors on the stream.
         * @param {string} [tabName] - Optional. The name of the tab this EventSource belongs to (for TabManager resource registration).
         * @returns {EventSource|null} The created EventSource object or null if creation failed.
         */
        createEventStream: (url, onMessage, onError = null, tabName = null) => {
            if (!url || typeof onMessage !== 'function') {
                _log('URL and onMessage callback are required to create an event stream.', 'error');
                return null;
            }

            const eventSourceId = _generateEventSourceId(url);
            if (activeEventSources[eventSourceId]) {
                _log(`Event stream already active for ID: ${eventSourceId}. Returning existing.`, 'warn');
                return activeEventSources[eventSourceId].eventSource;
            }
            
            const sessionId = _getSessionId(); // Get or generate a session ID
            const fullUrl = `${url}?sessionId=${sessionId}`; // Append session ID to URL

            try {
                _log(`Creating EventSource connection to: ${fullUrl}`, 'info', { id: eventSourceId });
                const eventSource = new EventSource(fullUrl); // Pass URL with session ID

                eventSource.onopen = () => {
                    _log(`EventSource connection opened: ${eventSourceId}`, 'success');
                };

                eventSource.onmessage = (event) => {
                    try {
                        const parsedData = JSON.parse(event.data);
                         // Check for session ID from server on first connection
                        if (parsedData.type === 'info' && parsedData.sessionId && !currentSessionId) {
                            currentSessionId = parsedData.sessionId;
                            localStorage.setItem('backendConnectorSessionId', currentSessionId);
                            _log(`Received session ID from server: ${currentSessionId}`, 'info');
                        }
                        onMessage(parsedData); // Pass parsed data to the callback
                    } catch (e) {
                        _log('Error parsing JSON from EventSource message. Passing raw data.', 'warn', { data: event.data, error: e });
                        onMessage(event.data); // Pass raw data if JSON parsing fails
                    }
                };

                eventSource.onerror = (error) => {
                    _log(`EventSource error for ID ${eventSourceId}:`, 'error', error);
                    if (activeEventSources[eventSourceId] && activeEventSources[eventSourceId].onError) {
                        activeEventSources[eventSourceId].onError(error);
                    }
                    // Depending on the error, EventSource might close automatically.
                    // If it's a critical error, consider calling disconnectEventStream here.
                    if (eventSource.readyState === EventSource.CLOSED) {
                        _log(`EventSource ${eventSourceId} connection closed due to error.`, 'warn');
                        BackendConnector.disconnectEventStream(eventSourceId);
                    }
                };

                activeEventSources[eventSourceId] = { 
                    eventSource, 
                    onMessage, 
                    onError: onError || ((err) => _log(`Default onError for ${eventSourceId}`, 'warn', err)),
                    tabName,
                    url: fullUrl
                };

                // Register with TabManager if TabManager is available and tabName is provided
                if (window.TabManager && tabName) {
                    TabManager.registerResource(tabName, {
                        name: `EventSource_${tabName}_${eventSourceId}`,
                        eventSource: eventSource, // Pass the EventSource object itself
                        cleanup: () => {
                            _log(`TabManager cleanup: Closing EventSource ${eventSourceId} for tab ${tabName}`, 'info');
                            BackendConnector.disconnectEventStream(eventSourceId);
                        }
                    });
                }
                return eventSource;
            } catch (e) {
                _log(`Failed to create EventSource for URL: ${fullUrl}`, 'error', e);
                return null;
            }
        },

        /**
         * Disconnects a specific EventSource stream by its ID.
         * @param {string} eventSourceId - The ID of the EventSource to disconnect (returned by createEventStream or an internal ID).
         */
        disconnectEventStream: (eventSourceId) => {
            const sourceInfo = activeEventSources[eventSourceId];
            if (sourceInfo && sourceInfo.eventSource) {
                try {
                    sourceInfo.eventSource.close();
                    _log(`EventSource connection closed: ${eventSourceId}`, 'info');
                } catch (e) {
                    _log(`Error closing EventSource ${eventSourceId}:`, 'error', e);
                }
            } else {
                _log(`EventSource not found or already closed: ${eventSourceId}`, 'warn');
            }
            delete activeEventSources[eventSourceId];
        },

        /**
         * Disconnects all active EventSource streams managed by this connector.
         */
        disconnectAllEventStreams: () => {
            _log('Disconnecting all active EventSource streams...', 'warn');
            Object.keys(activeEventSources).forEach(id => {
                BackendConnector.disconnectEventStream(id);
            });
            _log('All EventSource streams have been requested to close.', 'info');
        },

        /**
         * Makes a generic API call.
         * @param {string} url - The API endpoint URL.
         * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
         * @param {object} [body=null] - The request body for POST/PUT.
         * @param {object} [headers=null] - Custom headers.
         * @returns {Promise<object>} A promise that resolves with the JSON response or rejects with an error.
         */
        callApi: async (url, method, body = null, headers = null) => {
            if (!url || !method) {
                _log('URL and method are required for API call.', 'error');
                return Promise.reject(new Error('URL and method are required.'));
            }

            const defaultHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Session-ID': _getSessionId() // Include session ID in API calls
            };
            const requestHeaders = { ...defaultHeaders, ...headers };

            const requestOptions = {
                method: method.toUpperCase(),
                headers: requestHeaders
            };

            if (body && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
                requestOptions.body = JSON.stringify(body);
            }

            _log(`Calling API: ${method} ${url}`, 'info', { body, headers: requestHeaders });

            try {
                const response = await fetch(url, requestOptions);
                
                let responseData;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text(); 
                }

                if (!response.ok) {
                    _log(`API call failed: ${method} ${url} - Status: ${response.status}`, 'error', { status: response.status, response: responseData });
                    // Include responseData in the error object for more context
                    const error = new Error(`HTTP error ${response.status} for ${url}`);
                    error.status = response.status;
                    error.response = responseData; 
                    throw error;
                }
                
                _log(`API call successful: ${method} ${url}`, 'success', { status: response.status, response: responseData });
                return responseData;
            } catch (error) {
                _log(`Error during API call: ${method} ${url}`, 'error', error);
                // Ensure the error object consistently has status and response if possible
                if (!error.status && error.message && error.message.includes('HTTP error')) {
                     try { error.status = parseInt(error.message.split(' ')[1]); } catch(e){ /* ignore */ }
                }
                throw error; // Re-throw the error to be caught by the caller
            }
        },

        /**
         * Retrieves the current session ID used by the BackendConnector.
         * @returns {string|null} The current session ID, or null if not yet established.
         */
        getSessionId: () => _getSessionId(),

        /**
         * Allows setting the session ID, e.g., if retrieved from a different source initially.
         * @param {string} sessionId - The session ID to set.
         */
        setSessionId: (sessionId) => {
            if (sessionId) {
                currentSessionId = sessionId;
                localStorage.setItem('backendConnectorSessionId', currentSessionId);
                _log(`Session ID explicitly set to: ${sessionId}`, 'info');
            } else {
                _log('Attempted to set an invalid session ID.', 'warn');
            }
        }
    };
})();

// Example Usage:
/*
// Example: Making a GET request
BackendConnector.callApi('/api/items', 'GET')
    .then(data => console.log('Items:', data))
    .catch(error => console.error('Error fetching items:', error));

// Example: Making a POST request
const newItem = { name: 'New Item', value: 123 };
BackendConnector.callApi('/api/items', 'POST', newItem)
    .then(data => console.log('Item created:', data))
    .catch(error => console.error('Error creating item:', error));

// Example: Creating an EventSource stream
const eventSourceMessageHandler = (data) => {
    console.log('[MyTab] EventSource message:', data);
    if (data.type === 'important_update') {
        // Handle important update
    }
};
const eventSourceErrorHandler = (error) => {
    console.error('[MyTab] EventSource error:', error);
    // Optionally try to reconnect or inform the user
};

const myEventSource = BackendConnector.createEventStream(
    '/api/events/live-updates', 
    eventSourceMessageHandler, 
    eventSourceErrorHandler,
    'myTabName' // Associate with a tab for automatic cleanup by TabManager
);

// To disconnect the stream later (e.g., when the tab is deactivated or component destroyed)
// if (myEventSource) { // myEventSource itself is the EventSource object, not an ID
//     // Find its ID if you need to use disconnectEventStream(id)
//     // Or, if registered with TabManager, it will be handled automatically.
//     // Or, call myEventSource.close() directly, but BackendConnector won't know its state.
// }

// If you need the ID for manual disconnection:
// For an EventSource created with URL '/api/events/live-updates',
// the ID would be something like 'eventSource_api_events_live_updates_TIMESTAMP'
// You might need a more robust way to get this ID if managing manually outside TabManager registration.

// Disconnect all streams:
// BackendConnector.disconnectAllEventStreams();
*/ 