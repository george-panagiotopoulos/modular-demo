/**
 * Banking Configuration
 * Contains banking-specific settings and business logic configurations
 */

const bankingConfig = {
  // Account types mapping
  accountTypes: {
    DEPOSITS: 'deposit',
    ACCOUNTS: 'current',
    LENDING: 'loan'
  },
  
  // Product line mappings
  productLines: {
    DEPOSITS: 'Deposits',
    ACCOUNTS: 'Current Accounts', 
    LENDING: 'Lending'
  },
  
  // Default values
  defaults: {
    currency: 'USD',
    balance: 0.0,
    availableBalance: 0.0,
    status: 'active'
  },
  
  // Data transformation settings
  transformation: {
    // Fields to exclude from API responses
    excludeFields: ['internalId', 'systemReference'],
    
    // Fields to include in account responses
    accountFields: [
      'accountId',
      'displayName', 
      'productName',
      'type',
      'status',
      'currency',
      'currentBalance',
      'availableBalance',
      'openDate',
      'contractReference',
      'productLine'
    ],
    
    // Fields to include in loan responses
    loanFields: [
      'loanId',
      'displayName',
      'productName', 
      'type',
      'status',
      'currency',
      'outstandingBalance',
      'originalAmount',
      'startDate',
      'maturityDate',
      'interestRate',
      'contractReference'
    ]
  },
  
  // Error messages
  errors: {
    PARTY_NOT_FOUND: 'Customer not found',
    ACCOUNT_NOT_FOUND: 'Account not found',
    LOAN_NOT_FOUND: 'Loan not found',
    API_UNAVAILABLE: 'Banking service temporarily unavailable',
    INVALID_PARTY_ID: 'Invalid customer ID format',
    INVALID_ACCOUNT_ID: 'Invalid account ID format',
    INVALID_LOAN_ID: 'Invalid loan ID format'
  }
};

module.exports = bankingConfig; 