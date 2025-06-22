/**
 * Banking API Routes
 * Handles all banking-related endpoints for the MobileApp
 */

const express = require('express');
const router = express.Router();

const { getPartiesService } = require('../services/partiesService');
const { getLoansService } = require('../services/loansService');
const { getAccountsService } = require('../services/accountsService');
const { getTemenosApiService } = require('../services/temenosApiService');

// Initialize services
const partiesService = getPartiesService();
const loansService = getLoansService();
const accountsService = getAccountsService();
const temenosApiService = getTemenosApiService();

/**
 * GET /api/banking/parties/:partyId
 * Get party details
 */
router.get('/parties/:partyId', async (req, res) => {
  console.log(`[Banking API] GET /parties/${req.params.partyId}`);
  console.log(`[Banking API] Request params:`, req.params);
  console.log(`[Banking API] Request query:`, req.query);
  
  const { partyId } = req.params;
  
  if (!partyId) {
    console.log(`[Banking API] Error: Missing partyId parameter`);
    return res.status(400).json({ error: 'partyId is required' });
  }
  
  try {
    console.log(`[Banking API] Calling partiesService.getPartyDetails(${partyId})`);
    const partyDetails = await partiesService.getPartyDetails(partyId);
    console.log(`[Banking API] partiesService.getPartyDetails returned:`, partyDetails);
    
    res.json(partyDetails);
  } catch (error) {
    console.error(`[Banking API] Error in GET /parties/${partyId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/banking/parties/:partyId/accounts
 * Get all accounts for a party
 */
router.get('/parties/:partyId/accounts', async (req, res) => {
  console.log(`[Backend API] GET /parties/${req.params.partyId}/accounts called`);
  console.log(`[Backend API] Request params:`, req.params);
  console.log(`[Backend API] Request query:`, req.query);
  
  try {
    const { partyId } = req.params;
    
    if (!partyId) {
      console.log(`[Backend API] Missing partyId parameter`);
      return res.status(400).json({ error: 'Party ID is required' });
    }

    console.log(`[Backend API] Calling partiesService.getPartyAccounts(${partyId})`);
    const accounts = await partiesService.getPartyAccounts(partyId);
    console.log(`[Backend API] partiesService.getPartyAccounts returned ${accounts.length} accounts:`, accounts);
    
    res.json(accounts);
  } catch (error) {
    console.error(`[Backend API] Error in GET /parties/${req.params.partyId}/accounts:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch accounts',
      details: error.message 
    });
  }
});

/**
 * GET /api/banking/parties/:partyId/loans
 * Get all loans for a party
 */
router.get('/parties/:partyId/loans', async (req, res) => {
  console.log(`[Backend API] GET /parties/${req.params.partyId}/loans called`);
  console.log(`[Backend API] Request params:`, req.params);
  console.log(`[Backend API] Request query:`, req.query);
  
  try {
    const { partyId } = req.params;
    
    if (!partyId) {
      console.log(`[Backend API] Missing partyId parameter`);
      return res.status(400).json({ error: 'Party ID is required' });
    }

    console.log(`[Backend API] Calling partiesService.getPartyLoans(${partyId})`);
    const loans = await partiesService.getPartyLoans(partyId);
    console.log(`[Backend API] partiesService.getPartyLoans returned ${loans.length} loans:`, loans);
    
    res.json(loans);
  } catch (error) {
    console.error(`[Backend API] Error in GET /parties/${req.params.partyId}/loans:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch loans',
      details: error.message 
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
  console.log(`[Backend API] GET /accounts/${req.params.accountId}/transactions called`);
  console.log(`[Backend API] Request params:`, req.params);
  console.log(`[Backend API] Request query:`, req.query);
  
  try {
    const { accountId } = req.params;
    const { partyId } = req.query;

    if (!accountId) {
      console.log(`[Backend API] Missing accountId parameter`);
      return res.status(400).json({ error: 'Account ID is required' });
    }

    console.log(`[Backend API] Calling temenosApiService.getAccountTransactions(${accountId})`);
    const transactions = await temenosApiService.getAccountTransactions(accountId);
    console.log(`[Backend API] temenosApiService.getAccountTransactions returned:`, transactions);
    
    res.json({ transactions: transactions || [] });
  } catch (error) {
    console.error(`[Backend API] Error in GET /accounts/${req.params.accountId}/transactions:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      details: error.message 
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
  console.log(`[Backend API] GET /loans/${req.params.loanId} called`);
  console.log(`[Backend API] Request params:`, req.params);
  console.log(`[Backend API] Request query:`, req.query);
  
  try {
    const { loanId } = req.params;

    if (!loanId) {
      console.log(`[Backend API] Missing loanId parameter`);
      return res.status(400).json({ error: 'Loan ID is required' });
    }

    console.log(`[Backend API] Calling loansService.getLoanDetails(${loanId})`);
    const loanDetails = await loansService.getLoanDetails(loanId);
    console.log(`[Backend API] loansService.getLoanDetails returned:`, loanDetails);
    
    res.json(loanDetails);
  } catch (error) {
    console.error(`[Backend API] Error in GET /loans/${req.params.loanId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch loan details',
      details: error.message 
    });
  }
});

/**
 * GET /api/banking/loans/:loanId/schedule
 * Get loan payment schedule
 */
router.get('/loans/:loanId/schedule', async (req, res) => {
  console.log(`[Backend API] GET /loans/${req.params.loanId}/schedule called`);
  console.log(`[Backend API] Request params:`, req.params);
  console.log(`[Backend API] Request query:`, req.query);
  console.log(`[Backend API] Request headers:`, req.headers);
  
  try {
    const { loanId } = req.params;

    if (!loanId) {
      console.log(`[Backend API] Missing loanId parameter`);
      return res.status(400).json({ error: 'Loan ID is required' });
    }

    console.log(`[Backend API] Calling loansService.getLoanSchedule(${loanId})`);
    const loanSchedule = await loansService.getLoanSchedule(loanId);
    console.log(`[Backend API] loansService.getLoanSchedule returned:`, loanSchedule);
    
    res.json(loanSchedule);
  } catch (error) {
    console.error(`[Backend API] Error in GET /loans/${req.params.loanId}/schedule:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch loan schedule',
      details: error.message 
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