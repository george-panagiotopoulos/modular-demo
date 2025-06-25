/**
 * Loans Service
 * Handles loan-specific operations using Temenos APIs
 */

const axios = require('axios'); // Import axios for direct calls
const { getTemenosApiService } = require('./temenosApiService');
const temenosConfig = require('../config/temenosConfig');
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
      // Use the new component-based configuration
      const url = temenosConfig.buildUrl('lending', 'loanDetails', { arrangementId: loanId });
      console.log(`[Loans Service] Calling Temenos API URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Loans Service] Temenos API response status: ${response.status}`);
      console.log(`[Loans Service] Temenos API response data:`, JSON.stringify(response.data, null, 2));
      
      // Transform the response to match the expected format
      if (response.data && response.data.body && Array.isArray(response.data.body) && response.data.body.length > 0) {
        const rawLoanData = response.data.body[0];
        console.log(`[Loans Service] Raw loan data from Temenos:`, JSON.stringify(rawLoanData, null, 2));
        
        // Extract interest rate from the interests array
        let interestRate = 0;
        if (rawLoanData.interests && Array.isArray(rawLoanData.interests) && rawLoanData.interests.length > 0) {
          const firstInterest = rawLoanData.interests[0];
          if (firstInterest.interestRate) {
            // Extract the first rate from the pipe-separated string (e.g., "1.75%|6%" -> 1.75)
            const rateString = firstInterest.interestRate.split('|')[0];
            interestRate = parseFloat(rateString.replace('%', ''));
          }
        }
        
        // Calculate next payment amount from schedules if available
        let nextPaymentAmount = 0;
        if (rawLoanData.schedules && Array.isArray(rawLoanData.schedules) && rawLoanData.schedules.length > 0) {
          const firstSchedule = rawLoanData.schedules[0];
          if (firstSchedule.schedulePaymentAmount) {
            // Extract the payment amount from the pipe-separated string (e.g., "100%|1627.14||" -> 1627.14)
            const amounts = firstSchedule.schedulePaymentAmount.split('|');
            if (amounts.length > 1 && amounts[1] !== '') {
              nextPaymentAmount = parseFloat(amounts[1]);
            }
          }
        }
        
        // Transform to match frontend expectations with correct field mapping
        const transformedLoanData = {
          arrangementId: rawLoanData.arrangementId || loanId,
          productDescription: 'Mortgage Product', // Default since not in response
          outstandingBalance: parseFloat(rawLoanData.totalDue || 0),
          interestRate: interestRate,
          nextPaymentDate: rawLoanData.nextPaymentDate || null,
          nextPaymentAmount: nextPaymentAmount
        };
        
        console.log(`[Loans Service] Transformed loan data:`, transformedLoanData);
        return transformedLoanData;
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
      // Use the new component-based configuration
      const url = temenosConfig.buildUrl('lending', 'loanSchedules', { arrangementId: loanId });
      console.log(`[Loans Service] Calling Temenos API URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[Loans Service] Temenos API response status: ${response.status}`);
      console.log(`[Loans Service] Temenos API response data:`, JSON.stringify(response.data, null, 2));
      
      // Transform the response to match the expected format
      if (response.data && response.data.body && Array.isArray(response.data.body)) {
        const scheduleData = response.data.body.map((payment, index) => {
          console.log(`[Loans Service] Processing payment ${index + 1}:`, JSON.stringify(payment, null, 2));
          
          return {
            dueDate: payment.paymentDate || payment.dueDate || payment.date || '',
            amount: parseFloat(payment.totalAmount || payment.amount || payment.paymentAmount || 0),
            status: payment.status || payment.paymentStatus || 'Scheduled',
            paymentNumber: payment.paymentNumber || payment.installmentNumber || index + 1,
            principalAmount: parseFloat(payment.principalAmount || payment.principal || 0),
            interestAmount: parseFloat(payment.interestAmount || payment.interest || 0),
            outstandingAmount: parseFloat(payment.outstandingAmount || payment.outstanding || 0)
          };
        });
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