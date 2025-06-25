/**
 * Frontend API Configuration
 * Contains all API endpoint configurations for the frontend
 * Uses environment variables for all URLs and endpoints
 */

// Validation function to check required environment variables
const validateEnvVar = (name, value) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const apiConfig = {
  // Base URLs from environment variables
  baseUrls: {
    backend: validateEnvVar('REACT_APP_BACKEND_URL', process.env.REACT_APP_BACKEND_URL),
    party: validateEnvVar('REACT_APP_PARTY_API_URL', process.env.REACT_APP_PARTY_API_URL),
    deposits: validateEnvVar('REACT_APP_DEPOSITS_API_URL', process.env.REACT_APP_DEPOSITS_API_URL),
    lending: validateEnvVar('REACT_APP_LENDING_API_URL', process.env.REACT_APP_LENDING_API_URL),
    holdings: validateEnvVar('REACT_APP_HOLDINGS_API_URL', process.env.REACT_APP_HOLDINGS_API_URL)
  },

  // Direct backend URL for compatibility
  backend: validateEnvVar('REACT_APP_BACKEND_URL', process.env.REACT_APP_BACKEND_URL),

  // API endpoints organized by component - all from environment variables
  endpoints: {
    party: {
      create: validateEnvVar('REACT_APP_PARTY_CREATE_ENDPOINT', process.env.REACT_APP_PARTY_CREATE_ENDPOINT),
      getById: validateEnvVar('REACT_APP_PARTY_GET_BY_ID_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_ID_ENDPOINT),
      getByDateOfBirth: validateEnvVar('REACT_APP_PARTY_GET_BY_DOB_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_DOB_ENDPOINT),
      getByLastName: validateEnvVar('REACT_APP_PARTY_GET_BY_LASTNAME_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_LASTNAME_ENDPOINT),
      getByPhone: validateEnvVar('REACT_APP_PARTY_GET_BY_PHONE_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_PHONE_ENDPOINT),
      getByEmail: validateEnvVar('REACT_APP_PARTY_GET_BY_EMAIL_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_EMAIL_ENDPOINT),
      getByLastNameAndDOB: validateEnvVar('REACT_APP_PARTY_GET_BY_LASTNAME_DOB_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_LASTNAME_DOB_ENDPOINT)
    },
    deposits: {
      createCurrentAccount: validateEnvVar('REACT_APP_DEPOSITS_CREATE_CURRENT_ACCOUNT_ENDPOINT', process.env.REACT_APP_DEPOSITS_CREATE_CURRENT_ACCOUNT_ENDPOINT),
      getAccountBalance: validateEnvVar('REACT_APP_DEPOSITS_GET_ACCOUNT_BALANCE_ENDPOINT', process.env.REACT_APP_DEPOSITS_GET_ACCOUNT_BALANCE_ENDPOINT),
      getPartyArrangements: validateEnvVar('REACT_APP_DEPOSITS_GET_PARTY_ARRANGEMENTS_ENDPOINT', process.env.REACT_APP_DEPOSITS_GET_PARTY_ARRANGEMENTS_ENDPOINT),
      createTermDeposit: validateEnvVar('REACT_APP_DEPOSITS_CREATE_TERM_DEPOSIT_ENDPOINT', process.env.REACT_APP_DEPOSITS_CREATE_TERM_DEPOSIT_ENDPOINT),
      debitAccount: validateEnvVar('REACT_APP_DEPOSITS_DEBIT_ACCOUNT_ENDPOINT', process.env.REACT_APP_DEPOSITS_DEBIT_ACCOUNT_ENDPOINT),
      creditAccount: validateEnvVar('REACT_APP_DEPOSITS_CREDIT_ACCOUNT_ENDPOINT', process.env.REACT_APP_DEPOSITS_CREDIT_ACCOUNT_ENDPOINT)
    },
    lending: {
      createPersonalLoan: validateEnvVar('REACT_APP_LENDING_CREATE_PERSONAL_LOAN_ENDPOINT', process.env.REACT_APP_LENDING_CREATE_PERSONAL_LOAN_ENDPOINT),
      createConsumerLoan: validateEnvVar('REACT_APP_LENDING_CREATE_CONSUMER_LOAN_ENDPOINT', process.env.REACT_APP_LENDING_CREATE_CONSUMER_LOAN_ENDPOINT),
      getLoanStatus: validateEnvVar('REACT_APP_LENDING_GET_LOAN_STATUS_ENDPOINT', process.env.REACT_APP_LENDING_GET_LOAN_STATUS_ENDPOINT),
      getLoanSchedules: validateEnvVar('REACT_APP_LENDING_GET_LOAN_SCHEDULES_ENDPOINT', process.env.REACT_APP_LENDING_GET_LOAN_SCHEDULES_ENDPOINT),
      getCustomerArrangements: validateEnvVar('REACT_APP_LENDING_GET_CUSTOMER_ARRANGEMENTS_ENDPOINT', process.env.REACT_APP_LENDING_GET_CUSTOMER_ARRANGEMENTS_ENDPOINT)
    },
    holdings: {
      getPartyArrangements: validateEnvVar('REACT_APP_HOLDINGS_GET_PARTY_ARRANGEMENTS_ENDPOINT', process.env.REACT_APP_HOLDINGS_GET_PARTY_ARRANGEMENTS_ENDPOINT),
      getAccountBalances: validateEnvVar('REACT_APP_HOLDINGS_GET_ACCOUNT_BALANCES_ENDPOINT', process.env.REACT_APP_HOLDINGS_GET_ACCOUNT_BALANCES_ENDPOINT),
      getAccountTransactions: validateEnvVar('REACT_APP_HOLDINGS_GET_ACCOUNT_TRANSACTIONS_ENDPOINT', process.env.REACT_APP_HOLDINGS_GET_ACCOUNT_TRANSACTIONS_ENDPOINT)
    }
  }
};

/**
 * Build full URL for an API endpoint
 * @param {string} component - The component name (party, deposits, lending, holdings)
 * @param {string} endpoint - The endpoint name
 * @param {Object} params - Parameters to replace in the endpoint
 * @returns {string} - Full URL
 */
apiConfig.buildUrl = (component, endpoint, params = {}) => {
  const baseUrl = apiConfig.baseUrls[component];
  if (!baseUrl) {
    throw new Error(`Unknown component: ${component}`);
  }
  
  const endpointPath = apiConfig.endpoints[component]?.[endpoint];
  if (!endpointPath) {
    throw new Error(`Unknown endpoint '${endpoint}' for component '${component}'`);
  }
  
  let url = `${baseUrl}${endpointPath}`;
  
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
apiConfig.getAllEndpoints = () => {
  const result = {};
  
  Object.keys(apiConfig.endpoints).forEach(componentName => {
    const componentEndpoints = apiConfig.endpoints[componentName];
    result[componentName] = {
      baseUrl: apiConfig.baseUrls[componentName],
      endpoints: Object.keys(componentEndpoints).map(endpointName => ({
        name: endpointName,
        path: componentEndpoints[endpointName],
        fullUrl: `${apiConfig.baseUrls[componentName]}${componentEndpoints[endpointName]}`
      }))
    };
  });
  
  return result;
};

export default apiConfig; 