/**
 * Parties Service
 * Handles customer/party data operations using Temenos APIs
 */

const { getTemenosApiService } = require('./temenosApiService');
const Account = require('../models/Account');
const Loan = require('../models/Loan');
const Party = require('../models/Party');
const bankingConfig = require('../config/bankingConfig');

class PartiesService {
  constructor() {
    this.temenosApi = getTemenosApiService();
  }

  /**
   * Get party details by ID
   * @param {string} partyId - Party/customer ID
   * @returns {Promise<Object>} - Party details
   */
  async getPartyDetails(partyId) {
    try {
      console.log(`[PartiesService] Getting party details for ${partyId}`);
      
      // For now, create a basic party object since we don't have a direct party details API
      // In a real implementation, this would call a specific party API
      const party = Party.createBasic(partyId, `Customer ${partyId}`);
      
      return party.toJSON();
    } catch (error) {
      console.error(`[PartiesService] Error getting party details for ${partyId}:`, error.message);
      throw new Error(bankingConfig.errors.PARTY_NOT_FOUND);
    }
  }

  /**
   * Get all accounts for a party
   * @param {string} partyId - Party/customer ID
   * @returns {Promise<Array>} - Array of account objects
   */
  async getPartyAccounts(partyId) {
    try {
      console.log(`[PartiesService] Getting accounts for party ${partyId}`);
      
      // Get arrangements from Temenos
      const arrangementsData = await this.temenosApi.getPartyArrangements(partyId);
      
      const accounts = [];
      const loanIds = new Set(); // Track loan account IDs to exclude from accounts
      
      if (arrangementsData && arrangementsData.arrangements && Array.isArray(arrangementsData.arrangements)) {
        
        // First pass: identify all loan accounts
        for (const arrangement of arrangementsData.arrangements) {
          // Skip deposits explicitly
          if (arrangement.productLine === 'DEPOSITS' || arrangement.systemReference === 'deposits') {
            console.log(`[PartiesService] Skipping deposit arrangement in loan detection: ${arrangement.arrangementId}`);
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
          
          // Check if this is a loan by checking the balance API systemReference
          if (accountId) {
            try {
              const balanceData = await this.temenosApi.getAccountBalances(accountId);
              
              if (balanceData && balanceData.items && balanceData.items.length > 0) {
                const balanceItem = balanceData.items[0];
                const systemRef = balanceItem.systemReference || '';
                
                // If systemReference is 'lending' AND NOT 'deposits', this is a loan account
                if (systemRef === 'lending' && systemRef !== 'deposits') {
                  loanIds.add(accountId);
                  console.log(`[PartiesService] Identified loan account: ${accountId}`);
                } else if (systemRef === 'deposits') {
                  console.log(`[PartiesService] Confirmed deposit account (not loan): ${accountId}`);
                }
              }
            } catch (error) {
              console.error(`[PartiesService] Error checking balance for account ${accountId}:`, error.message);
            }
          }
          
          // Also check traditional lending arrangements (but exclude deposits)
          if (arrangement.productLine === 'LENDING' && 
              arrangement.systemReference === 'lending' &&
              arrangement.productLine !== 'DEPOSITS') {
            if (accountId) {
              loanIds.add(accountId);
              console.log(`[PartiesService] Identified traditional lending arrangement: ${accountId}`);
            }
          }
        }

        // Second pass: get all accounts from arrangements and filter out loans
        for (const arrangement of arrangementsData.arrangements) {
          // Include both ACCOUNTS and DEPOSITS productLines
          if (arrangement.productLine === 'ACCOUNTS' || arrangement.productLine === 'DEPOSITS') {
            const contractRef = arrangement.contractReference || '';
            
            // Get the Holdings account ID
            let holdingsAccountId = contractRef;
            if (arrangement.alternateReferences) {
              for (const ref of arrangement.alternateReferences) {
                if (ref.alternateType === 'ACCOUNT') {
                  holdingsAccountId = ref.alternateId || contractRef;
                  break;
                }
              }
            }
            
            // Skip if this account ID is identified as a loan
            if (loanIds.has(holdingsAccountId)) {
              console.log(`[PartiesService] Skipping loan account ${holdingsAccountId} from accounts list`);
              continue;
            }
            
            // Get balance data
            let balanceData = { balance: 0.0, availableBalance: 0.0 };
            try {
              const balanceResponse = await this.temenosApi.getAccountBalances(holdingsAccountId);
              
              if (balanceResponse && balanceResponse.items && balanceResponse.items.length > 0) {
                const balanceItem = balanceResponse.items[0];
                balanceData = {
                  balance: parseFloat(balanceItem.onlineActualBalance || 0),
                  availableBalance: parseFloat(balanceItem.availableBalance || 0)
                };
              }
            } catch (error) {
              console.error(`[PartiesService] Error fetching balance for account ${holdingsAccountId}:`, error.message);
            }
            
            // Create account object
            const account = Account.fromTemenosArrangement(arrangement, balanceData);
            accounts.push(account.toJSON());
          }
        }
      }
      
      console.log(`[PartiesService] Found ${accounts.length} accounts for party ${partyId}`);
      console.log(`[PartiesService] Loan account IDs excluded: ${Array.from(loanIds)}`);
      
      return accounts;
      
    } catch (error) {
      console.error(`[PartiesService] Error getting accounts for party ${partyId}:`, error.message);
      return []; // Return empty array on error rather than throwing
    }
  }

  /**
   * Get all loans for a party
   * @param {string} partyId - Party/customer ID
   * @returns {Promise<Array>} - Array of loan objects
   */
  async getPartyLoans(partyId) {
    try {
      console.log(`[PartiesService] Getting loans for party ${partyId}`);
      
      // Get arrangements from Temenos
      const arrangementsData = await this.temenosApi.getPartyArrangements(partyId);
      
      const loans = [];
      
      if (arrangementsData && arrangementsData.arrangements && Array.isArray(arrangementsData.arrangements)) {
        
        for (const arrangement of arrangementsData.arrangements) {
          // Skip deposits explicitly
          if (arrangement.productLine === 'DEPOSITS' || arrangement.systemReference === 'deposits') {
            console.log(`[PartiesService] Skipping deposit arrangement: ${arrangement.arrangementId}`);
            continue;
          }
          
          // Check both lending arrangements and accounts with lending systemReference
          let accountId = null;
          if (arrangement.alternateReferences) {
            for (const ref of arrangement.alternateReferences) {
              if (ref.alternateType === 'ACCOUNT') {
                accountId = ref.alternateId;
                break;
              }
            }
          }
          
          // Check if this is a loan based on balance API systemReference
          let isLoan = false;
          let balanceData = { balance: 0.0 };
          
          if (accountId) {
            try {
              const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
              
              if (balanceResponse && balanceResponse.items && balanceResponse.items.length > 0) {
                const balanceItem = balanceResponse.items[0];
                const systemRef = balanceItem.systemReference || '';
                
                // This is a loan ONLY if systemReference is 'lending' AND NOT 'deposits'
                if (systemRef === 'lending') {
                  isLoan = true;
                  // For loans, balance is typically negative, convert to positive outstanding
                  const rawBalance = parseFloat(balanceItem.onlineActualBalance || 0);
                  balanceData.balance = rawBalance < 0 ? Math.abs(rawBalance) : rawBalance;
                  console.log(`[PartiesService] Loan ${accountId}: Raw balance = ${rawBalance}, Outstanding = ${balanceData.balance}`);
                } else if (systemRef === 'deposits') {
                  // Explicitly skip deposits even if they somehow got this far
                  console.log(`[PartiesService] Skipping deposit account in loan check: ${accountId}`);
                  continue;
                }
              }
            } catch (error) {
              console.error(`[PartiesService] Error checking balance for potential loan ${accountId}:`, error.message);
            }
          }
          
          // Also check traditional lending arrangements (but exclude deposits)
          if (!isLoan && (arrangement.productLine === 'LENDING' && 
              arrangement.systemReference === 'lending' &&
              arrangement.productLine !== 'DEPOSITS')) {
            isLoan = true;
          }
          
          if (isLoan) {
            // Create loan object
            const loan = Loan.fromTemenosArrangement(arrangement, balanceData);
            loans.push(loan.toJSON());
          }
        }
      }
      
      console.log(`[PartiesService] Found ${loans.length} loans for party ${partyId}`);
      
      return loans;
      
    } catch (error) {
      console.error(`[PartiesService] Error getting loans for party ${partyId}:`, error.message);
      return []; // Return empty array on error rather than throwing
    }
  }

  /**
   * Validate party ID format
   * @param {string} partyId - Party ID to validate
   * @returns {boolean} - True if valid
   */
  validatePartyId(partyId) {
    if (!partyId || typeof partyId !== 'string') {
      return false;
    }
    
    // Basic validation - adjust regex based on your bank's party ID format
    const partyIdRegex = /^[0-9]{8,12}$/;
    return partyIdRegex.test(partyId.trim());
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of PartiesService
 * @returns {PartiesService} - Service instance
 */
function getPartiesService() {
  if (!instance) {
    instance = new PartiesService();
  }
  return instance;
}

module.exports = {
  PartiesService,
  getPartiesService
}; 