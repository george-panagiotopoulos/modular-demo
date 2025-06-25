/**
 * Integration Tests for Event Stream API with real Azure Event Hub
 *
 * These tests require a configured .env file with valid Azure Event Hub
 * connection strings (BOOTSTRAP_SERVERS, CONNECTION_STRING).
 * The tests are designed to run against a live service and will be slower
 * than mocked tests.
 */

const request = require('supertest');
const app = require('../src/server');
const { getEventHubService } = require('../src/services/eventHubService');
const { getSessionManager } = require('../src/services/sessionManager');

// Helper to create a unique session ID for each test run
const createTestSessionId = () => `test-session-${Date.now()}`;

describe('Event Stream Integration Tests (Live Azure Event Hub)', () => {
  let eventHubService;
  let sessionManager;
  let testSessionId;
  const componentToTest = 'eventstore'; // Use a consistent component for tests

  // Increase timeout to handle real network latency
  jest.setTimeout(60000); // 60 seconds

  beforeAll(() => {
    eventHubService = getEventHubService();
    sessionManager = getSessionManager();

    if (!eventHubService.isReady()) {
      throw new Error(
        'Event Hub Service is not ready. Please ensure BOOTSTRAP_SERVERS and CONNECTION_STRING are set in your .env file.'
      );
    }
  });

  beforeEach(() => {
    // Create a fresh session ID for each test to ensure isolation
    testSessionId = createTestSessionId();
  });

  afterEach(async () => {
    // Clean up the session after each test to remove consumers from Event Hub
    await eventHubService.cleanupSession(testSessionId);
  });

  afterAll(async () => {
    // Shutdown services gracefully
    console.log('Shutting down services after all tests.');
    await eventHubService.shutdown();
    sessionManager.cleanup(); // Stops the session manager's cleanup timer
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Allow time for connections to close
  });

  describe('Service Health and Configuration', () => {
    it('should return a healthy status via the /health endpoint', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services.eventHub).toBe('active');
    });

    it('should return the list of available components', async () => {
      const response = await request(app).get('/api/event-stream/components').expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      const componentKeys = response.body.data.map((c) => c.key);
      expect(componentKeys).toContain('party');
      expect(componentKeys).toContain(componentToTest);
    });
  });

  describe('Connection and Disconnection Lifecycle', () => {
    it('should fail to connect if component is invalid', async () => {
      const response = await request(app)
        .post('/api/event-stream/connect/invalid-component')
        .set('x-session-id', testSessionId)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unknown component');
    });

    it('should fail to connect without a session ID', async () => {
      const response = await request(app)
        .post(`/api/event-stream/connect/${componentToTest}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session ID required');
    });

    it('should connect to a valid component, get status, and disconnect', async () => {
      // 1. Connect to the component
      const connectResponse = await request(app)
        .post(`/api/event-stream/connect/${componentToTest}`)
        .set('x-session-id', testSessionId)
        .expect(200);

      expect(connectResponse.body.success).toBe(true);
      expect(connectResponse.body.message).toContain('Connected to');
      expect(connectResponse.body).toHaveProperty('topic');
      expect(connectResponse.body).toHaveProperty('groupId');

      // 2. Verify session status
      const statusResponse = await request(app)
        .get(`/api/event-stream/session/${testSessionId}/status`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.total).toBe(1);
      expect(statusResponse.body.data.connected).toContain(componentToTest);

      // 3. Disconnect from the component
      const disconnectResponse = await request(app)
        .post(`/api/event-stream/disconnect/${componentToTest}`)
        .set('x-session-id', testSessionId)
        .expect(200);

      expect(disconnectResponse.body.success).toBe(true);
      expect(disconnectResponse.body.message).toContain('Disconnected from');

      // 4. Verify session status after disconnection
      const finalStatusResponse = await request(app)
        .get(`/api/event-stream/session/${testSessionId}/status`)
        .expect(200);
      
      expect(finalStatusResponse.body.data.total).toBe(0);
    });
  });

  describe('Server-Sent Events (SSE) Stream', () => {
    it('should establish an SSE stream and receive an initial info message', (done) => {
      // First, establish a connection for the session
      request(app)
        .post(`/api/event-stream/connect/${componentToTest}`)
        .set('x-session-id', testSessionId)
        .expect(200)
        .then(() => {
          // Now, connect to the SSE endpoint
          const sseRequest = request(app)
            .get(`/api/event-stream/events/${componentToTest}`)
            .set('x-session-id', testSessionId)
            .set('Accept', 'text/event-stream');

          sseRequest
            .expect(200)
            .expect('Content-Type', /text\/event-stream/)
            .parse((res, callback) => {
              res.setEncoding('utf8');
              let buffer = '';
              res.on('data', (chunk) => {
                buffer += chunk;
                if (buffer.includes('data: {"type":"info"')) {
                  // End the response to signal completion to supertest
                  res.destroy(); 
                  callback(null, buffer);
                }
              });
              res.on('end', () => {
                // Should not be called if we destroy, but handle it just in case
                callback(null, buffer);
              });
               res.on('error', (err) => {
                // Propagate stream errors
                callback(err, buffer);
              });
            })
            .end((err, res) => {
              if (err) {
                // res.destroy() can cause a socket hang up error, which is fine
                if (err.code === 'ECONNRESET' || err.message.includes('socket hang up')) {
                  expect(res.body).toContain('data: {"type":"info"');
                  return done();
                }
                return done(err);
              }
              expect(res.body).toContain('data: {"type":"info"');
              done();
            });
        })
        .catch(done);
    });
  });

  describe('Session Management', () => {
    it('should clean up all connections for a session', async () => {
      // Connect to multiple components
      await request(app).post('/api/event-stream/connect/party').set('x-session-id', testSessionId).expect(200);
      await request(app).post('/api/event-stream/connect/deposits').set('x-session-id', testSessionId).expect(200);

      let statusResponse = await request(app)
        .get(`/api/event-stream/session/${testSessionId}/status`)
        .expect(200);
      expect(statusResponse.body.data.total).toBe(2);

      // Issue cleanup command
      const cleanupResponse = await request(app)
        .post(`/api/event-stream/session/${testSessionId}/cleanup`)
        .expect(200);

      expect(cleanupResponse.body.success).toBe(true);
      expect(cleanupResponse.body.message).toBe('Session cleanup completed');
      expect(cleanupResponse.body.data.connectionsTerminated).toBe(2);
      
      // Verify all connections are gone
      statusResponse = await request(app)
        .get(`/api/event-stream/session/${testSessionId}/status`)
        .expect(200);
      expect(statusResponse.body.data.total).toBe(0);
    });
  });
}); 