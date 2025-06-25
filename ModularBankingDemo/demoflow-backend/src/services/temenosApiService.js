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
      // Use the new component-based configuration
      const url = temenosConfig.buildUrl('holdings', 'partyArrangements', { partyId });
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
      // Strip the prefix from account ID for deposits API (e.g., "GB0010001-1013719612" -> "1013719612")
      const cleanAccountId = accountId.includes('-') ? accountId.split('-').pop() : accountId;
      console.log(`[Temenos API] Using clean accountId: ${cleanAccountId}`);
      
      // Try deposits API first (working endpoint for some accounts)
      try {
        const url = temenosConfig.buildUrl('deposits', 'accountBalances', { arrangementId: cleanAccountId });
        console.log(`[Temenos API] Trying deposits API: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        // Check if we got valid balance data
        if (response.data && Object.keys(response.data).length > 0 && 
            (response.data.ledgerBalance !== undefined || response.data.availableBalance !== undefined)) {
          console.log(`[Temenos API] Deposits API success:`, response.data);
          
          // Transform the response to match expected format for partiesService
          const transformedResponse = {
            items: [{
              accountReference: response.data.accountReference || cleanAccountId,
              onlineActualBalance: response.data.ledgerBalance || 0,
              availableBalance: response.data.availableBalance || 0,
              currency: response.data.currency || 'USD',
              systemReference: 'deposits' // This helps identify it as a deposit account
            }]
          };
          
          return transformedResponse;
        } else {
          console.log(`[Temenos API] Deposits API returned empty data, trying holdings API...`);
        }
      } catch (depositsError) {
        console.log(`[Temenos API] Deposits API failed: ${depositsError.message}, trying holdings API...`);
      }
      
      // Fallback to holdings API with full account ID format
      const fullAccountId = accountId.includes('-') ? accountId : `GB0010001-${accountId}`;
      const holdingsUrl = `${temenosConfig.components.holdings.baseUrl}/v1.0.0/holdings/accounts/${fullAccountId}/balances`;
      console.log(`[Temenos API] Trying holdings API: ${holdingsUrl}`);
      
      const holdingsResponse = await axios.get(holdingsUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Temenos API] Holdings API response:`, holdingsResponse.data);
      
      // Holdings API returns the expected format already
      if (holdingsResponse.data && holdingsResponse.data.items && holdingsResponse.data.items.length > 0) {
        // Add systemReference to identify the source
        holdingsResponse.data.items[0].systemReference = 'holdings';
        return holdingsResponse.data;
      }
      
      // If both APIs fail, return empty response
      console.log(`[Temenos API] Both APIs failed or returned empty data for ${accountId}`);
      return {
        items: [{
          accountReference: cleanAccountId,
          onlineActualBalance: 0,
          availableBalance: 0,
          currency: 'USD',
          systemReference: 'fallback'
        }]
      };
      
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
      // Use the new component-based configuration with proper endpoint
      const fullAccountId = accountId.includes('-') ? accountId : `GB0010001-${accountId}`;
      const url = temenosConfig.buildUrl('holdings', 'transactions', { accountId: fullAccountId });
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
   * @returns {Promise<Object>} - Loan details
   */
  async getLoanDetails(arrangementId) {
    console.log(`[Temenos API] getLoanDetails called with arrangementId: ${arrangementId}`);
    
    try {
      // Use the new component-based configuration
      const url = temenosConfig.buildUrl('holdings', 'loanDetails', { arrangementId });
      return this.get(url);
    } catch (error) {
      console.error(`[Temenos API] getLoanDetails error:`, error);
      throw error;
    }
  }

  /**
   * Get loan schedule/payment schedule
   * @param {string} arrangementId - Arrangement/Loan ID
   * @returns {Promise<Object>} - Loan schedule
   */
  async getLoanSchedule(arrangementId) {
    console.log(`[Temenos API] getLoanSchedule called with arrangementId: ${arrangementId}`);
    
    try {
      // Use the new component-based configuration
      const url = temenosConfig.buildUrl('holdings', 'loanSchedule', { arrangementId });
      return this.get(url);
    } catch (error) {
      console.error(`[Temenos API] getLoanSchedule error:`, error);
      throw error;
    }
  }

  /**
   * Retry mechanism for failed requests
   * @param {Function} apiCall - Function that returns a Promise
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay between retries in milliseconds
   * @returns {Promise} - Result of successful API call
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
        
        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[TemenosAPI] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Sleep utility for delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for Temenos API
   * @returns {Promise<boolean>} - True if API is healthy
   */
  async checkHealth() {
    try {
      // Use the base URL from holdings component for health check
      const baseUrl = temenosConfig.components.holdings.baseUrl.replace('/api', '');
      await this.client.get(baseUrl, { timeout: 5000 });
      return true;
    } catch (error) {
      console.warn('[TemenosAPI] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Generic GET method with URL building
   * @param {string} url - Complete URL or endpoint path
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - API response data
   */
  async get(url, options = {}) {
    try {
      // If it's not a complete URL, use the legacy method for compatibility
      if (!url.startsWith('http')) {
        url = temenosConfig.buildLegacyUrl(url);
      }
      
      const response = await this.client.get(url, options);
      return response.data;
    } catch (error) {
      console.error(`[TemenosAPI] GET ${url} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Generic POST method
   * @param {string} url - Complete URL
   * @param {Object} data - Request body
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - API response data
   */
  async post(url, data, options = {}) {
    try {
      const response = await this.client.post(url, data, options);
      return response.data;
    } catch (error) {
      console.error(`[TemenosAPI] POST ${url} failed:`, error.message);
      throw error;
    }
  }
}

// Create singleton instance
let temenosApiServiceInstance = null;

/**
 * Get singleton instance of TemenosApiService
 * @returns {TemenosApiService} - Service instance
 */
function getTemenosApiService() {
  if (!temenosApiServiceInstance) {
    temenosApiServiceInstance = new TemenosApiService();
  }
  return temenosApiServiceInstance;
}

module.exports = {
  TemenosApiService,
  getTemenosApiService
}; 