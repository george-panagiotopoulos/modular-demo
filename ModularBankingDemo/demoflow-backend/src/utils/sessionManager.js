/**
 * Session Manager
 * Manages client sessions and their event stream connections
 */

const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor(sessionTimeout = 30 * 60 * 1000, cleanupInterval = 5 * 60 * 1000) {
    this.sessions = new Map();
    this.sessionTimeout = sessionTimeout; // 30 minutes default
    this.cleanupIntervalTime = cleanupInterval; // 5 minutes default
    this.cleanupInterval = null; // Will store the interval reference
    this.startCleanupTimer();
  }

  // Create a new session
  createSession(sessionId = null) {
    const id = sessionId || uuidv4();
    
    if (this.sessions.has(id)) {
      throw new Error(`Session ${id} already exists`);
    }

    const session = {
      id,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      connections: new Map(),
      metadata: {},
      status: 'active'
    };

    this.sessions.set(id, session);
    console.log(`Session created: ${id}`);
    return session;
  }

  // Get session by ID
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  // Get or create session
  getOrCreateSession(sessionId) {
    let session = this.getSession(sessionId);
    if (!session) {
      session = this.createSession(sessionId);
    }
    this.updateSessionActivity(sessionId);
    return session;
  }

  // Update session last activity
  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date().toISOString();
    }
  }

  // Add connection to session
  addConnection(sessionId, component, connection) {
    const session = this.getOrCreateSession(sessionId);
    session.connections.set(component, {
      component,
      connection,
      connectedAt: new Date().toISOString(),
      status: 'connected'
    });
    this.updateSessionActivity(sessionId);
    console.log(`Connection added to session ${sessionId}: ${component}`);
  }

  // Remove connection from session
  removeConnection(sessionId, component) {
    const session = this.getSession(sessionId);
    if (session && session.connections.has(component)) {
      const connectionInfo = session.connections.get(component);
      session.connections.delete(component);
      this.updateSessionActivity(sessionId);
      console.log(`Connection removed from session ${sessionId}: ${component}`);
      return connectionInfo;
    }
    return null;
  }

  // Get connection from session
  getConnection(sessionId, component) {
    const session = this.getSession(sessionId);
    if (session) {
      return session.connections.get(component) || null;
    }
    return null;
  }

  // Get all connections for a session
  getSessionConnections(sessionId) {
    const session = this.getSession(sessionId);
    if (session) {
      return Array.from(session.connections.values());
    }
    return [];
  }

  // Check if session has active connections
  hasActiveConnections(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.connections.size > 0 : false;
  }

  // Clean up session and all its connections
  cleanupSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    let connectionsTerminated = 0;

    // Disconnect all connections
    session.connections.forEach((connectionInfo, component) => {
      try {
        if (connectionInfo.connection && typeof connectionInfo.connection.disconnect === 'function') {
          connectionInfo.connection.disconnect();
          connectionsTerminated++;
        }
      } catch (error) {
        console.error(`Error disconnecting ${component} for session ${sessionId}:`, error);
      }
    });

    // Remove session
    this.sessions.delete(sessionId);
    console.log(`Session cleaned up: ${sessionId} (${connectionsTerminated} connections terminated)`);
    
    return {
      sessionId,
      connectionsTerminated,
      cleanedAt: new Date().toISOString()
    };
  }

  // Get session status
  getSessionStatus(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const connections = Array.from(session.connections.keys());
    const activeConnections = connections.filter(component => {
      const conn = session.connections.get(component);
      return conn && conn.connection && conn.connection.isActive && conn.connection.isActive();
    });

    return {
      sessionId: session.id,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      totalConnections: connections.length,
      activeConnections,
      metadata: session.metadata
    };
  }

  // Set session metadata
  setSessionMetadata(sessionId, key, value) {
    const session = this.getOrCreateSession(sessionId);
    session.metadata[key] = value;
    this.updateSessionActivity(sessionId);
  }

  // Get session metadata
  getSessionMetadata(sessionId, key) {
    const session = this.getSession(sessionId);
    return session ? session.metadata[key] : null;
  }

  // Check if session is expired
  isSessionExpired(session) {
    const lastActivity = new Date(session.lastActivity).getTime();
    const now = Date.now();
    return (now - lastActivity) > this.sessionTimeout;
  }

  // Start automatic cleanup timer
  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.cleanupIntervalTime);
  }

  // Perform cleanup of expired sessions
  performCleanup() {
    const expiredSessions = [];
    
    this.sessions.forEach((session, sessionId) => {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach(sessionId => {
      console.log(`Cleaning up expired session: ${sessionId}`);
      this.cleanupSession(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(`Cleanup completed: ${expiredSessions.length} expired sessions removed`);
    }
  }

  // Get all active sessions
  getActiveSessions() {
    const activeSessions = [];
    this.sessions.forEach((session, sessionId) => {
      if (!this.isSessionExpired(session)) {
        activeSessions.push(this.getSessionStatus(sessionId));
      }
    });
    return activeSessions;
  }

  /**
   * Shutdown the session manager and cleanup all resources
   */
  shutdown() {
    // Clear the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Cleanup all active sessions
    for (const sessionId of this.sessions.keys()) {
      this.cleanupSession(sessionId);
    }

    console.log('SessionManager shutdown complete');
  }

  /**
   * Get statistics about active sessions
   * @returns {Object} Session statistics
   */
  getStats() {
    const stats = {
      activeSessions: this.sessions.size,
      totalConnections: 0,
      sessionDetails: []
    };

    for (const [sessionId, session] of this.sessions) {
      const connections = session.connections ? session.connections.size : 0;
      stats.totalConnections += connections;
      stats.sessionDetails.push({
        sessionId,
        connections,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      });
    }

    return stats;
  }
}

// Singleton instance
let sessionManagerInstance = null;

function getSessionManager() {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  if (sessionManagerInstance) {
    sessionManagerInstance.shutdown();
  }
});

process.on('SIGINT', () => {
  if (sessionManagerInstance) {
    sessionManagerInstance.shutdown();
  }
});

module.exports = {
  SessionManager,
  getSessionManager
}; 