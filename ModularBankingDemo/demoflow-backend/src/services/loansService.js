/**
 * Loans Service
 * Handles loan-specific operations using Temenos APIs
 */

const { getTemenosApiService } = require('./temenosApiService');
const Loan = require('../models/Loan');
const bankingConfig = require('../config/bankingConfig');

class LoansService {
  constructor() {
    this.temenosApi = getTemenosApiService();
  }

  /**
   * Get loan details by loan ID
   * @param {string} loanId - Loan arrangement ID
   * @returns {Promise<Object>} - Loan details
   */
  async getLoanDetails(loanId) {
    try {
      console.log(`[LoansService] Getting loan details for ${loanId}`);
      
      // Get arrangement details from Temenos
      const arrangementData = await this.temenosApi.getArrangementDetails(loanId);
      
      if (!arrangementData) {
        throw new Error(bankingConfig.errors.LOAN_NOT_FOUND);
      }
      
      // Get balance data for the loan
      let balanceData = { balance: 0.0 };
      let accountId = null;
      
      // Extract account ID from arrangement
      if (arrangementData.alternateReferences) {
        for (const ref of arrangementData.alternateReferences) {
          if (ref.alternateType === 'ACCOUNT') {
            accountId = ref.alternateId;
            break;
          }
        }
      }
      
      if (accountId) {
        try {
          const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
          
          if (balanceResponse && balanceResponse.items && balanceResponse.items.length > 0) {
            const balanceItem = balanceResponse.items[0];
            // For loans, balance is typically negative, convert to positive outstanding
            const rawBalance = parseFloat(balanceItem.onlineActualBalance || 0);
            balanceData.balance = rawBalance < 0 ? Math.abs(rawBalance) : rawBalance;
          }
        } catch (error) {
          console.error(`[LoansService] Error fetching balance for loan ${loanId}:`, error.message);
        }
      }
      
      // Create loan object
      const loan = Loan.fromTemenosArrangement(arrangementData, balanceData);
      
      return loan.toJSON();
      
    } catch (error) {
      console.error(`[LoansService] Error getting loan details for ${loanId}:`, error.message);
      throw new Error(bankingConfig.errors.LOAN_NOT_FOUND);
    }
  }

  /**
   * Get loan payment schedule
   * @param {string} loanId - Loan arrangement ID
   * @returns {Promise<Object>} - Payment schedule data
   */
  async getLoanSchedule(loanId) {
    try {
      console.log(`[LoansService] Getting loan schedule for ${loanId}`);
      
      // Get payment schedule from Temenos
      const scheduleData = await this.temenosApi.getLoanSchedule(loanId);
      
      if (!scheduleData || !scheduleData.paymentSchedule) {
        // Return a basic structure if no schedule data
        return {
          loanId,
          paymentSchedule: [],
          totalPayments: 0,
          nextPaymentDate: null,
          nextPaymentAmount: 0.0
        };
      }
      
      // Transform the schedule data
      const payments = scheduleData.paymentSchedule.map((payment, index) => ({
        paymentNumber: index + 1,
        dueDate: this.formatDate(payment.paymentDate),
        principalAmount: parseFloat(payment.principalAmount || 0),
        interestAmount: parseFloat(payment.interestAmount || 0),
        totalAmount: parseFloat(payment.totalAmount || payment.principalAmount || 0) + 
                    parseFloat(payment.interestAmount || 0),
        status: payment.status || 'PENDING',
        paidDate: payment.paidDate ? this.formatDate(payment.paidDate) : null,
        remainingBalance: parseFloat(payment.remainingBalance || 0)
      }));
      
      // Find next payment
      const nextPayment = payments.find(p => p.status === 'PENDING');
      
      return {
        loanId,
        paymentSchedule: payments,
        totalPayments: payments.length,
        nextPaymentDate: nextPayment ? nextPayment.dueDate : null,
        nextPaymentAmount: nextPayment ? nextPayment.totalAmount : 0.0,
        currency: scheduleData.currency || bankingConfig.defaults.currency
      };
      
    } catch (error) {
      console.error(`[LoansService] Error getting loan schedule for ${loanId}:`, error.message);
      // Return empty schedule on error
      return {
        loanId,
        paymentSchedule: [],
        totalPayments: 0,
        nextPaymentDate: null,
        nextPaymentAmount: 0.0,
        currency: bankingConfig.defaults.currency
      };
    }
  }

  /**
   * Get loan summary for a party
   * @param {string} partyId - Party/customer ID
   * @returns {Promise<Object>} - Loan summary
   */
  async getLoanSummary(partyId) {
    try {
      console.log(`[LoansService] Getting loan summary for party ${partyId}`);
      
      // Get arrangements from Temenos
      const arrangementsData = await this.temenosApi.getPartyArrangements(partyId);
      
      const summary = {
        totalLoans: 0,
        totalOutstanding: 0.0,
        totalMonthlyPayment: 0.0,
        loans: [],
        currency: bankingConfig.defaults.currency
      };
      
      if (arrangementsData && arrangementsData.arrangements && Array.isArray(arrangementsData.arrangements)) {
        
        for (const arrangement of arrangementsData.arrangements) {
          // Skip non-lending arrangements
          if (arrangement.productLine !== 'LENDING' || arrangement.systemReference === 'deposits') {
            continue;
          }
          
          // Get account ID for balance checking
          let accountId = null;
          if (arrangement.alternateReferences) {
            for (const ref of arrangement.alternateReferences) {
              if (ref.alternateType === 'ACCOUNT') {
                accountId = ref.alternateId;
                break;
              }
            }
          }
          
          // Get balance data
          let outstanding = 0.0;
          if (accountId) {
            try {
              const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
              
              if (balanceResponse && balanceResponse.items && balanceResponse.items.length > 0) {
                const balanceItem = balanceResponse.items[0];
                const rawBalance = parseFloat(balanceItem.onlineActualBalance || 0);
                outstanding = rawBalance < 0 ? Math.abs(rawBalance) : rawBalance;
              }
            } catch (error) {
              console.error(`[LoansService] Error fetching balance for loan ${arrangement.arrangementId}:`, error.message);
            }
          }
          
          // Create basic loan info
          const loanInfo = {
            loanId: arrangement.arrangementId,
            productName: arrangement.productName || 'Personal Loan',
            outstanding: outstanding,
            monthlyPayment: this.estimateMonthlyPayment(outstanding, arrangement),
            status: arrangement.arrangementStatus || 'ACTIVE'
          };
          
          summary.loans.push(loanInfo);
          summary.totalOutstanding += outstanding;
          summary.totalMonthlyPayment += loanInfo.monthlyPayment;
        }
        
        summary.totalLoans = summary.loans.length;
      }
      
      console.log(`[LoansService] Loan summary for party ${partyId}: ${summary.totalLoans} loans, $${summary.totalOutstanding} outstanding`);
      
      return summary;
      
    } catch (error) {
      console.error(`[LoansService] Error getting loan summary for party ${partyId}:`, error.message);
      return {
        totalLoans: 0,
        totalOutstanding: 0.0,
        totalMonthlyPayment: 0.0,
        loans: [],
        currency: bankingConfig.defaults.currency
      };
    }
  }

  /**
   * Validate loan ID format
   * @param {string} loanId - Loan ID to validate
   * @returns {boolean} - True if valid
   */
  validateLoanId(loanId) {
    if (!loanId || typeof loanId !== 'string') {
      return false;
    }
    
    // Basic validation - adjust regex based on your bank's loan ID format
    const loanIdRegex = /^[A-Z0-9]{10,20}$/;
    return loanIdRegex.test(loanId.trim());
  }

  /**
   * Format date string
   * @param {string} dateString - Date string from API
   * @returns {string} - Formatted date
   * @private
   */
  formatDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch (error) {
      console.error(`[LoansService] Error formatting date ${dateString}:`, error.message);
      return dateString;
    }
  }

  /**
   * Estimate monthly payment based on outstanding balance
   * @param {number} outstanding - Outstanding balance
   * @param {Object} arrangement - Arrangement data
   * @returns {number} - Estimated monthly payment
   * @private
   */
  estimateMonthlyPayment(outstanding, arrangement) {
    if (outstanding <= 0) return 0;
    
    // Simple estimation - in reality this would use actual loan terms
    // Assume 5% annual interest, 5-year term for estimation
    const annualRate = 0.05;
    const monthlyRate = annualRate / 12;
    const termMonths = 60; // 5 years
    
    if (monthlyRate === 0) {
      return outstanding / termMonths;
    }
    
    const monthlyPayment = outstanding * 
      (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    return Math.round(monthlyPayment * 100) / 100; // Round to 2 decimal places
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of LoansService
 * @returns {LoansService} - Service instance
 */
function getLoansService() {
  if (!instance) {
    instance = new LoansService();
  }
  return instance;
}

module.exports = {
  LoansService,
  getLoansService
}; 