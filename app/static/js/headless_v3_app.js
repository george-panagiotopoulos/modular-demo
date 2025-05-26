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
        displayEvent('eventstore-events', data.data);
    } else if (data.type === 'info') {
        console.log('Event Store info:', data.message);
    } else if (data.type === 'error') {
        console.error('Event Store error:', data.message);
    }
}

function handleAdapterEvent(data) {
    if (data.type === 'event' && data.data) {
        displayEvent('adapter-events', data.data);
    } else if (data.type === 'info') {
        console.log('Adapter info:', data.message);
    } else if (data.type === 'error') {
        console.error('Adapter error:', data.message);
    }
}

function handleHoldingsEvent(data) {
    if (data.type === 'event' && data.data) {
        displayEvent('holdings-events', data.data);
    } else if (data.type === 'info') {
        console.log('Holdings info:', data.message);
    } else if (data.type === 'error') {
        console.error('Holdings error:', data.message);
    }
}

function displayEvent(containerId, eventData) {
    const eventsContainer = document.getElementById(containerId);
    if (!eventsContainer) return;
    
    // Remove the initial message if it exists
    const initialMessage = eventsContainer.querySelector('.text-gray-500');
    if (initialMessage) {
        initialMessage.remove();
    }
    
    // Format timestamp
    const timestamp = eventData.time ? 
        new Date(eventData.time).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }) : 
        new Date().toLocaleString();
    
    // Create event element
    const eventElement = document.createElement('div');
    eventElement.className = 'border-b border-gray-200 pb-2 mb-2';
    
    // Create event header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex flex-col text-xs text-teal-700';
    
    headerDiv.innerHTML = `
        <div class="text-gray-500 font-bold">${timestamp}</div>
        <div class="font-bold">Topic: ${eventData.topic}</div>
        <div class="text-gray-600 font-bold">Partition: ${eventData.partition}, Offset: ${eventData.offset}</div>
    `;
    
    // Create payload section
    const payloadDiv = document.createElement('div');
    payloadDiv.className = 'mt-1';
    
    const payloadContent = typeof eventData.payload === 'object' ? 
        JSON.stringify(eventData.payload, null, 2) : 
        eventData.payload;
    
    payloadDiv.innerHTML = `
        <div class="text-xs text-gray-600 font-medium">Payload:</div>
        <pre class="text-xs bg-white p-1 rounded border overflow-x-auto whitespace-pre-wrap">${payloadContent}</pre>
    `;
    
    // Assemble the event
    eventElement.appendChild(headerDiv);
    eventElement.appendChild(payloadDiv);
    
    // Insert at the top
    eventsContainer.insertBefore(eventElement, eventsContainer.firstChild);
    
    // Limit the number of events displayed (keep last 20)
    const events = eventsContainer.children;
    while (events.length > 20) {
        eventsContainer.removeChild(events[events.length - 1]);
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