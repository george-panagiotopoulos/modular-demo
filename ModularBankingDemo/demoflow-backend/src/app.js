/**
 * Main Express Application
 * ModularBankingDemo Backend Server
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const bankingRoutes = require('./routes/banking');

// Create Express app
const app = express();

// Trust proxy (useful for deployment)
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3011',
  credentials: true
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ModularBankingDemo Backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/banking', bankingRoutes);

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

app.get('/api/accounts/:accountId/transactions', (req, res) => {
  console.log(`[Legacy API] Redirecting /api/accounts/${req.params.accountId}/transactions to banking API`);
  req.url = `/api/banking/accounts/${req.params.accountId}/transactions`;
  app.handle(req, res);
});

app.get('/api/loans/:loanId/details', (req, res) => {
  console.log(`[Legacy API] Redirecting /api/loans/${req.params.loanId}/details to banking API`);
  req.url = `/api/banking/loans/${req.params.loanId}`;
  app.handle(req, res);
});

app.get('/api/loans/:loanId/schedule', (req, res) => {
  console.log(`[Legacy API] Redirecting /api/loans/${req.params.loanId}/schedule to banking API`);
  req.url = `/api/banking/loans/${req.params.loanId}/schedule`;
  app.handle(req, res);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ModularBankingDemo Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      banking: '/api/banking',
      documentation: 'https://github.com/your-repo/ModularBankingDemo'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl} - Not Found`);
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
    availableEndpoints: [
      'GET /health',
      'GET /api/banking/health',
      'GET /api/banking/parties/:partyId',
      'GET /api/banking/parties/:partyId/accounts',
      'GET /api/banking/parties/:partyId/loans',
      'GET /api/banking/accounts/:accountId',
      'GET /api/banking/accounts/:accountId/transactions',
      'GET /api/banking/loans/:loanId',
      'GET /api/banking/loans/:loanId/schedule'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      details: error.details || null
    });
  }
  
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication credentials'
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = app; 