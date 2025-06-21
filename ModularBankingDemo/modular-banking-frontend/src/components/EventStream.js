import './EventStream.css';
import React, { useState, useEffect, useRef, useCallback } from 'react';

// Event type colors for consistent visualization
const EVENT_TYPE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

// Predefined component configurations matching backend data structure
const COMPONENT_CONFIGS = {
  'party': {
    name: 'Party/Customer - R24',
    version: 'R24',
    description: 'Customer identity and profile management services',
    eventTypes: ['CUSTOMER.CREATED', 'CUSTOMER.UPDATED', 'CUSTOMER.DELETED', 'PROFILE.CHANGED'],
    kafkaTopics: ['party-events', 'customer-lifecycle']
  },
  'deposits': {
    name: 'Deposits R25',
    version: 'R25', 
    description: 'Deposit account management and transaction processing',
    eventTypes: ['ACCOUNT.OPENED', 'ACCOUNT.CLOSED', 'TRANSACTION.POSTED', 'BALANCE.UPDATED'],
    kafkaTopics: ['deposits-events', 'account-lifecycle']
  },
  'lending': {
    name: 'Lending R24',
    version: 'R24',
    description: 'Loan origination, management and servicing platform',
    eventTypes: ['LOAN.ORIGINATED', 'LOAN.APPROVED', 'PAYMENT.RECEIVED', 'LOAN.DEFAULTED'],
    kafkaTopics: ['lending-events', 'loan-lifecycle']
  },
  'eventstore': {
    name: 'Event Store R25',
    version: 'R25',
    description: 'Central event storage and replay service',
    eventTypes: ['EVENT.STORED', 'EVENT.REPLAYED', 'SNAPSHOT.CREATED', 'STREAM.ARCHIVED'],
    kafkaTopics: ['eventstore-events', 'replay-requests']
  },
  'adapter': {
    name: 'Adapter Service R24',
    version: 'R24',
    description: 'External system integration and data transformation',
    eventTypes: ['INTEGRATION.STARTED', 'DATA.TRANSFORMED', 'EXTERNAL.CALL', 'ADAPTER.ERROR'],
    kafkaTopics: ['adapter-events', 'integration-lifecycle']
  },
  'holdings': {
    name: 'Holdings R25',
    version: 'R25',
    description: 'Investment and portfolio management services',
    eventTypes: ['POSITION.OPENED', 'TRADE.EXECUTED', 'PORTFOLIO.REBALANCED', 'MARKET.UPDATE'],
    kafkaTopics: ['holdings-events', 'portfolio-lifecycle']
  }
};

// Utility function to get a consistent color for an event type
const getEventTypeColor = (eventType, eventTypeColors, colorAssignmentIndex) => {
  if (!eventTypeColors.current[eventType]) {
    eventTypeColors.current[eventType] = EVENT_TYPE_COLORS[colorAssignmentIndex.current % EVENT_TYPE_COLORS.length];
    colorAssignmentIndex.current++;
  }
  return eventTypeColors.current[eventType];
};

// Format timestamp for display
const formatTimestamp = (timestamp) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  } catch (error) {
    return timestamp;
  }
};

// Format JSON payload for display
const formatJsonPayload = (payload) => {
  try {
    if (typeof payload === 'string') {
      return JSON.stringify(JSON.parse(payload), null, 2);
    }
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return typeof payload === 'string' ? payload : JSON.stringify(payload);
  }
};

// Component for rendering individual event details
const EventDetails = ({ event }) => (
  <div className="event-details-container">
    <div className="event-details-header">
      Event Details
    </div>
    
    <div className="event-metadata">
      <div>
        <span className="metadata-label">Timestamp:</span>
        <span>{formatTimestamp(event.timestamp)}</span>
      </div>
      <div>
        <span className="metadata-label">Type:</span>
        <span>{event.eventType}</span>
      </div>
      <div>
        <span className="metadata-label">Topic:</span>
        <span>{event.topicName}</span>
      </div>
      <div>
        <span className="metadata-label">Business Key:</span>
        <span>{event.businessKey || 'N/A'}</span>
      </div>
    </div>

    <div className="event-payload-section">
      <div className="payload-label">
        Event Payload
      </div>
      <div className="payload-json">
        {formatJsonPayload(event.payload)}
      </div>
    </div>
  </div>
);

// Main Event Stream Component
const EventStream = () => {
  const [components, setComponents] = useState([]);
  const [componentOrder, setComponentOrder] = useState([]);
  const [events, setEvents] = useState({});
  const [eventCounts, setEventCounts] = useState({});
  const [connectedComponents, setConnectedComponents] = useState(new Set());
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [stats, setStats] = useState({ totalEvents: 0, activeConnections: 0, uptime: '0s' });
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  // Use refs for values that should persist across renders but don't trigger re-renders
  const eventSourcesRef = useRef({});
  const backendUrlRef = useRef(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5011');
  const eventTypeColors = useRef({});
  const colorAssignmentIndexRef = useRef(0);
  const [sessionId] = useState(`event-stream-session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Fetch components from backend
  const fetchComponents = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${backendUrlRef.current}/api/event-stream/components`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setComponents(data.data);
        // Initialize component order if not already set
        setComponentOrder(prevOrder => 
          prevOrder.length === 0 ? data.data.map(comp => comp.key) : prevOrder
        );
      } else {
        throw new Error(data.message || 'Failed to fetch components');
      }
    } catch (err) {
      console.error('Error fetching components:', err);
      setError(`Failed to load components: ${err.message}`);
    }
  }, []);

  // Fetch stats from backend
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrlRef.current}/api/event-stream/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Connect to a component's event stream
  const connectToComponent = useCallback(async (componentKey) => {
    try {
      setError(null);
      
      // Close existing connection if any
      if (eventSourcesRef.current[componentKey]) {
        eventSourcesRef.current[componentKey].close();
        delete eventSourcesRef.current[componentKey];
      }

      const eventSourceUrl = `${backendUrlRef.current}/api/event-stream/events/${componentKey}?session_id=${sessionId}`;
      const eventSource = new EventSource(eventSourceUrl);
      
      eventSource.onopen = () => {
        console.log(`Connected to ${componentKey} event stream`);
        setConnectedComponents(prev => new Set([...prev, componentKey]));
        setEvents(prev => ({ ...prev, [componentKey]: [] }));
        setEventCounts(prev => ({ ...prev, [componentKey]: 0 }));
      };

      eventSource.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          
          // Debug logging
          console.log(`[EventStream] Raw event received for ${componentKey}:`, eventData);
          
          // Handle different event types
          if (eventData.type === 'heartbeat') {
            // Just acknowledge heartbeat, don't display
            return;
          }
          
          if (eventData.type === 'info' || eventData.type === 'error') {
            // Handle info/error events
            console.log(`[EventStream] Info/Error event:`, eventData);
            setEvents(prev => ({
              ...prev,
              [componentKey]: [eventData, ...(prev[componentKey] || [])].slice(0, 100)
            }));
            setEventCounts(prev => ({ ...prev, [componentKey]: (prev[componentKey] || 0) + 1 }));
            return;
          }

          // Handle regular business events - extract from backend data structure
          if (eventData.type === 'event' && eventData.data) {
            const backendData = eventData.data;
            console.log(`[EventStream] Business event backend data:`, backendData);
            
            // Extract event type from payload
            let eventType = 'UNKNOWN.EVENT';
            if (backendData.payload && typeof backendData.payload === 'object') {
              eventType = backendData.payload.eventType || backendData.payload.type || 'UNKNOWN.EVENT';
            }
            
            const processedEvent = {
              id: `${componentKey}-${Date.now()}-${Math.random()}`,
              componentKey,
              timestamp: backendData.timestamp || new Date().toISOString(),
              topicName: backendData.topic || 'Unknown Topic',
              eventType: eventType,
              businessKey: backendData.key || 'N/A',
              payload: backendData.payload,
              // Keep original data for debugging
              _originalData: backendData
            };

            console.log(`[EventStream] Processed event:`, processedEvent);

            setEvents(prev => ({
              ...prev,
              [componentKey]: [processedEvent, ...(prev[componentKey] || [])].slice(0, 100)
            }));
            
            setEventCounts(prev => ({ 
              ...prev, 
              [componentKey]: (prev[componentKey] || 0) + 1 
            }));
          } else {
            console.log(`[EventStream] Unhandled event type or structure:`, eventData);
          }

        } catch (parseError) {
          console.error('Error parsing event data:', parseError);
          console.error('Raw event data:', event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`Error in ${componentKey} event stream:`, error);
        setError(`Connection error for ${componentKey}. Retrying...`);
        
        // Clean up this connection
        eventSource.close();
        delete eventSourcesRef.current[componentKey];
        setConnectedComponents(prev => {
          const newSet = new Set(prev);
          newSet.delete(componentKey);
          return newSet;
        });
      };

      // Store the EventSource reference
      eventSourcesRef.current[componentKey] = eventSource;

    } catch (err) {
      console.error(`Error connecting to ${componentKey}:`, err);
      setError(`Failed to connect to ${componentKey}: ${err.message}`);
      
      // Remove from connected components if connection failed
      setConnectedComponents(prev => {
        const newSet = new Set(prev);
        newSet.delete(componentKey);
        return newSet;
      });
    }
  }, [sessionId]);

  // Disconnect from a component's event stream
  const disconnectFromComponent = useCallback(async (componentKey) => {
    try {
      // Close the EventSource connection
      if (eventSourcesRef.current[componentKey]) {
        eventSourcesRef.current[componentKey].close();
        delete eventSourcesRef.current[componentKey];
      }

      // Update connected components state
      setConnectedComponents(prev => {
        const newSet = new Set(prev);
        newSet.delete(componentKey);
        
        // If no components are connected, reset color assignments
        if (newSet.size === 0) {
          eventTypeColors.current = {};
          colorAssignmentIndexRef.current = 0;
          console.log('All components disconnected, color assignments reset');
        }
        
        return newSet;
      });

      // Clear events for this component
      setEvents(prev => {
        const newEvents = { ...prev };
        delete newEvents[componentKey];
        return newEvents;
      });

      // Clear event count for this component
      setEventCounts(prev => {
        const newCounts = { ...prev };
        delete newCounts[componentKey];
        return newCounts;
      });

      console.log(`Disconnected from ${componentKey}`);
      setError(null);
    } catch (err) {
      console.error(`Error disconnecting from ${componentKey}:`, err);
      setError(`Failed to disconnect from ${componentKey}: ${err.message}`);
    }
  }, []);

  // Toggle event details expansion
  const toggleEventExpansion = useCallback((eventId) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  // Drag and Drop handlers
  const handleDragStart = useCallback((e, componentKey) => {
    setDraggedItem(componentKey);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
    e.target.classList.add('dragging');
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.target.classList.remove('dragging');
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDragEnter = useCallback((e, componentKey) => {
    e.preventDefault();
    if (draggedItem !== componentKey) {
      setDragOverItem(componentKey);
    }
  }, [draggedItem]);

  const handleDragLeave = useCallback((e) => {
    // Only clear drag over if we're leaving the component entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverItem(null);
    }
  }, []);

  const handleDrop = useCallback((e, targetComponentKey) => {
    e.preventDefault();
    
    if (draggedItem && draggedItem !== targetComponentKey) {
      setComponentOrder(prevOrder => {
        const newOrder = [...prevOrder];
        const draggedIndex = newOrder.indexOf(draggedItem);
        const targetIndex = newOrder.indexOf(targetComponentKey);
        
        // Remove dragged item and insert at target position
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedItem);
        
        return newOrder;
      });
    }
    
    setDragOverItem(null);
  }, [draggedItem]);

  // Initialize component on mount
  useEffect(() => {
    fetchComponents();
    fetchStats();
    
    // Set up periodic stats refresh
    const statsInterval = setInterval(fetchStats, 5000);
    
    // Cleanup function
    return () => {
      clearInterval(statsInterval);
      // Close all event source connections
      Object.values(eventSourcesRef.current).forEach(eventSource => {
        if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      });
      eventSourcesRef.current = {};
    };
  }, [fetchComponents, fetchStats]);

  // Get ordered components for rendering
  const orderedComponents = componentOrder
    .map(key => components.find(comp => comp.key === key))
    .filter(Boolean)
    .concat(components.filter(comp => !componentOrder.includes(comp.key)));

  return (
    <div className="event-stream-container">
      <div className="event-stream-header">
        <h2>🔗 Event Stream - Real-time Event Hub Streaming</h2>
        <div className="stats-summary">
          <span>Total Events: {stats.totalEvents}</span>
          <span>Active Connections: {stats.activeConnections}</span>
          <span>Uptime: {stats.uptime}</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="components-grid">
        {orderedComponents.map((component) => {
          const isConnected = connectedComponents.has(component.key);
          const componentEvents = events[component.key] || [];
          const eventCount = eventCounts[component.key] || 0;
          const isDraggedOver = dragOverItem === component.key;

          return (
            <div
              key={component.key}
              className={`component-card ${isDraggedOver ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, component.key)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, component.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, component.key)}
            >
              <div className="drag-handle">⋮⋮</div>
              
              <div className="component-header">
                <div>
                  <h3>{component.name}</h3>
                  <div className="component-version">{component.version}</div>
                </div>
              </div>

              <div className="component-config">
                <div className="event-types">
                  <strong>Event Types:</strong>
                  <div className="event-type-tags">
                    {(COMPONENT_CONFIGS[component.key]?.eventTypes || ['GENERIC.EVENT']).map((eventType, index) => (
                      <span
                        key={eventType}
                        className="event-type-tag"
                        style={{
                          backgroundColor: getEventTypeColor(eventType, eventTypeColors, colorAssignmentIndexRef)
                        }}
                      >
                        {eventType}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="component-actions">
                {!isConnected ? (
                  <button
                    className="connect-btn"
                    onClick={() => connectToComponent(component.key)}
                  >
                    🔌 Connect to Stream
                  </button>
                ) : (
                  <button
                    className="disconnect-btn"
                    onClick={() => disconnectFromComponent(component.key)}
                  >
                    🔌 Disconnect
                  </button>
                )}
              </div>

              {isConnected && (
                <div className="event-stream">
                  <div className="stream-header">
                    <h4>📡 Live Events</h4>
                    <div className="event-count">{eventCount} events</div>
                  </div>
                  
                  <div className="events-container">
                    {componentEvents.length === 0 ? (
                      <div className="no-events">
                        <p>🔄 Listening for events...</p>
                        <p className="help-text">Events will appear here as they are received from the event stream</p>
                      </div>
                    ) : (
                      componentEvents.map((event) => {
                        const eventId = event.id || `${event.componentKey}-${event.timestamp}`;
                        const isExpanded = expandedEvents.has(eventId);
                        
                        // Handle info/error events differently
                        if (event.type === 'info' || event.type === 'error') {
                          return (
                            <div key={eventId} className={`event-item ${event.type}-event`}>
                              <div className="event-header">
                                <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
                                <span className={`event-type ${event.type}`}>{event.type.toUpperCase()}</span>
                                <span className="event-message">{event.message}</span>
                              </div>
                            </div>
                          );
                        }
                        
                        // Regular business events
                        const eventTypeColor = getEventTypeColor(event.eventType, eventTypeColors, colorAssignmentIndexRef);
                        
                        return (
                          <div key={eventId} className="event-wrapper">
                            <button
                              className="event-summary-button"
                              style={{ backgroundColor: eventTypeColor }}
                              onClick={() => toggleEventExpansion(eventId)}
                            >
                              <div className="event-summary-timestamp">
                                {formatTimestamp(event.timestamp)}
                              </div>
                              <div className="event-summary-topic">
                                <strong>Topic:</strong> {event.topicName}
                              </div>
                              <div className="event-summary-type">
                                <strong>Type:</strong> {event.eventType}
                              </div>
                              <div className="event-summary-business-key">
                                <strong>Business Key:</strong> {event.businessKey || 'N/A'}
                              </div>
                            </button>
                            
                            {isExpanded && (
                              <EventDetails event={event} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventStream; 