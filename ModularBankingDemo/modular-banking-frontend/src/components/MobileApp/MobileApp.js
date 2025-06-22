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

const MobileApp = () => {
  // State management
  const [partyId, setPartyId] = useState('TEST123');
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

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    fromAccount: '',
    toAccount: '',
    amount: '',
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

      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setLoans(Array.isArray(loansData) ? loansData : []);
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
    document.documentElement.style.setProperty('--temenos-primary', '#5CB8B2');
    document.documentElement.style.setProperty('--temenos-secondary', '#8246AF');
    document.documentElement.style.setProperty('--temenos-accent', '#283275');
    document.documentElement.style.setProperty('--brand-primary', '#5CB8B2');
    document.documentElement.style.setProperty('--brand-secondary', '#8246AF');
    document.documentElement.style.setProperty('--brand-accent', '#283275');
  }, []);

  // Navigation handlers
  const handleNavigation = (screen) => {
    setActiveScreen(screen);
    setError('');
    setSuccess('');
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
      const transactionData = await fetchTransactions(accountId);
      setTransactions(transactionData);
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
      const [details, schedule] = await Promise.all([
        fetchLoanDetails(loanId),
        fetchLoanSchedule(loanId)
      ]);
      setLoanDetails(details);
      setLoanSchedule(schedule);
      setSelectedLoan(loanId);
      setActiveScreen('loanDetails');
    } catch (err) {
      setError('Failed to load loan details');
      console.error('Error loading loan details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Form handlers
  const handlePartyIdSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newPartyId = formData.get('partyId');
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

    setLoading(true);
    setError('');
    
    try {
      await submitTransfer({
        fromAccount: transferForm.fromAccount,
        toAccount: transferForm.toAccount,
        amount: parseFloat(transferForm.amount),
        description: transferForm.description
      });
      
      setSuccess('Transfer completed successfully!');
      setTransferForm({ fromAccount: '', toAccount: '', amount: '', description: '' });
      
      // Refresh account data
      loadInitialData();
    } catch (err) {
      setError('Transfer failed. Please try again.');
      console.error('Transfer error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Render different screens
  const renderHomeScreen = () => (
    <div className="screen home-screen" data-testid="home-screen">
      <div className="party-id-section">
        <form className="party-id-form" onSubmit={handlePartyIdSubmit}>
          <div className="form-group inline">
            <label htmlFor="partyId">Party ID</label>
            <input
              type="text"
              id="partyId"
              name="partyId"
              defaultValue={partyId}
              placeholder="Enter Party ID"
            />
            <button type="submit" className="btn btn-secondary">Apply</button>
          </div>
        </form>
      </div>

      <div className="accounts-section" data-testid="accounts-section">
        <h3>Accounts</h3>
        <div className="cards-container">
          {accounts.length > 0 ? (
            accounts.map((account) => (
              <div key={account.id} className="account-card">
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
                      onClick={() => showTransactions(account.id)}
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
              <div key={loan.id} className="account-card">
                <div className="card-header">
                  <h4>{loan.productName}</h4>
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
                      onClick={() => showLoanDetails(loan.id)}
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
                  <span className="value">{profile.displayName}</span>
                </div>
                <div className="info-item">
                  <span className="label">Party ID</span>
                  <span className="value">{profile.partyId}</span>
                </div>
                <div className="info-item">
                  <span className="label">Customer Since</span>
                  <span className="value">{formatDate(profile.customerSince)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="placeholder-card">
            <p>Click "Load Profile" to view profile information</p>
            <button 
              className="btn btn-primary"
              onClick={loadProfile}
              disabled={loading}
            >
              Load Profile
            </button>
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
        <form className="transfer-form" onSubmit={handleTransferSubmit}>
          <div className="form-group">
            <label htmlFor="fromAccount">From Account</label>
            <select
              id="fromAccount"
              value={transferForm.fromAccount}
              onChange={(e) => setTransferForm({...transferForm, fromAccount: e.target.value})}
              required
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName} - {formatCurrency(account.availableBalance)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="toAccount">To Account</label>
            <input
              type="text"
              id="toAccount"
              value={transferForm.toAccount}
              onChange={(e) => setTransferForm({...transferForm, toAccount: e.target.value})}
              placeholder="Enter account number"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input
              type="number"
              id="amount"
              value={transferForm.amount}
              onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              max="1000000"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <input
              type="text"
              id="description"
              value={transferForm.description}
              onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
              placeholder="Transfer description"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || !transferForm.fromAccount || !transferForm.toAccount || !transferForm.amount}
          >
            {loading ? 'Processing...' : 'Transfer Money'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="mobile-app-container responsive-mobile" data-testid="mobile-app-container" style={{ maxWidth: '390px' }}>
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
        </div>
      </header>

      <main className="mobile-main" role="main">
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
    </div>
  );
};

export default MobileApp;
