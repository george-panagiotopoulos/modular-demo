/**
 * DemoFlow Backend Server
 * Express.js server for banking API and event stream functionality with real Azure Event Hub integration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Load environment variables from the main .env file
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Import routes and services
const eventStreamRoutes = require('./routes/eventStreamRoutes');
const bankingRoutes = require('./routes/banking');
const joltRoutes = require('./routes/joltRoutes');

let headlessRoutes;
try {
  headlessRoutes = require('./routes/headless');
  console.log('✅ Headless routes imported successfully');
} catch (error) {
  console.error('❌ Error importing headless routes:', error.message);
  console.error('   Stack trace:', error.stack);
}

const { getEventHubService } = require('./services/eventHubService');
const { getSessionManager } = require('./services/sessionManager');

const app = express();
const PORT = process.env.PORT || 5011;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for SSE
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for frontend
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3011', 'http://127.0.0.1:3011'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-session-id', 
    'x-client-type',
    'x-endpoint',
    'x-solution',
    'Accept'
  ]
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  const eventHubService = getEventHubService();
  const sessionManager = getSessionManager();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      eventHub: eventHubService ? 'active' : 'inactive',
      sessionManager: sessionManager ? 'active' : 'inactive',
      banking: 'active'
    }
  });
});

// API routes
app.use('/api/event-stream', eventStreamRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/jolt', joltRoutes);

if (headlessRoutes) {
  app.use('/api/headless', headlessRoutes);
  console.log('✅ Headless routes registered at /api/headless');
} else {
  console.log('⚠️  Headless routes not available - skipping registration');
}

// Legacy route mapping for MobileApp compatibility
// Map the old endpoints to new banking endpoints
app.get('/api/parties/:partyId/accounts', (req, res) => {
  console.log(`[Legacy API] Redirecting /api/parties/${req.params.partyId}/accounts to banking API`);
  req.url = `/api/banking/parties/${req.params.partyId}/accounts`;
  app.handle(req, res);
});

app.get('/api/parties/:partyId/loans', (req, res) => {
  console.log(`[Legacy API] Redirecting /api/parties/${req.params.partyId}/loans to banking API`);
  req.url = `/api/banking/parties/${req.params.partyId}/loans`;
  app.handle(req, res);
});

// Root endpoint
app.get('/', (req, res) => {
  const endpoints = {
    health: '/health',
    banking: '/api/banking',
    eventStreamComponents: '/api/event-stream/components',
    eventStreamConnect: '/api/event-stream/connect/:component',
    eventStreamDisconnect: '/api/event-stream/disconnect/:component',
    eventStreamEvents: '/api/event-stream/events/:component',
    eventStreamStats: '/api/event-stream/stats',
    sessionStatus: '/api/event-stream/session/:id/status',
    sessionCleanup: '/api/event-stream/session/:id/cleanup'
  };
  
  // Add headless endpoints if available
  if (headlessRoutes) {
    endpoints.headlessTrack = '/api/headless/track';
    endpoints.headlessEndpoints = '/api/headless/endpoints';
    endpoints.headlessStatus = '/api/headless/status';
  }
  
  res.json({
    message: 'Modular Banking Demo - Backend Server',
    version: '1.0.0',
    endpoints: endpoints
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /health',
      'GET /api/banking/parties/:partyId/accounts',
      'GET /api/banking/parties/:partyId/loans',
      'GET /api/event-stream/components',
      'GET /api/event-stream/stats',
      'POST /api/event-stream/connect/:component',
      'POST /api/event-stream/disconnect/:component',
      'GET /api/event-stream/events/:component'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Cleanup EventHub connections
    const eventHubService = getEventHubService();
    if (eventHubService) {
      await eventHubService.shutdown();
    }
    
    // Cleanup sessions
    const sessionManager = getSessionManager();
    if (sessionManager) {
      sessionManager.cleanup();
    }
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export app for testing
module.exports = app;

// Start server only if this file is run directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Modular Banking Demo Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: ${process.env.BACKEND_BASE_URL ? process.env.BACKEND_BASE_URL + '/health' : `http://localhost:${PORT}/health`}`);
    console.log(`🏦 Banking API: ${process.env.BACKEND_BASE_URL ? process.env.BACKEND_BASE_URL + '/api/banking/' : `http://localhost:${PORT}/api/banking/`}`);
    console.log(`🔗 Event Stream API: ${process.env.BACKEND_BASE_URL ? process.env.BACKEND_BASE_URL + '/api/event-stream/' : `http://localhost:${PORT}/api/event-stream/`}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize services
    const eventHubService = getEventHubService();
    const sessionManager = getSessionManager();
    
    console.log('✅ Services initialized:');
    console.log(`   - EventHub Service: ${eventHubService && eventHubService.isReady() ? 'Ready' : 'Not Ready'}`);
    console.log(`   - Session Manager: ${sessionManager ? 'Ready' : 'Failed'}`);
    
    if (eventHubService && !eventHubService.isReady()) {
      console.log('⚠️  EventHub service is not ready. Event streaming may not work.');
      console.log('   This could be due to network connectivity issues or missing configuration.');
    }
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });
} 