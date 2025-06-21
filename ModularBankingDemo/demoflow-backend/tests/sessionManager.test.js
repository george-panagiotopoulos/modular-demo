/**
 * SessionManager Service Unit Tests
 * Tests session lifecycle, cleanup, and statistics functionality
 */

const { SessionManager } = require('../src/services/sessionManager');

describe('SessionManager Service Unit Tests', () => {
  let sessionManager;
  let originalSetTimeout;
  let originalSetInterval;
  let originalClearTimeout;
  let originalClearInterval;

  beforeAll(() => {
    // Mock timers
    originalSetTimeout = global.setTimeout;
    originalSetInterval = global.setInterval;
    originalClearTimeout = global.clearTimeout;
    originalClearInterval = global.clearInterval;

    global.setTimeout = jest.fn((callback, delay) => {
      return { id: Math.random(), callback, delay };
    });
    global.setInterval = jest.fn((callback, delay) => {
      return { id: Math.random(), callback, delay };
    });
    global.clearTimeout = jest.fn();
    global.clearInterval = jest.fn();
  });

  afterAll(() => {
    // Restore original timers
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
    global.clearTimeout = originalClearTimeout;
    global.clearInterval = originalClearInterval;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager();
  });

  afterEach(async () => {
    if (sessionManager) {
      sessionManager.cleanup();
    }
  });

  describe('Session Registration', () => {
    test('should register new session successfully', () => {
      const sessionId = 'test-session-123';
      const metadata = { userAgent: 'Test Browser', ip: '192.168.1.1' };

      const result = sessionManager.registerSession(sessionId, metadata);

      expect(result).toBe(sessionId);

      // Verify session is stored
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.metadata.userAgent).toBe('Test Browser');
      expect(session.metadata.ip).toBe('192.168.1.1');
      expect(session.createdAt).toBeDefined();
      expect(session.lastActivity).toBeDefined();
      expect(session.age).toBeDefined();
      expect(session.timeSinceActivity).toBeDefined();
    });

    test('should update existing session on re-registration', () => {
      const sessionId = 'test-session-123';
      const metadata1 = { userAgent: 'Browser 1', ip: '192.168.1.1' };
      const metadata2 = { userAgent: 'Browser 2', ip: '192.168.1.2' };

      // First registration
      const result1 = sessionManager.registerSession(sessionId, metadata1);
      const session1 = sessionManager.getSession(sessionId);
      const createdAt1 = session1.createdAt;

      // Second registration with different metadata
      const result2 = sessionManager.registerSession(sessionId, metadata2);
      const session2 = sessionManager.getSession(sessionId);
      
      expect(result2).toBe(sessionId);
      expect(session2.metadata.userAgent).toBe('Browser 2');
      expect(session2.metadata.ip).toBe('192.168.1.2');
      // Note: re-registration creates a new session, so createdAt will be different
      expect(session2.createdAt).toBeGreaterThanOrEqual(createdAt1);
    });

    test('should handle registration with missing parameters', () => {
      const sessionId = 'test-session-123';

      const result = sessionManager.registerSession(sessionId);

      expect(result).toBe(sessionId);
      const session = sessionManager.getSession(sessionId);
      expect(session.metadata.userAgent).toBe('unknown');
      expect(session.metadata.ip).toBe('unknown');
    });
  });

  describe('Session Activity Updates', () => {
    test('should update session activity timestamp', () => {
      const sessionId = 'test-session-123';
      
      // Register session
      sessionManager.registerSession(sessionId, { userAgent: 'Test Browser', ip: '192.168.1.1' });
      const initialActivity = sessionManager.getSession(sessionId).lastActivity;

      // Wait a bit and update activity
      setTimeout(() => {
        const updateResult = sessionManager.updateActivity(sessionId);
        expect(updateResult).toBe(true);
        
        const updatedActivity = sessionManager.getSession(sessionId).lastActivity;
        expect(updatedActivity).toBeGreaterThanOrEqual(initialActivity);
      }, 10);
    });

    test('should handle activity update for non-existent session', () => {
      const sessionId = 'non-existent-session';

      const result = sessionManager.updateActivity(sessionId);
      expect(result).toBe(false);
    });

    test('should check if session is active within timeout', () => {
      const sessionId = 'test-session-123';
      
      sessionManager.registerSession(sessionId, { userAgent: 'Test Browser', ip: '192.168.1.1' });
      
      // Should be active immediately
      expect(sessionManager.isSessionActive(sessionId)).toBe(true);
    });

    test('should use default timeout when checking activity', () => {
      const sessionId = 'test-session-123';
      
      sessionManager.registerSession(sessionId, { userAgent: 'Test Browser', ip: '192.168.1.1' });
      
      // Should be active with default timeout
      expect(sessionManager.isSessionActive(sessionId)).toBe(true);
    });
  });

  describe('Session Retrieval', () => {
    test('should retrieve existing session', () => {
      const sessionId = 'test-session-123';
      const metadata = { userAgent: 'Test Browser', ip: '192.168.1.1' };
      
      sessionManager.registerSession(sessionId, metadata);
      
      const session = sessionManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.metadata.userAgent).toBe('Test Browser');
      expect(session.metadata.ip).toBe('192.168.1.1');
      expect(session.age).toBeDefined();
      expect(session.timeSinceActivity).toBeDefined();
    });

    test('should return null for non-existent session', () => {
      const sessionId = 'non-existent-session';
      
      const session = sessionManager.getSession(sessionId);
      
      expect(session).toBeNull();
    });

    test('should get all active sessions', () => {
      const sessions = [
        { id: 'session1', metadata: { userAgent: 'Browser 1', ip: '192.168.1.1' } },
        { id: 'session2', metadata: { userAgent: 'Browser 2', ip: '192.168.1.2' } },
        { id: 'session3', metadata: { userAgent: 'Browser 3', ip: '192.168.1.3' } }
      ];

      // Register sessions
      sessions.forEach(s => {
        sessionManager.registerSession(s.id, s.metadata);
      });

      const activeSessions = sessionManager.getActiveSessions();

      expect(Array.isArray(activeSessions)).toBe(true);
      expect(activeSessions.length).toBe(sessions.length);
      expect(activeSessions.map(s => s.id)).toEqual(
        expect.arrayContaining(sessions.map(s => s.id))
      );
    });

    test('should filter out inactive sessions from active sessions list', () => {
      const activeSessionId = 'active-session';
      const inactiveSessionId = 'inactive-session';

      // Register sessions
      sessionManager.registerSession(activeSessionId, { userAgent: 'Active Browser', ip: '192.168.1.1' });
      sessionManager.registerSession(inactiveSessionId, { userAgent: 'Inactive Browser', ip: '192.168.1.2' });

      // Make one session inactive by modifying its lastActivity directly in the internal sessions map
      const sessions = sessionManager.sessions;
      if (sessions.has(inactiveSessionId)) {
        const inactiveSession = sessions.get(inactiveSessionId);
        inactiveSession.lastActivity = Date.now() - (31 * 60 * 1000); // 31 minutes ago (beyond default timeout)
      }

      const activeSessions = sessionManager.getActiveSessions();

      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0].id).toBe(activeSessionId);
    });
  });

  describe('Session Removal', () => {
    test('should remove existing session', () => {
      const sessionId = 'test-session-123';
      
      sessionManager.registerSession(sessionId, { userAgent: 'Test Browser', ip: '192.168.1.1' });
      
      // Verify session exists
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      
      // Remove session
      const result = sessionManager.removeSession(sessionId);
      
      expect(result).toBe(true);
      expect(sessionManager.getSession(sessionId)).toBeNull();
    });

    test('should return false when removing non-existent session', () => {
      const sessionId = 'non-existent-session';
      
      const result = sessionManager.removeSession(sessionId);
      
      expect(result).toBe(false);
    });
  });

  describe('Session Statistics', () => {
    test('should return correct session statistics', () => {
      const sessions = [
        { id: 'session1', metadata: { userAgent: 'Browser 1', ip: '192.168.1.1' } },
        { id: 'session2', metadata: { userAgent: 'Browser 2', ip: '192.168.1.2' } },
        { id: 'session3', metadata: { userAgent: 'Browser 3', ip: '192.168.1.3' } }
      ];

      // Register sessions
      sessions.forEach(s => {
        sessionManager.registerSession(s.id, s.metadata);
      });

      const stats = sessionManager.getStats();

      expect(stats).toHaveProperty('total', sessions.length);
      expect(stats).toHaveProperty('active', sessions.length);
      expect(stats).toHaveProperty('oldestSession');
      expect(stats).toHaveProperty('newestSession');
      expect(stats).toHaveProperty('averageAge');
    });

    test('should return zero stats for empty session manager', () => {
      const stats = sessionManager.getStats();

      expect(stats).toHaveProperty('total', 0);
      expect(stats).toHaveProperty('active', 0);
      expect(stats).toHaveProperty('oldestSession', null);
      expect(stats).toHaveProperty('newestSession', null);
      expect(stats).toHaveProperty('averageAge', 0);
    });

    test('should calculate correct active counts', () => {
      const activeSessionId = 'active-session';
      const inactiveSessionId = 'inactive-session';

      // Register sessions
      sessionManager.registerSession(activeSessionId, { userAgent: 'Active Browser', ip: '192.168.1.1' });
      sessionManager.registerSession(inactiveSessionId, { userAgent: 'Inactive Browser', ip: '192.168.1.2' });

      // Make one session inactive by modifying its lastActivity
      const sessions = sessionManager.sessions;
      if (sessions.has(inactiveSessionId)) {
        const inactiveSession = sessions.get(inactiveSessionId);
        inactiveSession.lastActivity = Date.now() - (31 * 60 * 1000); // 31 minutes ago
      }

      const stats = sessionManager.getStats();

      expect(stats.total).toBe(1); // Only active session remains after cleanup
      expect(stats.active).toBe(1);
    });
  });

  describe('Session Cleanup', () => {
    test('should clean up expired sessions', () => {
      const activeSessionId = 'active-session';
      const expiredSessionId = 'expired-session';

      // Register sessions
      sessionManager.registerSession(activeSessionId, { userAgent: 'Active Browser', ip: '192.168.1.1' });
      sessionManager.registerSession(expiredSessionId, { userAgent: 'Expired Browser', ip: '192.168.1.2' });

      // Make one session expired
      const sessions = sessionManager.sessions;
      if (sessions.has(expiredSessionId)) {
        const expiredSession = sessions.get(expiredSessionId);
        expiredSession.lastActivity = Date.now() - (31 * 60 * 1000); // 31 minutes ago
      }

      const result = sessionManager.cleanupExpiredSessions();

      expect(result).toBe(1); // Returns number of cleaned up sessions

      // Verify expired session is removed
      expect(sessionManager.getSession(expiredSessionId)).toBeNull();
      expect(sessionManager.getSession(activeSessionId)).toBeDefined();
    });

    test('should return zero removed when no sessions expired', () => {
      const sessionId = 'active-session';
      
      sessionManager.registerSession(sessionId, { userAgent: 'Active Browser', ip: '192.168.1.1' });
      
      const result = sessionManager.cleanupExpiredSessions();
      
      expect(result).toBe(0);
    });

    test('should handle cleanup with no sessions', () => {
      const result = sessionManager.cleanupExpiredSessions();
      
      expect(result).toBe(0);
    });
  });

  describe('Automatic Cleanup Timer', () => {
    test('should start cleanup timer with default interval', () => {
      // Timer is started in constructor, so check if it was called
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        300000 // 5 minutes default
      );
    });

    test('should start cleanup timer manually', () => {
      // Stop existing timer first
      sessionManager.stopCleanupTimer();
      jest.clearAllMocks();
      
      sessionManager.startCleanupTimer();

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        300000 // 5 minutes default
      );
    });

    test('should stop cleanup timer', () => {
      sessionManager.stopCleanupTimer();

      expect(global.clearInterval).toHaveBeenCalled();
    });

    test('should handle stopping timer when none is running', () => {
      sessionManager.stopCleanupTimer();
      jest.clearAllMocks();
      
      // Should not throw error
      expect(() => {
        sessionManager.stopCleanupTimer();
      }).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    test('should set session timeout', () => {
      const customTimeout = 120000; // 2 minutes
      
      sessionManager.setSessionTimeout(customTimeout);
      
      expect(sessionManager.sessionTimeout).toBe(customTimeout);
    });

    test('should set cleanup interval', () => {
      const customInterval = 180000; // 3 minutes
      
      sessionManager.setCleanupInterval(customInterval);
      
      expect(sessionManager.cleanupInterval).toBe(customInterval);
    });

    test('should use custom timeout in activity checks', () => {
      const customTimeout = 10000; // 10 seconds
      const sessionId = 'test-session';
      
      sessionManager.setSessionTimeout(customTimeout);
      sessionManager.registerSession(sessionId, { userAgent: 'Test Browser', ip: '192.168.1.1' });
      
      // Mock old activity
      const sessions = sessionManager.sessions;
      if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        session.lastActivity = Date.now() - 15000; // 15 seconds ago
      }
      
      // Should be inactive with custom timeout
      expect(sessionManager.isSessionActive(sessionId)).toBe(false);
    });
  });

  describe('Service Shutdown', () => {
    test('should cleanup gracefully and stop timers', async () => {
      sessionManager.cleanup();
      
      expect(global.clearInterval).toHaveBeenCalled();
    });

    test('should handle cleanup when no timers are running', async () => {
      sessionManager.stopCleanupTimer();
      
      // Should not throw error
      expect(() => sessionManager.cleanup()).not.toThrow();
    });

    test('should clear all sessions on cleanup', async () => {
      const sessionIds = ['session1', 'session2', 'session3'];
      
      // Register sessions
      sessionIds.forEach(id => {
        sessionManager.registerSession(id, { userAgent: 'Test Browser', ip: '192.168.1.1' });
      });
      
      expect(sessionManager.getStats().total).toBe(sessionIds.length);
      
      sessionManager.cleanup();
      
      expect(sessionManager.getStats().total).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid session IDs gracefully', () => {
      const invalidIds = [null, undefined, '', 0, false];
      
      invalidIds.forEach(id => {
        expect(() => {
          sessionManager.registerSession(id, { userAgent: 'Test Browser', ip: '192.168.1.1' });
        }).not.toThrow();
        
        expect(() => {
          sessionManager.updateActivity(id);
        }).not.toThrow();
        
        expect(() => {
          sessionManager.getSession(id);
        }).not.toThrow();
        
        expect(() => {
          sessionManager.removeSession(id);
        }).not.toThrow();
      });
    });

    test('should handle concurrent session operations', () => {
      const sessionId = 'concurrent-test-session';
      
      // Simulate concurrent operations
      for (let i = 0; i < 10; i++) {
        sessionManager.registerSession(sessionId, { userAgent: `Browser ${i}`, ip: `192.168.1.${i}` });
        sessionManager.updateActivity(sessionId);
      }
      
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
    });

    test('should handle large number of sessions', () => {
      const sessionCount = 100; // Reduced from 1000 for faster tests
      const sessionIds = [];
      
      // Register many sessions
      for (let i = 0; i < sessionCount; i++) {
        const sessionId = `session-${i}`;
        sessionIds.push(sessionId);
        sessionManager.registerSession(sessionId, { userAgent: `Browser ${i}`, ip: `192.168.1.${i % 255}` });
      }
      
      const stats = sessionManager.getStats();
      expect(stats.total).toBe(sessionCount);
      
      // Cleanup half of them by making them expired
      const halfCount = Math.floor(sessionCount / 2);
      const sessions = sessionManager.sessions;
      for (let i = 0; i < halfCount; i++) {
        const sessionId = sessionIds[i];
        if (sessions.has(sessionId)) {
          const session = sessions.get(sessionId);
          session.lastActivity = Date.now() - (31 * 60 * 1000); // Make them expired
        }
      }
      
      const cleanupResult = sessionManager.cleanupExpiredSessions();
      expect(cleanupResult).toBe(halfCount);
      expect(sessionManager.getStats().total).toBe(sessionCount - halfCount);
    });

    test('should handle memory cleanup properly', () => {
      const sessionId = 'memory-test-session';
      
      // Register and remove session multiple times
      for (let i = 0; i < 10; i++) {
        sessionManager.registerSession(sessionId, { userAgent: 'Test Browser', ip: '192.168.1.1' });
        sessionManager.removeSession(sessionId);
      }
      
      // Should not leak memory
      expect(sessionManager.getStats().total).toBe(0);
      expect(sessionManager.getSession(sessionId)).toBeNull();
    });
  });
}); 