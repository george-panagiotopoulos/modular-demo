import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/HeadlessV3.css';

// Component configuration mapping
const COMPONENT_CONFIG = {
  'party': {
    name: 'Party/Customer - R24 (proxy microservice)',
    domain: 'party',
    topic: 'ms-party-outbox',
    color: '#0066CC', // Temenos primary blue
    description: 'Customer data and profile management'
  },
  'deposits': {
    name: 'Deposits/Accounts Module R25',
    domain: 'deposits', 
    topic: 'deposits-event-topic',
    color: '#00A651', // Temenos green
    description: 'Account creation and deposit operations'
  },
  'lending': {
    name: 'Lending Module R24',
    domain: 'lending',
    topic: 'lending-event-topic', 
    color: '#FF6B35', // Temenos orange
    description: 'Loan applications and processing'
  },
  'eventstore': {
    name: 'Event Store (R24)',
    domain: 'eventstore',
    topic: 'ms-eventstore-inbox-topic',
    color: '#8B5CF6', // Temenos purple
    description: 'Event sourcing and audit trail'
  },
  'adapter': {
    name: 'Adapter (R24)', 
    domain: 'adapter',
    topic: 'ms-adapterservice-event-topic',
    color: '#F59E0B', // Temenos amber
    description: 'External system integration'
  },
  'holdings': {
    name: 'Holdings (R25)',
    domain: 'holdings',
    topic: 'ms-holdings-event-topic',
    color: '#EF4444', // Temenos red
    description: 'Portfolio and investment management'
  }
};

// Individual Component Stream Component
const ComponentStream = ({ 
  componentKey, 
  selectedComponent, 
  onComponentChange, 
  connectionStatus, 
  onConnect, 
  onDisconnect, 
  events, 
  isDemo 
}) => {
  const config = COMPONENT_CONFIG[selectedComponent];
  const eventsContainerRef = useRef(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
  }, [events]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'connected':
        return 'status-badge status-connected';
      case 'connecting':
        return 'status-badge status-connecting';
      case 'error':
        return 'status-badge status-error';
      default:
        return 'status-badge status-disconnected';
    }
  };

  const formatEventTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const formatEventData = (event) => {
    try {
      if (typeof event.data === 'string') {
        return JSON.stringify(JSON.parse(event.data), null, 2);
      }
      return JSON.stringify(event.data, null, 2);
    } catch (e) {
      return event.data || 'No data';
    }
  };

  return (
    <div className="component-stream-card">
      {/* Header */}
      <div className="component-header" style={{ borderLeftColor: config?.color || '#0066CC' }}>
        <div className="component-info">
          <div className="component-title">
            <h3>{config?.name || 'Unknown Component'}</h3>
            <span className={getStatusBadgeClass(connectionStatus)}>
              {connectionStatus || 'disconnected'}
            </span>
          </div>
          <p className="component-description">{config?.description}</p>
        </div>
        
        {/* Component Selector */}
        <div className="component-selector">
          <select
            value={selectedComponent}
            onChange={(e) => onComponentChange(componentKey, e.target.value)}
            disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
            className="component-select"
          >
            {Object.entries(COMPONENT_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* Connection Controls */}
        <div className="connection-controls">
          {connectionStatus === 'connected' ? (
            <button
              onClick={() => onDisconnect(componentKey)}
              className="disconnect-button"
              aria-label={`Disconnect from ${config?.name}`}
            >
              <span className="button-icon">🔌</span>
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => onConnect(componentKey)}
              disabled={connectionStatus === 'connecting'}
              className="connect-button"
              aria-label={`Connect to ${config?.name}`}
            >
              <span className="button-icon">
                {connectionStatus === 'connecting' ? '⏳' : '🔗'}
              </span>
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Events Display */}
      <div className="events-container">
        <div className="events-header">
          <h4>Event Stream</h4>
          <span className="events-count">
            {events.length} events
          </span>
        </div>
        
        <div 
          ref={eventsContainerRef}
          className="events-list"
          style={{ maxHeight: '300px', overflowY: 'auto' }}
        >
          {events.length === 0 ? (
            <div className="no-events">
              <span className="no-events-icon">📡</span>
              <p>No events received yet</p>
              <p className="no-events-subtitle">
                {connectionStatus === 'connected' 
                  ? 'Waiting for events...' 
                  : 'Connect to start receiving events'
                }
              </p>
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={`${event.id || index}-${event.timestamp}`}
                className="event-item"
                style={{ borderLeftColor: config?.color || '#0066CC' }}
              >
                <div className="event-header">
                  <span className="event-type">{event.type || 'unknown'}</span>
                  <span className="event-time">{formatEventTime(event.timestamp)}</span>
                </div>
                
                {event.summary && (
                  <div className="event-summary">{event.summary}</div>
                )}
                
                <details className="event-details">
                  <summary>View Details</summary>
                  <pre className="event-data">
                    {formatEventData(event)}
                  </pre>
                </details>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Main Headless V3 Component
const HeadlessV3 = () => {
  const [components, setComponents] = useState([]);
  const [connectedComponents, setConnectedComponents] = useState(new Set());
  const [events, setEvents] = useState({});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [stats, setStats] = useState({ sessions: { active: 0 }, connections: { total: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId] = useState(`headless-v3-session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const backendUrlRef = useRef('http://localhost:8080'); // Our Express.js backend
  const eventSourcesRef = useRef({});
  const maxEventsPerComponent = 50;
  
  // Global color mapping to ensure consistent colors across all streams (matching original)
  const globalEventColorMapRef = useRef({});
  const colorAssignmentIndexRef = useRef(0);
  
  // Expanded color palette with 30 distinct colors for better event type differentiation (from original)
  const eventColorPalette = [
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

  // Get color for event type (matching original logic)
  const getEventColor = (eventType) => {
    // Check if we already have a color assigned to this event type
    if (globalEventColorMapRef.current[eventType]) {
      return globalEventColorMapRef.current[eventType];
    }
    
    // Sequential assignment - no collisions possible
    const selectedColor = eventColorPalette[colorAssignmentIndexRef.current % eventColorPalette.length];
    
    // Store the color mapping globally for this session
    globalEventColorMapRef.current[eventType] = selectedColor;
    
    // Move to next color for the next new event type
    colorAssignmentIndexRef.current++;
    
    console.log(`Event type: "${eventType}" -> Sequential Index: ${colorAssignmentIndexRef.current - 1} -> Color: ${selectedColor}`);
    console.log(`Total unique event types seen: ${Object.keys(globalEventColorMapRef.current).length}`);
    
    return selectedColor;
  };

  // Format timestamp like original (full date/time format)
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toLocaleString();
    
    let date;
    if (typeof timestamp === 'string' && timestamp.includes(':') && !timestamp.includes('-')) {
      // Backend sends timestamp as H:M:S format, convert to full datetime
      const today = new Date();
      const timeStr = timestamp;
      const [hours, minutes, seconds] = timeStr.split(':');
      today.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds));
      date = today;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Format JSON for display (matching original)
  const formatJSON = (json) => {
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
  };

  // Fetch available components
  const fetchComponents = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrlRef.current}/api/headless-v3/components`);
      const data = await response.json();
      
      if (data.success) {
        setComponents(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch components');
      }
    } catch (err) {
      console.error('Error fetching components:', err);
      setError(`Failed to load components: ${err.message}`);
    }
  }, []);

  // Fetch service statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrlRef.current}/api/headless-v3/stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Connect to a component's event stream
  const connectToComponent = async (componentKey) => {
    if (connectedComponents.has(componentKey)) {
      return; // Already connected
    }

    setLoading(true);
    setError(null);

    try {
      // Set up Server-Sent Events for real-time event streaming
      // The SSE endpoint will handle the Kafka connection automatically
      const eventSourceUrl = `${backendUrlRef.current}/api/headless-v3/events/${componentKey}?session_id=${sessionId}`;
      const eventSource = new EventSource(eventSourceUrl);

      // Add session ID to the request
      eventSource.addEventListener('open', () => {
        console.log(`SSE connection opened for ${componentKey}`);
      });

      eventSource.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          handleIncomingEvent(componentKey, eventData);
        } catch (err) {
          console.error('Error parsing event data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error(`EventSource error for ${componentKey}:`, err);
        
        if (eventSource.readyState === EventSource.CLOSED) {
          setConnectedComponents(prev => {
            const newSet = new Set(prev);
            newSet.delete(componentKey);
            return newSet;
          });
          setError(`Connection to ${componentKey} was closed`);
        }
      };

      // Store the EventSource reference
      eventSourcesRef.current[componentKey] = eventSource;
      
      // Update connected components
      setConnectedComponents(prev => new Set([...prev, componentKey]));
      
      // Initialize events array for this component
      setEvents(prev => ({
        ...prev,
        [componentKey]: prev[componentKey] || []
      }));

      console.log(`Connecting to ${componentKey} via SSE...`);

    } catch (err) {
      console.error(`Error connecting to ${componentKey}:`, err);
      setError(`Failed to connect to ${componentKey}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect from a component's event stream
  const disconnectFromComponent = async (componentKey) => {
    setLoading(true);

    try {
      // Close EventSource connection
      const eventSource = eventSourcesRef.current[componentKey];
      if (eventSource) {
        eventSource.close();
        delete eventSourcesRef.current[componentKey];
      }

      // Update connected components
      setConnectedComponents(prev => {
        const newSet = new Set(prev);
        newSet.delete(componentKey);
        return newSet;
      });

      console.log(`Disconnected from ${componentKey}`);

    } catch (err) {
      console.error(`Error disconnecting from ${componentKey}:`, err);
      setError(`Failed to disconnect from ${componentKey}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Limit event count in container (matching original)
  const limitEventCount = (componentKey, maxCount = 25) => {
    setEvents(prev => {
      const componentEvents = prev[componentKey] || [];
      if (componentEvents.length > maxCount) {
        return {
          ...prev,
          [componentKey]: componentEvents.slice(0, maxCount)
        };
      }
      return prev;
    });
  };

  const handleIncomingEvent = (componentKey, eventData) => {
    if (eventData.type === 'heartbeat') {
      return; // Don't store heartbeat events
    }

    const eventWithId = {
      ...eventData,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    setEvents(prev => {
      const newEvents = [eventWithId, ...(prev[componentKey] || [])];
      return {
        ...prev,
        [componentKey]: newEvents
      };
    });

    // Limit events after adding new one
    setTimeout(() => limitEventCount(componentKey, 25), 0);
  };

  // Toggle event expansion
  const toggleEventExpansion = (componentKey, eventId) => {
    const key = `${componentKey}-${eventId}`;
    setExpandedEvents(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Render event summary (matching original displayEventSummary function)
  const renderEventSummary = (componentKey, event) => {
    if (event.type === 'info') {
      return (
        <div key={event.id} className="event-item info-event">
          <div className="event-header">
            <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
            <span className="event-type info">INFO</span>
            <span className="event-message">{event.message}</span>
          </div>
        </div>
      );
    }

    if (event.type === 'error') {
      return (
        <div key={event.id} className="event-item error-event">
          <div className="event-header">
            <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
            <span className="event-type error">ERROR</span>
            <span className="event-message">{event.message}</span>
          </div>
        </div>
      );
    }

    if (event.type === 'heartbeat') {
      return null; // Don't display heartbeat events
    }

    if (event.type === 'event' && event.data) {
      const { topic, payload, partition, offset, key } = event.data;
      
      // Extract event information - matching original logic
      const timestamp = formatTimestamp(event.timestamp || (payload && payload.time));
      const topicName = topic || 'Unknown Topic';
      
      // Extract type and businesskey from payload - matching original extraction logic
      let eventType = 'Unknown Type';
      let businessKey = 'Unknown Business Key';
      
      if (payload && typeof payload === 'object') {
        eventType = payload.type || payload.eventType || payload.event_type || 'Unknown Type';
        businessKey = payload.businesskey || payload.businessKey || payload.id || payload.key || 'Unknown Business Key';
      }
      
      // Generate a color based on event type - using original color logic
      const eventColor = getEventColor(eventType);
      
      const expansionKey = `${componentKey}-${event.id}`;
      const isExpanded = expandedEvents[expansionKey];

      return (
        <div key={event.id} className="event-wrapper">
          {/* Summary button - matching original styling */}
          <button
            className="event-summary-button"
            style={{ backgroundColor: eventColor }}
            onClick={() => toggleEventExpansion(componentKey, event.id)}
          >
            <div className="event-summary-timestamp">{timestamp}</div>
            <div className="event-summary-topic">Topic: {topicName}</div>
            <div className="event-summary-type">Type: {eventType}</div>
            <div className="event-summary-business-key">Business Key: {businessKey}</div>
          </button>
          
          {/* Full event details container - matching original structure */}
          {isExpanded && (
            <div className="event-details-container">
              <div className="event-details-header">Full Event Details:</div>
              <div className="event-metadata">
                <div><span className="metadata-label">Topic:</span> {topic}</div>
                <div><span className="metadata-label">Partition:</span> {partition}</div>
                <div><span className="metadata-label">Offset:</span> {offset}</div>
                {key && <div><span className="metadata-label">Key:</span> {key}</div>}
              </div>
              <div className="event-payload-section">
                <div className="payload-label">Payload:</div>
                <pre className="payload-json">{formatJSON(payload)}</pre>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // Initialize component
  useEffect(() => {
    fetchComponents();
    fetchStats();
    
    // Refresh stats periodically
    const statsInterval = setInterval(fetchStats, 5000);
    
    return () => {
      clearInterval(statsInterval);
      
      // Clean up all EventSource connections
      Object.values(eventSourcesRef.current).forEach(eventSource => {
        eventSource.close();
      });
    };
  }, [fetchComponents, fetchStats]);

  return (
    <div className="headless-v3-container">
      <div className="headless-v3-header">
        <h2>🔗 HeadlessV3 - Real-time Event Hub Streaming</h2>
        <div className="stats-summary">
          <span>Active Sessions: {stats.sessions?.active || 0}</span>
          <span>Total Connections: {stats.connections?.total || 0}</span>
          <span>Session ID: {sessionId.split('-').pop()}</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="components-grid">
        {components.map(component => (
          <div key={component.key} className="component-card">
            <div className="component-header">
              <h3>{component.name}</h3>
              <span className="component-version">{component.version}</span>
            </div>
            
            <p className="component-description">{component.description}</p>
            
            <div className="component-config">
              <div className="event-types">
                <strong>Kafka Topic:</strong>
                <div className="event-type-tags">
                  {component.config.kafkaTopic ? (
                    <span 
                      className="event-type-tag"
                      style={{ 
                        backgroundColor: getEventColor(component.key),
                        color: 'white'
                      }}
                    >
                      {component.config.kafkaTopic}
                    </span>
                  ) : component.config.eventTypes ? (
                    component.config.eventTypes.map(eventType => (
                      <span 
                        key={eventType} 
                        className="event-type-tag"
                        style={{ 
                          backgroundColor: getEventColor(eventType),
                          color: 'white'
                        }}
                      >
                        {eventType}
                      </span>
                    ))
                  ) : (
                    <span className="event-type-tag" style={{ backgroundColor: '#666', color: 'white' }}>
                      No topic configured
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="component-actions">
              {connectedComponents.has(component.key) ? (
                <button 
                  className="disconnect-btn"
                  onClick={() => disconnectFromComponent(component.key)}
                  disabled={loading}
                >
                  🔌 Disconnect
                </button>
              ) : (
                <button 
                  className="connect-btn"
                  onClick={() => connectToComponent(component.key)}
                  disabled={loading}
                >
                  🔗 Connect to Event Hub
                </button>
              )}
            </div>

            {connectedComponents.has(component.key) && (
              <div className="event-stream">
                <div className="stream-header">
                  <h4>📡 Live Event Stream</h4>
                  <span className="event-count">
                    {events[component.key]?.length || 0} events
                  </span>
                </div>
                
                <div className="events-container">
                  {events[component.key]?.length > 0 ? (
                    events[component.key].map(event => 
                      renderEventSummary(component.key, event)
                    )
                  ) : (
                    <div className="no-events">
                      <p>🔄 Waiting for events from Azure Event Hub...</p>
                      <p className="help-text">
                        Events will appear here in real-time when they are published to the {component.key} topic.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {components.length === 0 && !error && (
        <div className="loading-message">
          <p>🔄 Loading banking components...</p>
        </div>
      )}
    </div>
  );
};

export default HeadlessV3; 