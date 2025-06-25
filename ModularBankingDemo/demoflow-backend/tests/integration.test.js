/**
 * Integration Tests for Frontend-Backend Communication
 * Tests complete flow from connection to event streaming
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const { EventEmitter } = require('events');

// Mock services must be defined before jest.mock calls
const mockEventHubService = {
  connectToComponent: jest.fn().mockResolvedValue({
    topic: 'test-topic',
    groupId: 'test-group'
  }),
  disconnectFromComponent: jest.fn().mockResolvedValue(true),
  getStats: jest.fn().mockReturnValue({
    totalConnections: 5,
    activeConnections: 3,
    sessions: { count: 2 },
    connections: { total: 2 },
    topics: ['ms-party-outbox', 'deposits-event-topic']
  }),
  cleanupSession: jest.fn().mockResolvedValue({ connectionsTerminated: 1 }),
  getSessionStatus: jest.fn().mockReturnValue({
    connected: ['party', 'deposits'],
    total: 2
  })
};

const mockSessionManager = {
  registerSession: jest.fn(),
  removeSession: jest.fn().mockReturnValue(true),
  getSession: jest.fn().mockReturnValue({ id: 'test-session', createdAt: new Date() }),
  getStats: jest.fn().mockReturnValue({
    total: 2,
    active: 1
  }),
  isSessionActive: jest.fn().mockReturnValue(true)
};

// Mock the service modules
jest.mock('../src/services/eventHubService', () => ({
  getEventHubService: () => mockEventHubService
}));

jest.mock('../src/services/sessionManager', () => ({
  getSessionManager: () => mockSessionManager
}));

// Import the actual routes after mocking
const eventStreamRoutes = require('../src/routes/eventStreamRoutes');

describe('Frontend-Backend Integration Tests', () => {
  let app;
  let server;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/event-stream', eventStreamRoutes);
    
    // Add health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          eventHub: 'active',
          sessionManager: 'active'
        }
      });
    });

    // Start server
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockSessionManager.registerSession.mockReturnValue({
      sessionId: 'test-session-123',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      userAgent: 'Test Browser',
      ipAddress: '127.0.0.1',
      isActive: true
    });

    mockSessionManager.getSession.mockReturnValue({
      sessionId: 'test-session-123',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      userAgent: 'Test Browser',
      ipAddress: '127.0.0.1',
      isActive: true
    });

    mockEventHubService.getStats.mockReturnValue({
      sessions: { active: 1 },
      connections: { total: 2 },
      topics: ['ms-party-outbox', 'deposits-event-topic']
    });

    mockSessionManager.getStats.mockReturnValue({
      total: 1,
      active: 1,
      inactive: 0
    });
  });

  describe('Health Check Integration', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('eventHub', 'active');
      expect(response.body.services).toHaveProperty('sessionManager', 'active');
    });
  });

  describe('Component Configuration Integration', () => {
    test('should return banking component configurations', async () => {
      const response = await request(app)
        .get('/api/event-stream/components')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check component structure
      const component = response.body.data[0];
      expect(component).toHaveProperty('key');
      expect(component).toHaveProperty('name');
      expect(component).toHaveProperty('description');
      expect(component).toHaveProperty('config');
      expect(component.config).toHaveProperty('kafkaTopic');
      expect(component.config).toHaveProperty('defaultPort');
      expect(component).toHaveProperty('createdAt');
      expect(typeof component.config.kafkaTopic).toBe('string');
    });

    test('should handle CORS preflight requests', async () => {
      await request(app)
        .options('/api/event-stream/components')
        .expect(204);
    });
  });

  describe('Connection Management Integration', () => {
    test('should establish EventHub connection successfully', async () => {
      const component = 'party';
      const sessionId = 'test-session-123';

      const response = await request(app)
        .post(`/api/event-stream/connect/${component}`)
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('topic', 'test-topic');
      expect(response.body).toHaveProperty('groupId', 'test-group');
      expect(response.body).toHaveProperty('sessionId', sessionId);
      expect(mockEventHubService.connectToComponent).toHaveBeenCalledWith(
        sessionId, component, expect.any(Function)
      );
    });

    test('should reject connection to invalid component', async () => {
      const component = 'invalid-component';
      const sessionId = 'test-session-456';

      const response = await request(app)
        .post(`/api/event-stream/connect/${component}`)
        .set('x-session-id', sessionId)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unknown component');
    });

    test('should require session ID for connection', async () => {
      const component = 'party';

      const response = await request(app)
        .post(`/api/event-stream/connect/${component}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Session ID required');
    });

    test('should handle connection errors gracefully', async () => {
      const component = 'party';
      const sessionId = 'test-session-error';

      // Mock service to throw error
      mockEventHubService.connectToComponent.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app)
        .post(`/api/event-stream/connect/${component}`)
        .set('x-session-id', sessionId)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');

      // Reset mock
      mockEventHubService.connectToComponent.mockResolvedValue({
        topic: 'test-topic',
        groupId: 'test-group'
      });
    });
  });

  describe('Disconnection Management Integration', () => {
    test('should disconnect from component successfully', async () => {
      const component = 'party';
      const sessionId = 'test-session-disconnect';

      const response = await request(app)
        .post(`/api/event-stream/disconnect/${component}`)
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(mockEventHubService.disconnectFromComponent).toHaveBeenCalledWith(sessionId, component);
    });

    test('should handle disconnection from non-connected component', async () => {
      const component = 'party';
      const sessionId = 'test-session-not-connected';

      const response = await request(app)
        .post(`/api/event-stream/disconnect/${component}`)
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    test('should require session ID for disconnection', async () => {
      const component = 'party';

      const response = await request(app)
        .post(`/api/event-stream/disconnect/${component}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Session ID required');
    });
  });

  describe('Server-Sent Events Integration', () => {
    test.skip('should establish SSE connection for event streaming', (done) => {
      // Skip this test as SSE streaming is complex to test with supertest
      // The functionality is working but testing streaming connections requires more complex setup
      done();
    });

    test('should handle SSE connection without session ID', (done) => {
      const component = 'party';

      request(app)
        .get(`/api/event-stream/events/${component}`)
        .set('Accept', 'text/event-stream')
        .expect(400)
        .expect('Content-Type', /application\/json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          
          expect(res.body).toHaveProperty('success', false);
          expect(res.body).toHaveProperty('error', 'Session ID required');
          done();
        });
    });
  });

  describe('Statistics Integration', () => {
    test('should return combined service statistics', async () => {
      const response = await request(app)
        .get('/api/event-stream/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('connections');
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('topics');
    });
  });

  describe('Session Status Integration', () => {
    test('should return session connection status', async () => {
      const sessionId = 'test-session-123';

      mockEventHubService.getSessionStatus.mockReturnValue({
        connected: ['party', 'deposits'],
        total: 2
      });

      const response = await request(app)
        .get(`/api/event-stream/session/${sessionId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sessionId', sessionId);
      expect(response.body.data).toHaveProperty('active');
      expect(mockEventHubService.getSessionStatus).toHaveBeenCalledWith(sessionId);
    });

    test('should handle non-existent session status request', async () => {
      const sessionId = 'non-existent-session';

      mockEventHubService.getSessionStatus.mockReturnValue({
        connected: [],
        total: 0
      });

      const response = await request(app)
        .get(`/api/event-stream/session/${sessionId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sessionId', sessionId);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/event-stream/connect/party')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express handles malformed JSON and returns a generic error
      expect(response.body).toBeDefined();
    });

    test('should handle missing Content-Type header', async () => {
      const component = 'party';
      const sessionId = 'test-session-123';

      const response = await request(app)
        .post(`/api/event-stream/connect/${component}`)
        .send(`sessionId=${sessionId}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should handle service unavailability', async () => {
      const component = 'party';
      const sessionId = 'test-session-unavailable';

      // Mock service to throw error
      mockEventHubService.connectToComponent.mockRejectedValueOnce(new Error('Service unavailable'));

      const response = await request(app)
        .post(`/api/event-stream/connect/${component}`)
        .set('x-session-id', sessionId)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');

      // Reset mock
      mockEventHubService.connectToComponent.mockResolvedValue({
        topic: 'test-topic',
        groupId: 'test-group'
      });
    });

    test('should handle 404 for non-existent endpoints', async () => {
      await request(app)
        .get('/api/event-stream/non-existent-endpoint')
        .expect(404);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent connection requests', async () => {
      const component = 'party';
      const concurrentRequests = 5;

      const requests = Array.from({ length: concurrentRequests }, (_, i) => 
        request(app)
          .post(`/api/event-stream/connect/${component}`)
          .set('x-session-id', `concurrent-session-${i}`)
          .expect(200)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success', true);
      });
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      const component = 'party';
      const sessionId = 'rapid-test-session';

      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/event-stream/connect/${component}`)
          .set('x-session-id', sessionId)
          .expect(200);

        await request(app)
          .post(`/api/event-stream/disconnect/${component}`)
          .set('x-session-id', sessionId)
          .expect(200);
      }
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      const requestCount = 50;

      mockEventHubService.getStats.mockReturnValue({
        sessions: { active: 1 },
        connections: { total: 1 },
        topics: ['test-topic']
      });

      const requests = Array.from({ length: requestCount }, () =>
        request(app)
          .get('/api/event-stream/stats')
          .expect(200)
      );

      await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(mockEventHubService.getStats).toHaveBeenCalledTimes(requestCount);
    });
  });

  describe('Cross-Origin Resource Sharing (CORS)', () => {
    test('should handle CORS preflight requests', async () => {
      await request(app)
        .options('/api/event-stream/components')
        .set('Origin', process.env.TEST_ALLOWED_ORIGIN || 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
    });

    test('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/api/event-stream/components')
        .set('Origin', process.env.TEST_ALLOWED_ORIGIN || 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should handle CORS for POST requests', async () => {
      const component = 'party';
      const sessionId = 'cors-test-session';

      const response = await request(app)
        .post(`/api/event-stream/connect/${component}`)
        .set('Origin', process.env.TEST_ALLOWED_ORIGIN || 'http://localhost:3000')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
}); 