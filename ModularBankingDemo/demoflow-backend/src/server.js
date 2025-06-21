/**
 * DemoFlow Backend Server
 * Express.js server for headless_v3 functionality with real Azure Event Hub integration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import routes and services
const headlessV3Routes = require('./routes/headlessV3Routes');
const { getEventHubService } = require('./services/eventHubService');
const { getSessionManager } = require('./services/sessionManager');

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for SSE
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3011', 'http://127.0.0.1:3011'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
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
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      eventHub: eventHubService ? 'active' : 'inactive',
      sessionManager: sessionManager ? 'active' : 'inactive'
    }
  });
});

// API routes
app.use('/api/headless-v3', headlessV3Routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'DemoFlow Backend Server - HeadlessV3 with Azure Event Hub',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      components: '/api/headless-v3/components',
      connect: '/api/headless-v3/connect/:component',
      disconnect: '/api/headless-v3/disconnect/:component',
      events: '/api/headless-v3/events/:component',
      stats: '/api/headless-v3/stats',
      sessionStatus: '/api/headless-v3/session/:id/status',
      sessionCleanup: '/api/headless-v3/session/:id/cleanup'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
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
    console.log(`🚀 DemoFlow Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API endpoints: http://localhost:${PORT}/api/headless-v3/`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize services
    const eventHubService = getEventHubService();
    const sessionManager = getSessionManager();
    
    console.log('✅ Services initialized:');
    console.log(`   - EventHub Service: ${eventHubService ? 'Ready' : 'Failed'}`);
    console.log(`   - Session Manager: ${sessionManager ? 'Ready' : 'Failed'}`);
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