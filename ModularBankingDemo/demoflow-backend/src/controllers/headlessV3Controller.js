/**
 * Headless V3 Controller
 * Handles API endpoints for headless_v3 tab functionality
 */

const Component = require('../models/Component');
const EventStream = require('../models/EventStream');
const { getSessionManager } = require('../services/sessionManager');
const { getEventService } = require('../services/eventService');

class HeadlessV3Controller {
  constructor() {
    this.sessionManager = getSessionManager();
    this.eventService = getEventService();
    
    // Start event service when controller is created
    this.eventService.start();
  }

  // GET /api/headless-v3/components
  async getComponents(req, res) {
    try {
      const components = Component.getAllComponents();
      
      res.status(200).json({
        success: true,
        components: components.map(component => component.toJSON()),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting components:', error);
      res.status(500).json({
        error: 'Failed to retrieve components',
        code: 'COMPONENTS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // POST /api/headless-v3/connect/:component
  async connectToComponent(req, res) {
    try {
      const { component } = req.params;
      const { sessionId } = req.body;

      // Validate inputs
      if (!sessionId) {
        return res.status(400).json({
          error: 'sessionId is required in request body',
          code: 'MISSING_SESSION_ID',
          timestamp: new Date().toISOString()
        });
      }

      if (!Component.isValidComponent(component)) {
        return res.status(400).json({
          error: `Invalid component: ${component}`,
          code: 'INVALID_COMPONENT',
          timestamp: new Date().toISOString()
        });
      }

      // Check if already connected
      const existingConnection = this.sessionManager.getConnection(sessionId, component);
      if (existingConnection && existingConnection.connection.isActive()) {
        return res.status(409).json({
          error: `Already connected to component: ${component}`,
          code: 'ALREADY_CONNECTED',
          timestamp: new Date().toISOString()
        });
      }

      // Create new event stream
      const eventStream = new EventStream(component, sessionId, {
        autoReconnect: true,
        eventBufferSize: 1000,
        heartbeatInterval: 30000
      });

      // Connect the stream
      eventStream.connect();

      // Add to session manager
      this.sessionManager.addConnection(sessionId, component, eventStream);

      res.status(200).json({
        success: true,
        status: 'connected',
        sessionId,
        component,
        streamId: eventStream.id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error connecting to component:', error);
      res.status(500).json({
        error: 'Failed to connect to component',
        code: 'CONNECTION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // POST /api/headless-v3/disconnect/:component
  async disconnectFromComponent(req, res) {
    try {
      const { component } = req.params;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'sessionId is required in request body',
          code: 'MISSING_SESSION_ID',
          timestamp: new Date().toISOString()
        });
      }

      const connectionInfo = this.sessionManager.removeConnection(sessionId, component);
      
      if (connectionInfo) {
        // Disconnect the stream
        if (connectionInfo.connection && typeof connectionInfo.connection.disconnect === 'function') {
          connectionInfo.connection.disconnect();
        }

        res.status(200).json({
          success: true,
          status: 'disconnected',
          component,
          sessionId,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(200).json({
          success: true,
          status: 'not-connected',
          component,
          sessionId,
          message: 'Component was not connected',
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Error disconnecting from component:', error);
      res.status(500).json({
        error: 'Failed to disconnect from component',
        code: 'DISCONNECTION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // POST /api/headless-v3/create-demo-data
  async createDemoData(req, res) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'sessionId is required in request body',
          code: 'MISSING_SESSION_ID',
          timestamp: new Date().toISOString()
        });
      }

      // Create demo data and trigger events
      const result = this.eventService.createDemoDataEvents(sessionId);

      res.status(201).json({
        success: true,
        created: result.demoData,
        eventsTriggered: result.eventsTriggered,
        affectedComponents: result.affectedComponents,
        sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error creating demo data:', error);
      res.status(500).json({
        error: 'Failed to create demo data',
        code: 'DEMO_DATA_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // GET /api/headless-v3/events/:component (Server-Sent Events)
  async streamEvents(req, res) {
    try {
      const { component } = req.params;
      const sessionId = req.query.sessionId || req.headers['x-session-id'];

      // Validate component
      if (!Component.isValidComponent(component)) {
        return res.status(400).json({
          error: `Invalid component: ${component}`,
          code: 'INVALID_COMPONENT',
          timestamp: new Date().toISOString()
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          error: 'sessionId is required as query parameter or X-Session-ID header',
          code: 'MISSING_SESSION_ID',
          timestamp: new Date().toISOString()
        });
      }

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Get or create connection
      let connectionInfo = this.sessionManager.getConnection(sessionId, component);
      if (!connectionInfo) {
        // Auto-create connection if it doesn't exist
        const eventStream = new EventStream(component, sessionId);
        eventStream.connect();
        this.sessionManager.addConnection(sessionId, component, eventStream);
        connectionInfo = this.sessionManager.getConnection(sessionId, component);
      }

      const eventStream = connectionInfo.connection;

      // Send initial connection confirmation
      res.write(`data: ${JSON.stringify({
        type: 'connection.established',
        component,
        sessionId,
        streamId: eventStream.id,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Add event listener for this SSE connection
      const eventListener = (event) => {
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (writeError) {
          console.error('Error writing SSE event:', writeError);
        }
      };

      eventStream.addListener(eventListener);

      // Send buffered events
      const bufferedEvents = eventStream.getRecentEvents(10);
      bufferedEvents.forEach(event => {
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (writeError) {
          console.error('Error writing buffered event:', writeError);
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        console.log(`SSE client disconnected for ${component} (Session: ${sessionId})`);
        eventStream.removeListener(eventListener);
      });

      // Keep connection alive with periodic heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            component,
            timestamp: new Date().toISOString()
          })}\n\n`);
        } catch (heartbeatError) {
          console.error('Error sending heartbeat:', heartbeatError);
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Clean up heartbeat on close
      req.on('close', () => {
        clearInterval(heartbeatInterval);
      });

    } catch (error) {
      console.error('Error setting up event stream:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to establish event stream',
          code: 'STREAM_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // GET /api/headless-v3/session/:sessionId/status
  async getSessionStatus(req, res) {
    try {
      const { sessionId } = req.params;
      
      const sessionStatus = this.sessionManager.getSessionStatus(sessionId);
      
      if (!sessionStatus) {
        return res.status(404).json({
          error: `Session not found: ${sessionId}`,
          code: 'SESSION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        success: true,
        ...sessionStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting session status:', error);
      res.status(500).json({
        error: 'Failed to get session status',
        code: 'SESSION_STATUS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // POST /api/headless-v3/session/:sessionId/cleanup
  async cleanupSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      const result = this.sessionManager.cleanupSession(sessionId);
      
      if (!result) {
        return res.status(404).json({
          error: `Session not found: ${sessionId}`,
          code: 'SESSION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        success: true,
        cleaned: true,
        connectionsTerminated: result.connectionsTerminated,
        cleanedAt: result.cleanedAt,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error cleaning up session:', error);
      res.status(500).json({
        error: 'Failed to cleanup session',
        code: 'CLEANUP_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // GET /api/headless-v3/stats
  async getStats(req, res) {
    try {
      const sessionStats = this.sessionManager.getStats();
      const eventStats = this.eventService.getStats();

      res.status(200).json({
        success: true,
        stats: {
          sessions: sessionStats,
          events: eventStats,
          components: {
            total: Component.getAllComponents().length,
            available: Component.getAllComponents().map(c => c.key)
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        error: 'Failed to get statistics',
        code: 'STATS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Create singleton instance
const headlessV3ControllerInstance = new HeadlessV3Controller();

module.exports = headlessV3ControllerInstance; 