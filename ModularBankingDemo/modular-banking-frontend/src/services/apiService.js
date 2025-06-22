/**
 * API Service Layer for Mobile Banking Application
 * 
 * This service handles all API communication with the backend,
 * providing a clean abstraction layer for data fetching and error handling.
 * Uses REAL backend APIs - NO MOCKING ALLOWED.
 * 
 * @module apiService
 */

// Base configuration - using the backend server URL
const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5011';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Generic API request handler with error handling and timeout
 * @param {string} url - The API endpoint URL (relative or absolute)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - API response data
 */
const apiRequest = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  // Construct full URL if it's a relative path
  const fullUrl = url.startsWith('http') ? url : `${BACKEND_BASE_URL}${url}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle the new API response format with success/data structure
    if (data.success && data.data !== undefined) {
      return data.data;
    }
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    
    console.error('API Request Error:', error);
    throw error;
  }
};

/**
 * Fetch customer accounts for a given party ID
 * @param {string} partyId - The party/customer ID
 * @returns {Promise<Array>} - Array of account objects
 */
export const fetchAccounts = async (partyId) => {
  console.log(`[Frontend API] fetchAccounts called with partyId: ${partyId}`);
  const url = `${BACKEND_BASE_URL}/api/banking/parties/${partyId}/accounts?_=${Date.now()}`;
  console.log(`[Frontend API] Calling URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`[Frontend API] fetchAccounts response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Frontend API] fetchAccounts response data:`, data);
    return data;
  } catch (error) {
    console.error(`[Frontend API] fetchAccounts error:`, error);
    throw error;
  }
};

/**
 * Fetch customer loans for a given party ID
 * @param {string} partyId - The party/customer ID
 * @returns {Promise<Array>} - Array of loan objects
 */
export const fetchLoans = async (partyId) => {
  console.log(`[Frontend API] fetchLoans called with partyId: ${partyId}`);
  const url = `${BACKEND_BASE_URL}/api/banking/parties/${partyId}/loans?_=${Date.now()}`;
  console.log(`[Frontend API] Calling URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`[Frontend API] fetchLoans response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Frontend API] fetchLoans response data:`, data);
    return data;
  } catch (error) {
    console.error(`[Frontend API] fetchLoans error:`, error);
    throw error;
  }
};

/**
 * Fetch customer profile information
 * @param {string} partyId - The party/customer ID
 * @returns {Promise<Object>} - Customer profile object
 */
export const fetchProfile = async (partyId) => {
  console.log(`[Frontend API] fetchProfile called with partyId: ${partyId}`);
  const url = `${BACKEND_BASE_URL}/api/banking/parties/${partyId}?_=${Date.now()}`;
  console.log(`[Frontend API] Calling URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`[Frontend API] fetchProfile response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Frontend API] fetchProfile response data:`, data);
    return data;
  } catch (error) {
    console.error(`[Frontend API] fetchProfile error:`, error);
    throw error;
  }
};

/**
 * Fetch transactions for a specific account
 * @param {string} accountId - The account ID
 * @param {string} partyId - The party/customer ID
 * @returns {Promise<Array>} - Array of transaction objects
 */
export const fetchTransactions = async (accountId, partyId) => {
  console.log(`[Frontend API] fetchTransactions called with accountId: ${accountId}, partyId: ${partyId}`);
  const url = `${BACKEND_BASE_URL}/api/banking/accounts/${accountId}/transactions?partyId=${partyId}&_=${Date.now()}`;
  console.log(`[Frontend API] Calling URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`[Frontend API] fetchTransactions response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Frontend API] fetchTransactions response data:`, data);
    return data;
  } catch (error) {
    console.error(`[Frontend API] fetchTransactions error:`, error);
    throw error;
  }
};

/**
 * Fetch detailed information for a specific loan
 * @param {string} loanId - The loan ID
 * @returns {Promise<Object>} - Loan details object
 */
export const fetchLoanDetails = async (loanId) => {
  console.log(`[Frontend API] fetchLoanDetails called with loanId: ${loanId}`);
  const url = `${BACKEND_BASE_URL}/api/banking/loans/${loanId}`;
  console.log(`[Frontend API] Calling URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`[Frontend API] fetchLoanDetails response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Frontend API] fetchLoanDetails response data:`, data);
    return data;
  } catch (error) {
    console.error(`[Frontend API] fetchLoanDetails error:`, error);
    throw error;
  }
};

/**
 * Fetch payment schedule for a specific loan
 * @param {string} loanId - The loan ID
 * @returns {Promise<Object>} - Loan schedule object
 */
export const fetchLoanSchedule = async (loanId) => {
  console.log(`[Frontend API] fetchLoanSchedule called with loanId: ${loanId}`);
  const url = `${BACKEND_BASE_URL}/api/banking/loans/${loanId}/schedule`;
  console.log(`[Frontend API] Calling URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-Client-Type': 'mobile'
      }
    });
    console.log(`[Frontend API] fetchLoanSchedule response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Frontend API] fetchLoanSchedule response data:`, data);
    return data;
  } catch (error) {
    console.error(`[Frontend API] fetchLoanSchedule error:`, error);
    throw error;
  }
};

/**
 * Submit a money transfer request
 * @param {Object} transferData - Transfer details
 * @param {string} transferData.from_account - Source account
 * @param {string} transferData.to_account - Destination account
 * @param {number} transferData.amount - Transfer amount
 * @param {string} transferData.description - Transfer description
 * @returns {Promise<Object>} - Transfer result
 */
export const submitTransfer = async (transferData) => {
  const debitPayload = {
    paymentTransactionReference: `TRF_${Date.now()}`,
    paymentReservationReference: `TRF_${Date.now()}`,
    paymentValueDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    debitAccount: transferData.from_account,
    debitCurrency: "USD",
    paymentAmount: transferData.amount.toString(),
    paymentDescription: `Transfer to ${transferData.to_account}`
  };
  
  return apiRequest('/api/proxy/deposits/payments/debitAccount', {
    method: 'POST',
    body: JSON.stringify(debitPayload),
  });
};

/**
 * Check API health status
 * @returns {Promise<Object>} - Health status
 */
export const checkApiHealth = async () => {
  return apiRequest('/api/health');
};

// Utility functions for data formatting

/**
 * Format currency amount
 * @param {number|string} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency} 0.00`;
  }
  
  const numAmount = parseFloat(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

/**
 * Format date string
 * @param {string} dateString - Date string to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    let date;
    if (dateString.includes('-')) {
      date = new Date(dateString);
    } else if (dateString.length === 8) {
      // Handle YYYYMMDD format
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      date = new Date(`${year}-${month}-${day}`);
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'N/A';
  }
};

/**
 * Validate account number format
 * @param {string} accountNumber - Account number to validate
 * @returns {boolean} - True if valid
 */
export const validateAccountNumber = (accountNumber) => {
  if (!accountNumber || typeof accountNumber !== 'string') {
    return false;
  }
  
  // Basic validation - adjust regex based on your bank's account number format
  const accountRegex = /^[0-9]{8,20}$/;
  return accountRegex.test(accountNumber.replace(/\s/g, ''));
};

/**
 * Validate transfer amount
 * @param {number|string} amount - Amount to validate
 * @returns {Object} - Validation result with isValid and message
 */
export const validateTransferAmount = (amount) => {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount)) {
    return { isValid: false, message: 'Please enter a valid amount' };
  }
  
  if (numAmount <= 0) {
    return { isValid: false, message: 'Amount must be greater than zero' };
  }
  
  if (numAmount > 1000000) {
    return { isValid: false, message: 'Amount exceeds maximum limit' };
  }
  
  return { isValid: true, message: '' };
};

// Default export object with all functions
const apiService = {
  fetchAccounts,
  fetchLoans,
  fetchProfile,
  fetchTransactions,
  fetchLoanDetails,
  fetchLoanSchedule,
  submitTransfer,
  checkApiHealth,
  formatCurrency,
  formatDate,
  validateAccountNumber,
  validateTransferAmount,
};

export default apiService; 