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

// Global color mapping to ensure consistent colors across all streams
let globalEventColorMap = {};
let colorAssignmentIndex = 0; // Track next color to assign

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
            
            // Reset button states
            updateButtonStates(componentKey, 'disconnected');
            
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
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
            break;
        case 'connected':
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
            disconnectBtn.disabled = false;
            break;
        case 'disconnected':
        case 'error':
            connectBtn.textContent = state === 'error' ? 'Error - Retry' : 'Connect';
            connectBtn.disabled = false;
            connectBtn.style.backgroundColor = state === 'error' ? '#dc2626' : '';
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
    
    // Clean up existing connections first
    cleanupAllConnections();
    
    // Get selected values
    const component1Select = document.getElementById('component-1-select');
    const component2Select = document.getElementById('component-2-select');
    const component3Select = document.getElementById('component-3-select');
    
    if (!component1Select || !component2Select || !component3Select) {
        console.error('Selection dropdowns not found');
        return;
    }
    
    const component1 = component1Select.value;
    const component2 = component2Select.value;
    const component3 = component3Select.value;
    
    // Validate selection (no duplicates, all selected)
    const selections = [component1, component2, component3].filter(v => v);
    const uniqueSelections = [...new Set(selections)];
    
    if (selections.length !== 3) {
        alert('Please select all three components.');
        return;
    }
    
    if (uniqueSelections.length !== 3) {
        alert('Please select three different components.');
        return;
    }
    
    // Update selected components
    selectedComponents.component1 = component1;
    selectedComponents.component2 = component2;
    selectedComponents.component3 = component3;
    
    // Update displays
    updateComponentDisplay('component1', component1);
    updateComponentDisplay('component2', component2);
    updateComponentDisplay('component3', component3);
    
    console.log('Component selection applied successfully:', selectedComponents);
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
    
    // Create EventSource with session ID
    const eventSourceUrl = `/api/headless-v2/events/${config.domain}?session_id=${getSessionId()}`;
    const eventSource = new EventSource(eventSourceUrl);
    
    eventSource.onopen = function() {
        console.log(`Connected to ${config.name} events`);
        activeConnections[componentKey] = eventSource;
        updateButtonStates(componentKey, 'connected');
    };
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleComponentEvent(componentKey, data);
        } catch (e) {
            console.error(`Error parsing ${config.name} event:`, e);
        }
    };
    
    eventSource.onerror = function(error) {
        console.error(`${config.name} EventSource error:`, error);
        updateButtonStates(componentKey, 'error');
        cleanupEventSource(eventSource, config.domain, componentKey);
    };
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
        console.error(`Events container not found: ${componentKey}-events`);
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
        return;
    }
    
    // Apply selection button
    const applyBtn = document.getElementById('apply-selection');
    if (applyBtn) {
        applyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            applyComponentSelection();
        });
    }
    
    // Connect and disconnect buttons for each component
    ['component1', 'component2', 'component3'].forEach(componentKey => {
        const connectButton = document.getElementById(`${componentKey}-connect`);
        const disconnectButton = document.getElementById(`${componentKey}-disconnect`);
        
        if (connectButton) {
            connectButton.addEventListener('click', function(e) {
                e.preventDefault();
                connectToComponent(componentKey);
            });
        }
        
        if (disconnectButton) {
            disconnectButton.addEventListener('click', function(e) {
                e.preventDefault();
                disconnectFromComponent(componentKey);
            });
        }
    });
    
    // Initialize with default selection
    applyComponentSelection();
    
    isInitialized = true;
}

// Polling function to check for content and initialize
function pollForHeadlessV3Content() {
    if (isHeadlessV3ContentLoaded()) {
        initializeHeadlessV3();
    } else {
        setTimeout(pollForHeadlessV3Content, 100);
    }
}

// Start polling immediately
pollForHeadlessV3Content();

// Also try to initialize on DOMContentLoaded as backup
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (!isInitialized) {
            if (isHeadlessV3ContentLoaded()) {
                initializeHeadlessV3();
            }
        }
    }, 100);
});

// Add page visibility and unload handlers
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('beforeunload', handleBeforeUnload);

// Add cleanup when navigating away from this tab
window.addEventListener('hashchange', function() {
    if (!window.location.hash.includes('headless-v3')) {
        cleanupAllConnections();
    }
});

// Global cleanup function for external access
window.cleanupHeadlessV3 = cleanupAllConnections; 