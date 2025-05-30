/**
 * BackendConnector - Manages connections to backend services
 */
const BackendConnector = (function() {
  // Map of active event sources by sessionId_domain
  const _activeEventSources = {};
  let _globalSessionId = null; // Store a single session ID for the lifetime of the connector

  function _getGlobalSessionId() {
    if (!_globalSessionId) {
      _globalSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return _globalSessionId;
  }

  /**
   * Create a new event source connection
   * 
   * @param {string} domain - Domain name (party, deposits, lending, etc.)
   * @param {Object} handlers - Event handlers {onMessage, onError, onOpen}
   * @param {string} [sessionIdForRequest] - Optional session ID to use for this specific request, otherwise global is used.
   * @returns {EventSource} The created EventSource object or null if error
   */
  function createEventStream(domain, handlers, sessionIdForRequest) {
    if (!domain || !handlers) {
      console.error('BackendConnector: Domain and handlers are required to create an event stream.');
      return null;
    }

    const currentSessionId = sessionIdForRequest || _getGlobalSessionId();
    const key = `${currentSessionId}_${domain}`;
    
    // Clean up existing connection for this specific key, if any
    if (_activeEventSources[key]) {
      console.warn(`BackendConnector: Closing existing event stream for ${key} before creating a new one.`);
      disconnectEventStream(domain, currentSessionId); // This is async, but we proceed
    }
    
    const eventSourceUrl = `/api/headless-v2/events/${domain}?session_id=${currentSessionId}`;
    console.log(`BackendConnector: Creating EventSource for ${domain} with URL: ${eventSourceUrl}`);
    
    try {
      const eventSource = new EventSource(eventSourceUrl);
      
      eventSource.onmessage = handlers.onMessage || function(event) { console.log(`BackendConnector [${domain}]: Message received`, event.data); };
      eventSource.onerror = handlers.onError || function(error) { console.error(`BackendConnector [${domain}]: Error`, error); };
      eventSource.onopen = handlers.onOpen || function() { console.log(`BackendConnector [${domain}]: Connection opened`); };
      
      _activeEventSources[key] = eventSource;
      console.log(`BackendConnector: Event stream for ${key} created and stored.`);
      return eventSource;
    } catch (e) {
      console.error(`BackendConnector: Failed to create EventSource for ${domain}:`, e);
      return null;
    }
  }
  
  /**
   * Disconnect a specific event stream
   * 
   * @param {string} domain - Domain name
   * @param {string} [sessionIdToDisconnect] - Session ID for the stream to disconnect. If not provided, uses global session ID.
   * @returns {Promise} Promise that resolves when disconnection attempt is complete
   */
  function disconnectEventStream(domain, sessionIdToDisconnect) {
    const currentSessionId = sessionIdToDisconnect || _getGlobalSessionId();
    const key = `${currentSessionId}_${domain}`;
    const eventSource = _activeEventSources[key];
    
    if (!eventSource) {
      console.log(`BackendConnector: No active event stream to disconnect for ${key}`);
      return Promise.resolve();
    }
    
    console.log(`BackendConnector: Disconnecting event stream for ${key}`);
    eventSource.close(); // Close the client-side connection immediately
    delete _activeEventSources[key];
    console.log(`BackendConnector: Client-side event stream for ${key} closed and removed.`);

    // Notify backend for cleanup
    return fetch(`/api/headless-v2/events/${domain}/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': currentSessionId // Send the correct session ID
      },
      // The body might not be strictly necessary if session ID is in header, but align with server expectation
      body: JSON.stringify({ session_id: currentSessionId }) 
    })
    .then(response => {
      if (!response.ok) {
        // Don't throw here, just log, as client-side is already closed
        console.error(`BackendConnector: Backend disconnect call for ${key} failed with status ${response.status}`);
      }
      console.log(`BackendConnector: Backend disconnect request for ${key} completed.`);
    })
    .catch(error => {
      console.error(`BackendConnector: Error during backend disconnect request for ${key}:`, error);
    });
  }
  
  /**
   * Disconnect all event streams managed by this connector.
   * This is typically called on page unload or major context change.
   * @returns {Promise} Promise that resolves when all disconnection attempts are complete
   */
  function disconnectAllEventStreams() {
    console.log("BackendConnector: Disconnecting all event streams.");
    const disconnectPromises = [];
    
    Object.keys(_activeEventSources).forEach(key => {
      const [sessionId, ...domainParts] = key.split('_');
      const domain = domainParts.join('_'); // Handle domains with underscores if any
      if (domain && sessionId) {
        disconnectPromises.push(disconnectEventStream(domain, sessionId));
      }
    });
    
    // Optional: A global cleanup call to the backend if your API supports it without specific session/domain
    // This depends on your backend design for cleaning up orphaned sessions.
    // Example: 
    // disconnectPromises.push(
    //   fetch('/api/headless-v2/cleanup', { 
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ session_id: _getGlobalSessionId(), cleanup_all_for_session: true })
    //   })
    //   .then(res => console.log('Global cleanup request completed'))
    //   .catch(err => console.error('Global cleanup request failed:', err))
    // );
    
    return Promise.all(disconnectPromises).then(() => {
      console.log("BackendConnector: All event stream disconnection attempts finished.");
    });
  }
  
  /**
   * Make an API call while tracking it via the headless/track endpoint
   * 
   * @param {Object} options - API call options { uri, method, payload, domain }
   * @returns {Promise} Promise that resolves with the API response from the track endpoint
   */
  function callApi(options) {
    const { uri, method = 'GET', payload = null, domain = 'unknown' } = options;
    
    if (!uri) {
      console.error('BackendConnector: callApi requires a URI.');
      return Promise.reject(new Error('URI is required for callApi'));
    }

    console.log(`BackendConnector: Tracking API call - Method: ${method}, URI: ${uri}, Domain: ${domain}`);

    return fetch('/api/headless/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uri, method, payload, domain })
    })
    .then(response => {
      if (!response.ok) {
        // Attempt to get error message from response body
        return response.json().catch(() => ({})) // Catch if body is not json
          .then(errBody => {
            const errorMsg = errBody.message || errBody.error || `API track call failed with status ${response.status}`;
            console.error(`BackendConnector: API track call to /api/headless/track failed: ${errorMsg}`);
            throw new Error(errorMsg);
          });
      }
      return response.json();
    })
    .then(result => {
      // The /api/headless/track endpoint returns a structure, 
      // and the actual API call result is nested within result.api_call.response or result.api_call.error
      if (result && result.api_call) {
        if (result.api_call.error) {
          console.error('BackendConnector: Tracked API call resulted in an error:', result.api_call.error);
          // Standardize error to have a message property
          const err = new Error(result.api_call.error.message || JSON.stringify(result.api_call.error));
          err.details = result.api_call.error;
          throw err;
        }
        console.log('BackendConnector: Tracked API call successful, response:', result.api_call.response);
        return result.api_call.response; // Return the actual API response
      }
      // If the structure is not as expected, treat it as an error from the tracking endpoint itself.
      console.error('BackendConnector: Unexpected response structure from /api/headless/track:', result);
      throw new Error('Unexpected response structure from API tracking service.');
    })
    .catch(error => {
      console.error('BackendConnector: callApi failed:', error.message);
      // Re-throw the error so the caller can handle it
      throw error; 
    });
  }
  
  // Public API
  return {
    createEventStream,
    disconnectEventStream,
    disconnectAllEventStreams,
    callApi,
    
    // Use the internal getter for session ID to ensure it's created on first request
    generateSessionId: function() {
      return _getGlobalSessionId();
    },
    
    getActiveConnectionsCount: function() {
      return Object.keys(_activeEventSources).length;
    },
    
    isConnected: function(domain, sessionIdToCheck) {
      const currentSessionId = sessionIdToCheck || _getGlobalSessionId();
      const key = `${currentSessionId}_${domain}`;
      return !!_activeEventSources[key] && _activeEventSources[key].readyState === EventSource.OPEN;
    }
  };
})(); 