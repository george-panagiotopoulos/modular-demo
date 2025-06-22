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
   * Make a GET request to Temenos API
   * @param {string} endpoint - API endpoint path
   * @param {Object} params - URL parameters
   * @param {Object} options - Additional request options
   * @returns {Promise<Object>} - API response data
   */
  async get(endpoint, params = {}, options = {}) {
    const url = temenosConfig.buildUrl(endpoint, params);
    
    try {
      const response = await this.client.get(url, {
        params: options.queryParams,
        ...options
      });
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Make a POST request to Temenos API
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data
   * @param {Object} params - URL parameters
   * @param {Object} options - Additional request options
   * @returns {Promise<Object>} - API response data
   */
  async post(endpoint, data = {}, params = {}, options = {}) {
    const url = temenosConfig.buildUrl(endpoint, params);
    
    try {
      const response = await this.client.post(url, data, options);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get party arrangements from Holdings API
   * @param {string} partyId - Party/customer ID
   * @returns {Promise<Object>} - Arrangements data
   */
  async getPartyArrangements(partyId) {
    return this.get(temenosConfig.endpoints.holdings.arrangements, { partyId });
  }

  /**
   * Get account balances from Holdings API
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Balance data
   */
  async getAccountBalances(accountId) {
    return this.get(temenosConfig.endpoints.holdings.accountBalances, { accountId });
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