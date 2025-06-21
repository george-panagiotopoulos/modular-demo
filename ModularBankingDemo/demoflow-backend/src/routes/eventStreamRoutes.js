/**
 * Event Stream API Routes
 * Handles all /api/event-stream/* endpoints
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getEventHubService } = require('../services/eventHubService');
const { getSessionManager } = require('../services/sessionManager');

const router = express.Router();

// Available banking components
const COMPONENTS = [
  {
    key: 'party',
    name: 'Party/Customer Management',
    description: 'Customer and party management services - handles customer creation, updates, and party relationships',
    domain: 'Party',
    version: 'R24',
    config: {
      kafkaTopic: 'ms-party-outbox',
      defaultPort: 8081
    },
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    key: 'deposits',
    name: 'Deposits/Accounts Module',
    description: 'Account management and deposit services - handles account operations and transactions',
    domain: 'Deposits',
    version: 'R25',
    config: {
      kafkaTopic: 'deposits-event-topic',
      defaultPort: 8082
    },
    createdAt: '2024-01-15T11:00:00Z'
  },
  {
    key: 'lending',
    name: 'Lending Module',
    description: 'Loan and credit management services - handles loan lifecycle and payments',
    domain: 'Lending',
    version: 'R24',
    config: {
      kafkaTopic: 'lending-event-topic',
      defaultPort: 8083
    },
    createdAt: '2024-01-15T11:30:00Z'
  },
  {
    key: 'eventstore',
    name: 'Event Store',
    description: 'Central event storage and replay service - manages event persistence and replay capabilities',
    domain: 'EventStore',
    version: 'R25',
    config: {
      kafkaTopic: 'ms-eventstore-inbox-topic',
      defaultPort: 8084
    },
    createdAt: '2024-01-15T12:00:00Z'
  },
  {
    key: 'adapter',
    name: 'Adapter Service',
    description: 'External system integration and data transformation - handles external API calls and data mapping',
    domain: 'Integration',
    version: 'R24',
    config: {
      kafkaTopic: 'ms-adapterservice-event-topic',
      defaultPort: 8085
    },
    createdAt: '2024-01-15T12:30:00Z'
  },
  {
    key: 'holdings',
    name: 'Holdings Module',
    description: 'Investment and portfolio management services - handles positions, trades, and portfolio management',
    domain: 'Holdings',
    version: 'R25',
    config: {
      kafkaTopic: 'ms-holdings-event-topic',
      defaultPort: 8086
    },
    createdAt: '2024-01-15T13:00:00Z'
  }
];

// Get EventHub service and SessionManager
const eventHubService = getEventHubService();
const sessionManager = getSessionManager();

// Middleware for logging requests
router.use((req, res, next) => {
  console.log(`[EventStreamRoutes] ${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    headers: {
      'x-session-id': req.headers['x-session-id'],
      'content-type': req.headers['content-type']
    }
  });
  next();
});

// Middleware for request validation
const validateSessionId = (req, res, next) => {
  const sessionId = req.body?.sessionId || req.query?.sessionId || req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.status(400).json({
      error: 'sessionId is required',
      code: 'MISSING_SESSION_ID',
      timestamp: new Date().toISOString()
    });
  }
  
  // Attach sessionId to request for easy access
  req.sessionId = sessionId;
  next();
};

// GET /api/event-stream/components
router.get('/components', (req, res) => {
  res.json({
    success: true,
    data: COMPONENTS
  });
});

// POST /api/event-stream/connect/:component
router.post('/connect/:component', async (req, res) => {
  const { component } = req.params;
  const sessionId = req.headers['x-session-id'];

  // Require session ID
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Session ID required'
    });
  }

  try {
    // Validate component
    const componentData = COMPONENTS.find(c => c.key === component);
    if (!componentData) {
      return res.status(400).json({
        success: false,
        error: `Unknown component: ${component}`
      });
    }

    // Register session
    sessionManager.registerSession(sessionId);

    // Connect to real Event Hub
    const result = await eventHubService.connectToComponent(
      sessionId, 
      component, 
      (eventData) => {
        // This callback will be used by SSE endpoint
        // Events are handled through the SSE stream
      }
    );

    res.json({
      success: true,
      message: `Connected to ${componentData.name}`,
      sessionId,
      topic: result.topic,
      groupId: result.groupId
    });

  } catch (error) {
    console.error('Connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/event-stream/disconnect/:component
router.post('/disconnect/:component', async (req, res) => {
  const { component } = req.params;
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Session ID required'
    });
  }

  try {
    await eventHubService.disconnectFromComponent(sessionId, component);

    res.json({
      success: true,
      message: `Disconnected from ${component}`
    });

  } catch (error) {
    console.error('Disconnection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/event-stream/events/:component (SSE)
router.get('/events/:component', async (req, res) => {
  const { component } = req.params;
  const sessionId = req.headers['x-session-id'] || req.query.session_id;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Session ID required'
    });
  }

  // Validate component
  const componentData = COMPONENTS.find(c => c.key === component);
  if (!componentData) {
    return res.status(400).json({
      success: false,
      error: `Unknown component: ${component}`
    });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, x-session-id'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'info',
    message: `Connecting to ${componentData.name}...`,
    timestamp: new Date().toISOString()
  })}\n\n`);

  try {
    // Register session
    sessionManager.registerSession(sessionId);

    // Set up event callback for real-time streaming
    const eventCallback = (eventData) => {
      try {
        if (!res.destroyed && !res.finished) {
          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        }
      } catch (error) {
        console.error('Error writing SSE data:', error);
      }
    };

    // Connect to Event Hub with callback
    const connectionResult = await eventHubService.connectToComponent(
      sessionId, 
      component, 
      eventCallback
    );

    // Send connection success message
    res.write(`data: ${JSON.stringify({
      type: 'info',
      message: `Connected to ${componentData.name} (${connectionResult.topic})`,
      timestamp: new Date().toISOString()
    })}\n\n`);

    console.log(`SSE connection established for ${component} (session: ${sessionId})`);

  } catch (error) {
    console.error(`SSE connection error for ${component}:`, error);
    
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: `Failed to connect to ${component}: ${error.message}`,
      timestamp: new Date().toISOString()
    })}\n\n`);
  }

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    try {
      if (!res.destroyed && !res.finished) {
        res.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        })}\n\n`);
      } else {
        clearInterval(heartbeat);
      }
    } catch (error) {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Clean up on client disconnect
  req.on('close', async () => {
    clearInterval(heartbeat);
    console.log(`SSE connection closed for ${component} (session: ${sessionId})`);
    
    try {
      // Disconnect from Event Hub
      await eventHubService.disconnectFromComponent(sessionId, component);
    } catch (error) {
      console.error(`Error cleaning up SSE connection for ${component}:`, error);
    }
  });

  req.on('error', (error) => {
    clearInterval(heartbeat);
    console.error(`SSE connection error for ${component}:`, error);
  });
});

// GET /api/event-stream/stats
router.get('/stats', (req, res) => {
  const eventHubStats = eventHubService.getStats();
  const sessionStats = sessionManager.getStats();

  res.json({
    success: true,
    data: {
      ...eventHubStats,
      sessions: {
        ...eventHubStats.sessions,
        total: sessionStats.total,
        active: sessionStats.active
      }
    }
  });
});

// GET /api/event-stream/session/:id/status
router.get('/session/:id/status', (req, res) => {
  const { id } = req.params;
  
  const sessionStatus = eventHubService.getSessionStatus(id);
  const isActive = sessionManager.isSessionActive(id);

  res.json({
    success: true,
    data: {
      sessionId: id,
      active: isActive,
      ...sessionStatus
    }
  });
});

// POST /api/event-stream/session/:id/cleanup
router.post('/session/:id/cleanup', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await eventHubService.cleanupSession(id);
    sessionManager.removeSession(id);

    res.json({
      success: true,
      message: 'Session cleanup completed',
      data: result
    });

  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware specific to event stream routes
router.use((error, req, res, next) => {
  console.error('[EventStreamRoutes] Error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  const status = error.status || error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    code: error.code || 'EVENT_STREAM_ERROR',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

module.exports = router; 