/**
 * Comprehensive Tests for HeadlessV3 EventHub Integration
 * Tests Kafka connectivity, session management, and frontend-backend communication
 */

const request = require('supertest');
const { EventEmitter } = require('events');
const app = require('../src/server');
const { getEventHubService } = require('../src/services/eventHubService');
const { getSessionManager } = require('../src/services/sessionManager');

// Mock EventSource for SSE testing
class MockEventSource extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = options;
    this.readyState = 1; // OPEN
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSED = 2;
    
    // Simulate connection
    setTimeout(() => {
      this.emit('open');
    }, 10);
  }
  
  close() {
    this.readyState = this.CLOSED;
    this.emit('close');
  }
}

// Test utilities
const createTestSession = () => `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const waitForEvent = (emitter, event, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);
    
    emitter.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
};

describe('HeadlessV3 EventHub Integration Tests', () => {
  let eventHubService;
  let sessionManager;
  let testSessions = [];

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Get service instances
    eventHubService = getEventHubService();
    sessionManager = getSessionManager();
    
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup all test sessions
    for (const sessionId of testSessions) {
      try {
        await eventHubService.cleanupSession(sessionId);
        sessionManager.removeSession(sessionId);
      } catch (error) {
        console.error(`Error cleaning up session ${sessionId}:`, error);
      }
    }

    try {
      // Shutdown services
      await eventHubService.shutdown();
      sessionManager.cleanup(); // This will stop the cleanup timer
    } catch (error) {
      console.error('Error shutting down services:', error);
    }

    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 15000); // Increased timeout to 15 seconds

  afterEach(async () => {
    // Clean up after each test
    jest.clearAllMocks();
  });

  describe('Health Check and Service Status', () => {
    test('should return healthy status with active services', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('eventHub', 'active');
      expect(response.body.services).toHaveProperty('sessionManager', 'active');
    });

    test('should return service statistics', async () => {
      const response = await request(app)
        .get('/api/headless-v3/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('connections');
      expect(response.body.data).toHaveProperty('topics');
      expect(Array.isArray(response.body.data.topics)).toBe(true);
    });
  });

  describe('Component Configuration', () => {
    test('should return all banking components with correct structure', async () => {
      const response = await request(app)
        .get('/api/headless-v3/components')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Check for expected component types
      const componentKeys = response.body.data.map(c => c.key);
      expect(componentKeys).toContain('party');
      expect(componentKeys).toContain('deposits');
      expect(componentKeys).toContain('lending');
      expect(componentKeys).toContain('eventstore');
      expect(componentKeys).toContain('adapter');
      expect(componentKeys).toContain('holdings');

      // Validate component structure
      response.body.data.forEach(component => {
        expect(component).toHaveProperty('key');
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('description');
        expect(component).toHaveProperty('domain');
        expect(component).toHaveProperty('version');
        expect(component).toHaveProperty('config');
        expect(component.config).toHaveProperty('eventTypes');
        expect(component.config).toHaveProperty('defaultPort');
        expect(component).toHaveProperty('createdAt');
      });
    });

    test('should have correct Kafka topic mappings', async () => {
      const response = await request(app)
        .get('/api/headless-v3/components')
        .expect(200);

      const components = response.body.data;
      
      // Test specific component configurations
      const party = components.find(c => c.key === 'party');
      expect(party).toBeDefined();
      expect(party.name).toContain('Party/Customer - R24');
      expect(party.config.eventTypes).toContain('CustomerCreated');

      const deposits = components.find(c => c.key === 'deposits');
      expect(deposits).toBeDefined();
      expect(deposits.name).toContain('Deposits/Accounts Module R25');
      expect(deposits.config.eventTypes).toContain('AccountOpened');

      const eventstore = components.find(c => c.key === 'eventstore');
      expect(eventstore).toBeDefined();
      expect(eventstore.name).toContain('Event Store R25');
      expect(eventstore.config.eventTypes).toContain('EventStored');
    });
  });

  describe('EventHub Connection Management', () => {
    test('should establish connection to valid component', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      const response = await request(app)
        .post('/api/headless-v3/connect/eventstore')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('sessionId', sessionId);
      expect(response.body).toHaveProperty('topic');
      expect(response.body).toHaveProperty('groupId');
      expect(response.body.topic).toBe('ms-eventstore-inbox-topic');
    });

    test('should reject connection to invalid component', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      const response = await request(app)
        .post('/api/headless-v3/connect/invalid-component')
        .set('x-session-id', sessionId)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unknown component');
    });

    test('should require session ID for connection', async () => {
      const response = await request(app)
        .post('/api/headless-v3/connect/party')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Session ID required');
    });

    test('should handle multiple component connections per session', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // Connect to multiple components
      const components = ['party', 'deposits', 'lending'];
      const responses = await Promise.all(
        components.map(component =>
          request(app)
            .post(`/api/headless-v3/connect/${component}`)
            .set('x-session-id', sessionId)
        )
      );

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.sessionId).toBe(sessionId);
      });

      // Check session status
      const statusResponse = await request(app)
        .get(`/api/headless-v3/session/${sessionId}/status`)
        .expect(200);

      expect(statusResponse.body.data.connected).toEqual(
        expect.arrayContaining(components)
      );
      expect(statusResponse.body.data.total).toBe(components.length);
    });
  });

  describe('EventHub Disconnection', () => {
    test('should disconnect from connected component', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // First connect
      await request(app)
        .post('/api/headless-v3/connect/holdings')
        .set('x-session-id', sessionId)
        .expect(200);

      // Then disconnect
      const response = await request(app)
        .post('/api/headless-v3/disconnect/holdings')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Disconnected from holdings');
    });

    test('should handle disconnection from non-connected component gracefully', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      const response = await request(app)
        .post('/api/headless-v3/disconnect/adapter')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should require session ID for disconnection', async () => {
      const response = await request(app)
        .post('/api/headless-v3/disconnect/party')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Session ID required');
    });
  });

  describe('Server-Sent Events (SSE) Streaming', () => {
    test('should establish SSE connection for valid component', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // First connect to component
      await request(app)
        .post('/api/headless-v3/connect/party')
        .set('x-session-id', sessionId)
        .expect(200);

      // Test SSE endpoint
      const response = await request(app)
        .get('/api/headless-v3/events/party')
        .set('x-session-id', sessionId)
        .set('Accept', 'text/event-stream')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    test('should require session ID for SSE connection', async () => {
      const response = await request(app)
        .get('/api/headless-v3/events/party')
        .set('Accept', 'text/event-stream')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Session ID required');
    });

    test('should handle SSE connection for multiple components', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      const components = ['deposits', 'lending'];
      
      // Connect to components
      for (const component of components) {
        await request(app)
          .post(`/api/headless-v3/connect/${component}`)
          .set('x-session-id', sessionId)
          .expect(200);
      }

      // Test SSE connections
      const ssePromises = components.map(component =>
        request(app)
          .get(`/api/headless-v3/events/${component}`)
          .set('x-session-id', sessionId)
          .set('Accept', 'text/event-stream')
          .expect(200)
      );

      const responses = await Promise.all(ssePromises);
      responses.forEach(response => {
        expect(response.headers['content-type']).toBe('text/event-stream');
      });
    });
  });

  describe('Session Management', () => {
    test('should track session status correctly', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // Connect to component
      await request(app)
        .post('/api/headless-v3/connect/adapter')
        .set('x-session-id', sessionId)
        .expect(200);

      // Check session status
      const response = await request(app)
        .get(`/api/headless-v3/session/${sessionId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sessionId', sessionId);
      expect(response.body.data).toHaveProperty('active', true);
      expect(response.body.data).toHaveProperty('connected');
      expect(response.body.data.connected).toContain('adapter');
      expect(response.body.data).toHaveProperty('total', 1);
    });

    test('should perform session cleanup', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // Connect to multiple components
      const components = ['party', 'deposits'];
      for (const component of components) {
        await request(app)
          .post(`/api/headless-v3/connect/${component}`)
          .set('x-session-id', sessionId)
          .expect(200);
      }

      // Perform cleanup
      const response = await request(app)
        .post(`/api/headless-v3/session/${sessionId}/cleanup`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Session cleanup completed');
      expect(response.body.data).toHaveProperty('connectionsTerminated', components.length);

      // Verify session is cleaned up
      const statusResponse = await request(app)
        .get(`/api/headless-v3/session/${sessionId}/status`)
        .expect(200);

      expect(statusResponse.body.data.total).toBe(0);
      expect(statusResponse.body.data.connected).toEqual([]);
    });

    test('should handle concurrent session operations', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // Perform concurrent operations
      const operations = [
        request(app).post('/api/headless-v3/connect/party').set('x-session-id', sessionId),
        request(app).post('/api/headless-v3/connect/deposits').set('x-session-id', sessionId),
        request(app).post('/api/headless-v3/connect/lending').set('x-session-id', sessionId)
      ];

      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Verify final state
      const statusResponse = await request(app)
        .get(`/api/headless-v3/session/${sessionId}/status`)
        .expect(200);

      expect(statusResponse.body.data.total).toBe(3);
    });
  });

  describe('Kafka Integration Tests', () => {
    test('should validate Kafka topic mappings', () => {
      const { KAFKA_TOPICS } = require('../src/services/eventHubService');
      
      expect(KAFKA_TOPICS).toBeDefined();
      expect(KAFKA_TOPICS).toHaveProperty('party', 'ms-party-outbox');
      expect(KAFKA_TOPICS).toHaveProperty('deposits', 'deposits-event-topic');
      expect(KAFKA_TOPICS).toHaveProperty('lending', 'lending-event-topic');
      expect(KAFKA_TOPICS).toHaveProperty('eventstore', 'ms-eventstore-inbox-topic');
      expect(KAFKA_TOPICS).toHaveProperty('adapter', 'ms-adapterservice-event-topic');
      expect(KAFKA_TOPICS).toHaveProperty('holdings', 'ms-holdings-event-topic');
    });

    test('should handle Kafka connection errors gracefully', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // Mock a connection error scenario
      const originalConnect = eventHubService.connectToComponent;
      eventHubService.connectToComponent = jest.fn().mockRejectedValue(
        new Error('Kafka connection failed')
      );

      const response = await request(app)
        .post('/api/headless-v3/connect/party')
        .set('x-session-id', sessionId)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Kafka connection failed');

      // Restore original method
      eventHubService.connectToComponent = originalConnect;
    });

    test('should format Kafka messages correctly', () => {
      const mockMessage = {
        value: Buffer.from(JSON.stringify({
          eventType: 'CustomerCreated',
          businessKey: 'CUST-123',
          payload: { id: 'CUST-123', name: 'John Doe' }
        })),
        timestamp: '1640995200000',
        offset: '42',
        key: Buffer.from('CUST-123')
      };

      const formattedEvent = eventHubService.formatEventMessage(
        mockMessage, 
        'ms-party-outbox', 
        0
      );

      expect(formattedEvent).toHaveProperty('type', 'event');
      expect(formattedEvent.data).toHaveProperty('topic', 'ms-party-outbox');
      expect(formattedEvent.data).toHaveProperty('partition', 0);
      expect(formattedEvent.data).toHaveProperty('offset', '42');
      expect(formattedEvent.data).toHaveProperty('timestamp');
      expect(formattedEvent.data).toHaveProperty('key', 'CUST-123');
      expect(formattedEvent.data).toHaveProperty('payload');
      expect(formattedEvent.data.payload).toHaveProperty('eventType', 'CustomerCreated');
    });
  });

  describe('Frontend-Backend Communication', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/headless-v3/components')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    test('should accept requests from allowed origins', async () => {
      const response = await request(app)
        .get('/api/headless-v3/components')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('should handle session ID in headers', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      const response = await request(app)
        .post('/api/headless-v3/connect/holdings')
        .set('x-session-id', sessionId)
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
    });

    test('should validate JSON request bodies', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      const response = await request(app)
        .post('/api/headless-v3/connect/party')
        .set('x-session-id', sessionId)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/headless-v3/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Endpoint not found');
      expect(response.body).toHaveProperty('path', '/api/headless-v3/non-existent');
      expect(response.body).toHaveProperty('method', 'GET');
    });

    test('should provide meaningful error messages', async () => {
      const response = await request(app)
        .post('/api/headless-v3/connect/nonexistent')
        .set('x-session-id', 'test-session')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unknown component');
    });

    test('should handle malformed session IDs', async () => {
      const response = await request(app)
        .post('/api/headless-v3/connect/party')
        .set('x-session-id', '')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Session ID required');
    });

    test('should handle service unavailability gracefully', async () => {
      // Temporarily disable EventHub service
      const originalKafka = eventHubService.kafka;
      eventHubService.kafka = null;

      const sessionId = createTestSession();
      testSessions.push(sessionId);

      const response = await request(app)
        .post('/api/headless-v3/connect/party')
        .set('x-session-id', sessionId)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('EventHub service not initialized');

      // Restore service
      eventHubService.kafka = originalKafka;
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent connections', async () => {
      const numSessions = 5;
      const sessions = Array.from({ length: numSessions }, () => createTestSession());
      testSessions.push(...sessions);

      const connectionPromises = sessions.map(sessionId =>
        request(app)
          .post('/api/headless-v3/connect/eventstore')
          .set('x-session-id', sessionId)
      );

      const responses = await Promise.all(connectionPromises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify all sessions are tracked
      const statsResponse = await request(app)
        .get('/api/headless-v3/stats')
        .expect(200);

      expect(statsResponse.body.data.connections.total).toBeGreaterThanOrEqual(numSessions);
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      const sessionId = createTestSession();
      testSessions.push(sessionId);

      // Perform rapid connect/disconnect cycles
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/headless-v3/connect/adapter')
          .set('x-session-id', sessionId)
          .expect(200);

        await request(app)
          .post('/api/headless-v3/disconnect/adapter')
          .set('x-session-id', sessionId)
          .expect(200);
      }

      // Final state should be disconnected
      const statusResponse = await request(app)
        .get(`/api/headless-v3/session/${sessionId}/status`)
        .expect(200);

      expect(statusResponse.body.data.total).toBe(0);
    });
  });
});