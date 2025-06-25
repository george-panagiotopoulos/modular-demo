/**
 * Temenos Banking API Configuration
 * Contains all Temenos API endpoint configurations and settings
 * Organized by component following working API endpoints only
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Validation function to check required environment variables
const validateEnvVar = (name, value) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const temenosConfig = {
  // Base configuration
  baseUrl: validateEnvVar('TEMENOS_BASE_URL', process.env.TEMENOS_BASE_URL),
  
  // Component-based API endpoints - only working endpoints included
  components: {
    // Party Component (✅ Working)
    party: {
      baseUrl: validateEnvVar('TEMENOS_PARTY_BASE_URL', process.env.TEMENOS_PARTY_BASE_URL),
      endpoints: {
        create: validateEnvVar('TEMENOS_PARTY_CREATE_ENDPOINT', process.env.TEMENOS_PARTY_CREATE_ENDPOINT),
        getById: validateEnvVar('TEMENOS_PARTY_GET_BY_ID_ENDPOINT', process.env.TEMENOS_PARTY_GET_BY_ID_ENDPOINT)
      }
    },
    
    // Deposits Component (✅ Working - Balance only)
    deposits: {
      baseUrl: validateEnvVar('TEMENOS_DEPOSITS_BASE_URL', process.env.TEMENOS_DEPOSITS_BASE_URL),
      endpoints: {
        createCurrentAccount: validateEnvVar('TEMENOS_DEPOSITS_CREATE_CURRENT_ACCOUNT_ENDPOINT', process.env.TEMENOS_DEPOSITS_CREATE_CURRENT_ACCOUNT_ENDPOINT),
        accountBalances: validateEnvVar('TEMENOS_DEPOSITS_ACCOUNT_BALANCES_ENDPOINT', process.env.TEMENOS_DEPOSITS_ACCOUNT_BALANCES_ENDPOINT),
        termDeposits: validateEnvVar('TEMENOS_DEPOSITS_TERM_DEPOSITS_ENDPOINT', process.env.TEMENOS_DEPOSITS_TERM_DEPOSITS_ENDPOINT),
        debitAccount: validateEnvVar('TEMENOS_DEPOSITS_DEBIT_ACCOUNT_ENDPOINT', process.env.TEMENOS_DEPOSITS_DEBIT_ACCOUNT_ENDPOINT),
        creditAccount: validateEnvVar('TEMENOS_DEPOSITS_CREDIT_ACCOUNT_ENDPOINT', process.env.TEMENOS_DEPOSITS_CREDIT_ACCOUNT_ENDPOINT)
      }
    },
    
    // Lending Component (✅ Working)
    lending: {
      baseUrl: validateEnvVar('TEMENOS_LENDING_BASE_URL', process.env.TEMENOS_LENDING_BASE_URL),
      endpoints: {
        createLoan: validateEnvVar('TEMENOS_LENDING_CREATE_LOAN_ENDPOINT', process.env.TEMENOS_LENDING_CREATE_LOAN_ENDPOINT),
        loanDetails: validateEnvVar('TEMENOS_LENDING_LOAN_DETAILS_ENDPOINT', process.env.TEMENOS_LENDING_LOAN_DETAILS_ENDPOINT),
        loanStatus: validateEnvVar('TEMENOS_LENDING_LOAN_STATUS_ENDPOINT', process.env.TEMENOS_LENDING_LOAN_STATUS_ENDPOINT),
        loanSchedules: validateEnvVar('TEMENOS_LENDING_LOAN_SCHEDULES_ENDPOINT', process.env.TEMENOS_LENDING_LOAN_SCHEDULES_ENDPOINT),
        personalLoans: validateEnvVar('TEMENOS_LENDING_PERSONAL_LOANS_ENDPOINT', process.env.TEMENOS_LENDING_PERSONAL_LOANS_ENDPOINT),
        consumerLoans: validateEnvVar('TEMENOS_LENDING_CONSUMER_LOANS_ENDPOINT', process.env.TEMENOS_LENDING_CONSUMER_LOANS_ENDPOINT),
        customerArrangements: validateEnvVar('TEMENOS_LENDING_CUSTOMER_ARRANGEMENTS_ENDPOINT', process.env.TEMENOS_LENDING_CUSTOMER_ARRANGEMENTS_ENDPOINT),
        loanBalances: validateEnvVar('TEMENOS_LENDING_LOAN_BALANCES_ENDPOINT', process.env.TEMENOS_LENDING_LOAN_BALANCES_ENDPOINT)
      }
    },
    
    // Holdings Component (✅ Working)
    holdings: {
      baseUrl: validateEnvVar('TEMENOS_HOLDINGS_BASE_URL', process.env.TEMENOS_HOLDINGS_BASE_URL),
      endpoints: {
        partyArrangements: validateEnvVar('TEMENOS_HOLDINGS_PARTY_ARRANGEMENTS_ENDPOINT', process.env.TEMENOS_HOLDINGS_PARTY_ARRANGEMENTS_ENDPOINT),
        accountBalances: validateEnvVar('TEMENOS_HOLDINGS_ACCOUNT_BALANCES_ENDPOINT', process.env.TEMENOS_HOLDINGS_ACCOUNT_BALANCES_ENDPOINT),
        transactions: validateEnvVar('TEMENOS_HOLDINGS_ACCOUNT_TRANSACTIONS_ENDPOINT', process.env.TEMENOS_HOLDINGS_ACCOUNT_TRANSACTIONS_ENDPOINT),
        loanDetails: validateEnvVar('TEMENOS_HOLDINGS_LOAN_DETAILS_ENDPOINT', process.env.TEMENOS_HOLDINGS_LOAN_DETAILS_ENDPOINT),
        loanSchedule: validateEnvVar('TEMENOS_HOLDINGS_LOAN_SCHEDULE_ENDPOINT', process.env.TEMENOS_HOLDINGS_LOAN_SCHEDULE_ENDPOINT)
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