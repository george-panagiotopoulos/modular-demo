/**
 * Headless API Routes
 * Handles API tracking and execution for the API Viewer component
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const { getTemenosApiService } = require('../services/temenosApiService');
const { getEventHubService } = require('../services/eventHubService');

// Initialize services
const temenosApiService = getTemenosApiService();
const eventHubService = getEventHubService();

/**
 * POST /api/headless/track
 * Execute API calls from the API Viewer and track them
 */
router.post('/track', async (req, res) => {
  console.log('[Headless API] POST /track called');
  console.log('[Headless API] Request body:', JSON.stringify(req.body, null, 2));
  console.log('[Headless API] Request headers:', req.headers);
  
  try {
    const { uri, method, payload, domain, endpoint } = req.body;
    
    // Validate request
    if (!uri || !method) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'uri and method are required'
      });
    }
    
    // Extract headers from request
    const clientType = req.headers['x-client-type'] || 'api-viewer';
    const solution = req.headers['x-solution'] || domain;
    const endpointName = req.headers['x-endpoint'] || endpoint;
    
    console.log(`[Headless API] Executing ${method} ${uri}`);
    console.log(`[Headless API] Domain: ${domain}, Endpoint: ${endpointName}`);
    console.log(`[Headless API] Client Type: ${clientType}`);
    
    // Prepare request configuration
    const requestConfig = {
      method: method.toLowerCase(),
      url: uri,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Modular-Banking-Demo/1.0.0'
      },
      timeout: 30000, // 30 second timeout
      validateStatus: function (status) {
        return status < 500; // Accept all status codes less than 500
      }
    };
    
    // Add payload for POST/PUT requests
    if ((method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') && payload) {
      requestConfig.data = payload;
    }
    
    // Execute the API call
    console.log(`[Headless API] Making request with config:`, {
      ...requestConfig,
      data: requestConfig.data ? '[PAYLOAD]' : undefined
    });
    
    const startTime = Date.now();
    let apiResponse;
    let apiError = null;
    
    try {
      apiResponse = await axios(requestConfig);
      console.log(`[Headless API] API call successful. Status: ${apiResponse.status}`);
      console.log(`[Headless API] Response data:`, apiResponse.data);
    } catch (error) {
      console.error(`[Headless API] API call failed:`, error.message);
      
      if (error.response) {
        // Server responded with error status
        apiResponse = error.response;
        apiError = {
          message: error.message,
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        };
      } else if (error.request) {
        // Network error
        apiError = {
          message: 'Network error - no response received',
          type: 'network_error',
          details: error.message
        };
      } else {
        // Other error
        apiError = {
          message: error.message,
          type: 'request_error'
        };
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Prepare tracking data
    const trackingData = {
      timestamp: new Date().toISOString(),
      request: {
        method: method.toUpperCase(),
        uri: uri,
        domain: domain,
        endpoint: endpointName,
        headers: requestConfig.headers,
        payload: payload || null
      },
      response: apiResponse ? {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: apiResponse.headers,
        data: apiResponse.data
      } : null,
      error: apiError,
      performance: {
        duration: duration,
        success: !apiError
      },
      client: {
        type: clientType,
        solution: solution
      }
    };
    
    // Send event to Event Hub if available
    if (eventHubService && eventHubService.isReady()) {
      try {
        await eventHubService.sendEvent('api-call', trackingData);
        console.log('[Headless API] Event sent to Event Hub');
      } catch (eventError) {
        console.warn('[Headless API] Failed to send event to Event Hub:', eventError.message);
      }
    }
    
    // Prepare response for the API Viewer
    const responsePayload = {
      success: !apiError,
      api_call: {
        request: trackingData.request,
        response: trackingData.response?.data,
        error: apiError,
        duration: duration,
        timestamp: trackingData.timestamp
      },
      tracking: {
        event_sent: eventHubService?.isReady() || false,
        domain: domain,
        endpoint: endpointName
      }
    };
    
    // Return appropriate status code
    const statusCode = apiResponse ? apiResponse.status : 500;
    res.status(statusCode).json(responsePayload);
    
  } catch (error) {
    console.error('[Headless API] Unexpected error in /track:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      success: false
    });
  }
});

/**
 * GET /api/headless/endpoints
 * Get available API endpoints for testing
 */
router.get('/endpoints', (req, res) => {
  console.log('[Headless API] GET /endpoints called');
  
  const endpoints = {
    party: [
      {
        id: 'create_party',
        name: 'Create Party/Customer',
        method: 'POST',
        uri: 'http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties',
        description: 'Create a new customer/party in the system',
        requiresPayload: true
      },
      {
        id: 'get_party_by_id',
        name: 'Get Party by ID',
        method: 'GET',
        uri: 'http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties/{partyId}',
        description: 'Retrieve party details by party ID',
        requiresPayload: false
      }
    ],
    deposits: [
      {
        id: 'create_current_account',
        name: 'Create Current Account',
        method: 'POST',
        uri: 'http://modulardemo.northeurope.cloudapp.azure.com/ms-currentaccount-api/api/v1.0.0/current-account/arrangements',
        description: 'Create a new current account for a customer',
        requiresPayload: true
      }
    ],
    lending: [
      {
        id: 'create_mortgage_loan',
        name: 'Create Mortgage Loan',
        method: 'POST',
        uri: 'http://modulardemo.northeurope.cloudapp.azure.com/ms-loan-api/api/v1.0.0/loan/arrangements',
        description: 'Create a new mortgage loan arrangement',
        requiresPayload: true
      }
    ],
    holdings: [
      {
        id: 'get_holdings_arrangements',
        name: 'Get Holdings Arrangements',
        method: 'GET',
        uri: 'http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v2.0.0/holdings/arrangements',
        description: 'Retrieve all holdings arrangements',
        requiresPayload: false
      }
    ]
  };
  
  res.json({
    success: true,
    endpoints: endpoints,
    total: Object.values(endpoints).reduce((sum, group) => sum + group.length, 0)
  });
});

/**
 * GET /api/headless/status
 * Get headless API status
 */
router.get('/status', (req, res) => {
  console.log('[Headless API] GET /status called');
  
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    services: {
      temenos_api: temenosApiService ? 'available' : 'unavailable',
      event_hub: eventHubService?.isReady() ? 'connected' : 'disconnected'
    },
    endpoints: {
      track: '/api/headless/track',
      endpoints: '/api/headless/endpoints',
      status: '/api/headless/status'
    }
  });
});

module.exports = router; 