// Wrap everything in an IIFE to prevent global scope pollution
(function() {
    // Check if already initialized
    if (window.headlessV3Initialized) {
        console.log('Headless v3 already initialized, skipping...');
        return;
    }

    // Debug: Check BackendConnector availability at script load time
    console.log('[HeadlessV3] Script loading...');
    console.log('[HeadlessV3] BackendConnector available at load time:', !!window.BackendConnector);
    console.log('[HeadlessV3] Window keys containing "Backend":', Object.keys(window).filter(key => key.includes('Backend')));

    // Headless v3 App - Dynamic Component Selection with Event Streaming

    // Component configuration mapping
    const COMPONENT_CONFIG = {
        'party': {
            name: 'Party/Customer - R24 (proxy microservice)',
            domain: 'party',
            topic: 'ms-party-outbox'
        },
        'deposits': {
            name: 'Deposits/Accounts Module R25',
            domain: 'deposits',
            topic: 'deposits-event-topic'
        },
        'lending': {
            name: 'Lending Module R24',
            domain: 'lending',
            topic: 'lending-event-topic'
        },
        'eventstore': {
            name: 'Event Store (R24)',
            domain: 'eventstore',
            topic: 'ms-eventstore-inbox-topic'
        },
        'adapter': {
            name: 'Adapter (R24)',
            domain: 'adapter',
            topic: 'ms-adapterservice-event-topic'
        },
        'holdings': {
            name: 'Holdings (R25)',
            domain: 'holdings',
            topic: 'ms-holdings-event-topic'
        }
    };

    // Connection management
    let activeConnections = {
        component1: null,
        component2: null,
        component3: null
    };

    let selectedComponents = {
        component1: 'eventstore',
        component2: 'adapter',
        component3: 'holdings'
    };

    // Session management for concurrent connections
    let sessionId = null;
    let isInitialized = false;
    let isTabActive = false; // Track if this tab is currently active

    // Global color mapping to ensure consistent colors across all streams
    let globalEventColorMap = {};
    let colorAssignmentIndex = 0; // Track next color to assign

    // Store references to global event listeners for proper cleanup
    let globalEventListeners = {
        visibilitychange: null,
        beforeunload: null,
        hashchange: null
    };

    // Generate or retrieve session ID
    function getSessionId() {
        if (!sessionId) {
            sessionId = 'headless-v3-session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        return sessionId;
    }

    // Improved cleanup function with better error handling
    function cleanupEventSource(eventSource, domain, componentKey) {
        if (eventSource) {
            try {
                console.log(`Cleaning up connection for ${domain} (${componentKey})`);
                
                // Send disconnect request to backend
                fetch(`/api/headless-v2/events/${domain}/disconnect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-ID': getSessionId()
                    },
                    body: JSON.stringify({ session_id: getSessionId() })
                }).catch(err => console.log(`Disconnect request failed for ${domain}:`, err));
                
                // Close the EventSource
                eventSource.close();
                
                // Clear from active connections
                activeConnections[componentKey] = null;
                
                // Reset button states if elements exist
                const connectBtn = document.getElementById(`${componentKey}-connect`);
                const disconnectBtn = document.getElementById(`${componentKey}-disconnect`);
                if (connectBtn && disconnectBtn) {
                    updateButtonStates(componentKey, 'disconnected');
                }
                
            } catch (e) {
                console.error(`Error cleaning up EventSource for ${domain}:`, e);
            }
        }
    }

    // Update button states for connect/disconnect
    function updateButtonStates(componentKey, state) {
        const connectBtn = document.getElementById(`${componentKey}-connect`);
        const disconnectBtn = document.getElementById(`${componentKey}-disconnect`);
        
        if (!connectBtn || !disconnectBtn) {
            console.error(`Buttons not found for ${componentKey}`);
            return;
        }
        
        switch (state) {
            case 'connecting':
                connectBtn.textContent = 'Connecting...';
                connectBtn.disabled = true;
                connectBtn.className = 'px-2 py-0.5 bg-gray-500 text-white rounded text-xs cursor-not-allowed';
                connectBtn.style.display = 'inline-block';
                disconnectBtn.style.display = 'none';
                break;
            case 'connected':
                connectBtn.style.display = 'none';
                disconnectBtn.textContent = 'Disconnect';
                disconnectBtn.disabled = false;
                disconnectBtn.className = 'px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 cursor-pointer';
                disconnectBtn.style.display = 'inline-block';
                break;
            case 'disconnected':
                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;
                connectBtn.className = 'px-2 py-0.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 cursor-pointer';
                connectBtn.style.display = 'inline-block';
                disconnectBtn.style.display = 'none';
                break;
            case 'error':
                connectBtn.textContent = 'Error - Retry';
                connectBtn.disabled = false;
                connectBtn.className = 'px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 cursor-pointer';
                connectBtn.style.display = 'inline-block';
                disconnectBtn.style.display = 'none';
                break;
        }
    }

    // Global cleanup function for all connections
    function cleanupAllConnections() {
        console.log('Cleaning up all headless v3 connections...');
        
        // Clean up individual connections
        Object.keys(activeConnections).forEach(componentKey => {
            if (activeConnections[componentKey]) {
                const component = selectedComponents[componentKey];
                const config = COMPONENT_CONFIG[component];
                if (config) {
                    cleanupEventSource(activeConnections[componentKey], config.domain, componentKey);
                }
            }
        });
        
        // Reset all connection states
        activeConnections = {
            component1: null,
            component2: null,
            component3: null
        };
        
        // Reset initialization flag
        isInitialized = false;
        
        // Send global cleanup request
        fetch('/api/headless-v2/cleanup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': getSessionId()
            },
            body: JSON.stringify({ session_id: getSessionId() })
        }).catch(err => console.log('Global cleanup request failed:', err));
    }

    // Page visibility change handler to cleanup connections when tab becomes hidden
    function handleVisibilityChange() {
        // Only cleanup if this tab is currently active and the page becomes hidden
        if (document.hidden && isTabActive) {
            console.log('Page hidden while headless-v3 tab active, cleaning up connections...');
            cleanupAllConnections();
        }
    }

    // Beforeunload handler to cleanup connections when leaving page
    function handleBeforeUnload() {
        // Only cleanup if this tab is currently active
        if (isTabActive) {
            console.log('Page unloading while headless-v3 tab active, cleaning up connections...');
            cleanupAllConnections();
        }
    }

    // Add global event listeners only when tab is active
    function addGlobalEventListeners() {
        if (!globalEventListeners.visibilitychange) {
            globalEventListeners.visibilitychange = handleVisibilityChange;
            document.addEventListener('visibilitychange', globalEventListeners.visibilitychange);
            console.log('[HeadlessV3] Added visibilitychange listener');
        }
        
        if (!globalEventListeners.beforeunload) {
            globalEventListeners.beforeunload = handleBeforeUnload;
            window.addEventListener('beforeunload', globalEventListeners.beforeunload);
            console.log('[HeadlessV3] Added beforeunload listener');
        }
        
        // Note: hashchange is handled by TabManager, so we don't add it here
    }

    // Remove global event listeners when tab is not active
    function removeGlobalEventListeners() {
        if (globalEventListeners.visibilitychange) {
            document.removeEventListener('visibilitychange', globalEventListeners.visibilitychange);
            globalEventListeners.visibilitychange = null;
            console.log('[HeadlessV3] Removed visibilitychange listener');
        }
        
        if (globalEventListeners.beforeunload) {
            window.removeEventListener('beforeunload', globalEventListeners.beforeunload);
            globalEventListeners.beforeunload = null;
            console.log('[HeadlessV3] Removed beforeunload listener');
        }
        
        // Note: hashchange is handled by TabManager, so we don't remove it here
    }

    // Update component display
    function updateComponentDisplay(componentKey, componentValue) {
        const config = COMPONENT_CONFIG[componentValue];
        if (!config) {
            console.error(`No config found for component: ${componentValue}`);
            return;
        }
        
        // Update header
        const header = document.getElementById(`${componentKey}-header`);
        if (header) {
            header.textContent = config.name;
        } else {
            console.error(`Header not found: ${componentKey}-header`);
        }
        
        // Clear events display
        const eventsContainer = document.getElementById(`${componentKey}-events`);
        if (eventsContainer) {
            eventsContainer.innerHTML = '<div class="text-sm text-gray-500">Click "Connect" to start streaming events...</div>';
        } else {
            console.error(`Events container not found: ${componentKey}-events`);
        }
        
        // Reset button states
        updateButtonStates(componentKey, 'disconnected');
    }

    // Apply component selection
    function applyComponentSelection() {
        console.log('Applying component selection...');
        
        // First cleanup any existing connections
        cleanupAllConnections();
        
        // Update selected components from dropdowns
        selectedComponents.component1 = document.getElementById('component1-select').value;
        selectedComponents.component2 = document.getElementById('component2-select').value;
        selectedComponents.component3 = document.getElementById('component3-select').value;
        
        // Update displays for all components
        Object.keys(selectedComponents).forEach(componentKey => {
            updateComponentDisplay(componentKey, selectedComponents[componentKey]);
        });
        
        console.log('Component selection applied:', selectedComponents);
    }

    // Demo creation functionality
    let demoPollingInterval = null;

    function resetDemoStatus() {
        return fetch('/api/configuration/demo-status/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json());
    }

    function createDemoData() {
        return fetch('/api/configuration/create-demo-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || `HTTP ${response.status}`);
                });
            }
            return response.json();
        });
    }

    function checkDemoStatus() {
        return fetch('/api/configuration/demo-status')
            .then(response => response.json())
            .catch(error => {
                console.error('Error checking demo status:', error);
                throw error;
            });
    }

    function startDemoPolling() {
        if (demoPollingInterval) {
            clearInterval(demoPollingInterval);
        }
        
        demoPollingInterval = setInterval(() => {
            checkDemoStatus()
                .then(data => {
                    if (data.status === 'completed') {
                        clearInterval(demoPollingInterval);
                        demoPollingInterval = null;
                        displayDemoResults(data);
                    } else if (data.status === 'error') {
                        clearInterval(demoPollingInterval);
                        demoPollingInterval = null;
                        displayDemoError(data);
                    }
                })
                .catch(error => {
                    console.error('Error polling demo status:', error);
                    clearInterval(demoPollingInterval);
                    demoPollingInterval = null;
                    displayDemoError({ error: error.message });
                });
        }, 2000);
    }

    function displayDemoResults(data) {
        const button = document.getElementById('create-demo-data-v3');
        button.textContent = 'Create Accounts & Loans';
        button.disabled = false;
        button.style.backgroundColor = '';
        
        if (data.results && data.results.length > 0) {
            let resultHtml = '<div class="demo-results" style="margin-top: 10px; padding: 15px; background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px;">';
            resultHtml += '<h4 style="color: #0369a1; margin-bottom: 10px;">Demo Data Created Successfully!</h4>';
            
            data.results.forEach(result => {
                resultHtml += '<div style="margin-bottom: 8px;">';
                resultHtml += `<strong>Party ID:</strong> ${result.party_id}<br>`;
                resultHtml += `<strong>Account ID:</strong> ${result.account_id}<br>`;
                resultHtml += '<strong>Loan IDs:</strong><br>';
                if (result.loan_ids && result.loan_ids.length > 0) {
                    result.loan_ids.forEach(loanId => {
                        resultHtml += `&nbsp;&nbsp;• ${loanId}<br>`;
                    });
                }
                resultHtml += '</div>';
            });
            
            resultHtml += '</div>';
            
            // Insert results after the button
            const buttonContainer = button.parentElement;
            const existingResults = buttonContainer.querySelector('.demo-results');
            if (existingResults) {
                existingResults.remove();
            }
            buttonContainer.insertAdjacentHTML('afterend', resultHtml);
        }
    }

    function displayDemoError(data) {
        const button = document.getElementById('create-demo-data-v3');
        button.textContent = 'Create Accounts & Loans';
        button.disabled = false;
        button.style.backgroundColor = '';
        
        let errorHtml = '<div class="demo-error" style="margin-top: 10px; padding: 15px; background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px;">';
        errorHtml += '<h4 style="color: #dc2626; margin-bottom: 10px;">Demo Creation Failed</h4>';
        errorHtml += `<p style="color: #991b1b;">${data.error || 'Unknown error occurred'}</p>`;
        errorHtml += '</div>';
        
        // Insert error after the button
        const buttonContainer = button.parentElement;
        const existingError = buttonContainer.querySelector('.demo-error');
        if (existingError) {
            existingError.remove();
        }
        buttonContainer.insertAdjacentHTML('afterend', errorHtml);
    }

    function handleCreateDemoData() {
        const button = document.getElementById('create-demo-data-v3');
        button.textContent = 'Creating...';
        button.disabled = true;
        button.style.backgroundColor = '#6b7280';
        
        // Clear any existing results or errors
        const buttonContainer = button.parentElement;
        const existingResults = buttonContainer.querySelector('.demo-results');
        const existingError = buttonContainer.querySelector('.demo-error');
        if (existingResults) existingResults.remove();
        if (existingError) existingError.remove();
        
        // Reset status first, then create demo data
        resetDemoStatus()
            .then(() => createDemoData())
            .then(data => {
                if (data.status === 'success') {
                    startDemoPolling();
                } else {
                    throw new Error(data.message || 'Failed to start demo creation');
                }
            })
            .catch(error => {
                console.error('Error creating demo data:', error);
                displayDemoError({ error: error.message });
            });
    }

    // Connect to a specific component using BackendConnector
    function connectToComponent(componentKey) {
        const componentValue = selectedComponents[componentKey];
        const config = COMPONENT_CONFIG[componentValue];
        
        if (!config) {
            console.error(`No configuration found for component: ${componentValue}`);
            return;
        }
        
        // Check if already connected
        if (activeConnections[componentKey]) {
            console.log(`Already connected to ${config.name}`);
            return;
        }
        
        // Simple check for BackendConnector (should be available after initialization)
        if (!window.BackendConnector) {
            console.error('BackendConnector not available. This should not happen after proper initialization.');
            updateButtonStates(componentKey, 'error');
            return;
        }
        
        console.log(`BackendConnector found! Connecting to ${config.name} (${config.domain})...`);
        
        // Update button state to connecting
        updateButtonStates(componentKey, 'connecting');
        
        // Use BackendConnector to create event stream with proper TabManager integration
        const eventSource = window.BackendConnector.createEventStream(
            `/api/headless-v2/events/${config.domain}`,
            (eventData) => {
                handleComponentEvent(componentKey, eventData);
            },
            (error) => {
                console.error(`${config.name} EventSource error:`, error);
                updateButtonStates(componentKey, 'error');
                cleanupEventSource(activeConnections[componentKey], config.domain, componentKey);
            },
            'headless-v3' // Pass tabName for TabManager registration
        );
        
        // Store the connection
        activeConnections[componentKey] = eventSource;
        
        // Update button state to connected
        updateButtonStates(componentKey, 'connected');
        
        console.log(`Connected to ${config.name} events`);
    }

    // Disconnect from a specific component
    function disconnectFromComponent(componentKey) {
        const componentValue = selectedComponents[componentKey];
        const config = COMPONENT_CONFIG[componentValue];
        
        if (!config) {
            console.error(`No configuration found for component: ${componentValue}`);
            return;
        }
        
        if (activeConnections[componentKey]) {
            cleanupEventSource(activeConnections[componentKey], config.domain, componentKey);
        }
    }

    // Handle events for a specific component
    function handleComponentEvent(componentKey, data) {
        const eventsContainer = document.getElementById(`${componentKey}-events`);
        if (!eventsContainer) {
            // If container not found, clean up the connection
            const componentValue = selectedComponents[componentKey];
            const config = COMPONENT_CONFIG[componentValue];
            if (config && activeConnections[componentKey]) {
                console.log(`Events container not found for ${componentKey}, cleaning up connection...`);
                cleanupEventSource(activeConnections[componentKey], config.domain, componentKey);
            }
            return;
        }
        
        // Handle different event types
        if (data.type === 'ping') {
            return; // Ignore ping events
        }
        
        if (data.type === 'info') {
            // Display info message as simple text element (like headless v2)
            const infoElement = document.createElement('div');
            infoElement.className = 'mb-1 text-blue-600';
            infoElement.textContent = data.message;
            eventsContainer.insertBefore(infoElement, eventsContainer.firstChild);
            return;
        }
        
        if (data.type === 'error') {
            // Display error message as simple text element (like headless v2)
            const errorElement = document.createElement('div');
            errorElement.className = 'mb-1 text-red-600';
            errorElement.textContent = data.message;
            eventsContainer.insertBefore(errorElement, eventsContainer.firstChild);
            return;
        }
        
        // Handle actual Kafka events - the backend sends events with type 'event' and data in 'data' property
        if (data.type === 'event' && data.data) {
            // Format and display event data using the colored summary cards
            displayEventSummary(`${componentKey}-events`, data.data);
        }
    }

    // Display event summary (copied exactly from headless v2 implementation)
    function displayEventSummary(containerId, eventData) {
        const eventsContainer = document.getElementById(containerId);
        if (!eventsContainer) return;
        
        // Remove initial message if it exists
        const initialMessage = eventsContainer.querySelector('.text-gray-500');
        if (initialMessage && initialMessage.textContent.includes('Click "Connect"')) {
            initialMessage.remove();
        }
        
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
            <pre class="whitespace-pre-wrap overflow-x-auto bg-white p-2 rounded border">${formatJSON(eventData.payload)}</pre>
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

    // Get color for event type (expanded palette with 30 colors)
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

    // Limit event count in container (copied exactly from headless v2)
    function limitEventCount(eventsContainer, maxCount) {
        // Limit number of events shown to prevent browser performance issues
        const children = Array.from(eventsContainer.children);
        // Keep only the first maxCount real event elements (not info/error messages)
        const eventElements = children.filter(child => 
            child.classList.contains('mb-2') && 
            (child.classList.contains('p-1') || child.querySelector('button'))
        );
        
        if (eventElements.length > maxCount) {
            for (let i = maxCount; i < eventElements.length; i++) {
                if (eventElements[i] && eventElements[i].parentNode === eventsContainer) {
                    eventsContainer.removeChild(eventElements[i]);
                }
            }
        }
    }

    // Format JSON for display
    function formatJSON(json) {
        if (typeof json === 'string') {
            try {
                json = JSON.parse(json);
            } catch (e) {
                return json; // Return as-is if not valid JSON
            }
        }
        
        if (typeof json === 'object' && json !== null) {
            return JSON.stringify(json, null, 2);
        }
        
        return String(json);
    }

    // Function to wait for BackendConnector to be available
    function waitForBackendConnector(callback, maxAttempts = 100) {
        let attempts = 0;
        
        function checkBackendConnector() {
            attempts++;
            console.log(`[HeadlessV3] Checking for BackendConnector (attempt ${attempts}/${maxAttempts})`);
            
            if (window.BackendConnector && typeof window.BackendConnector.createEventStream === 'function') {
                console.log('[HeadlessV3] BackendConnector is available!');
                callback();
                return;
            }
            
            if (attempts >= maxAttempts) {
                console.error('[HeadlessV3] BackendConnector not available after maximum attempts');
                console.error('[HeadlessV3] Available window properties:', Object.keys(window).filter(key => key.toLowerCase().includes('backend')));
                return;
            }
            
            setTimeout(checkBackendConnector, 100);
        }
        
        checkBackendConnector();
    }

    // Check if headless v3 content is loaded
    function isHeadlessV3ContentLoaded() {
        const applyBtn = document.getElementById('apply-selection');
        const header1 = document.getElementById('component1-header');
        const connect1 = document.getElementById('component1-connect');
        
        return !!(applyBtn && header1 && connect1);
    }

    // Initialize headless v3 functionality
    function initializeHeadlessV3() {
        if (isInitialized) {
            console.log('Headless v3 already initialized, skipping...');
            return;
        }
        
        console.log('Initializing headless v3...');
        
        // Wait for BackendConnector before proceeding
        waitForBackendConnector(() => {
            console.log('[HeadlessV3] BackendConnector confirmed available, proceeding with initialization...');
            
            // Apply selection button
            const applyBtn = document.getElementById('apply-selection');
            if (applyBtn) {
                applyBtn.addEventListener('click', applyComponentSelection);
                console.log('[HeadlessV3] Apply selection button listener added');
            }
            
            // Demo creation button
            const demoBtn = document.getElementById('create-demo-data-v3');
            if (demoBtn) {
                demoBtn.addEventListener('click', handleCreateDemoData);
                console.log('[HeadlessV3] Create demo data button listener added');
            }
            
            // Connect and disconnect buttons for each component
            for (let i = 1; i <= 3; i++) {
                const connectButton = document.getElementById(`component${i}-connect`);
                const disconnectButton = document.getElementById(`component${i}-disconnect`);
                
                if (connectButton) {
                    connectButton.addEventListener('click', () => connectToComponent(`component${i}`));
                    console.log(`[HeadlessV3] Component ${i} connect button listener added`);
                }
                
                if (disconnectButton) {
                    disconnectButton.addEventListener('click', () => disconnectFromComponent(`component${i}`));
                    console.log(`[HeadlessV3] Component ${i} disconnect button listener added`);
                }
            }
            
            // Initialize with default selection
            applyComponentSelection();
            
            isInitialized = true;
            console.log('Headless v3 initialization complete');
        });
    }

    // Polling function to check for content and initialize
    function pollForHeadlessV3Content() {
        if (isHeadlessV3ContentLoaded()) {
            if (!isInitialized) {
                initializeHeadlessV3();
            }
        } else {
            // If content is not loaded and we were initialized, clean up
            if (isInitialized) {
                cleanupAllConnections();
            }
            setTimeout(pollForHeadlessV3Content, 100);
        }
    }

    // Start polling immediately
    pollForHeadlessV3Content();

    // Create module object for TabManager registration with correct method names
    const HeadlessV3Module = {
        onInit: function() {
            console.log('[HeadlessV3Module] Initializing...');
            // Initialize the app when TabManager calls onInit
            init();
        },
        
        onActivate: function(isRestoring = false) {
            console.log('[HeadlessV3Module] Activating...', isRestoring ? '(restoring)' : '');
            isTabActive = true;
            addGlobalEventListeners();
            if (!isInitialized && isHeadlessV3ContentLoaded()) {
                initializeHeadlessV3();
            }
        },
        
        onDeactivate: function(isUnloading = false) {
            console.log('[HeadlessV3Module] Deactivating...', isUnloading ? '(unloading)' : '');
            isTabActive = false;
            removeGlobalEventListeners();
            cleanupAllConnections();
        },
        
        onDestroy: function(isUnloading = false) {
            console.log('[HeadlessV3Module] Destroying...', isUnloading ? '(unloading)' : '');
            isTabActive = false;
            removeGlobalEventListeners();
            cleanupAllConnections();
        }
    };

    // Register with TabManager if available
    if (window.TabManager) {
        TabManager.registerTab('headless-v3', HeadlessV3Module);
        console.log('[HeadlessV3Module] Successfully registered with TabManager');
    } else {
        console.error('[HeadlessV3Module] TabManager not found. Ensure tab-manager.js is loaded first and correctly.');
        // Fallback: initialize directly if TabManager is not available
        setTimeout(() => {
            if (!window.TabManager) {
                console.log('[HeadlessV3Module] Fallback initialization without TabManager');
                init();
            }
        }, 100);
    }

    // Mark as initialized at the end
    window.headlessV3Initialized = true;

    // Global cleanup function for external access
    window.cleanupHeadlessV3 = cleanupAllConnections;

    // Initialize the headless v3 app
    function init() {
        console.log('[HeadlessV3] Initializing headless v3 app...');
        
        // Check if we're currently on the headless-v3 tab
        isTabActive = window.location.hash.includes('headless-v3');
        console.log('[HeadlessV3] Tab active on init:', isTabActive);
        
        // Only add global event listeners if tab is active
        // Note: hashchange is handled by TabManager, so we don't add it here
        if (isTabActive) {
            // Add only visibility and beforeunload listeners, not hashchange
            if (!globalEventListeners.visibilitychange) {
                globalEventListeners.visibilitychange = handleVisibilityChange;
                document.addEventListener('visibilitychange', globalEventListeners.visibilitychange);
                console.log('[HeadlessV3] Added visibilitychange listener');
            }
            
            if (!globalEventListeners.beforeunload) {
                globalEventListeners.beforeunload = handleBeforeUnload;
                window.addEventListener('beforeunload', globalEventListeners.beforeunload);
                console.log('[HeadlessV3] Added beforeunload listener');
            }
        }
        
        setupUI();
        
        // Expose global functions
        window.HeadlessV3 = {
            cleanupAllConnections: cleanupAllConnections,
            getActiveConnections: () => Object.keys(activeConnections),
            connectToComponent: connectToComponent,
            disconnectFromComponent: disconnectFromComponent,
            applyComponentSelection: applyComponentSelection
        };
        
        console.log('[HeadlessV3] Initialization complete');
    }

    // Setup UI elements and event listeners
    function setupUI() {
        // Setup apply selection button
        const applyBtn = document.getElementById('apply-selection');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyComponentSelection);
            console.log('[HeadlessV3] Apply selection button listener added');
        }
        
        // Setup create demo data button
        const createDemoBtn = document.getElementById('create-demo-data-v3');
        if (createDemoBtn) {
            createDemoBtn.addEventListener('click', handleCreateDemoData);
            console.log('[HeadlessV3] Create demo data button listener added');
        }
        
        // Setup component connect/disconnect buttons
        for (let i = 1; i <= 3; i++) {
            const connectBtn = document.getElementById(`component${i}-connect`);
            const disconnectBtn = document.getElementById(`component${i}-disconnect`);
            
            if (connectBtn) {
                connectBtn.addEventListener('click', () => connectToComponent(`component${i}`));
                console.log(`[HeadlessV3] Component ${i} connect button listener added`);
            }
            
            if (disconnectBtn) {
                disconnectBtn.addEventListener('click', () => disconnectFromComponent(`component${i}`));
                console.log(`[HeadlessV3] Component ${i} disconnect button listener added`);
            }
        }
        
        console.log('[HeadlessV3] UI setup complete');
    }
})();