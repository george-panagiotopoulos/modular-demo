// BB EventHub Monitor - Standalone Event Streaming Application
// Based on headless_v3_app.js but simplified for standalone use

(function() {
    console.log('[BBEventHub] Initializing BB EventHub Monitor...');

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

    // Global color mapping to ensure consistent colors across all streams
    let globalEventColorMap = {};
    let colorAssignmentIndex = 0;

    // Generate or retrieve session ID
    function getSessionId() {
        if (!sessionId) {
            sessionId = 'bb-eventhub-session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        return sessionId;
    }

    // Improved cleanup function with better error handling
    function cleanupEventSource(eventSource, domain, componentKey) {
        if (eventSource) {
            try {
                console.log(`Cleaning up connection for ${domain} (${componentKey})`);
                
                // Send disconnect request to backend
                fetch(`/api/events/${domain}/disconnect`, {
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
        console.log('Cleaning up all BB EventHub connections...');
        
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
        
        // Send global cleanup request
        fetch('/api/cleanup', {
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
        if (document.hidden) {
            console.log('Page hidden, cleaning up connections...');
            cleanupAllConnections();
        }
    }

    // Beforeunload handler to cleanup connections when leaving page
    function handleBeforeUnload() {
        console.log('Page unloading, cleaning up connections...');
        cleanupAllConnections();
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

    // Create EventSource for streaming
    function createEventSource(url, onMessage, onError) {
        const eventSource = new EventSource(url);
        
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (e) {
                console.error('Error parsing event data:', e);
            }
        };
        
        eventSource.onerror = function(event) {
            console.error('EventSource error:', event);
            onError(event);
        };
        
        return eventSource;
    }

    // Connect to a specific component
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
        
        console.log(`Connecting to ${config.name} (${config.domain})...`);
        
        // Update button state to connecting
        updateButtonStates(componentKey, 'connecting');
        
        // Create event stream
        const eventSource = createEventSource(
            `/api/events/${config.domain}?session_id=${getSessionId()}`,
            (eventData) => {
                handleComponentEvent(componentKey, eventData);
            },
            (error) => {
                console.error(`${config.name} EventSource error:`, error);
                updateButtonStates(componentKey, 'error');
                cleanupEventSource(activeConnections[componentKey], config.domain, componentKey);
            }
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
            // Display info message as simple text element
            const infoElement = document.createElement('div');
            infoElement.className = 'mb-1 text-blue-600';
            infoElement.textContent = data.message;
            eventsContainer.insertBefore(infoElement, eventsContainer.firstChild);
            return;
        }
        
        if (data.type === 'error') {
            // Display error message as simple text element
            const errorElement = document.createElement('div');
            errorElement.className = 'mb-1 text-red-600';
            errorElement.textContent = data.message;
            eventsContainer.insertBefore(errorElement, eventsContainer.firstChild);
            return;
        }
        
        // Handle actual Kafka events
        if (data.type === 'event' && data.data) {
            // Format and display event data using the colored summary cards
            displayEventSummary(`${componentKey}-events`, data.data);
        }
    }

    // Display event summary
    function displayEventSummary(containerId, eventData) {
        const eventsContainer = document.getElementById(containerId);
        if (!eventsContainer) return;
        
        // Remove initial message if it exists
        const initialMessage = eventsContainer.querySelector('.text-gray-500');
        if (initialMessage && initialMessage.textContent.includes('Click "Connect"')) {
            initialMessage.remove();
        }
        
        // Extract event information
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

    // Get color for event type
    function getEventColor(eventType) {
        // Check if we already have a color assigned to this event type
        if (globalEventColorMap[eventType]) {
            return globalEventColorMap[eventType];
        }
        
        // Expanded color palette with 30 distinct colors for better event type differentiation
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280',
            '#14B8A6', '#F472B6', '#A855F7', '#22C55E', '#FB923C', '#38BDF8', '#FBBF24', '#F87171', '#A78BFA', '#34D399',
            '#60A5FA', '#FBBF24', '#FB7185', '#C084FC', '#4ADE80', '#FACC15', '#F472B6', '#06B6D4', '#8B5CF6', '#EAB308'
        ];
        
        // Sequential assignment - no collisions possible
        const selectedColor = colors[colorAssignmentIndex % colors.length];
        
        // Store the color mapping globally for this session
        globalEventColorMap[eventType] = selectedColor;
        
        // Move to next color for the next new event type
        colorAssignmentIndex++;
        
        console.log(`Event type: "${eventType}" -> Sequential Index: ${colorAssignmentIndex - 1} -> Color: ${selectedColor}`);
        
        return selectedColor;
    }

    // Limit event count in container
    function limitEventCount(eventsContainer, maxCount) {
        const children = Array.from(eventsContainer.children);
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

    // Initialize the application
    function initializeApp() {
        if (isInitialized) {
            console.log('BB EventHub Monitor already initialized, skipping...');
            return;
        }
        
        console.log('Initializing BB EventHub Monitor...');
        
        // Apply selection button
        const applyBtn = document.getElementById('apply-selection');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyComponentSelection);
            console.log('[BBEventHub] Apply selection button listener added');
        }
        
        // Connect and disconnect buttons for each component
        for (let i = 1; i <= 3; i++) {
            const connectButton = document.getElementById(`component${i}-connect`);
            const disconnectButton = document.getElementById(`component${i}-disconnect`);
            
            if (connectButton) {
                connectButton.addEventListener('click', () => connectToComponent(`component${i}`));
                console.log(`[BBEventHub] Component ${i} connect button listener added`);
            }
            
            if (disconnectButton) {
                disconnectButton.addEventListener('click', () => disconnectFromComponent(`component${i}`));
                console.log(`[BBEventHub] Component ${i} disconnect button listener added`);
            }
        }
        
        // Initialize with default selection
        applyComponentSelection();
        
        // Add global event listeners for cleanup
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        isInitialized = true;
        console.log('BB EventHub Monitor initialization complete');
        
        // Expose global functions for debugging
        window.BBEventHub = {
            cleanupAllConnections: cleanupAllConnections,
            getActiveConnections: () => Object.keys(activeConnections),
            connectToComponent: connectToComponent,
            disconnectFromComponent: disconnectFromComponent,
            applyComponentSelection: applyComponentSelection
        };
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

})(); 