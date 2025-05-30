/**
 * Headless V2 Tab Implementation
 */
(function() {
  // Only register once
  if (window.headlessV2Registered) {
    return;
  }
  window.headlessV2Registered = true;
  
  // Session ID for this instance
  let sessionId = null;
  
  // Store API calls history for each domain
  let partyApiCalls = [];
  let depositsApiCalls = [];
  let lendingApiCalls = [];
  
  // Track active connections (local UI state)
  let activeConnections = {
    party: false,
    deposits: false,
    lending: false
  };
  
  // Get stored session ID or create a new one
  function getSessionId() {
    if (!sessionId) {
      const storedId = localStorage.getItem('headless_v2_session_id');
      if (storedId) {
        sessionId = storedId;
      } else {
        sessionId = BackendConnector.generateSessionId();
        localStorage.setItem('headless_v2_session_id', sessionId);
      }
    }
    return sessionId;
  }
  
  // This reference will be set by TabManager.registerTab
  let tabInstance; 

  // Implementation of tab lifecycle hooks
  tabInstance = TabManager.registerTab('headless-v2', {
    contentSelector: '#headless-v2-tab',
    
    onInit: function() {
      console.log('Initializing headless v2 tab');
      getSessionId();
      populateApiDropdowns();
      // Note: `this` inside TabManager hooks refers to the tab object itself.
      // We store it if needed for calling registerResource from non-hook functions,
      // though ideally, resource registration happens in response to actions within the tab.
      // For event streams started by user, they can call this.registerResource directly.
    },
    
    onActivate: function() {
      console.log('Activating headless v2 tab');
      setupEventListeners();
      
      const partyEndpointSelect = document.getElementById('party-endpoint');
      if (partyEndpointSelect && !partyEndpointSelect.value) {
        partyEndpointSelect.value = 'createCustomer';
        updateUri('party', 'createCustomer');
      }
      
      const depositsEndpointSelect = document.getElementById('deposits-endpoint');
      if (depositsEndpointSelect && !depositsEndpointSelect.value) {
        depositsEndpointSelect.value = 'createCurrentAccount';
        updateUri('deposits', 'createCurrentAccount');
      }
      
      const lendingEndpointSelect = document.getElementById('lending-endpoint');
      if (lendingEndpointSelect && !lendingEndpointSelect.value) {
        lendingEndpointSelect.value = 'createConsumerLoan';
        updateUri('lending', 'createConsumerLoan');
      }
      
      updateEvents('party');
      updateEvents('deposits');
      updateEvents('lending');
    },
    
    onDeactivate: function() {
      console.log('Deactivating headless v2 tab');
      removeEventListeners();
      // TabManager will call this.cleanupResources() automatically after this.
    },
    
    onVisibilityLost: function() {
      console.log('Headless v2 tab lost visibility');
      if (activeConnections.party || activeConnections.deposits || activeConnections.lending) {
        console.log('Cleaning up resources due to visibility lost.');
        this.cleanupResources(); // Provided by TabManager
      }
    },
    
    onVisibilityRestored: function() {
      console.log('Headless v2 tab visibility restored');
      // Resources are cleaned up on visibility lost. User must reconnect if desired.
    },
    
    onUnload: function() {
      console.log('Headless v2 tab onUnload hook executed.');
      // TabManager's default onUnload calls this.cleanupResources(), so direct call here is redundant
      // unless specific pre-cleanup is needed *before* TabManager's generic resource cleanup.
    },
    
    saveState: function() {
      return {
        endpoints: {
          party: document.getElementById('party-endpoint')?.value || 'createCustomer',
          deposits: document.getElementById('deposits-endpoint')?.value || 'createCurrentAccount',
          lending: document.getElementById('lending-endpoint')?.value || 'createConsumerLoan'
        },
        uris: {
          party: document.getElementById('party-uri')?.value || '',
          deposits: document.getElementById('deposits-uri')?.value || '',
          lending: document.getElementById('lending-uri')?.value || ''
        },
        methods: {
          party: document.getElementById('party-method')?.value || 'POST',
          deposits: document.getElementById('deposits-method')?.value || 'POST',
          lending: document.getElementById('lending-method')?.value || 'POST'
        },
        requestPayloads: {
          party: document.getElementById('party-request-payload')?.value || '',
          deposits: document.getElementById('deposits-request-payload')?.value || '',
          lending: document.getElementById('lending-request-payload')?.value || ''
        },
        responses: {
          party: document.getElementById('party-response')?.value || '',
          deposits: document.getElementById('deposits-response')?.value || '',
          lending: document.getElementById('lending-response')?.value || ''
        },
        apiCalls: {
          party: partyApiCalls,
          deposits: depositsApiCalls,
          lending: lendingApiCalls
        }
      };
    },
    
    loadState: function(state) {
      if (!state) return;
      
      // Restore API call history
      if (state.apiCalls) {
        partyApiCalls = state.apiCalls.party || [];
        depositsApiCalls = state.apiCalls.deposits || [];
        lendingApiCalls = state.apiCalls.lending || [];
      }
      
      // Restore endpoints
      if (state.endpoints) {
        const partyEndpoint = document.getElementById('party-endpoint');
        if (partyEndpoint && state.endpoints.party) {
          partyEndpoint.value = state.endpoints.party;
          updateUri('party', state.endpoints.party);
        }
        
        const depositsEndpoint = document.getElementById('deposits-endpoint');
        if (depositsEndpoint && state.endpoints.deposits) {
          depositsEndpoint.value = state.endpoints.deposits;
          updateUri('deposits', state.endpoints.deposits);
        }
        
        const lendingEndpoint = document.getElementById('lending-endpoint');
        if (lendingEndpoint && state.endpoints.lending) {
          lendingEndpoint.value = state.endpoints.lending;
          updateUri('lending', state.endpoints.lending);
        }
      }
      
      // Restore methods
      if (state.methods) {
        const partyMethod = document.getElementById('party-method');
        if (partyMethod && state.methods.party) {
          partyMethod.value = state.methods.party;
        }
        
        const depositsMethod = document.getElementById('deposits-method');
        if (depositsMethod && state.methods.deposits) {
          depositsMethod.value = state.methods.deposits;
        }
        
        const lendingMethod = document.getElementById('lending-method');
        if (lendingMethod && state.methods.lending) {
          lendingMethod.value = state.methods.lending;
        }
      }
      
      // Restore request payloads
      if (state.requestPayloads) {
        const partyPayload = document.getElementById('party-request-payload');
        if (partyPayload && state.requestPayloads.party) {
          partyPayload.value = state.requestPayloads.party;
        }
        
        const depositsPayload = document.getElementById('deposits-request-payload');
        if (depositsPayload && state.requestPayloads.deposits) {
          depositsPayload.value = state.requestPayloads.deposits;
        }
        
        const lendingPayload = document.getElementById('lending-request-payload');
        if (lendingPayload && state.requestPayloads.lending) {
          lendingPayload.value = state.requestPayloads.lending;
        }
      }
      
      // Restore response fields
      if (state.responses) {
        const partyResponse = document.getElementById('party-response');
        if (partyResponse && state.responses.party) {
          partyResponse.value = state.responses.party;
        }
        
        const depositsResponse = document.getElementById('deposits-response');
        if (depositsResponse && state.responses.deposits) {
          depositsResponse.value = state.responses.deposits;
        }
        
        const lendingResponse = document.getElementById('lending-response');
        if (lendingResponse && state.responses.lending) {
          lendingResponse.value = state.responses.lending;
        }
      }
      
      // Update event displays
      updateEvents('party');
      updateEvents('deposits');
      updateEvents('lending');
    }
  });

  // Helper Functions for the Headless V2 Tab
  function setupEventListeners() {
    // Party/Customer Column
    const partyEndpoint = document.getElementById('party-endpoint');
    if (partyEndpoint) {
      partyEndpoint.addEventListener('change', (e) => {
        updateUri('party', e.target.value);
      });
    }
    
    const partySend = document.getElementById('party-send');
    if (partySend) {
      partySend.addEventListener('click', () => {
        sendApiRequest('party');
      });
    }
    
    const partyConnect = document.getElementById('party-connect');
    if (partyConnect) {
      partyConnect.addEventListener('click', () => {
        toggleEventStream('party');
      });
    }
    
    // Deposits/Accounts Column
    const depositsEndpoint = document.getElementById('deposits-endpoint');
    if (depositsEndpoint) {
      depositsEndpoint.addEventListener('change', (e) => {
        updateUri('deposits', e.target.value);
      });
    }
    
    const depositsSend = document.getElementById('deposits-send');
    if (depositsSend) {
      depositsSend.addEventListener('click', () => {
        sendApiRequest('deposits');
      });
    }
    
    const depositsConnect = document.getElementById('deposits-connect');
    if (depositsConnect) {
      depositsConnect.addEventListener('click', () => {
        toggleEventStream('deposits');
      });
    }
    
    // Lending Column
    const lendingEndpoint = document.getElementById('lending-endpoint');
    if (lendingEndpoint) {
      lendingEndpoint.addEventListener('change', (e) => {
        updateUri('lending', e.target.value);
      });
    }
    
    const lendingSend = document.getElementById('lending-send');
    if (lendingSend) {
      lendingSend.addEventListener('click', () => {
        sendApiRequest('lending');
      });
    }
    
    const lendingConnect = document.getElementById('lending-connect');
    if (lendingConnect) {
      lendingConnect.addEventListener('click', () => {
        toggleEventStream('lending');
      });
    }
    
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
  }
  
  function removeEventListeners() {
    // To prevent duplicate event handlers, replace elements with clones
    const elements = [
      'party-endpoint',
      'party-send',
      'party-connect',
      'deposits-endpoint',
      'deposits-send',
      'deposits-connect',
      'lending-endpoint',
      'lending-send',
      'lending-connect',
      'toggle-diagram'
    ];
    
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const clone = element.cloneNode(true);
        element.parentNode.replaceChild(clone, element);
      }
    });
  }

  function toggleEventStream(domain) {
    if (activeConnections[domain]) {
      stopEventStream(domain);
    } else {
      startEventStream(domain);
    }
  }
  
  async function startEventStream(domain) {
    const eventsContainer = document.getElementById(`${domain}-events`);
    const connectButton = document.getElementById(`${domain}-connect`);
    
    if (eventsContainer) {
      eventsContainer.innerHTML = '';
      const loadingElement = document.createElement('div');
      loadingElement.className = 'text-xs text-blue-600 mb-2';
      loadingElement.textContent = `Connecting to ${domain} events...`;
      eventsContainer.appendChild(loadingElement);
    }
    
    // Ensure any previous stream for this domain is stopped (BackendConnector handles idempotency)
    // This call will also update UI to "Connect" if it was "Disconnect"
    await stopEventStream(domain); 
    
    const currentSessionId = getSessionId();
    const eventSource = BackendConnector.createEventStream(domain, currentSessionId, {
      onMessage: function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'info') {
            const infoElement = document.createElement('div');
            infoElement.className = 'mb-1 text-blue-600';
            infoElement.textContent = data.message;
            eventsContainer.insertBefore(infoElement, eventsContainer.firstChild);
          } 
          else if (data.type === 'error') {
            const errorElement = document.createElement('div');
            errorElement.className = 'mb-1 text-red-600';
            errorElement.textContent = data.message;
            eventsContainer.insertBefore(errorElement, eventsContainer.firstChild);
          }
          else if (data.type === 'event') {
            displayEventSummary(`${domain}-events`, data.data);
          }
        } catch (e) { console.error(`Error processing ${domain} event data:`, e); }
      },
      onError: function(error) {
        console.error(`${domain} EventSource error:`, error);
        if (eventsContainer) {
          const errorElement = document.createElement('div');
          errorElement.className = 'mb-1 text-red-600';
          errorElement.textContent = `Connection error: ${error.type || 'Unknown error'}`;
          eventsContainer.insertBefore(errorElement, eventsContainer.firstChild);
        }
        // Ensure UI reflects disconnection on error
        activeConnections[domain] = false;
        if (connectButton) {
          connectButton.textContent = "Connect";
          connectButton.classList.remove("bg-red-600");
          connectButton.classList.add("bg-teal-600");
        }
      },
      onOpen: function() {
        console.log(`${domain} EventSource connection opened (Session: ${currentSessionId})`);
        activeConnections[domain] = true;
        
        if (connectButton) {
          connectButton.textContent = "Disconnect";
          connectButton.classList.remove("bg-teal-600");
          connectButton.classList.add("bg-red-600");
        }
        
        // Register this stream as a resource with the tab
        // `tabInstance` refers to the object returned by TabManager.registerTab
        if (tabInstance) {
            tabInstance.registerResource(
                { domain: domain, sessionId: currentSessionId, eventSourceInstance: eventSource },
                (resource) => { // This is the cleanup function called by TabManager
                    console.log(`TabManager cleaning resource for domain: ${resource.domain} (Session: ${resource.sessionId})`);
                    if (resource.eventSourceInstance && resource.eventSourceInstance.readyState !== EventSource.CLOSED) {
                        resource.eventSourceInstance.close();
                    }
                    // Notify backend and clean up in BackendConnector
                    BackendConnector.disconnectEventStream(resource.domain, resource.sessionId);

                    // Update UI for this specific domain within headless-v2.js
                    // This ensures UI is correct even if cleanup is triggered by TabManager
                    activeConnections[resource.domain] = false;
                    const btn = document.getElementById(`${resource.domain}-connect`);
                    if (btn) {
                        btn.textContent = "Connect";
                        btn.classList.remove("bg-red-600");
                        btn.classList.add("bg-teal-600");
                    }
                    const evContainer = document.getElementById(`${resource.domain}-events`);
                    if (evContainer) {
                        const infoEl = document.createElement('div');
                        infoEl.className = 'mb-1 text-gray-600';
                        infoEl.textContent = `Event streaming for ${resource.domain} disconnected by TabManager.`;
                        evContainer.insertBefore(infoEl, evContainer.firstChild);
                    }
                }
            );
        } else {
            console.error("headlessV2Tab instance not available for resource registration.");
        }
      }
    });
  }
  
  async function stopEventStream(domain) {
    const currentSessionId = getSessionId();
    console.log(`User/Internal stopEventStream for ${domain} (Session: ${currentSessionId})`);

    try {
        await BackendConnector.disconnectEventStream(domain, currentSessionId);
        console.log(`BackendConnector.disconnectEventStream completed for ${domain}`);
    } catch (error) {
        console.error(`Error during BackendConnector.disconnectEventStream for ${domain}:`, error);
    } finally {
        // Always update local UI state regardless of backend call success/failure
        activeConnections[domain] = false;
        const connectButton = document.getElementById(`${domain}-connect`);
        if (connectButton) {
            connectButton.textContent = "Connect";
            connectButton.classList.remove("bg-red-600");
            connectButton.classList.add("bg-teal-600");
        }
        const eventsContainer = document.getElementById(`${domain}-events`);
        if (eventsContainer) {
            const infoElement = document.createElement('div');
            infoElement.className = 'mb-1 text-gray-600';
            infoElement.textContent = `Event streaming for ${domain} disconnected.`;
            // Avoid adding duplicate "disconnected" messages if one is already there from resource cleanup
            const firstChild = eventsContainer.firstChild;
            if (!firstChild || !firstChild.textContent.includes('disconnected')) {
                 eventsContainer.insertBefore(infoElement, eventsContainer.firstChild);
            }
        }
    }
  }

  // --- Stubs for undefined helper functions ---
  // These functions are called in the code above but not defined in the provided snippet.
  // They need to be implemented for the tab to function fully.

  function populateApiDropdowns() {
    console.warn('populateApiDropdowns function is not yet implemented.');
    // Example: Populate select elements like #party-endpoint, #deposits-endpoint, #lending-endpoint
  }

  function updateUri(domain, selectedEndpoint) {
    console.warn(`updateUri function is not yet implemented for domain: ${domain}, endpoint: ${selectedEndpoint}.`);
    // Example: Update #party-uri, #deposits-uri, #lending-uri based on selected endpoint
  }

  function updateEvents(domain) {
    console.warn(`updateEvents function is not yet implemented for domain: ${domain}.`);
    // Example: Populate #party-events, #deposits-events, #lending-events with stored API call history or events
  }

  function sendApiRequest(domain) {
    console.warn(`sendApiRequest function is not yet implemented for domain: ${domain}.`);
    // Example: Get URI, method, payload for the domain and use BackendConnector.callApi
    // Then update response text area and call updateEvents(domain)
  }

  function displayEventSummary(containerId, eventData) {
    console.warn(`displayEventSummary function is not yet implemented for container: ${containerId}.`);
    // Example: Format eventData and append it to the DOM element with id=containerId
    // const container = document.getElementById(containerId);
    // if (container) {
    //   const eventElement = document.createElement('div');
    //   eventElement.className = 'p-2 mb-2 border rounded bg-gray-50 text-xs';
    //   eventElement.innerHTML = `<strong>${eventData.timestamp} [${eventData.topic}]</strong>: ${JSON.stringify(eventData.payload, null, 2)}`;
    //   container.insertBefore(eventElement, container.firstChild);
    // }
  }

})(); 