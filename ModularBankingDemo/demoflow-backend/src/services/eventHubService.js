/**
 * EventHub Service
 * Handles real Azure Event Hub connections using Kafka protocol
 */

const { Kafka } = require('kafkajs');
require('dotenv').config();

// Topic mapping
const KAFKA_TOPICS = {
  'party': 'ms-party-outbox',
  'deposits': 'deposits-event-topic',
  'lending': 'lending-event-topic',
  'eventstore': 'ms-eventstore-inbox-topic',
  'adapter': 'ms-adapterservice-event-topic',
  'holdings': 'ms-holdings-event-topic'
};

class EventHubService {
  constructor() {
    this.kafka = null;
    this.consumers = new Map(); // sessionId -> Map(component -> consumer)
    this.eventCallbacks = new Map(); // sessionId -> Map(component -> callback)
    this.initialize();
  }

  initialize() {
    // Check environment variables dynamically
    const BOOTSTRAP_SERVERS = process.env.BOOTSTRAP_SERVERS;
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    
    if (!BOOTSTRAP_SERVERS || !CONNECTION_STRING) {
      console.error('EventHub configuration missing. Set BOOTSTRAP_SERVERS and CONNECTION_STRING environment variables.');
      this.kafka = null;
      return;
    }

    // Create Kafka client for Azure Event Hub
    this.kafka = new Kafka({
      clientId: 'demoflow-backend',
      brokers: [BOOTSTRAP_SERVERS],
      ssl: true,
      sasl: {
        mechanism: 'plain',
        username: '$ConnectionString',
        password: CONNECTION_STRING,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
    });

    console.log('EventHub service initialized');
  }

  /**
   * Connect to a component's event stream
   */
  async connectToComponent(sessionId, component, eventCallback) {
    if (!this.kafka) {
      throw new Error('EventHub service not initialized');
    }

    const topic = KAFKA_TOPICS[component];
    if (!topic) {
      throw new Error(`Unknown component: ${component}`);
    }

    // Clean up existing connection if any
    await this.disconnectFromComponent(sessionId, component);

    try {
      // Create unique consumer group for this session and component
      const groupId = `event-stream-${component}-${sessionId}-${Date.now()}`;
      const consumer = this.kafka.consumer({ 
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 10000,
      });

      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      // Store consumer and callback
      if (!this.consumers.has(sessionId)) {
        this.consumers.set(sessionId, new Map());
        this.eventCallbacks.set(sessionId, new Map());
      }
      this.consumers.get(sessionId).set(component, consumer);
      this.eventCallbacks.get(sessionId).set(component, eventCallback);

      // Start consuming events
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const eventData = this.formatEventMessage(message, topic, partition);
            
            // Send to callback if still connected
            const callback = this.eventCallbacks.get(sessionId)?.get(component);
            if (callback) {
              callback(eventData);
            }
          } catch (error) {
            console.error(`Error processing message for ${component}:`, error);
          }
        },
      });

      console.log(`Connected to ${component} (${topic}) for session ${sessionId}`);
      return { success: true, topic, groupId };

    } catch (error) {
      console.error(`Failed to connect to ${component}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a component's event stream
   */
  async disconnectFromComponent(sessionId, component) {
    const sessionConsumers = this.consumers.get(sessionId);
    const sessionCallbacks = this.eventCallbacks.get(sessionId);

    if (sessionConsumers?.has(component)) {
      const consumer = sessionConsumers.get(component);
      try {
        await consumer.disconnect();
        console.log(`Disconnected from ${component} for session ${sessionId}`);
      } catch (error) {
        console.error(`Error disconnecting from ${component}:`, error);
      }
      
      sessionConsumers.delete(component);
      sessionCallbacks?.delete(component);

      // Clean up empty session maps
      if (sessionConsumers.size === 0) {
        this.consumers.delete(sessionId);
        this.eventCallbacks.delete(sessionId);
      }
    }
  }

  /**
   * Clean up all connections for a session
   */
  async cleanupSession(sessionId) {
    const sessionConsumers = this.consumers.get(sessionId);
    if (!sessionConsumers) {
      return { connectionsTerminated: 0 };
    }

    let connectionsTerminated = 0;
    const components = Array.from(sessionConsumers.keys());

    for (const component of components) {
      try {
        await this.disconnectFromComponent(sessionId, component);
        connectionsTerminated++;
      } catch (error) {
        console.error(`Error cleaning up ${component} for session ${sessionId}:`, error);
      }
    }

    console.log(`Session ${sessionId} cleanup complete: ${connectionsTerminated} connections terminated`);
    return { connectionsTerminated };
  }

  /**
   * Format Kafka message for frontend consumption
   */
  formatEventMessage(message, topic, partition) {
    try {
      // Parse message value
      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch {
        payload = message.value.toString();
      }

      // Format timestamp
      const timestamp = message.timestamp 
        ? new Date(parseInt(message.timestamp)).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        : new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

      return {
        type: 'event',
        data: {
          topic,
          partition,
          offset: message.offset,
          timestamp,
          key: message.key ? message.key.toString() : null,
          payload
        }
      };
    } catch (error) {
      console.error('Error formatting event message:', error);
      return {
        type: 'error',
        message: `Error formatting message: ${error.message}`
      };
    }
  }

  /**
   * Get connection status for a session
   */
  getSessionStatus(sessionId) {
    const sessionConsumers = this.consumers.get(sessionId);
    if (!sessionConsumers) {
      return { connected: [], total: 0 };
    }

    const connected = Array.from(sessionConsumers.keys());
    return { connected, total: connected.length };
  }

  /**
   * Get service statistics
   */
  getStats() {
    const totalSessions = this.consumers.size;
    let totalConnections = 0;

    for (const sessionConsumers of this.consumers.values()) {
      totalConnections += sessionConsumers.size;
    }

    return {
      sessions: { active: totalSessions },
      connections: { total: totalConnections },
      topics: Object.keys(KAFKA_TOPICS)
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    console.log('Shutting down EventHub service...');
    
    for (const sessionId of this.consumers.keys()) {
      await this.cleanupSession(sessionId);
    }

    console.log('EventHub service shutdown complete');
  }
}

// Export singleton instance
let eventHubServiceInstance = null;

function getEventHubService() {
  if (!eventHubServiceInstance) {
    eventHubServiceInstance = new EventHubService();
  }
  return eventHubServiceInstance;
}

module.exports = {
  EventHubService,
  getEventHubService,
  KAFKA_TOPICS
}; 