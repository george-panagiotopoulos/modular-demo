/**
 * Temenos Banking API Configuration
 * Contains all Temenos API endpoint configurations and settings
 */

require('dotenv').config();

const temenosConfig = {
  baseUrl: process.env.TEMENOS_BASE_URL || 'http://modulardemo.northeurope.cloudapp.azure.com',
  holdingsApiPath: process.env.TEMENOS_HOLDINGS_API_PATH || '/ms-holdings-api/api',
  
  // API endpoints
  endpoints: {
    // Holdings API endpoints
    holdings: {
      arrangements: '/v1.0.0/holdings/parties/{partyId}/arrangements',
      accountBalances: '/v3.0.0/holdings/accounts/{accountId}/balances',
      loanDetails: '/v1.0.0/holdings/arrangements/{arrangementId}',
      loanSchedule: '/v1.0.0/holdings/arrangements/{arrangementId}/schedule'
    }
  },
  
  // Request configuration
  request: {
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000, // 1 second
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'ModularBankingDemo/1.0.0'
    }
  },
  
  // Response configuration
  response: {
    maxSize: '10mb'
  }
};

/**
 * Build full URL for a Temenos API endpoint
 * @param {string} endpoint - The endpoint path with placeholders
 * @param {Object} params - Parameters to replace in the endpoint
 * @returns {string} - Full URL
 */
temenosConfig.buildUrl = (endpoint, params = {}) => {
  let url = `${temenosConfig.baseUrl}${temenosConfig.holdingsApiPath}${endpoint}`;
  
  // Replace placeholders in the URL
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  
  return url;
};

module.exports = temenosConfig; 