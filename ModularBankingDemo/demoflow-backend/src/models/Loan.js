/**
 * Loan Data Model
 * Represents a bank loan with all its properties
 */

class Loan {
  constructor(data = {}) {
    this.loanId = data.loanId || '';
    this.displayName = data.displayName || 'Loan';
    this.productName = data.productName || 'LOAN';
    this.type = data.type || 'loan';
    this.status = data.status || 'active';
    this.currency = data.currency || 'USD';
    this.outstandingBalance = parseFloat(data.outstandingBalance || 0);
    this.originalAmount = parseFloat(data.originalAmount || 0);
    this.startDate = data.startDate || '';
    this.maturityDate = data.maturityDate || '';
    this.interestRate = parseFloat(data.interestRate || 0);
    this.contractReference = data.contractReference || '';
    this.productLine = data.productLine || 'LENDING';
  }

  /**
   * Create Loan from Temenos arrangement data
   * @param {Object} arrangement - Temenos arrangement object
   * @param {Object} balanceData - Balance information
   * @returns {Loan} - Loan instance
   */
  static fromTemenosArrangement(arrangement, balanceData = {}) {
    const loan = new Loan();
    
    // Map arrangement data
    loan.contractReference = arrangement.contractReference || '';
    loan.displayName = arrangement.arrangementName || 'Loan';
    loan.productName = arrangement.productName || 'LOAN';
    loan.currency = arrangement.currency || 'USD';
    loan.startDate = arrangement.startDate || '';
    loan.maturityDate = arrangement.maturityDate || '';
    loan.productLine = arrangement.productLine || 'LENDING';
    loan.type = 'loan';
    
    // Get loan ID from alternate references or use contract reference
    if (arrangement.alternateReferences) {
      for (const ref of arrangement.alternateReferences) {
        if (ref.alternateType === 'ACCOUNT') {
          loan.loanId = ref.alternateId || loan.contractReference;
          break;
        }
      }
    }
    
    if (!loan.loanId) {
      loan.loanId = loan.contractReference;
    }
    
    // Map balance data - for loans, balance is typically negative, convert to positive outstanding
    if (balanceData && balanceData.balance !== undefined) {
      const rawBalance = parseFloat(balanceData.balance);
      loan.outstandingBalance = rawBalance < 0 ? Math.abs(rawBalance) : rawBalance;
    }
    
    // Set original amount (would need additional API call in real implementation)
    loan.originalAmount = loan.outstandingBalance; // Placeholder
    
    return loan;
  }

  /**
   * Create Loan from detailed arrangement data (for loan details endpoint)
   * @param {Object} arrangementDetails - Detailed arrangement object
   * @returns {Loan} - Loan instance with detailed information
   */
  static fromTemenosArrangementDetails(arrangementDetails) {
    const loan = new Loan();
    
    // Map basic arrangement data
    if (arrangementDetails.arrangement) {
      const arrangement = arrangementDetails.arrangement;
      loan.contractReference = arrangement.arrangementId || '';
      loan.loanId = arrangement.arrangementId || '';
      loan.displayName = arrangement.productName || 'Loan';
      loan.productName = arrangement.productName || 'LOAN';
      loan.currency = arrangement.currency?.currencyId || 'USD';
      loan.startDate = arrangement.effectiveDate || '';
      loan.maturityDate = arrangement.maturityDate || '';
      loan.status = arrangement.arrangementStatus || 'active';
    }
    
    // Map financial details
    if (arrangementDetails.financialDetails) {
      const financial = arrangementDetails.financialDetails;
      if (financial.principalAmount) {
        loan.originalAmount = parseFloat(financial.principalAmount);
      }
      if (financial.outstandingAmount) {
        loan.outstandingBalance = parseFloat(financial.outstandingAmount);
      }
    }
    
    // Map interest details
    if (arrangementDetails.interestDetails && arrangementDetails.interestDetails.length > 0) {
      const interest = arrangementDetails.interestDetails[0];
      if (interest.interestRate) {
        loan.interestRate = parseFloat(interest.interestRate);
      }
    }
    
    return loan;
  }

  /**
   * Convert to JSON representation
   * @returns {Object} - JSON object
   */
  toJSON() {
    return {
      id: this.contractReference,
      loanId: this.loanId,
      displayName: this.displayName,
      productName: this.productName,
      type: this.type,
      status: this.status,
      currency: this.currency,
      outstandingBalance: this.outstandingBalance,
      originalAmount: this.originalAmount,
      startDate: this.startDate,
      maturityDate: this.maturityDate,
      interestRate: this.interestRate,
      contractReference: this.contractReference,
      productLine: this.productLine
    };
  }

  /**
   * Validate loan data
   * @returns {Object} - Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.loanId) {
      errors.push('Loan ID is required');
    }
    
    if (!this.currency) {
      errors.push('Currency is required');
    }
    
    if (isNaN(this.outstandingBalance)) {
      errors.push('Outstanding balance must be a number');
    }
    
    if (isNaN(this.originalAmount)) {
      errors.push('Original amount must be a number');
    }
    
    if (isNaN(this.interestRate)) {
      errors.push('Interest rate must be a number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Loan; 