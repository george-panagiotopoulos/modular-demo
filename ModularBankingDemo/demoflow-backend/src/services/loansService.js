/**
 * Loans Service
 * Handles loan-specific operations using Temenos APIs
 */

const axios = require('axios'); // Import axios for direct calls
const { getTemenosApiService } = require('./temenosApiService');
const Loan = require('../models/Loan');
const bankingConfig = require('../config/bankingConfig');

class LoansService {
  constructor() {
    this.temenosApi = getTemenosApiService();
  }

  /**
   * Get loan details by loan ID
   * @param {string} loanId - Loan contract reference ID
   * @returns {Promise<Object>} - Loan details
   */
  async getLoanDetails(loanId) {
    console.log(`[Loans Service] getLoanDetails called with loanId: ${loanId}`);
    
    try {
      // Use the hardcoded URL that matches the Python implementation
      const url = `http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/${loanId}/status`;
      console.log(`[Loans Service] Calling Temenos API URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Loans Service] Temenos API response status: ${response.status}`);
      console.log(`[Loans Service] Temenos API response data:`, response.data);
      
      // Transform the response to match the expected format
      if (response.data && response.data.body && Array.isArray(response.data.body) && response.data.body.length > 0) {
        const loanData = response.data.body[0];
        console.log(`[Loans Service] Transformed loan data:`, loanData);
        return loanData;
      }
      
      console.log(`[Loans Service] No loan data found in response`);
      throw new Error('No loan data found');
    } catch (error) {
      console.error(`[Loans Service] Error getting loan details for ${loanId}:`, error.message);
      if (error.response) {
        console.error(`[Loans Service] Temenos API error status: ${error.response.status}`);
        console.error(`[Loans Service] Temenos API error data:`, error.response.data);
      }
      throw new Error(`Failed to fetch loan details: ${error.message}`);
    }
  }

  /**
   * Get loan payment schedule by loan ID
   * @param {string} loanId - Loan contract reference ID
   * @returns {Promise<Array>} - Loan payment schedule
   */
  async getLoanSchedule(loanId) {
    console.log(`[Loans Service] getLoanSchedule called with loanId: ${loanId}`);
    
    try {
      // Use the hardcoded URL that matches the Python implementation
      const url = `http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/${loanId}/schedules`;
      console.log(`[Loans Service] Calling Temenos API URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Loans Service] Temenos API response status: ${response.status}`);
      console.log(`[Loans Service] Temenos API response data:`, response.data);
      
      // Transform the response to match the expected format
      if (response.data && response.data.body && Array.isArray(response.data.body)) {
        const scheduleData = response.data.body.map(payment => ({
          paymentDate: payment.paymentDate || '',
          paymentNumber: payment.paymentNumber || 1,
          principalAmount: parseFloat(payment.principalAmount || 0),
          interestAmount: parseFloat(payment.interestAmount || 0),
          totalAmount: parseFloat(payment.totalAmount || 0),
          outstandingAmount: parseFloat(payment.outstandingAmount || 0)
        }));
        console.log(`[Loans Service] Transformed schedule data (${scheduleData.length} payments):`, scheduleData);
        return scheduleData;
      }
      
      console.log(`[Loans Service] No schedule data found in response`);
      return [];
    } catch (error) {
      console.error(`[Loans Service] Error getting loan schedule for ${loanId}:`, error.message);
      if (error.response) {
        console.error(`[Loans Service] Temenos API error status: ${error.response.status}`);
        console.error(`[Loans Service] Temenos API error data:`, error.response.data);
      }
      throw new Error(`Failed to fetch loan schedule: ${error.message}`);
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