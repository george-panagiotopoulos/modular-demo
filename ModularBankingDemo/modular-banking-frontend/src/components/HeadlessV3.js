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
  const [stats, setStats] = useState({ sessions: { active: 0 }, connections: { total: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  const backendUrlRef = useRef('http://localhost:8080'); // Our Express.js backend
  const eventSourcesRef = useRef({});
  const maxEventsPerComponent = 50;

  // Event type color mapping (from original headless v2)
  const eventColors = {
    'CustomerCreated': '#4CAF50',
    'CustomerUpdated': '#2196F3', 
    'PartyLinked': '#FF9800',
    'AccountOpened': '#9C27B0',
    'DepositMade': '#4CAF50',
    'AccountClosed': '#F44336',
    'LoanCreated': '#3F51B5',
    'PaymentProcessed': '#4CAF50',
    'LoanClosed': '#FF5722',
    'EventStored': '#607D8B',
    'EventReplayed': '#795548',
    'SnapshotCreated': '#009688',
    'MessageTransformed': '#E91E63',
    'ExternalCallMade': '#FF9800',
    'DataSynced': '#4CAF50',
    'PositionUpdated': '#2196F3',
    'TradeExecuted': '#4CAF50',
    'PortfolioRebalanced': '#9C27B0',
    'default': '#757575'
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

  // Handle incoming events (enhanced visualization from headless v2)
  const handleIncomingEvent = (componentKey, eventData) => {
    setEvents(prev => {
      const componentEvents = prev[componentKey] || [];
      
      if (eventData.type === 'event') {
        const newEvent = {
          ...eventData,
          id: `${componentKey}-${Date.now()}-${Math.random()}`,
          timestamp: eventData.data.timestamp || new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          expanded: false
        };

        // Add new event and limit to maxEventsPerComponent
        const updatedEvents = [newEvent, ...componentEvents].slice(0, maxEventsPerComponent);
        
        return {
          ...prev,
          [componentKey]: updatedEvents
        };
      } else if (eventData.type === 'info' || eventData.type === 'error') {
        const newEvent = {
          ...eventData,
          id: `${componentKey}-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          expanded: false
        };

        const updatedEvents = [newEvent, ...componentEvents].slice(0, maxEventsPerComponent);
        
        return {
          ...prev,
          [componentKey]: updatedEvents
        };
      }
      
      return prev;
    });
  };

  // Toggle event details expansion
  const toggleEventExpansion = (componentKey, eventId) => {
    setEvents(prev => ({
      ...prev,
      [componentKey]: prev[componentKey].map(event =>
        event.id === eventId ? { ...event, expanded: !event.expanded } : event
      )
    }));
  };

  // Format JSON for display (from original headless v2)
  const formatJSONForDisplay = (obj, indent = 0) => {
    if (obj === null) return <span className="json-null">null</span>;
    if (typeof obj === 'undefined') return <span className="json-undefined">undefined</span>;
    if (typeof obj === 'string') return <span className="json-string">"{obj}"</span>;
    if (typeof obj === 'number') return <span className="json-number">{obj}</span>;
    if (typeof obj === 'boolean') return <span className="json-boolean">{obj.toString()}</span>;
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return <span className="json-array">[]</span>;
      
      return (
        <div className="json-array">
          <span>[</span>
          {obj.map((item, index) => (
            <div key={index} style={{ marginLeft: `${(indent + 1) * 20}px` }}>
              {formatJSONForDisplay(item, indent + 1)}
              {index < obj.length - 1 && <span>,</span>}
            </div>
          ))}
          <span style={{ marginLeft: `${indent * 20}px` }}>]</span>
        </div>
      );
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return <span className="json-object">{'{}'}</span>;
      
      return (
        <div className="json-object">
          <span>{'{'}</span>
          {keys.map((key, index) => (
            <div key={key} style={{ marginLeft: `${(indent + 1) * 20}px` }}>
              <span className="json-key">"{key}"</span>: {formatJSONForDisplay(obj[key], indent + 1)}
              {index < keys.length - 1 && <span>,</span>}
            </div>
          ))}
          <span style={{ marginLeft: `${indent * 20}px` }}>{'}'}</span>
        </div>
      );
    }
    
    return <span>{String(obj)}</span>;
  };

  // Render event summary (enhanced from headless v2)
  const renderEventSummary = (componentKey, event) => {
    if (event.type === 'info') {
      return (
        <div key={event.id} className="event-item info-event">
          <div className="event-header">
            <span className="event-timestamp">{event.timestamp}</span>
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
            <span className="event-timestamp">{event.timestamp}</span>
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
      const { topic, payload } = event.data;
      
      // Extract event type from payload
      let eventType = 'Unknown';
      let businessKey = '';
      
      if (payload && typeof payload === 'object') {
        eventType = payload.eventType || payload.type || payload.event_type || 'Event';
        businessKey = payload.businessKey || payload.id || payload.key || '';
      }

      const eventColor = eventColors[eventType] || eventColors.default;

      return (
        <div key={event.id} className="event-item data-event">
          <div 
            className="event-header clickable"
            onClick={() => toggleEventExpansion(componentKey, event.id)}
          >
            <span className="event-timestamp">{event.timestamp}</span>
            <span 
              className="event-type" 
              style={{ backgroundColor: eventColor, color: 'white' }}
            >
              {eventType}
            </span>
            <span className="event-topic">{topic}</span>
            {businessKey && <span className="event-business-key">{businessKey}</span>}
            <span className={`expand-icon ${event.expanded ? 'expanded' : ''}`}>▼</span>
          </div>
          
          {event.expanded && (
            <div className="event-details">
              <div className="event-metadata">
                <div><strong>Topic:</strong> {topic}</div>
                <div><strong>Partition:</strong> {event.data.partition}</div>
                <div><strong>Offset:</strong> {event.data.offset}</div>
                {event.data.key && <div><strong>Key:</strong> {event.data.key}</div>}
              </div>
              
              <div className="event-payload">
                <strong>Payload:</strong>
                <div className="json-display">
                  {formatJSONForDisplay(payload)}
                </div>
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
                        backgroundColor: eventColors[component.key] || eventColors.default,
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
                          backgroundColor: eventColors[eventType] || eventColors.default,
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