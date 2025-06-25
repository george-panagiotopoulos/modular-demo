import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAccounts,
  fetchLoans,
  fetchProfile,
  fetchTransactions,
  fetchLoanDetails,
  fetchLoanSchedule,
  submitTransfer,
  formatCurrency,
  formatDate,
  validateTransferAmount
} from '../../services/apiService';
import './MobileApp.css';

// Helper function to transform technical product names to user-friendly labels
const getProductDisplayName = (productName) => {
  const productMappings = {
    'MORTGAGE.PRODUCT': 'Mortgage Loan',
    'GS.CONSUMER.LOAN': 'Consumer Loan'
  };
  
  return productMappings[productName] || productName;
};

const MobileApp = () => {
  // State management
  const [partyId, setPartyId] = useState('2517636814');
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loanDetails, setLoanDetails] = useState(null);
  const [loanSchedule, setLoanSchedule] = useState([]);
  const [activeScreen, setActiveScreen] = useState('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    fromAccount: '',
    toAccount: 'ACC002',
    amount: '100',
    description: ''
  });

  // Load initial data when partyId changes
  const loadInitialData = useCallback(async () => {
    if (!partyId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const accountsPromise = Promise.resolve(fetchAccounts(partyId))
        .catch(err => {
          console.error('Failed to fetch accounts:', err);
          throw err; // Re-throw to trigger the main catch block
        });

      const loansPromise = Promise.resolve(fetchLoans(partyId))
        .catch(err => {
          console.error('Failed to fetch loans:', err);
          throw err; // Re-throw to trigger the main catch block
        });

      const [accountsData, loansData] = await Promise.all([
        accountsPromise,
        loansPromise
      ]);

      // Handle the new API response format with success/data structure
      const accounts = accountsData?.data || accountsData || [];
      const loans = loansData?.data || loansData || [];
      
      console.log(`[MobileApp] Processing accounts data:`, accounts);
      console.log(`[MobileApp] Processing loans data:`, loans);

      setAccounts(Array.isArray(accounts) ? accounts : []);
      setLoans(Array.isArray(loans) ? loans : []);
    } catch (err) {
      setError('API Error: Failed to load banking data. Please try again.');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Set CSS custom properties for branding
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--temenos-primary', '#5CB8B2');
    root.style.setProperty('--temenos-secondary', '#8246AF');
    root.style.setProperty('--temenos-accent', '#283275');
    root.style.setProperty('--brand-primary', '#5CB8B2');
    root.style.setProperty('--brand-secondary', '#8246AF');
    root.style.setProperty('--brand-accent', '#283275');
  }, []);

  // Set CSS custom properties immediately for tests
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--temenos-primary', '#5CB8B2');
    root.style.setProperty('--temenos-secondary', '#8246AF');
    root.style.setProperty('--temenos-accent', '#283275');
    root.style.setProperty('--brand-primary', '#5CB8B2');
    root.style.setProperty('--brand-secondary', '#8246AF');
    root.style.setProperty('--brand-accent', '#283275');
  }

  // Navigation handlers
  const handleNavigation = (screen) => {
    setActiveScreen(screen);
    setError('');
    setSuccess('');
    
    // Auto-load profile when navigating to profile tab
    if (screen === 'profile' && !profile) {
      loadProfile();
    }
  };

  // Data loading functions
  const loadProfile = async () => {
    if (!partyId) return;
    
    setLoading(true);
    try {
      const profileData = await fetchProfile(partyId);
      setProfile(profileData);
    } catch (err) {
      setError('Failed to load profile data');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const showTransactions = async (accountId) => {
    setLoading(true);
    try {
      const transactionData = await fetchTransactions(accountId, partyId);
      setTransactions(transactionData.transactions || []);
      setSelectedAccount(accountId);
      setActiveScreen('transactions');
    } catch (err) {
      setError('Failed to load transactions');
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const showLoanDetails = async (loanId) => {
    setLoading(true);
    try {
      console.log(`[MobileApp] Fetching loan details for loanId: ${loanId}`);
      const details = await fetchLoanDetails(loanId);
      console.log(`[MobileApp] Received loan details:`, details);
      setLoanDetails(details);
      setSelectedLoan(loanId);
      setActiveScreen('loanDetails');
    } catch (err) {
      setError('Failed to load loan details. The upstream API may be unavailable.');
      console.error('Error loading loan details:', err);
    } finally {
      setLoading(false);
    }
  };

  const showLoanSchedule = async (loanId) => {
    setLoading(true);
    try {
      console.log(`[MobileApp] Fetching loan schedule for loanId: ${loanId}`);
      const schedule = await fetchLoanSchedule(loanId);
      console.log(`[MobileApp] Received loan schedule:`, schedule);
      setLoanSchedule(schedule);
      setSelectedLoan(loanId);
      setActiveScreen('loanSchedule');
    } catch (err) {
      setError('Failed to load loan schedule. The upstream API may be unavailable.');
      console.error('Error loading loan schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  // Form handlers
  const handlePartyIdChange = (e) => {
    const newPartyId = e.target.value;
    setPartyId(newPartyId);
    // Autosave functionality
    if (newPartyId) {
      window.localStorage.setItem('currentPartyId', newPartyId);
    }
    
    // Validation
    if (!newPartyId) {
      setValidationErrors(prev => ({ ...prev, partyId: 'Party ID is required' }));
    } else if (!/^[A-Z0-9]+$/.test(newPartyId)) {
      setValidationErrors(prev => ({ ...prev, partyId: 'Please enter a valid Party ID' }));
    } else {
      setValidationErrors(prev => ({ ...prev, partyId: null }));
    }
  };

  const handlePartyIdSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newPartyId = formData.get('partyId');
    
    // Trigger validation
    if (!newPartyId) {
      setValidationErrors(prev => ({ ...prev, partyId: 'Party ID is required' }));
      return;
    } else if (!/^[A-Z0-9]+$/.test(newPartyId)) {
      setValidationErrors(prev => ({ ...prev, partyId: 'Please enter a valid Party ID' }));
      return;
    } else {
      setValidationErrors(prev => ({ ...prev, partyId: null }));
    }
    
    if (newPartyId && newPartyId !== partyId) {
      // Store in localStorage as expected by tests
      window.localStorage.setItem('currentPartyId', newPartyId);
      setPartyId(newPartyId);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    
    const validation = validateTransferAmount(transferForm.amount);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    // Check if amount is large and requires confirmation
    if (parseFloat(transferForm.amount) > 5000) {
      setPendingTransfer(transferForm);
      setShowConfirmation(true);
      return;
    }

    await executeTransfer(transferForm);
  };

  const executeTransfer = async (transferData) => {
    setTransferLoading(true);
    setError('');
    setShowConfirmation(false);
    setPendingTransfer(null);
    
    try {
      const result = await submitTransfer(transferData);
      setSuccess('Transfer successful! Your transaction has been processed.');
      setTransferForm({ fromAccount: '', toAccount: '', amount: '', description: '' });
      
      // Reload accounts to reflect the transfer
      setTimeout(() => {
        loadInitialData();
      }, 1000);
    } catch (err) {
      setError('Transfer failed. Please try again.');
      console.error('Transfer error:', err);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleTransferFormChange = (field, value) => {
    setTransferForm(prev => ({ ...prev, [field]: value }));
  };

  // Render functions
  const renderHomeScreen = () => (
    <div className="screen home-screen" data-testid="home-screen">
      <div className="accounts-section" data-testid="accounts-section">
        <h3>Accounts</h3>
        <div className="cards-container">
          {accounts.length > 0 ? (
            accounts.map((account) => (
              <div key={account.accountId || account.id} className="account-card">
                <div className="card-header">
                  <h4>{account.displayName}</h4>
                  <span className="account-type">{account.productName}</span>
                </div>
                <div className="card-body">
                  <div className="balance-info">
                    <div className="balance-item">
                      <span className="label">Available Balance</span>
                      <span className="amount primary">{formatCurrency(account.availableBalance)}</span>
                    </div>
                    <div className="balance-item">
                      <span className="label">Current Balance</span>
                      <span className="amount">{formatCurrency(account.currentBalance)}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button 
                      className="btn btn-outline"
                      onClick={() => showTransactions(account.accountId || account.id)}
                    >
                      View Transactions
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="placeholder-card">
              <p>No accounts found for this Party ID</p>
            </div>
          )}
        </div>
      </div>

      <div className="loans-section" data-testid="loans-section">
        <h3>Loans</h3>
        <div className="cards-container">
          {loans.length > 0 ? (
            loans.map((loan) => (
              <div key={loan.loanId || loan.id} className="account-card">
                <div className="card-header">
                  <h4>{getProductDisplayName(loan.productName)}</h4>
                  <span className="account-type">Loan Account</span>
                </div>
                <div className="card-body">
                  <div className="balance-info">
                    <div className="balance-item">
                      <span className="label">Outstanding Balance</span>
                      <span className="amount">{formatCurrency(loan.outstandingBalance)}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button 
                      className="btn btn-outline"
                      onClick={() => showLoanDetails(loan.loanId || loan.id)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="placeholder-card">
              <p>No loans found for this Party ID</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderProfileScreen = () => (
    <div className="screen profile-screen" data-testid="profile-screen">
      <div className="screen-header">
        <h2>Profile</h2>
      </div>
      <div className="screen-content">
        {profile ? (
          <div className="profile-info">
            <div className="profile-section">
              <h3>Personal Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Name</span>
                  <span className="value">{profile.firstName} {profile.lastName}</span>
                </div>
                <div className="info-item">
                  <span className="label">Customer ID</span>
                  <span className="value">{profile.customerId}</span>
                </div>
                <div className="info-item">
                  <span className="label">Date of Birth</span>
                  <span className="value">{profile.dateOfBirth}</span>
                </div>
                <div className="info-item">
                  <span className="label">Email</span>
                  <span className="value">{profile.email || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Mobile</span>
                  <span className="value">{profile.mobilePhone || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Nationality</span>
                  <span className="value">{profile.nationality || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">City of Birth</span>
                  <span className="value">{profile.cityOfBirth || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Address</span>
                  <span className="value">{profile.address || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="placeholder-card">
            <p>Loading profile information...</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTransactionsScreen = () => (
    <div className="screen transactions-screen" data-testid="transactions-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => handleNavigation('home')}>‹ Back</button>
        <h2>Transactions</h2>
      </div>
      <div className="screen-content">
        <div className="transaction-list">
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.transactionId} className="transaction-item">
                <div className="transaction-details">
                  <span className="description">{tx.description}</span>
                  <span className="date">{formatDate(tx.date)}</span>
                </div>
                <div className={`amount ${tx.type === 'DEBIT' ? 'debit' : 'credit'}`}>
                  {formatCurrency(tx.amount)}
                </div>
              </div>
            ))
          ) : (
            <div className="placeholder-card">
              <p>No transactions found for this account.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLoanDetailsScreen = () => (
    <div className="screen loan-details-screen" data-testid="loan-details-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => handleNavigation('home')}>‹ Back</button>
        <h2>Loan Details</h2>
      </div>
      <div className="screen-content">
        {loanDetails ? (
          <div className="details-card">
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Arrangement ID</span>
                <span className="value">{loanDetails.arrangementId || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Product</span>
                <span className="value">{loanDetails.productDescription || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Outstanding Balance</span>
                <span className="value">{loanDetails.outstandingBalance ? formatCurrency(loanDetails.outstandingBalance) : 'USD 0.00'}</span>
              </div>
              <div className="info-item">
                <span className="label">Interest Rate</span>
                <span className="value">{loanDetails.interestRate ? `${loanDetails.interestRate}%` : 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Next Payment Date</span>
                <span className="value">{loanDetails.nextPaymentDate ? formatDate(loanDetails.nextPaymentDate) : 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Next Payment Amount</span>
                <span className="value">{loanDetails.nextPaymentAmount ? formatCurrency(loanDetails.nextPaymentAmount) : 'USD 0.00'}</span>
              </div>
            </div>
            <div className="card-actions">
              <button 
                className="btn btn-primary"
                onClick={() => showLoanSchedule(selectedLoan)}
              >
                View Payment Schedule
              </button>
            </div>
          </div>
        ) : (
          <div className="placeholder-card">
            <p>Loading loan details...</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderLoanScheduleScreen = () => (
    <div className="screen loan-schedule-screen" data-testid="loan-schedule-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => handleNavigation('loanDetails')}>‹ Back</button>
        <h2>Payment Schedule</h2>
      </div>
      <div className="screen-content">
        {loanSchedule.length > 0 ? (
          <div className="schedule-container">
            <div className="schedule-table">
              {/* Header Row */}
              <div className="schedule-row schedule-header">
                <div className="payment-date">Due Date</div>
                <div className="payment-amount">Amount</div>
                <div className="payment-status">Status</div>
              </div>
              {/* Payment Rows */}
              {loanSchedule.map((payment, index) => (
                <div key={index} className="schedule-row">
                  <div className="payment-date">{payment.dueDate ? formatDate(payment.dueDate) : 'N/A'}</div>
                  <div className="payment-amount">{payment.amount ? formatCurrency(payment.amount) : 'USD 0.00'}</div>
                  <div className={`payment-status ${(payment.status ? payment.status.toLowerCase() : 'unknown')}`}>
                    {payment.status || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="placeholder-card">
            <p>No payment schedule available.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTransferScreen = () => (
    <div className="screen transfer-screen" data-testid="transfer-screen">
      <div className="screen-header">
        <h2>Transfer Money</h2>
      </div>
      <div className="screen-content">
        <div className="transfer-form">
          <form onSubmit={handleTransferSubmit}>
            <div className="form-group">
              <label htmlFor="fromAccount">From Account</label>
              <select
                id="fromAccount"
                value={transferForm.fromAccount}
                onChange={(e) => handleTransferFormChange('fromAccount', e.target.value)}
                required
                aria-label="From Account"
              >
                <option value="">Select an account</option>
                {accounts.map((account) => (
                  <option key={account.accountId || account.id} value={account.accountId || account.id}>
                    {account.displayName} - {formatCurrency(account.availableBalance)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="toAccount">To Account (Stub ID)</label>
              <input
                type="text"
                id="toAccount"
                value={transferForm.toAccount}
                onChange={(e) => handleTransferFormChange('toAccount', e.target.value)}
                required
                aria-label="To Account"
              />
            </div>

            <div className="form-group">
              <label htmlFor="amount">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                id="amount"
                value={transferForm.amount}
                onChange={(e) => handleTransferFormChange('amount', e.target.value)}
                required
                aria-label="Amount"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={transferLoading || !transferForm.fromAccount || !transferForm.toAccount || !transferForm.amount}
            >
              {transferLoading ? 'Processing...' : 'Transfer Money'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderConfirmationDialog = () => {
    if (!showConfirmation || !pendingTransfer) return null;

    return (
      <div className="confirmation-overlay">
        <div className="confirmation-dialog">
          <h3>Confirm Transfer</h3>
          <p>You are about to transfer <strong>{formatCurrency(pendingTransfer.amount)}</strong> from your account.</p>
          <p>This is a large amount. Are you sure you want to proceed?</p>
          <div className="confirmation-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => setShowConfirmation(false)}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => executeTransfer(pendingTransfer)}
            >
              Confirm Transfer
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mobile-app-wrapper">
      {/* Party ID Section - Outside Mobile App */}
      <div className="party-id-section-external">
        <form className="party-id-form" onSubmit={handlePartyIdSubmit}>
          <div className="form-group inline">
            <label htmlFor="partyId">Party ID</label>
            <input
              type="text"
              id="partyId"
              name="partyId"
              value={partyId}
              onChange={handlePartyIdChange}
              placeholder="Enter Party ID"
              aria-describedby={validationErrors.partyId ? "partyId-error" : undefined}
              aria-label="Party ID"
            />
            <button type="submit" className="btn btn-secondary">Apply</button>
          </div>
          {validationErrors.partyId && (
            <div id="partyId-error" className="error-text" role="alert">
              {validationErrors.partyId}
            </div>
          )}
        </form>
      </div>

      <div className="mobile-app-container responsive-mobile" data-testid="mobile-app-container" style={{ maxWidth: '450px', width: '100%' }}>
        {/* Skip Navigation Link for Accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {loading && (
          <div className="loading-overlay" data-testid="loading-spinner">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        )}
        
        <header className="mobile-header" role="banner">
          <div className="header-content">
            <div className="logo">
              <span className="logo-text">Temenos</span>
            </div>
            <div className="header-title">
              <h1>Mobile Banking</h1>
            </div>
            <div className="security-indicator">
              <span className="secure-badge" title="Secure Connection">🔒 Secure</span>
            </div>
          </div>
        </header>

        <main className="mobile-main" role="main" id="main-content">
          {error && (
            <div className="error-message" role="alert">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
              <button 
                className="error-dismiss" 
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="success-message" role="alert">
              <span className="success-icon">✅</span>
              <span>{success}</span>
              <button 
                onClick={() => setSuccess('')}
                aria-label="Dismiss success message"
              >
                ×
              </button>
            </div>
          )}

          {activeScreen === 'home' && renderHomeScreen()}
          {activeScreen === 'profile' && renderProfileScreen()}
          {activeScreen === 'transfer' && renderTransferScreen()}
          {activeScreen === 'transactions' && renderTransactionsScreen()}
          {activeScreen === 'loanDetails' && renderLoanDetailsScreen()}
          {activeScreen === 'loanSchedule' && renderLoanScheduleScreen()}
        </main>

        <nav className="mobile-navigation" role="navigation">
          <button 
            className={`nav-button ${activeScreen === 'home' ? 'active' : ''}`}
            onClick={() => handleNavigation('home')}
            aria-label="Home"
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Home</span>
          </button>
          <button 
            className={`nav-button ${activeScreen === 'transfer' ? 'active' : ''}`}
            onClick={() => handleNavigation('transfer')}
            aria-label="Transfer"
          >
            <span className="nav-icon">💸</span>
            <span className="nav-label">Transfer</span>
          </button>
          <button 
            className={`nav-button ${activeScreen === 'profile' ? 'active' : ''}`}
            onClick={() => handleNavigation('profile')}
            aria-label="Profile"
          >
            <span className="nav-icon">👤</span>
            <span className="nav-label">Profile</span>
          </button>
        </nav>

        {/* Privacy Notice */}
        <div className="privacy-notice">
          <small>Your data is protected. View our <a href="#" className="privacy-link">Privacy Policy</a></small>
        </div>

        {/* Confirmation Dialog */}
        {renderConfirmationDialog()}
      </div>
    </div>
  );
};

export default MobileApp;
