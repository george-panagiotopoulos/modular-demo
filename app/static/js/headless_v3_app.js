// Headless v3 App - Event streaming for Event Store, Adapter, and Holdings
// Using identical functionality to headless_v2 but for different topics

let eventstoreEventSource = null;
let adapterEventSource = null;
let holdingsEventSource = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Headless v3 app initialized - DOM ready');
    
    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
        console.log('Setting up event listeners for headless v3...');
        
        // Set up event listeners for each service
        const eventstoreBtn = document.getElementById('eventstore-connect');
        const adapterBtn = document.getElementById('adapter-connect');
        const holdingsBtn = document.getElementById('holdings-connect');
        
        console.log('Found buttons:', {
            eventstore: !!eventstoreBtn,
            adapter: !!adapterBtn,
            holdings: !!holdingsBtn
        });
        
        if (eventstoreBtn) {
            console.log('Adding click listener to eventstore button');
            eventstoreBtn.addEventListener('click', function(e) {
                console.log('Event Store button clicked!');
                e.preventDefault();
                connectToEventStore();
            });
        } else {
            console.error('Event Store button not found!');
        }
        
        if (adapterBtn) {
            console.log('Adding click listener to adapter button');
            adapterBtn.addEventListener('click', function(e) {
                console.log('Adapter button clicked!');
                e.preventDefault();
                connectToAdapter();
            });
        } else {
            console.error('Adapter button not found!');
        }
        
        if (holdingsBtn) {
            console.log('Adding click listener to holdings button');
            holdingsBtn.addEventListener('click', function(e) {
                console.log('Holdings button clicked!');
                e.preventDefault();
                connectToHoldings();
            });
        } else {
            console.error('Holdings button not found!');
        }
        
        console.log('Event listeners setup complete for headless v3');
    }, 100);
});

function connectToEventStore() {
    console.log('connectToEventStore called');
    if (eventstoreEventSource) {
        console.log('Already connected to Event Store');
        return;
    }
    
    console.log('Connecting to Event Store events...');
    const button = document.getElementById('eventstore-connect');
    if (!button) {
        console.error('EventStore button not found when trying to connect!');
        return;
    }
    
    button.textContent = 'Connecting...';
    button.disabled = true;
    
    eventstoreEventSource = new EventSource('/api/headless-v2/events/eventstore');
    
    eventstoreEventSource.onopen = function() {
        console.log('Connected to Event Store events');
        button.textContent = 'Connected';
        button.style.backgroundColor = '#059669'; // green
    };
    
    eventstoreEventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleEventStoreEvent(data);
        } catch (e) {
            console.error('Error parsing Event Store event:', e);
        }
    };
    
    eventstoreEventSource.onerror = function(error) {
        console.error('Event Store EventSource error:', error);
        button.textContent = 'Error';
        button.style.backgroundColor = '#dc2626'; // red
        button.disabled = false;
        if (eventstoreEventSource) {
            eventstoreEventSource.close();
            eventstoreEventSource = null;
        }
    };
}

function connectToAdapter() {
    console.log('connectToAdapter called');
    if (adapterEventSource) {
        console.log('Already connected to Adapter');
        return;
    }
    
    console.log('Connecting to Adapter events...');
    const button = document.getElementById('adapter-connect');
    if (!button) {
        console.error('Adapter button not found when trying to connect!');
        return;
    }
    
    button.textContent = 'Connecting...';
    button.disabled = true;
    
    adapterEventSource = new EventSource('/api/headless-v2/events/adapter');
    
    adapterEventSource.onopen = function() {
        console.log('Connected to Adapter events');
        button.textContent = 'Connected';
        button.style.backgroundColor = '#059669'; // green
    };
    
    adapterEventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleAdapterEvent(data);
        } catch (e) {
            console.error('Error parsing Adapter event:', e);
        }
    };
    
    adapterEventSource.onerror = function(error) {
        console.error('Adapter EventSource error:', error);
        button.textContent = 'Error';
        button.style.backgroundColor = '#dc2626'; // red
        button.disabled = false;
        if (adapterEventSource) {
            adapterEventSource.close();
            adapterEventSource = null;
        }
    };
}

function connectToHoldings() {
    console.log('connectToHoldings called');
    if (holdingsEventSource) {
        console.log('Already connected to Holdings');
        return;
    }
    
    console.log('Connecting to Holdings events...');
    const button = document.getElementById('holdings-connect');
    if (!button) {
        console.error('Holdings button not found when trying to connect!');
        return;
    }
    
    button.textContent = 'Connecting...';
    button.disabled = true;
    
    holdingsEventSource = new EventSource('/api/headless-v2/events/holdings');
    
    holdingsEventSource.onopen = function() {
        console.log('Connected to Holdings events');
        button.textContent = 'Connected';
        button.style.backgroundColor = '#059669'; // green
    };
    
    holdingsEventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleHoldingsEvent(data);
        } catch (e) {
            console.error('Error parsing Holdings event:', e);
        }
    };
    
    holdingsEventSource.onerror = function(error) {
        console.error('Holdings EventSource error:', error);
        button.textContent = 'Error';
        button.style.backgroundColor = '#dc2626'; // red
        button.disabled = false;
        if (holdingsEventSource) {
            holdingsEventSource.close();
            holdingsEventSource = null;
        }
    };
}

function handleEventStoreEvent(data) {
    if (data.type === 'event' && data.data) {
        displayEventSummary('eventstore-events', data.data);
    } else if (data.type === 'info') {
        console.log('Event Store info:', data.message);
    } else if (data.type === 'error') {
        console.error('Event Store error:', data.message);
    }
}

function handleAdapterEvent(data) {
    if (data.type === 'event' && data.data) {
        displayEventSummary('adapter-events', data.data);
    } else if (data.type === 'info') {
        console.log('Adapter info:', data.message);
    } else if (data.type === 'error') {
        console.error('Adapter error:', data.message);
    }
}

function handleHoldingsEvent(data) {
    if (data.type === 'event' && data.data) {
        displayEventSummary('holdings-events', data.data);
    } else if (data.type === 'info') {
        console.log('Holdings info:', data.message);
    } else if (data.type === 'error') {
        console.error('Holdings error:', data.message);
    }
}

function displayEventSummary(containerId, eventData) {
    const eventsContainer = document.getElementById(containerId);
    if (!eventsContainer) return;
    
    // Remove the initial message if it exists
    const initialMessage = eventsContainer.querySelector('.text-gray-500');
    if (initialMessage) {
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

function getEventColor(eventType) {
    // Generate consistent colors based on event type
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
        '#6B7280'  // Gray
    ];
    
    // Simple hash function to get consistent color for same event type
    let hash = 0;
    for (let i = 0; i < eventType.length; i++) {
        const char = eventType.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return colors[Math.abs(hash) % colors.length];
}

function limitEventCount(eventsContainer, maxCount) {
    // Limit number of events shown to prevent browser performance issues
    const children = Array.from(eventsContainer.children);
    // Keep only the first maxCount real event elements (not info/error messages)
    const eventElements = children.filter(child => 
        child.classList.contains('mb-2') && 
        child.querySelector('button')
    );
    
    if (eventElements.length > maxCount) {
        for (let i = maxCount; i < eventElements.length; i++) {
            if (eventElements[i] && eventElements[i].parentNode === eventsContainer) {
                eventsContainer.removeChild(eventElements[i]);
            }
        }
    }
}

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

// Cleanup function
function cleanupHeadlessV3() {
    if (eventstoreEventSource) {
        eventstoreEventSource.close();
        eventstoreEventSource = null;
    }
    if (adapterEventSource) {
        adapterEventSource.close();
        adapterEventSource = null;
    }
    if (holdingsEventSource) {
        holdingsEventSource.close();
        holdingsEventSource = null;
    }
}

// Register cleanup function
window.cleanupCurrentTab = cleanupHeadlessV3;

// Make functions globally available
window.connectToEventStore = connectToEventStore;
window.connectToAdapter = connectToAdapter;
window.connectToHoldings = connectToHoldings; 