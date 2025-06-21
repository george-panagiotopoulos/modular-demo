/**
 * EventStream Model
 * Manages event stream connections and state
 */

const { v4: uuidv4 } = require('uuid');

class EventStream {
  constructor(component, sessionId, options = {}) {
    this.id = uuidv4();
    this.component = component;
    this.sessionId = sessionId;
    this.status = 'disconnected';
    this.createdAt = new Date().toISOString();
    this.connectedAt = null;
    this.disconnectedAt = null;
    this.lastEventAt = null;
    this.eventCount = 0;
    this.options = {
      autoReconnect: true,
      eventBufferSize: 1000,
      heartbeatInterval: 30000,
      ...options
    };
    this.eventBuffer = [];
    this.heartbeatTimer = null;
    this.listeners = new Set();
  }

  // Connect the event stream
  connect() {
    if (this.status === 'connected') {
      throw new Error(`EventStream for ${this.component} is already connected`);
    }

    this.status = 'connected';
    this.connectedAt = new Date().toISOString();
    this.disconnectedAt = null;
    
    // Start heartbeat if configured
    if (this.options.heartbeatInterval > 0) {
      this.startHeartbeat();
    }

    console.log(`EventStream connected: ${this.component} (Session: ${this.sessionId})`);
    return this;
  }

  // Disconnect the event stream
  disconnect() {
    this.status = 'disconnected';
    this.disconnectedAt = new Date().toISOString();
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Clear listeners
    this.listeners.clear();

    console.log(`EventStream disconnected: ${this.component} (Session: ${this.sessionId})`);
    return this;
  }

  // Add event to the stream
  addEvent(event) {
    if (this.status !== 'connected') {
      return false;
    }

    // Add metadata
    const enrichedEvent = {
      ...event,
      streamId: this.id,
      component: this.component,
      sessionId: this.sessionId,
      receivedAt: new Date().toISOString(),
      sequenceNumber: this.eventCount + 1
    };

    // Add to buffer
    this.eventBuffer.push(enrichedEvent);
    
    // Maintain buffer size
    if (this.eventBuffer.length > this.options.eventBufferSize) {
      this.eventBuffer.shift();
    }

    this.eventCount++;
    this.lastEventAt = enrichedEvent.receivedAt;

    // Notify listeners
    this.notifyListeners(enrichedEvent);

    return true;
  }

  // Add event listener
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return true;
    }
    return false;
  }

  // Remove event listener
  removeListener(listener) {
    return this.listeners.delete(listener);
  }

  // Notify all listeners of new event
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  // Get recent events
  getRecentEvents(count = 10) {
    return this.eventBuffer.slice(-count);
  }

  // Get all buffered events
  getAllEvents() {
    return [...this.eventBuffer];
  }

  // Clear event buffer
  clearEvents() {
    this.eventBuffer = [];
    this.eventCount = 0;
    return this;
  }

  // Start heartbeat
  startHeartbeat() {
    this.stopHeartbeat(); // Ensure no duplicate timers
    
    this.heartbeatTimer = setInterval(() => {
      if (this.status === 'connected') {
        const heartbeatEvent = {
          id: `heartbeat-${Date.now()}`,
          type: 'system.heartbeat',
          timestamp: new Date().toISOString(),
          data: {
            status: 'alive',
            eventCount: this.eventCount,
            uptime: Date.now() - new Date(this.connectedAt).getTime()
          }
        };
        this.addEvent(heartbeatEvent);
      }
    }, this.options.heartbeatInterval);
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Get stream statistics
  getStats() {
    return {
      id: this.id,
      component: this.component,
      sessionId: this.sessionId,
      status: this.status,
      eventCount: this.eventCount,
      bufferSize: this.eventBuffer.length,
      createdAt: this.createdAt,
      connectedAt: this.connectedAt,
      disconnectedAt: this.disconnectedAt,
      lastEventAt: this.lastEventAt,
      uptime: this.connectedAt ? Date.now() - new Date(this.connectedAt).getTime() : 0
    };
  }

  // Check if stream is active
  isActive() {
    return this.status === 'connected';
  }

  // Check if stream is healthy (received events recently)
  isHealthy(maxAgeMs = 60000) {
    if (!this.isActive()) return false;
    if (!this.lastEventAt) return true; // No events yet is OK
    
    const eventAge = Date.now() - new Date(this.lastEventAt).getTime();
    return eventAge < maxAgeMs;
  }

  // Serialize to JSON
  toJSON() {
    return {
      id: this.id,
      component: this.component,
      sessionId: this.sessionId,
      status: this.status,
      createdAt: this.createdAt,
      connectedAt: this.connectedAt,
      disconnectedAt: this.disconnectedAt,
      lastEventAt: this.lastEventAt,
      eventCount: this.eventCount,
      bufferSize: this.eventBuffer.length,
      options: this.options
    };
  }
}

module.exports = EventStream; 