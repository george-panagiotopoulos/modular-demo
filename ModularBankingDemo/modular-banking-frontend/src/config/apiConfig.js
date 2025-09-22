/**
 * Frontend API Configuration
 * Contains all API endpoint configurations for the frontend
 * Uses environment variables for all URLs and endpoints
 */

// Validation function to check required environment variables with defaults
const validateEnvVar = (name, value, defaultValue = '') => {
  if (!value) {
    console.warn(`Missing environment variable: ${name}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

const apiConfig = {
  // Base URLs from environment variables
  baseUrls: {
    backend: validateEnvVar('REACT_APP_BACKEND_URL', process.env.REACT_APP_BACKEND_URL, 'http://localhost:5011'),
    party: validateEnvVar('REACT_APP_PARTY_API_URL', process.env.REACT_APP_PARTY_API_URL, 'http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api'),
    deposits: validateEnvVar('REACT_APP_DEPOSITS_API_URL', process.env.REACT_APP_DEPOSITS_API_URL, 'http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api'),
    lending: validateEnvVar('REACT_APP_LENDING_API_URL', process.env.REACT_APP_LENDING_API_URL, 'http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api'),
    holdings: validateEnvVar('REACT_APP_HOLDINGS_API_URL', process.env.REACT_APP_HOLDINGS_API_URL, 'http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api')
  },

  // Direct backend URL for compatibility
  backend: validateEnvVar('REACT_APP_BACKEND_URL', process.env.REACT_APP_BACKEND_URL, 'http://localhost:5011'),

  // API endpoints organized by component - all from environment variables
  endpoints: {
    party: {
      create: validateEnvVar('REACT_APP_PARTY_CREATE_ENDPOINT', process.env.REACT_APP_PARTY_CREATE_ENDPOINT, '/v5.0.0/party/parties'),
      getById: validateEnvVar('REACT_APP_PARTY_GET_BY_ID_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_ID_ENDPOINT, '/v5.0.0/party/parties/{partyId}'),
      getByDateOfBirth: validateEnvVar('REACT_APP_PARTY_GET_BY_DOB_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_DOB_ENDPOINT, '/v5.0.0/party/parties?dateOfBirth={dateOfBirth}'),
      getByLastName: validateEnvVar('REACT_APP_PARTY_GET_BY_LASTNAME_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_LASTNAME_ENDPOINT, '/v5.0.0/party/parties?lastName={lastName}'),
      getByPhone: validateEnvVar('REACT_APP_PARTY_GET_BY_PHONE_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_PHONE_ENDPOINT, '/v5.0.0/party/parties?contactNumber={contactNumber}'),
      getByEmail: validateEnvVar('REACT_APP_PARTY_GET_BY_EMAIL_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_EMAIL_ENDPOINT, '/v5.0.0/party/parties?emailId={emailId}'),
      getByLastNameAndDOB: validateEnvVar('REACT_APP_PARTY_GET_BY_LASTNAME_DOB_ENDPOINT', process.env.REACT_APP_PARTY_GET_BY_LASTNAME_DOB_ENDPOINT, '/v5.0.0/party/parties?lastName={lastName}&dateOfBirth={dateOfBirth}')
    },
    deposits: {
      createCurrentAccount: validateEnvVar('REACT_APP_DEPOSITS_CREATE_CURRENT_ACCOUNT_ENDPOINT', process.env.REACT_APP_DEPOSITS_CREATE_CURRENT_ACCOUNT_ENDPOINT, '/v2.0.0/holdings/accounts/currentAccounts'),
      getAccountBalance: validateEnvVar('REACT_APP_DEPOSITS_GET_ACCOUNT_BALANCE_ENDPOINT', process.env.REACT_APP_DEPOSITS_GET_ACCOUNT_BALANCE_ENDPOINT, '/v2.0.0/holdings/accounts/{accountReference}/balances'),
      getPartyArrangements: validateEnvVar('REACT_APP_DEPOSITS_GET_PARTY_ARRANGEMENTS_ENDPOINT', process.env.REACT_APP_DEPOSITS_GET_PARTY_ARRANGEMENTS_ENDPOINT, '/v1.0.0/holdings/parties/{partyId}/arrangements'),
      createTermDeposit: validateEnvVar('REACT_APP_DEPOSITS_CREATE_TERM_DEPOSIT_ENDPOINT', process.env.REACT_APP_DEPOSITS_CREATE_TERM_DEPOSIT_ENDPOINT, '/v2.0.0/holdings/deposits/termDeposits'),
      debitAccount: validateEnvVar('REACT_APP_DEPOSITS_DEBIT_ACCOUNT_ENDPOINT', process.env.REACT_APP_DEPOSITS_DEBIT_ACCOUNT_ENDPOINT, '/v1.0.0/order/payments/debitAccount'),
      creditAccount: validateEnvVar('REACT_APP_DEPOSITS_CREDIT_ACCOUNT_ENDPOINT', process.env.REACT_APP_DEPOSITS_CREDIT_ACCOUNT_ENDPOINT, '/v1.0.0/order/payments/creditAccount')
    },
    lending: {
      createPersonalLoan: validateEnvVar('REACT_APP_LENDING_CREATE_PERSONAL_LOAN_ENDPOINT', process.env.REACT_APP_LENDING_CREATE_PERSONAL_LOAN_ENDPOINT, '/v8.0.0/holdings/loans/personalLoans'),
      createConsumerLoan: validateEnvVar('REACT_APP_LENDING_CREATE_CONSUMER_LOAN_ENDPOINT', process.env.REACT_APP_LENDING_CREATE_CONSUMER_LOAN_ENDPOINT, '/v8.0.0/holdings/loans/consumerLoans'),
      getLoanStatus: validateEnvVar('REACT_APP_LENDING_GET_LOAN_STATUS_ENDPOINT', process.env.REACT_APP_LENDING_GET_LOAN_STATUS_ENDPOINT, '/v8.0.0/holdings/loans/{loanArrangementId}/status'),
      getLoanSchedules: validateEnvVar('REACT_APP_LENDING_GET_LOAN_SCHEDULES_ENDPOINT', process.env.REACT_APP_LENDING_GET_LOAN_SCHEDULES_ENDPOINT, '/v8.0.0/holdings/loans/{loanArrangementId}/schedules'),
      getCustomerArrangements: validateEnvVar('REACT_APP_LENDING_GET_CUSTOMER_ARRANGEMENTS_ENDPOINT', process.env.REACT_APP_LENDING_GET_CUSTOMER_ARRANGEMENTS_ENDPOINT, '/v7.0.0/holdings/customers/{partyId}/arrangements')
    },
    holdings: {
      getPartyArrangements: validateEnvVar('REACT_APP_HOLDINGS_GET_PARTY_ARRANGEMENTS_ENDPOINT', process.env.REACT_APP_HOLDINGS_GET_PARTY_ARRANGEMENTS_ENDPOINT, '/v1.0.0/holdings/parties/{partyId}/arrangements'),
      getAccountBalances: validateEnvVar('REACT_APP_HOLDINGS_GET_ACCOUNT_BALANCES_ENDPOINT', process.env.REACT_APP_HOLDINGS_GET_ACCOUNT_BALANCES_ENDPOINT, '/v3.0.0/holdings/accounts/GB0010001-{accountReference}/balances'),
      getAccountTransactions: validateEnvVar('REACT_APP_HOLDINGS_GET_ACCOUNT_TRANSACTIONS_ENDPOINT', process.env.REACT_APP_HOLDINGS_GET_ACCOUNT_TRANSACTIONS_ENDPOINT, '/v3.0.0/holdings/accounts/GB0010001-{accountReference}/transactions')
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