/**
 * Banking API Routes
 * Handles all banking-related endpoints for the MobileApp
 */

const express = require('express');
const router = express.Router();

const { getPartiesService } = require('../services/partiesService');
const { getLoansService } = require('../services/loansService');
const { getAccountsService } = require('../services/accountsService');

// Initialize services
const partiesService = getPartiesService();
const loansService = getLoansService();
const accountsService = getAccountsService();

/**
 * GET /api/banking/parties/:partyId
 * Get party details
 */
router.get('/parties/:partyId', async (req, res) => {
  try {
    const { partyId } = req.params;
    
    console.log(`[Banking API] GET /parties/${partyId}`);
    
    if (!partiesService.validatePartyId(partyId)) {
      return res.status(400).json({
        error: 'Invalid party ID format',
        message: 'Party ID must be 8-12 digits'
      });
    }
    
    const partyDetails = await partiesService.getPartyDetails(partyId);
    
    res.json({
      success: true,
      data: partyDetails
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting party details:`, error.message);
    res.status(404).json({
      error: 'Party not found',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/parties/:partyId/accounts
 * Get all accounts for a party
 */
router.get('/parties/:partyId/accounts', async (req, res) => {
  try {
    const { partyId } = req.params;
    
    console.log(`[Banking API] GET /parties/${partyId}/accounts`);
    
    if (!partiesService.validatePartyId(partyId)) {
      return res.status(400).json({
        error: 'Invalid party ID format',
        message: 'Party ID must be 8-12 digits'
      });
    }
    
    const accounts = await partiesService.getPartyAccounts(partyId);
    
    res.json({
      success: true,
      data: accounts,
      count: accounts.length
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting party accounts:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch accounts',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/parties/:partyId/loans
 * Get all loans for a party
 */
router.get('/parties/:partyId/loans', async (req, res) => {
  try {
    const { partyId } = req.params;
    
    console.log(`[Banking API] GET /parties/${partyId}/loans`);
    
    if (!partiesService.validatePartyId(partyId)) {
      return res.status(400).json({
        error: 'Invalid party ID format',
        message: 'Party ID must be 8-12 digits'
      });
    }
    
    const loans = await partiesService.getPartyLoans(partyId);
    
    res.json({
      success: true,
      data: loans,
      count: loans.length
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting party loans:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch loans',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/accounts/:accountId
 * Get account details
 */
router.get('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`[Banking API] GET /accounts/${accountId}`);
    
    if (!accountsService.validateAccountId(accountId)) {
      return res.status(400).json({
        error: 'Invalid account ID format',
        message: 'Account ID must be 8-16 digits'
      });
    }
    
    const accountDetails = await accountsService.getAccountDetails(accountId);
    
    res.json({
      success: true,
      data: accountDetails
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting account details:`, error.message);
    res.status(404).json({
      error: 'Account not found',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/accounts/:accountId/transactions
 * Get account transactions
 */
router.get('/accounts/:accountId/transactions', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { limit, offset, dateFrom, dateTo } = req.query;
    
    console.log(`[Banking API] GET /accounts/${accountId}/transactions`);
    
    if (!accountsService.validateAccountId(accountId)) {
      return res.status(400).json({
        error: 'Invalid account ID format',
        message: 'Account ID must be 8-16 digits'
      });
    }
    
    const options = {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null
    };
    
    const transactionsData = await accountsService.getAccountTransactions(accountId, options);
    
    res.json({
      success: true,
      data: transactionsData
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting account transactions:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/accounts/:accountId/balance
 * Get account balance
 */
router.get('/accounts/:accountId/balance', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`[Banking API] GET /accounts/${accountId}/balance`);
    
    if (!accountsService.validateAccountId(accountId)) {
      return res.status(400).json({
        error: 'Invalid account ID format',
        message: 'Account ID must be 8-16 digits'
      });
    }
    
    const balanceData = await accountsService.getAccountBalance(accountId);
    
    res.json({
      success: true,
      data: balanceData
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting account balance:`, error.message);
    res.status(404).json({
      error: 'Account not found',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/loans/:loanId
 * Get loan details
 */
router.get('/loans/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    
    console.log(`[Banking API] GET /loans/${loanId}`);
    
    if (!loansService.validateLoanId(loanId)) {
      return res.status(400).json({
        error: 'Invalid loan ID format',
        message: 'Loan ID must be 10-20 alphanumeric characters'
      });
    }
    
    const loanDetails = await loansService.getLoanDetails(loanId);
    
    res.json({
      success: true,
      data: loanDetails
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting loan details:`, error.message);
    res.status(404).json({
      error: 'Loan not found',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/loans/:loanId/schedule
 * Get loan payment schedule
 */
router.get('/loans/:loanId/schedule', async (req, res) => {
  try {
    const { loanId } = req.params;
    
    console.log(`[Banking API] GET /loans/${loanId}/schedule`);
    
    if (!loansService.validateLoanId(loanId)) {
      return res.status(400).json({
        error: 'Invalid loan ID format',
        message: 'Loan ID must be 10-20 alphanumeric characters'
      });
    }
    
    const scheduleData = await loansService.getLoanSchedule(loanId);
    
    res.json({
      success: true,
      data: scheduleData
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting loan schedule:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch loan schedule',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/parties/:partyId/summary
 * Get complete banking summary for a party
 */
router.get('/parties/:partyId/summary', async (req, res) => {
  try {
    const { partyId } = req.params;
    
    console.log(`[Banking API] GET /parties/${partyId}/summary`);
    
    if (!partiesService.validatePartyId(partyId)) {
      return res.status(400).json({
        error: 'Invalid party ID format',
        message: 'Party ID must be 8-12 digits'
      });
    }
    
    // Get all data in parallel
    const [partyDetails, accounts, loans, loanSummary] = await Promise.all([
      partiesService.getPartyDetails(partyId),
      partiesService.getPartyAccounts(partyId),
      partiesService.getPartyLoans(partyId),
      loansService.getLoanSummary(partyId)
    ]);
    
    const summary = {
      party: partyDetails,
      accounts: {
        items: accounts,
        count: accounts.length,
        totalBalance: accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
      },
      loans: {
        items: loans,
        count: loans.length,
        summary: loanSummary
      }
    };
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error(`[Banking API] Error getting party summary:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch party summary',
      message: error.message
    });
  }
});

/**
 * GET /api/banking/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Banking API is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 