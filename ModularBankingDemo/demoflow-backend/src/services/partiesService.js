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
      // Use the same API endpoint as the Python implementation
      const url = `http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties/${partyId}`;
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
      const loanIds = new Set(); // Track loan account IDs to exclude from accounts
  
      if (!arrangementsData?.arrangements) {
        return [];
      }
  
      // First pass: identify all loan accounts (EXACTLY like Python implementation)
      for (const arrangement of arrangementsData.arrangements) {
        // EXPLICITLY EXCLUDE DEPOSITS from loan detection
        if (arrangement.productLine === 'DEPOSITS' || arrangement.systemReference === 'deposits') {
          console.log(`Skipping deposit arrangement in loan detection: ${arrangement.arrangementId}`);
          continue;
        }
        
        // Get the account ID for balance checking
        let accountId = null;
        const contractRef = arrangement.contractReference || '';
        
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
            const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
            if (balanceResponse?.items?.[0]) {
              const balanceItem = balanceResponse.items[0];
              const systemRef = balanceItem.systemReference || '';
              
              // If systemReference is 'lending' AND NOT 'deposits', this is a loan account
              if (systemRef === 'lending' && systemRef !== 'deposits') {
                loanIds.add(accountId);
                console.log(`Identified loan account: ${accountId}`);
              } else if (systemRef === 'deposits') {
                console.log(`Confirmed deposit account (not loan): ${accountId}`);
              }
            }
          } catch (error) {
            console.error(`Error checking balance for account ${accountId}:`, error.message);
          }
        }
        
        // Also check traditional lending arrangements (but exclude deposits)
        if (arrangement.productLine === 'LENDING' && 
            arrangement.systemReference === 'lending' &&
            arrangement.productLine !== 'DEPOSITS') {
          if (accountId) {
            loanIds.add(accountId);
            console.log(`Identified traditional lending arrangement: ${accountId}`);
          }
        }
      }

      // Second pass: get all accounts from arrangements and filter out loans
      for (const arrangement of arrangementsData.arrangements) {
        // Include both ACCOUNTS and DEPOSITS productLines
        if (arrangement.productLine === 'ACCOUNTS' || arrangement.productLine === 'DEPOSITS') {
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
          
          // Skip if this account ID is identified as a loan
          if (loanIds.has(holdingsAccountId)) {
            console.log(`Skipping loan account ${holdingsAccountId} from accounts list`);
            continue;
          }
          
          // Get balance data using the alternateId (same as Python)
          let balanceData = { balance: 0.0, availableBalance: 0.0 };
          try {
            const balanceResponse = await this.temenosApi.getAccountBalances(holdingsAccountId);
            if (balanceResponse?.items?.[0]) {
              const balanceItem = balanceResponse.items[0];
              balanceData = {
                balance: parseFloat(balanceItem.onlineActualBalance || 0),
                availableBalance: parseFloat(balanceItem.availableBalance || 0),
              };
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
          accounts.push(account);
        }
      }
  
      console.log(`[PartiesService] Found ${accounts.length} accounts for party ${partyId}`);
      console.log(`Loan account IDs excluded: ${Array.from(loanIds)}`);
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
        return [];
      }

      for (const arrangement of arrangementsData.arrangements) {
        // EXPLICITLY EXCLUDE DEPOSITS - Skip if this is a deposit arrangement
        if (arrangement.productLine === 'DEPOSITS' || arrangement.systemReference === 'deposits') {
          console.log(`Skipping deposit arrangement: ${arrangement.arrangementId}`);
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
        let outstandingBalance = 0.0;
        const currency = arrangement.currency || 'USD';
        
        if (accountId) {
          try {
            const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
            if (balanceResponse?.items?.[0]) {
              const balanceItem = balanceResponse.items[0];
              const systemRef = balanceItem.systemReference || '';
              
              // This is a loan ONLY if systemReference is 'lending' AND NOT 'deposits'
              if (systemRef === 'lending') {
                isLoan = true;
                // For loans, balance is typically negative, convert to positive outstanding
                const rawBalance = parseFloat(balanceItem.onlineActualBalance || 0);
                outstandingBalance = rawBalance < 0 ? Math.abs(rawBalance) : rawBalance;
                console.log(`Loan ${accountId}: Raw balance = ${rawBalance}, Outstanding = ${outstandingBalance}`);
              } else if (systemRef === 'deposits') {
                // Explicitly skip deposits even if they somehow got this far
                console.log(`Skipping deposit account in loan check: ${accountId}`);
                continue;
              }
            }
          } catch (error) {
            console.error(`Error checking balance for potential loan ${accountId}:`, error.message);
          }
        }
        
        // Also check traditional lending arrangements (but exclude deposits)
        if (!isLoan && (arrangement.productLine === 'LENDING' && 
            arrangement.systemReference === 'lending' &&
            arrangement.productLine !== 'DEPOSITS')) {
          isLoan = true;
          // For traditional lending arrangements, try to get balance if we have account_id
          if (accountId) {
            try {
              const balanceResponse = await this.temenosApi.getAccountBalances(accountId);
              if (balanceResponse?.items?.[0]) {
                const balanceItem = balanceResponse.items[0];
                const rawBalance = parseFloat(balanceItem.onlineActualBalance || 0);
                outstandingBalance = rawBalance < 0 ? Math.abs(rawBalance) : rawBalance;
              }
            } catch (error) {
              console.error(`Error fetching balance for lending arrangement ${accountId}:`, error.message);
            }
          }
        }
        
        if (isLoan) {
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
          loans.push(loan);
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