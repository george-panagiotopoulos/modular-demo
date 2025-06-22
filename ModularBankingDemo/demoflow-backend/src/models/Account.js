/**
 * Account Data Model
 * Represents a bank account with all its properties
 */

class Account {
  constructor(data = {}) {
    this.accountId = data.accountId || '';
    this.displayName = data.displayName || 'Account';
    this.productName = data.productName || 'ACCOUNT';
    this.type = data.type || 'current';
    this.status = data.status || 'active';
    this.currency = data.currency || 'USD';
    this.currentBalance = parseFloat(data.currentBalance || 0);
    this.availableBalance = parseFloat(data.availableBalance || 0);
    this.openDate = data.openDate || '';
    this.contractReference = data.contractReference || '';
    this.productLine = data.productLine || 'ACCOUNTS';
  }

  /**
   * Create Account from Temenos arrangement data
   * @param {Object} arrangement - Temenos arrangement object
   * @param {Object} balanceData - Balance information
   * @returns {Account} - Account instance
   */
  static fromTemenosArrangement(arrangement, balanceData = {}) {
    const account = new Account();
    
    // Map arrangement data
    account.contractReference = arrangement.contractReference || '';
    account.displayName = arrangement.arrangementName || 'Account';
    account.productName = arrangement.productName || 'ACCOUNT';
    account.currency = arrangement.currency || 'USD';
    account.openDate = arrangement.startDate || '';
    account.productLine = arrangement.productLine || 'ACCOUNTS';
    
    // Determine account type
    if (arrangement.productLine === 'DEPOSITS') {
      account.type = 'deposit';
      account.displayName = arrangement.arrangementName || 'Term Deposit';
      account.productName = arrangement.productName || 'TERM_DEPOSIT';
    } else {
      account.type = 'current';
      account.displayName = arrangement.arrangementName || 'Current Account';
      account.productName = arrangement.productName || 'CURRENT_ACCOUNT';
    }
    
    // Get account ID from alternate references
    if (arrangement.alternateReferences) {
      for (const ref of arrangement.alternateReferences) {
        if (ref.alternateType === 'ACCOUNT') {
          account.accountId = ref.alternateId || account.contractReference;
          break;
        }
      }
    }
    
    if (!account.accountId) {
      account.accountId = account.contractReference;
    }
    
    // Map balance data
    if (balanceData) {
      account.currentBalance = parseFloat(balanceData.balance || 0);
      account.availableBalance = parseFloat(balanceData.availableBalance || 0);
    }
    
    return account;
  }

  /**
   * Create Account from Temenos balance data only
   * @param {Object} balanceItem - Temenos balance object
   * @param {Object} balanceData - Additional balance information
   * @returns {Account} - Account instance
   */
  static fromTemenosBalance(balanceItem, balanceData = {}) {
    const account = new Account();
    
    // Map basic data from balance item
    account.accountId = balanceItem.accountId || balanceItem.id || '';
    account.displayName = balanceItem.accountName || `Account ${account.accountId}`;
    account.currency = balanceItem.currency || 'USD';
    account.type = 'current'; // Default type
    account.productName = 'CURRENT_ACCOUNT';
    account.productLine = 'ACCOUNTS';
    
    // Map balance data
    account.currentBalance = parseFloat(balanceData.balance || balanceItem.onlineActualBalance || 0);
    account.availableBalance = parseFloat(balanceData.availableBalance || balanceItem.availableBalance || 0);
    
    return account;
  }

  /**
   * Convert to JSON representation
   * @returns {Object} - JSON object
   */
  toJSON() {
    return {
      id: this.contractReference,
      accountId: this.accountId,
      displayName: this.displayName,
      productName: this.productName,
      type: this.type,
      status: this.status,
      currency: this.currency,
      currentBalance: this.currentBalance,
      availableBalance: this.availableBalance,
      openDate: this.openDate,
      contractReference: this.contractReference,
      productLine: this.productLine
    };
  }

  /**
   * Validate account data
   * @returns {Object} - Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.accountId) {
      errors.push('Account ID is required');
    }
    
    if (!this.currency) {
      errors.push('Currency is required');
    }
    
    if (isNaN(this.currentBalance)) {
      errors.push('Current balance must be a number');
    }
    
    if (isNaN(this.availableBalance)) {
      errors.push('Available balance must be a number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Account; 