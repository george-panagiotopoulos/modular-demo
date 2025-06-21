/**
 * EventHub Service Unit Tests
 * Tests Kafka connectivity, message formatting, and service lifecycle
 */

const { EventHubService, getEventHubService, KAFKA_TOPICS } = require('../src/services/eventHubService');

// Mock KafkaJS
const mockConsumer = {
  connect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
  disconnect: jest.fn()
};

const mockKafka = {
  consumer: jest.fn(() => mockConsumer)
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn(() => mockKafka)
}));

describe('EventHub Service Unit Tests', () => {
  let eventHubService;
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.BOOTSTRAP_SERVERS = 'test-eventhub.servicebus.windows.net:9093';
    process.env.CONNECTION_STRING = 'Endpoint=sb://test-eventhub.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=testkey=';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create fresh service instance
    eventHubService = new EventHubService();
  });

  afterEach(async () => {
    // Cleanup service
    if (eventHubService) {
      await eventHubService.shutdown();
    }
  });

  describe('Service Initialization', () => {
    test('should initialize with valid configuration', () => {
      expect(eventHubService.kafka).toBeDefined();
      expect(eventHubService.consumers).toBeInstanceOf(Map);
      expect(eventHubService.eventCallbacks).toBeInstanceOf(Map);
    });

    test('should handle missing configuration gracefully', () => {
      // Store original values
      const originalBootstrap = process.env.BOOTSTRAP_SERVERS;
      const originalConnection = process.env.CONNECTION_STRING;
      
      // Delete environment variables
      delete process.env.BOOTSTRAP_SERVERS;
      delete process.env.CONNECTION_STRING;
      
      // Create service without config - should handle gracefully
      const serviceWithoutConfig = new EventHubService();
      expect(serviceWithoutConfig.kafka).toBeNull();
      
      // Restore config
      process.env.BOOTSTRAP_SERVERS = originalBootstrap;
      process.env.CONNECTION_STRING = originalConnection;
    });

    test('should validate Kafka topic mappings', () => {
      expect(KAFKA_TOPICS).toBeDefined();
      expect(typeof KAFKA_TOPICS).toBe('object');
      expect(KAFKA_TOPICS.party).toBe('ms-party-outbox');
      expect(KAFKA_TOPICS.deposits).toBe('deposits-event-topic');
      expect(KAFKA_TOPICS.lending).toBe('lending-event-topic');
      expect(KAFKA_TOPICS.eventstore).toBe('ms-eventstore-inbox-topic');
      expect(KAFKA_TOPICS.adapter).toBe('ms-adapterservice-event-topic');
      expect(KAFKA_TOPICS.holdings).toBe('ms-holdings-event-topic');
    });
  });

  describe('Component Connection Management', () => {
    test('should connect to valid component successfully', async () => {
      const sessionId = 'test-session-123';
      const component = 'party';
      const mockCallback = jest.fn();

      mockConsumer.connect.mockResolvedValue();
      mockConsumer.subscribe.mockResolvedValue();
      mockConsumer.run.mockResolvedValue();

      const result = await eventHubService.connectToComponent(sessionId, component, mockCallback);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('topic', KAFKA_TOPICS[component]);
      expect(result).toHaveProperty('groupId');
      expect(result.groupId).toContain(component);
      expect(result.groupId).toContain(sessionId);

      expect(mockKafka.consumer).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: expect.stringContaining(component),
          sessionTimeout: 30000,
          heartbeatInterval: 10000
        })
      );

      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: KAFKA_TOPICS[component],
        fromBeginning: false
      });
      expect(mockConsumer.run).toHaveBeenCalled();

      // Verify consumer and callback are stored
      expect(eventHubService.consumers.has(sessionId)).toBe(true);
      expect(eventHubService.consumers.get(sessionId).has(component)).toBe(true);
      expect(eventHubService.eventCallbacks.has(sessionId)).toBe(true);
      expect(eventHubService.eventCallbacks.get(sessionId).has(component)).toBe(true);
    });

    test('should reject connection to invalid component', async () => {
      const sessionId = 'test-session-123';
      const component = 'invalid-component';
      const mockCallback = jest.fn();

      await expect(
        eventHubService.connectToComponent(sessionId, component, mockCallback)
      ).rejects.toThrow('Unknown component: invalid-component');
    });

    test('should handle Kafka connection errors', async () => {
      const sessionId = 'test-session-123';
      const component = 'party';
      const mockCallback = jest.fn();

      mockConsumer.connect.mockRejectedValue(new Error('Kafka connection failed'));

      await expect(
        eventHubService.connectToComponent(sessionId, component, mockCallback)
      ).rejects.toThrow('Kafka connection failed');
    });

    test('should clean up existing connection before new one', async () => {
      const sessionId = 'test-session-123';
      const component = 'party';
      const mockCallback = jest.fn();

      // Setup successful connection
      mockConsumer.connect.mockResolvedValue();
      mockConsumer.subscribe.mockResolvedValue();
      mockConsumer.run.mockResolvedValue();
      mockConsumer.disconnect.mockResolvedValue();

      // First connection
      await eventHubService.connectToComponent(sessionId, component, mockCallback);
      
      // Second connection should clean up first
      await eventHubService.connectToComponent(sessionId, component, mockCallback);

      expect(mockConsumer.disconnect).toHaveBeenCalled();
    });
  });

  describe('Component Disconnection', () => {
    test('should disconnect from connected component', async () => {
      const sessionId = 'test-session-123';
      const component = 'deposits';
      const mockCallback = jest.fn();

      // Setup connection
      mockConsumer.connect.mockResolvedValue();
      mockConsumer.subscribe.mockResolvedValue();
      mockConsumer.run.mockResolvedValue();
      mockConsumer.disconnect.mockResolvedValue();

      await eventHubService.connectToComponent(sessionId, component, mockCallback);
      
      // Verify connection exists before disconnection
      expect(eventHubService.consumers.get(sessionId)?.has(component)).toBe(true);
      expect(eventHubService.eventCallbacks.get(sessionId)?.has(component)).toBe(true);
      
      // Disconnect
      await eventHubService.disconnectFromComponent(sessionId, component);

      expect(mockConsumer.disconnect).toHaveBeenCalled();
      
      // After disconnection, the session map may be cleaned up if it's empty
      // So we check if the session exists, and if it does, the component should not be there
      const sessionConsumers = eventHubService.consumers.get(sessionId);
      const sessionCallbacks = eventHubService.eventCallbacks.get(sessionId);
      
      if (sessionConsumers) {
        expect(sessionConsumers.has(component)).toBe(false);
      }
      if (sessionCallbacks) {
        expect(sessionCallbacks.has(component)).toBe(false);
      }
    });

    test('should handle disconnection from non-connected component gracefully', async () => {
      const sessionId = 'test-session-123';
      const component = 'lending';

      // Should not throw error
      await expect(
        eventHubService.disconnectFromComponent(sessionId, component)
      ).resolves.not.toThrow();
    });

    test('should handle disconnection errors gracefully', async () => {
      const sessionId = 'test-session-123';
      const component = 'holdings';
      const mockCallback = jest.fn();

      // Setup connection
      mockConsumer.connect.mockResolvedValue();
      mockConsumer.subscribe.mockResolvedValue();
      mockConsumer.run.mockResolvedValue();
      mockConsumer.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      await eventHubService.connectToComponent(sessionId, component, mockCallback);
      
      // Should handle disconnect error gracefully
      await expect(
        eventHubService.disconnectFromComponent(sessionId, component)
      ).resolves.not.toThrow();
    });
  });

  describe('Session Management', () => {
    test('should clean up all connections for a session', async () => {
      const sessionId = 'test-session-123';
      const components = ['party', 'deposits', 'lending'];
      const mockCallback = jest.fn();

      // Setup connections
      mockConsumer.connect.mockResolvedValue();
      mockConsumer.subscribe.mockResolvedValue();
      mockConsumer.run.mockResolvedValue();
      mockConsumer.disconnect.mockResolvedValue();

      for (const component of components) {
        await eventHubService.connectToComponent(sessionId, component, mockCallback);
      }

      // Clean up session
      const result = await eventHubService.cleanupSession(sessionId);

      expect(result).toHaveProperty('connectionsTerminated', components.length);
      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(components.length);
      expect(eventHubService.consumers.has(sessionId)).toBe(false);
      expect(eventHubService.eventCallbacks.has(sessionId)).toBe(false);
    });

    test('should handle cleanup for non-existent session', async () => {
      const sessionId = 'non-existent-session';

      const result = await eventHubService.cleanupSession(sessionId);

      expect(result).toHaveProperty('connectionsTerminated', 0);
    });

    test('should get session status correctly', () => {
      const sessionId = 'test-session-123';
      const components = ['party', 'deposits'];

      // Simulate connected components
      eventHubService.consumers.set(sessionId, new Map());
      components.forEach(component => {
        eventHubService.consumers.get(sessionId).set(component, mockConsumer);
      });

      const status = eventHubService.getSessionStatus(sessionId);

      expect(status).toHaveProperty('connected', components);
      expect(status).toHaveProperty('total', components.length);
    });

    test('should return empty status for non-existent session', () => {
      const sessionId = 'non-existent-session';

      const status = eventHubService.getSessionStatus(sessionId);

      expect(status).toHaveProperty('connected', []);
      expect(status).toHaveProperty('total', 0);
    });
  });

  describe('Message Formatting', () => {
    test('should format JSON message correctly', () => {
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

      const result = eventHubService.formatEventMessage(mockMessage, 'ms-party-outbox', 0);

      expect(result).toHaveProperty('type', 'event');
      expect(result.data).toHaveProperty('topic', 'ms-party-outbox');
      expect(result.data).toHaveProperty('partition', 0);
      expect(result.data).toHaveProperty('offset', '42');
      expect(result.data).toHaveProperty('timestamp');
      expect(result.data).toHaveProperty('key', 'CUST-123');
      expect(result.data).toHaveProperty('payload');
      expect(result.data.payload).toHaveProperty('eventType', 'CustomerCreated');
    });

    test('should format non-JSON message correctly', () => {
      const mockMessage = {
        value: Buffer.from('plain text message'),
        timestamp: '1640995200000',
        offset: '43',
        key: Buffer.from('TEXT-123')
      };

      const result = eventHubService.formatEventMessage(mockMessage, 'test-topic', 1);

      expect(result).toHaveProperty('type', 'event');
      expect(result.data).toHaveProperty('topic', 'test-topic');
      expect(result.data).toHaveProperty('partition', 1);
      expect(result.data).toHaveProperty('offset', '43');
      expect(result.data).toHaveProperty('key', 'TEXT-123');
      expect(result.data).toHaveProperty('payload', 'plain text message');
    });

    test('should handle message without timestamp', () => {
      const mockMessage = {
        value: Buffer.from('{"test": "data"}'),
        offset: '44',
        key: null
      };

      const result = eventHubService.formatEventMessage(mockMessage, 'test-topic', 0);

      expect(result).toHaveProperty('type', 'event');
      expect(result.data).toHaveProperty('timestamp');
      expect(result.data).toHaveProperty('key', null);
    });

    test('should handle message formatting errors', () => {
      const mockMessage = {
        value: { toString: () => { throw new Error('Conversion error'); } },
        timestamp: '1640995200000',
        offset: '45'
      };

      const result = eventHubService.formatEventMessage(mockMessage, 'test-topic', 0);

      expect(result).toHaveProperty('type', 'error');
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Error formatting message');
    });
  });

  describe('Service Statistics', () => {
    test('should return correct service statistics', () => {
      const sessions = ['session1', 'session2', 'session3'];
      const componentsPerSession = ['party', 'deposits'];

      // Setup test data
      sessions.forEach(sessionId => {
        eventHubService.consumers.set(sessionId, new Map());
        componentsPerSession.forEach(component => {
          eventHubService.consumers.get(sessionId).set(component, mockConsumer);
        });
      });

      const stats = eventHubService.getStats();

      expect(stats).toHaveProperty('sessions');
      expect(stats.sessions).toHaveProperty('active', sessions.length);
      expect(stats).toHaveProperty('connections');
      expect(stats.connections).toHaveProperty('total', sessions.length * componentsPerSession.length);
      expect(stats).toHaveProperty('topics');
      expect(Array.isArray(stats.topics)).toBe(true);
      expect(stats.topics).toEqual(Object.keys(KAFKA_TOPICS));
    });

    test('should return zero stats for empty service', () => {
      const stats = eventHubService.getStats();

      expect(stats.sessions.active).toBe(0);
      expect(stats.connections.total).toBe(0);
      expect(Array.isArray(stats.topics)).toBe(true);
    });
  });

  describe('Service Shutdown', () => {
    test('should shutdown service and cleanup all connections', async () => {
      const sessions = ['session1', 'session2'];
      const components = ['party', 'deposits'];
      const mockCallback = jest.fn();

      // Setup connections
      mockConsumer.connect.mockResolvedValue();
      mockConsumer.subscribe.mockResolvedValue();
      mockConsumer.run.mockResolvedValue();
      mockConsumer.disconnect.mockResolvedValue();

      for (const sessionId of sessions) {
        for (const component of components) {
          await eventHubService.connectToComponent(sessionId, component, mockCallback);
        }
      }

      // Shutdown service
      await eventHubService.shutdown();

      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(sessions.length * components.length);
      expect(eventHubService.consumers.size).toBe(0);
      expect(eventHubService.eventCallbacks.size).toBe(0);
    });

    test('should handle shutdown errors gracefully', async () => {
      const sessionId = 'test-session';
      const component = 'party';
      const mockCallback = jest.fn();

      // Setup connection
      mockConsumer.connect.mockResolvedValue();
      mockConsumer.subscribe.mockResolvedValue();
      mockConsumer.run.mockResolvedValue();
      mockConsumer.disconnect.mockRejectedValue(new Error('Shutdown error'));

      await eventHubService.connectToComponent(sessionId, component, mockCallback);

      // Should not throw error during shutdown
      await expect(eventHubService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getEventHubService', () => {
      const instance1 = getEventHubService();
      const instance2 = getEventHubService();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(EventHubService);
    });
  });

  describe('Error Scenarios', () => {
    test('should throw error when service not initialized', async () => {
      const uninitializedService = new EventHubService();
      uninitializedService.kafka = null;

      await expect(
        uninitializedService.connectToComponent('session', 'party', jest.fn())
      ).rejects.toThrow('EventHub service not initialized');
    });

    test('should handle consumer creation failure', async () => {
      mockKafka.consumer.mockImplementation(() => {
        throw new Error('Consumer creation failed');
      });

      await expect(
        eventHubService.connectToComponent('session', 'party', jest.fn())
      ).rejects.toThrow('Consumer creation failed');
    });
  });
}); 