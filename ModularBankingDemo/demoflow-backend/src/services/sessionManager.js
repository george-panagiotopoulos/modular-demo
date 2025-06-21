/**
 * Session Manager Service
 * Handles session lifecycle, tracking, and cleanup
 */

class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> { createdAt, lastActivity, metadata }
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes cleanup interval
    
    // Start periodic cleanup
    this.startCleanupTimer();
    
    console.log('SessionManager initialized');
  }

  /**
   * Register a new session
   */
  registerSession(sessionId, metadata = {}) {
    const now = Date.now();
    
    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: now,
      lastActivity: now,
      metadata: {
        userAgent: metadata.userAgent || 'unknown',
        ip: metadata.ip || 'unknown',
        ...metadata
      }
    });

    console.log(`Session registered: ${sessionId}`);
    return sessionId;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Check if a session is active (exists and not expired)
   */
  isSessionActive(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const now = Date.now();
    const isExpired = (now - session.lastActivity) > this.sessionTimeout;
    
    if (isExpired) {
      this.removeSession(sessionId);
      return false;
    }

    return true;
  }

  /**
   * Get session information
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if expired
    if (!this.isSessionActive(sessionId)) {
      return null;
    }

    return {
      ...session,
      age: Date.now() - session.createdAt,
      timeSinceActivity: Date.now() - session.lastActivity
    };
  }

  /**
   * Remove a session
   */
  removeSession(sessionId) {
    const removed = this.sessions.delete(sessionId);
    if (removed) {
      console.log(`Session removed: ${sessionId}`);
    }
    return removed;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const now = Date.now();
    const activeSessions = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const isExpired = (now - session.lastActivity) > this.sessionTimeout;
      
      if (!isExpired) {
        activeSessions.push({
          ...session,
          age: now - session.createdAt,
          timeSinceActivity: now - session.lastActivity
        });
      } else {
        // Remove expired session
        this.sessions.delete(sessionId);
      }
    }

    return activeSessions;
  }

  /**
   * Get session statistics
   */
  getStats() {
    const activeSessions = this.getActiveSessions();
    const now = Date.now();

    const stats = {
      total: this.sessions.size,
      active: activeSessions.length,
      averageAge: 0,
      oldestSession: null,
      newestSession: null
    };

    if (activeSessions.length > 0) {
      // Calculate average age
      const totalAge = activeSessions.reduce((sum, session) => sum + session.age, 0);
      stats.averageAge = Math.round(totalAge / activeSessions.length);

      // Find oldest and newest
      stats.oldestSession = activeSessions.reduce((oldest, session) => 
        session.createdAt < oldest.createdAt ? session : oldest
      );
      
      stats.newestSession = activeSessions.reduce((newest, session) => 
        session.createdAt > newest.createdAt ? session : newest
      );
    }

    return stats;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedUp = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const isExpired = (now - session.lastActivity) > this.sessionTimeout;
      
      if (isExpired) {
        this.sessions.delete(sessionId);
        cleanedUp++;
        console.log(`Expired session cleaned up: ${sessionId}`);
      }
    }

    if (cleanedUp > 0) {
      console.log(`Session cleanup completed: ${cleanedUp} sessions removed`);
    }

    return cleanedUp;
  }

  /**
   * Start the periodic cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);

    console.log(`Session cleanup timer started (interval: ${this.cleanupInterval / 1000}s)`);
  }

  /**
   * Stop the cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('Session cleanup timer stopped');
    }
  }

  /**
   * Cleanup all sessions and stop timers
   */
  cleanup() {
    this.stopCleanupTimer();
    const sessionCount = this.sessions.size;
    this.sessions.clear();
    console.log(`SessionManager cleanup: ${sessionCount} sessions cleared`);
  }

  /**
   * Set session timeout (in milliseconds)
   */
  setSessionTimeout(timeout) {
    this.sessionTimeout = timeout;
    console.log(`Session timeout updated: ${timeout / 1000}s`);
  }

  /**
   * Set cleanup interval (in milliseconds)
   */
  setCleanupInterval(interval) {
    this.cleanupInterval = interval;
    
    // Restart timer with new interval
    this.stopCleanupTimer();
    this.startCleanupTimer();
    
    console.log(`Cleanup interval updated: ${interval / 1000}s`);
  }
}

// Export singleton instance
let sessionManagerInstance = null;

function getSessionManager() {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

module.exports = {
  SessionManager,
  getSessionManager
}; 