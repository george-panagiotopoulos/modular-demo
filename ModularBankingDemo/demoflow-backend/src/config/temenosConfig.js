/**
 * Temenos Banking API Configuration
 * Contains all Temenos API endpoint configurations and settings
 * Organized by component following working API endpoints only
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const temenosConfig = {
  // Base configuration
  baseUrl: process.env.TEMENOS_BASE_URL || 'http://modulardemo.northeurope.cloudapp.azure.com',
  
  // Component-based API endpoints - only working endpoints included
  components: {
    // Party Component (✅ Working)
    party: {
      baseUrl: process.env.TEMENOS_PARTY_BASE_URL || 'http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api',
      endpoints: {
        create: process.env.TEMENOS_PARTY_CREATE_ENDPOINT || '/v5.0.0/party/parties',
        getById: process.env.TEMENOS_PARTY_GET_BY_ID_ENDPOINT || '/v5.0.0/party/parties/{partyId}'
      }
    },
    
    // Deposits Component (✅ Working - Balance only)
    deposits: {
      baseUrl: process.env.TEMENOS_DEPOSITS_BASE_URL || 'http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api',
      endpoints: {
        createCurrentAccount: process.env.TEMENOS_DEPOSITS_CREATE_CURRENT_ACCOUNT_ENDPOINT || '/v2.0.0/holdings/accounts/currentAccounts',
        accountBalances: process.env.TEMENOS_DEPOSITS_ACCOUNT_BALANCES_ENDPOINT || '/v2.0.0/holdings/accounts/{arrangementId}/balances',
        termDeposits: process.env.TEMENOS_DEPOSITS_TERM_DEPOSITS_ENDPOINT || '/v2.0.0/holdings/deposits/termDeposits',
        debitAccount: process.env.TEMENOS_DEPOSITS_DEBIT_ACCOUNT_ENDPOINT || '/v1.0.0/order/payments/debitAccount',
        creditAccount: process.env.TEMENOS_DEPOSITS_CREDIT_ACCOUNT_ENDPOINT || '/v1.0.0/order/payments/creditAccount'
      }
    },
    
    // Lending Component (✅ Working)
    lending: {
      baseUrl: process.env.TEMENOS_LENDING_BASE_URL || 'http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api',
      endpoints: {
        createLoan: process.env.TEMENOS_LENDING_CREATE_LOAN_ENDPOINT || '/v1.0.0/loan/arrangements',
        loanDetails: process.env.TEMENOS_LENDING_LOAN_DETAILS_ENDPOINT || '/v1.0.0/holdings/loans/{arrangementId}',
        loanStatus: process.env.TEMENOS_LENDING_LOAN_STATUS_ENDPOINT || '/v8.0.0/holdings/loans/{arrangementId}/status',
        loanSchedules: process.env.TEMENOS_LENDING_LOAN_SCHEDULES_ENDPOINT || '/v8.0.0/holdings/loans/{arrangementId}/schedules',
        personalLoans: process.env.TEMENOS_LENDING_PERSONAL_LOANS_ENDPOINT || '/v8.0.0/holdings/loans/personalLoans',
        consumerLoans: process.env.TEMENOS_LENDING_CONSUMER_LOANS_ENDPOINT || '/v8.0.0/holdings/loans/consumerLoans',
        customerArrangements: process.env.TEMENOS_LENDING_CUSTOMER_ARRANGEMENTS_ENDPOINT || '/v7.0.0/holdings/customers/{customerId}/arrangements',
        loanBalances: process.env.TEMENOS_LENDING_LOAN_BALANCES_ENDPOINT || '/v8.0.0/holdings/loans/balances?arrangementId={arrangementId}'
      }
    },
    
    // Holdings Component (✅ Working)
    holdings: {
      baseUrl: process.env.TEMENOS_HOLDINGS_BASE_URL || 'http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api',
      endpoints: {
        partyArrangements: process.env.TEMENOS_HOLDINGS_PARTY_ARRANGEMENTS_ENDPOINT || '/v1.0.0/holdings/parties/{partyId}/arrangements',
        accountBalances: process.env.TEMENOS_HOLDINGS_ACCOUNT_BALANCES_ENDPOINT || '/v1.0.0/holdings/accounts/{accountId}/balances',
        transactions: process.env.TEMENOS_HOLDINGS_ACCOUNT_TRANSACTIONS_ENDPOINT || '/v1.0.0/holdings/accounts/{accountId}/transactions',
        loanDetails: process.env.TEMENOS_HOLDINGS_LOAN_DETAILS_ENDPOINT || '/v1.0.0/holdings/loans/{arrangementId}',
        loanSchedule: process.env.TEMENOS_HOLDINGS_LOAN_SCHEDULE_ENDPOINT || '/v1.0.0/holdings/loans/{arrangementId}/schedule'
      }
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
 * @param {string} component - The component name (party, deposits, lending, holdings)
 * @param {string} endpoint - The endpoint name
 * @param {Object} params - Parameters to replace in the endpoint
 * @returns {string} - Full URL
 */
temenosConfig.buildUrl = (component, endpoint, params = {}) => {
  const componentConfig = temenosConfig.components[component];
  if (!componentConfig) {
    throw new Error(`Unknown component: ${component}`);
  }
  
  const endpointPath = componentConfig.endpoints[endpoint];
  if (!endpointPath) {
    throw new Error(`Unknown endpoint '${endpoint}' for component '${component}'`);
  }
  
  let url = `${componentConfig.baseUrl}${endpointPath}`;
  
  // Replace placeholders in the URL
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  
  return url;
};

/**
 * Get all available endpoints grouped by component
 * @returns {Object} - Object with components and their endpoints
 */
temenosConfig.getAllEndpoints = () => {
  const result = {};
  
  Object.keys(temenosConfig.components).forEach(componentName => {
    const component = temenosConfig.components[componentName];
    result[componentName] = {
      baseUrl: component.baseUrl,
      endpoints: Object.keys(component.endpoints).map(endpointName => ({
        name: endpointName,
        path: component.endpoints[endpointName],
        fullUrl: `${component.baseUrl}${component.endpoints[endpointName]}`
      }))
    };
  });
  
  return result;
};

/**
 * Legacy compatibility - build URL using old method signature
 * @deprecated Use buildUrl(component, endpoint, params) instead
 */
temenosConfig.buildLegacyUrl = (endpoint, params = {}) => {
  // This maintains compatibility with existing code that uses the old method
  const holdingsBaseUrl = temenosConfig.components.holdings.baseUrl;
  let url = `${holdingsBaseUrl}${endpoint}`;
  
  // Replace placeholders in the URL
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  
  return url;
};

module.exports = temenosConfig; 