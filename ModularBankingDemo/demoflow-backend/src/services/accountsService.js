/**
 * Accounts Service
 * Handles account-specific operations using Temenos APIs
 */

const { getTemenosApiService } = require('./temenosApiService');
const Account = require('../models/Account');
const bankingConfig = require('../config/bankingConfig');

class AccountsService {
  constructor() {
    this.temenosApi = getTemenosApiService();
  }

  /**
   * Get account details by account ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Account details
   */
  async getAccountDetails(accountId) {
    try {
      console.log(`[AccountsService] Getting account details for ${accountId}`);
      
      // Get balance data
      const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
      
      if (!balanceResponse || !balanceResponse.items || balanceResponse.items.length === 0) {
        throw new Error(bankingConfig.errors.ACCOUNT_NOT_FOUND);
      }
      
      const balanceItem = balanceResponse.items[0];
      
      // Get arrangement details if available
      let arrangementData = null;
      try {
        // Try to get arrangement details using the account ID
        // This might not always work depending on the API structure
        arrangementData = await this.temenosApi.getArrangementDetails(accountId);
      } catch (error) {
        console.log(`[AccountsService] No arrangement data found for account ${accountId}`);
      }
      
      // Create account object
      const balanceData = {
        balance: parseFloat(balanceItem.onlineActualBalance || 0),
        availableBalance: parseFloat(balanceItem.availableBalance || 0)
      };
      
      let account;
      if (arrangementData) {
        account = Account.fromTemenosArrangement(arrangementData, balanceData);
      } else {
        // Create basic account from balance data
        account = Account.fromTemenosBalance(balanceItem, balanceData);
      }
      
      return account.toJSON();
      
    } catch (error) {
      console.error(`[AccountsService] Error getting account details for ${accountId}:`, error.message);
      throw new Error(bankingConfig.errors.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Get account transactions
   * @param {string} accountId - Account ID
   * @param {Object} options - Query options (limit, offset, dateFrom, dateTo)
   * @returns {Promise<Object>} - Transactions data
   */
  async getAccountTransactions(accountId, options = {}) {
    try {
      console.log(`[AccountsService] Getting transactions for account ${accountId}`);
      
      const {
        limit = bankingConfig.defaults.transactionLimit,
        offset = 0,
        dateFrom = null,
        dateTo = null
      } = options;
      
      // Get transactions from Temenos
      const transactionsData = await this.temenosApi.getAccountTransactions(accountId, {
        limit,
        offset,
        dateFrom,
        dateTo
      });
      
      if (!transactionsData || !transactionsData.items) {
        return {
          accountId,
          transactions: [],
          totalCount: 0,
          hasMore: false
        };
      }
      
      // Transform transactions
      const transactions = transactionsData.items.map(tx => this.transformTransaction(tx));
      
      return {
        accountId,
        transactions,
        totalCount: transactionsData.totalCount || transactions.length,
        hasMore: transactionsData.hasMore || false,
        limit,
        offset
      };
      
    } catch (error) {
      console.error(`[AccountsService] Error getting transactions for account ${accountId}:`, error.message);
      return {
        accountId,
        transactions: [],
        totalCount: 0,
        hasMore: false
      };
    }
  }

  /**
   * Get account balance
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Balance information
   */
  async getAccountBalance(accountId) {
    try {
      console.log(`[AccountsService] Getting balance for account ${accountId}`);
      
      const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
      
      if (!balanceResponse || !balanceResponse.items || balanceResponse.items.length === 0) {
        throw new Error(bankingConfig.errors.ACCOUNT_NOT_FOUND);
      }
      
      const balanceItem = balanceResponse.items[0];
      
      return {
        accountId,
        balance: parseFloat(balanceItem.onlineActualBalance || 0),
        availableBalance: parseFloat(balanceItem.availableBalance || 0),
        currency: balanceItem.currency || bankingConfig.defaults.currency,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[AccountsService] Error getting balance for account ${accountId}:`, error.message);
      throw new Error(bankingConfig.errors.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Get account summary for multiple accounts
   * @param {Array<string>} accountIds - Array of account IDs
   * @returns {Promise<Array>} - Array of account summaries
   */
  async getAccountsSummary(accountIds) {
    try {
      console.log(`[AccountsService] Getting summary for ${accountIds.length} accounts`);
      
      const summaries = [];
      
      // Process accounts in parallel for better performance
      const promises = accountIds.map(async (accountId) => {
        try {
          const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
          
          if (balanceResponse && balanceResponse.items && balanceResponse.items.length > 0) {
            const balanceItem = balanceResponse.items[0];
            
            return {
              accountId,
              accountName: balanceItem.accountName || `Account ${accountId}`,
              balance: parseFloat(balanceItem.onlineActualBalance || 0),
              availableBalance: parseFloat(balanceItem.availableBalance || 0),
              currency: balanceItem.currency || bankingConfig.defaults.currency,
              status: 'ACTIVE'
            };
          }
        } catch (error) {
          console.error(`[AccountsService] Error getting summary for account ${accountId}:`, error.message);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      
      // Filter out null results
      return results.filter(result => result !== null);
      
    } catch (error) {
      console.error(`[AccountsService] Error getting accounts summary:`, error.message);
      return [];
    }
  }

  /**
   * Validate account ID format
   * @param {string} accountId - Account ID to validate
   * @returns {boolean} - True if valid
   */
  validateAccountId(accountId) {
    if (!accountId || typeof accountId !== 'string') {
      return false;
    }
    
    // Basic validation - adjust regex based on your bank's account ID format
    const accountIdRegex = /^[0-9]{8,16}$/;
    return accountIdRegex.test(accountId.trim());
  }

  /**
   * Transform transaction data from Temenos format
   * @param {Object} tx - Transaction data from Temenos
   * @returns {Object} - Transformed transaction
   * @private
   */
  transformTransaction(tx) {
    return {
      transactionId: tx.transactionId || tx.id,
      date: this.formatDate(tx.bookingDate || tx.valueDate || tx.date),
      description: tx.narrative || tx.description || 'Transaction',
      amount: parseFloat(tx.amount || 0),
      currency: tx.currency || bankingConfig.defaults.currency,
      type: this.determineTransactionType(tx),
      balance: parseFloat(tx.runningBalance || 0),
      reference: tx.reference || tx.transactionReference,
      status: tx.status || 'COMPLETED',
      category: this.categorizeTransaction(tx)
    };
  }

  /**
   * Determine transaction type (DEBIT/CREDIT)
   * @param {Object} tx - Transaction data
   * @returns {string} - Transaction type
   * @private
   */
  determineTransactionType(tx) {
    const amount = parseFloat(tx.amount || 0);
    
    if (amount > 0) {
      return 'CREDIT';
    } else if (amount < 0) {
      return 'DEBIT';
    }
    
    // Fallback to debitCreditIndicator if available
    if (tx.debitCreditIndicator) {
      return tx.debitCreditIndicator === 'D' ? 'DEBIT' : 'CREDIT';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Categorize transaction based on description
   * @param {Object} tx - Transaction data
   * @returns {string} - Transaction category
   * @private
   */
  categorizeTransaction(tx) {
    const description = (tx.narrative || tx.description || '').toLowerCase();
    
    if (description.includes('transfer')) return 'TRANSFER';
    if (description.includes('payment')) return 'PAYMENT';
    if (description.includes('deposit')) return 'DEPOSIT';
    if (description.includes('withdrawal')) return 'WITHDRAWAL';
    if (description.includes('fee')) return 'FEE';
    if (description.includes('interest')) return 'INTEREST';
    if (description.includes('salary') || description.includes('payroll')) return 'SALARY';
    if (description.includes('purchase') || description.includes('pos')) return 'PURCHASE';
    
    return 'OTHER';
  }

  /**
   * Format date string
   * @param {string} dateString - Date string from API
   * @returns {string} - Formatted date
   * @private
   */
  formatDate(dateString) {
    if (!dateString) return new Date().toISOString().split('T')[0];
    
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch (error) {
      console.error(`[AccountsService] Error formatting date ${dateString}:`, error.message);
      return new Date().toISOString().split('T')[0];
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of AccountsService
 * @returns {AccountsService} - Service instance
 */
function getAccountsService() {
  if (!instance) {
    instance = new AccountsService();
  }
  return instance;
}

module.exports = {
  AccountsService,
  getAccountsService
}; 