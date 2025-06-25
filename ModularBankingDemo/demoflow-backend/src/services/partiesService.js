/**
 * Parties Service
 * Handles customer/party data operations using Temenos APIs
 */

const { getTemenosApiService } = require('./temenosApiService');
const Account = require('../models/Account');
const Loan = require('../models/Loan');
const Party = require('../models/Party');
const bankingConfig = require('../config/bankingConfig');
const axios = require('axios');
const temenosConfig = require('../config/temenosConfig');

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
    console.log(`[PartiesService] Getting party details for ${partyId}`);
    
    try {
      // Use the new component-based configuration
      const url = temenosConfig.buildUrl('party', 'getById', { partyId });
      console.log(`[PartiesService] Calling URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log(`[PartiesService] Party API response status: ${response.status}`);
      console.log(`[PartiesService] Party API response data:`, response.data);
      
      if (response.status === 200 && response.data) {
        const partyData = response.data;
        
        // Extract nationality from nationalities array
        let nationality = "";
        if (partyData.nationalities && partyData.nationalities.length > 0) {
          nationality = partyData.nationalities[0].country || "";
        }
        
        // Extract contact information from addresses array
        let primaryEmail = "";
        let mobilePhone = "";
        let address = "";
        
        const addresses = partyData.addresses || [];
        if (addresses.length > 0) {
          const firstAddress = addresses[0];
          mobilePhone = firstAddress.phoneNo || "";
          primaryEmail = firstAddress.electronicAddress || "";
          const addressLines = firstAddress.addressFreeFormat || [];
          if (addressLines.length > 0) {
            address = addressLines[0].addressLine || "";
          }
        }
        
        // Also check contactReferences as fallback
        if (!primaryEmail || !mobilePhone) {
          for (const contact of partyData.contactReferences || []) {
            const contactType = (contact.contactType || "").toUpperCase();
            const contactValue = contact.contactValue || "";
            const contactSubtype = (contact.contactSubType || "").toUpperCase();
            
            if (contactType === 'EMAIL' && !primaryEmail) {
              primaryEmail = contactValue;
            } else if (contactType === 'PHONE') {
              if (contactSubtype === 'MOBILE' && !mobilePhone) {
                mobilePhone = contactValue;
              } else if (!mobilePhone) {
                mobilePhone = contactValue;
              }
            }
          }
        }
        
        const customer = {
          customerId: partyData.partyId || partyId,
          partyId: partyData.partyId || partyId,
          firstName: partyData.firstName || "",
          lastName: partyData.lastName || "",
          displayName: `${partyData.firstName || ""} ${partyData.lastName || ""}`.trim(),
          dateOfBirth: partyData.dateOfBirth || "",
          cityOfBirth: partyData.cityOfBirth || "",
          middleName: partyData.middleName || "",
          nationality: nationality,
          primaryEmail: primaryEmail,
          email: primaryEmail,
          mobilePhone: mobilePhone,
          phone: mobilePhone,
          homePhone: "",
          address: address,
          status: "Active",
          customerSince: partyData.creationDateTime || partyData.nameStartDate || "2025-06-13",
          addresses: partyData.addresses || [],
          nationalities: partyData.nationalities || []
        };
        
        console.log(`[PartiesService] Transformed customer data:`, customer);
        return customer;
      } else {
        throw new Error(`Party API returned status ${response.status}`);
      }
    } catch (error) {
      console.error(`[PartiesService] Error getting party details for ${partyId}:`, error.message);
      if (error.response) {
        console.error(`[PartiesService] Party API error status: ${error.response.status}`);
        console.error(`[PartiesService] Party API error data:`, error.response.data);
      }
      throw new Error(`Failed to fetch party details: ${error.message}`);
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
      const arrangementsData = await this.temenosApi.getPartyArrangements(partyId);
      const accounts = [];
  
      if (!arrangementsData?.arrangements) {
        return [];
      }

      console.log(`[PartiesService] Processing ${arrangementsData.arrangements.length} arrangements for accounts`);

      // Process arrangements and filter out loans
      for (const arrangement of arrangementsData.arrangements) {
        console.log(`[PartiesService] Checking arrangement: ${arrangement.arrangementId}, productLine: ${arrangement.productLine}, systemReference: ${arrangement.systemReference}`);
        
        // Include only ACCOUNTS and DEPOSITS productLines, exclude LENDING
        if (arrangement.productLine === 'ACCOUNTS' || arrangement.productLine === 'DEPOSITS') {
          // Double-check: exclude if it's a lending arrangement
          if (arrangement.systemReference === 'lending') {
            console.log(`[PartiesService] Skipping lending arrangement in accounts: ${arrangement.arrangementId}`);
            continue;
          }
          
          const contractRef = arrangement.contractReference || '';
          
          // Get the Holdings account ID (alternateId, not contractReference!)
          let holdingsAccountId = contractRef;
          if (arrangement.alternateReferences) {
            for (const ref of arrangement.alternateReferences) {
              if (ref.alternateType === 'ACCOUNT') {
                holdingsAccountId = ref.alternateId || contractRef;
                break;
              }
            }
          }
          
          console.log(`[PartiesService] Processing account: ${holdingsAccountId} for arrangement ${arrangement.arrangementId}`);
          
          // Get balance data using the alternateId (same as Python)
          let balanceData = { balance: 0.0, availableBalance: 0.0 };
          try {
            const balanceResponse = await this.temenosApi.getAccountBalances(holdingsAccountId);
            if (balanceResponse?.items?.[0]) {
              const balanceItem = balanceResponse.items[0];
              
              // Check if this account belongs to the correct customer
              const accountCustomerId = balanceItem.customerId;
              if (accountCustomerId && accountCustomerId !== partyId) {
                console.log(`[PartiesService] Skipping account ${holdingsAccountId} - belongs to different customer: ${accountCustomerId} (expected: ${partyId})`);
                continue;
              }
              
              // Handle negative balances - if balance is negative, this might be a loan account
              const rawBalance = parseFloat(balanceItem.onlineActualBalance || 0);
              const rawAvailableBalance = parseFloat(balanceItem.availableBalance || 0);
              
              // If both balances are negative, this is likely a loan account that got miscategorized
              if (rawBalance < 0 && rawAvailableBalance < 0) {
                console.log(`[PartiesService] Skipping account ${holdingsAccountId} - has negative balances (likely a loan): balance=${rawBalance}, available=${rawAvailableBalance}`);
                continue;
              }
              
              balanceData = {
                balance: Math.max(0, rawBalance), // Ensure non-negative
                availableBalance: Math.max(0, rawAvailableBalance), // Ensure non-negative
              };
              console.log(`[PartiesService] Got balance for ${holdingsAccountId}:`, balanceData);
            }
          } catch (error) {
            console.error(`[PartiesService] Could not fetch balance for account ${holdingsAccountId}:`, error.message);
          }
          
          // Determine account type based on productLine
          const accountType = arrangement.productLine === 'DEPOSITS' ? 'deposit' : 'current';
          const displayName = arrangement.arrangementName || (accountType === 'deposit' ? 'Term Deposit' : 'Current Account');
          const productName = arrangement.productName || (accountType === 'deposit' ? 'TERM_DEPOSIT' : 'CURRENT_ACCOUNT');
          
          const account = {
            id: holdingsAccountId,  // Use alternateId for frontend (transactions API needs this)
            accountId: holdingsAccountId,
            displayName: displayName,
            productName: productName,
            type: accountType,
            status: 'active',
            currency: arrangement.currency || 'USD',
            currentBalance: balanceData.balance,
            availableBalance: balanceData.availableBalance,
            openDate: arrangement.startDate || '',
            contractReference: contractRef,
            productLine: arrangement.productLine || 'ACCOUNTS'
          };
          
          console.log(`[PartiesService] Created account object:`, account);
          accounts.push(account);
        } else {
          console.log(`[PartiesService] Skipping non-account arrangement: productLine=${arrangement.productLine}`);
        }
      }
  
      console.log(`[PartiesService] Found ${accounts.length} accounts for party ${partyId}`);
      return accounts;
  
    } catch (error) {
      console.error(`[PartiesService] Error getting accounts for party ${partyId}:`, error.message);
      return [];
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
      const arrangementsData = await this.temenosApi.getPartyArrangements(partyId);
      const loans = [];

      if (!arrangementsData?.arrangements) {
        console.log(`[PartiesService] No arrangements data found`);
        return [];
      }

      console.log(`[PartiesService] Processing ${arrangementsData.arrangements.length} arrangements for loans`);

      for (const arrangement of arrangementsData.arrangements) {
        console.log(`[PartiesService] Checking arrangement: ${arrangement.arrangementId}, productLine: ${arrangement.productLine}, systemReference: ${arrangement.systemReference}`);
        
        // EXPLICITLY EXCLUDE DEPOSITS - Skip if this is a deposit arrangement
        if (arrangement.productLine === 'DEPOSITS' || arrangement.systemReference === 'deposits') {
          console.log(`[PartiesService] Skipping deposit arrangement: ${arrangement.arrangementId}`);
          continue;
        }
        
        // Check for LENDING arrangements only
        if (arrangement.productLine === 'LENDING' && arrangement.systemReference === 'lending') {
          console.log(`[PartiesService] Found lending arrangement: ${arrangement.arrangementId}`);
          
          // Get the account ID for balance lookup
          let accountId = null;
          if (arrangement.alternateReferences) {
            for (const ref of arrangement.alternateReferences) {
              if (ref.alternateType === 'ACCOUNT') {
                accountId = ref.alternateId;
                break;
              }
            }
          }
          
          // Get loan balance if account ID is available
          let outstandingBalance = 0.0;
          const currency = arrangement.currency || 'USD';
          
          if (accountId) {
            try {
              console.log(`[PartiesService] Getting balance for loan account: ${accountId}`);
              const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
              if (balanceResponse?.items?.[0]) {
                const balanceItem = balanceResponse.items[0];
                const rawBalance = parseFloat(balanceItem.onlineActualBalance || 0);
                // For loans, balance might be negative, convert to positive outstanding
                outstandingBalance = rawBalance < 0 ? Math.abs(rawBalance) : rawBalance;
                console.log(`[PartiesService] Loan ${accountId}: Raw balance = ${rawBalance}, Outstanding = ${outstandingBalance}`);
              }
            } catch (error) {
              console.error(`[PartiesService] Error getting balance for loan ${accountId}:`, error.message);
              // Continue processing even if balance fetch fails
            }
          }
          
          // Extract loan ID from contract reference or arrangement ID
          const loanId = arrangement.contractReference || arrangement.arrangementId || '';
          
          const loan = {
            id: loanId,  // Use contractReference for frontend (loan details/schedule APIs need this)
            loanId: loanId,
            displayName: arrangement.productDescription || arrangement.productGroup || 'Loan',
            productName: arrangement.productGroup || 'LOAN',
            type: 'loan',
            status: arrangement.arrangementStatus || 'Active',
            currency: currency,
            outstandingBalance: outstandingBalance,
            principalAmount: outstandingBalance,  // For now, same as outstanding
            contractReference: arrangement.contractReference || '',
            arrangementId: arrangement.arrangementId || '',
            startDate: arrangement.startDate || '',
            accountIdForTransactions: accountId  // Include account ID for transaction lookup
          };
          
          console.log(`[PartiesService] Created loan object:`, loan);
          loans.push(loan);
        } else {
          console.log(`[PartiesService] Skipping non-lending arrangement: productLine=${arrangement.productLine}, systemReference=${arrangement.systemReference}`);
        }
      }

      console.log(`[PartiesService] Found ${loans.length} loans for party ${partyId}`);
      return loans;

    } catch (error) {
      console.error(`[PartiesService] Error getting loans for party ${partyId}:`, error.message);
      return [];
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