/**
 * Temenos API Service
 * Central service for communicating with Temenos Banking APIs
 */

const axios = require('axios');
const temenosConfig = require('../config/temenosConfig');

class TemenosApiService {
  constructor() {
    this.client = axios.create({
      timeout: temenosConfig.request.timeout,
      headers: temenosConfig.request.headers,
      maxContentLength: temenosConfig.response.maxSize,
      maxBodyLength: temenosConfig.response.maxSize
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[TemenosAPI] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[TemenosAPI] Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[TemenosAPI] ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const status = error.response?.status || 'Unknown';
        const url = error.config?.url || 'Unknown URL';
        console.error(`[TemenosAPI] ${status} ${url} - ${error.message}`);
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Handle API errors and convert to standardized format
   * @param {Error} error - Axios error
   * @returns {Error} - Standardized error
   */
  handleApiError(error) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 404:
          return new Error('Resource not found');
        case 400:
          return new Error(`Bad request: ${data.message || 'Invalid parameters'}`);
        case 401:
          return new Error('Authentication required');
        case 403:
          return new Error('Access forbidden');
        case 500:
          return new Error('Banking service temporarily unavailable');
        default:
          return new Error(`API Error: ${status} ${data.message || error.message}`);
      }
    } else if (error.request) {
      // Request was made but no response received
      return new Error('Banking service is not responding');
    } else {
      // Something else happened
      return new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * Get party arrangements
   * @param {string} partyId - Party ID
   * @returns {Promise<Object>} - Arrangements data
   */
  async getPartyArrangements(partyId) {
    console.log(`[Temenos API] getPartyArrangements called with partyId: ${partyId}`);
    
    try {
      // Use the correct API endpoint that matches the Python implementation
      const url = `http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v1.0.0/holdings/parties/${partyId}/arrangements`;
      console.log(`[Temenos API] Calling URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Temenos API] getPartyArrangements response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[Temenos API] getPartyArrangements error:`, error);
      throw error;
    }
  }

  /**
   * Get account balances
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Balance data
   */
  async getAccountBalances(accountId) {
    console.log(`[Temenos API] getAccountBalances called with accountId: ${accountId}`);
    
    try {
      // Use the correct API endpoint that matches the Python implementation
      const url = `http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/${accountId}/balances`;
      console.log(`[Temenos API] Calling URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Temenos API] getAccountBalances response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[Temenos API] getAccountBalances error for accountId ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get account transactions from Holdings API
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>} - Array of transactions
   */
  async getAccountTransactions(accountId) {
    console.log(`[Temenos API] getAccountTransactions called with accountId: ${accountId}`);
    
    try {
      // Use the correct Holdings API URL
      const url = `http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/${accountId}/transactions`;
      console.log(`[Temenos API] Calling URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Temenos API] Raw response status and data:`, {
        status: response.status || 'N/A',
        data: response.data
      });
      
      // Handle different response formats
      let transactions = [];
      
      if (Array.isArray(response.data)) {
        // Direct array response
        transactions = response.data;
      } else if (response.data && response.data.items && Array.isArray(response.data.items)) {
        // Response with items array
        transactions = response.data.items;
      } else if (response.data && response.data.body && Array.isArray(response.data.body)) {
        // Response with body array
        transactions = response.data.body;
      } else if (response.data && Array.isArray(response.data.data)) {
        // Response with data array
        transactions = response.data.data;
      }
      
      console.log(`[Temenos API] Processed ${transactions.length} transactions`);
      
      // Transform transactions to consistent format
      const transformedTransactions = transactions.map(tx => ({
        transactionId: tx.id || tx.transactionId || 'N/A',
        date: tx.valueDate || tx.bookingDate || tx.date || new Date().toISOString(),
        description: tx.narrative || tx.description || tx.transactionReference || 'Transaction',
        amount: Math.abs(parseFloat(tx.amountInAccountCurrency || tx.transactionAmount || tx.amount || 0)),
        type: (tx.paymentIndicator || tx.type || '').toUpperCase().includes('CREDIT') || 
              (parseFloat(tx.amountInAccountCurrency || tx.transactionAmount || tx.amount || 0) > 0) ? 'CREDIT' : 'DEBIT',
        balance: parseFloat(tx.balance || 0),
        currency: tx.currency || 'USD',
        reference: tx.transactionReference || tx.reference || tx.externalReference || 'N/A'
      }));
      
      console.log(`[Temenos API] Processed ${transformedTransactions.length} transactions`);
      return transformedTransactions;
      
    } catch (error) {
      console.error(`[Temenos API] getAccountTransactions error:`, error);
      throw error;
    }
  }

  /**
   * Get loan details from Holdings API
   * @param {string} arrangementId - Arrangement/Loan ID
   * @returns {Promise<Object>} - Loan details data
   */
  async getLoanDetails(arrangementId) {
    return this.get(temenosConfig.endpoints.holdings.loanDetails, { arrangementId });
  }

  /**
   * Get loan schedule from Holdings API
   * @param {string} arrangementId - Arrangement/Loan ID
   * @returns {Promise<Object>} - Loan schedule data
   */
  async getLoanSchedule(arrangementId) {
    return this.get(temenosConfig.endpoints.holdings.loanSchedule, { arrangementId });
  }

  /**
   * Retry a failed request with exponential backoff
   * @param {Function} apiCall - The API call function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise<Object>} - API response data
   */
  async retryRequest(apiCall, maxRetries = temenosConfig.request.retries, baseDelay = temenosConfig.request.retryDelay) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[TemenosAPI] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if the Temenos API is available
   * @returns {Promise<boolean>} - True if API is available
   */
  async checkHealth() {
    try {
      // Try a simple request to check connectivity
      await this.client.get(temenosConfig.baseUrl, { timeout: 5000 });
      return true;
    } catch (error) {
      console.error('[TemenosAPI] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Generic GET request handler
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  async get(endpoint, options = {}) {
    const url = `${temenosConfig.baseUrl}${endpoint}`;
    console.log(`[Temenos API] Making GET request to: ${url}`);
    console.log(`[Temenos API] Request options:`, options);
    
    try {
      const response = await this.client.get(url, {
        params: options.queryParams,
        ...options
      });
      
      console.log(`[Temenos API] Response status: ${response.status} ${response.statusText}`);
      console.log(`[Temenos API] Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Temenos API] HTTP Error ${response.status}: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.data;
      console.log(`[Temenos API] Response data:`, data);
      return data;
    } catch (error) {
      console.error(`[Temenos API] Request failed for ${url}:`, error);
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of TemenosApiService
 * @returns {TemenosApiService} - Service instance
 */
function getTemenosApiService() {
  if (!instance) {
    instance = new TemenosApiService();
  }
  return instance;
}

module.exports = {
  TemenosApiService,
  getTemenosApiService
}; 