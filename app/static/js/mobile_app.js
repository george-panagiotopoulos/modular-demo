console.log('[MobileAppModule] Script loaded and executing...');

const MobileAppModule = {
    // Private properties
    _accountsData: [],
    _loansData: [],
    _partyId: null,
    _staticListenersAdded: false,
    _domElements: null,
    _domReady: false,
    _pollIntervalId: null,
    _isActivating: false,

    // Key element IDs to check for DOM readiness - updated to match actual HTML
    _KEY_ELEMENT_IDS: [
        'accounts-list', 'loans-list', 'transactions-section', 'profile-section', 
        'loan-schedule-section', 'transfer-section', 'party-id-input',
        'accounts-section', 'loans-section', // Main view containers that actually exist
        'home-button', 'show-profile-button', 'show-transfer-button' // Navigation elements
    ],

    // --- Logging ---
    _log(message, type = 'info', data = null) {
        const SCRIPT_NAME = 'MobileAppModule';
        const style = type === 'error' ? 'color: red;' : (type === 'warn' ? 'color: orange;' : 'color: blue;');
        if (data) {
            console.log(`%c[${SCRIPT_NAME}] ${message}`, style, data);
    } else {
            console.log(`%c[${SCRIPT_NAME}] ${message}`, style);
        }
    },

    // --- Private Helper Methods (moved from global scope) ---
    _formatCurrency(amount, currency = 'USD') {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return 'N/A';
        }
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(amount);
    },

    _formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            let date;
            if (dateString.includes('-')) {
                date = new Date(dateString);
            } else if (dateString.length === 8) {
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                date = new Date(`${year}-${month}-${day}`);
            } else {
                date = new Date(dateString);
            }
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (error) {
            this._log(`Error formatting date: ${dateString}`, 'error', error);
            return 'N/A';
        }
    },
    
    // --- DOM Element Access ---
    _getElements() {
        this._domElements = {
            accountsListDiv: document.getElementById('accounts-list'),
            loansListDiv: document.getElementById('loans-list'),
            loansSectionDiv: document.getElementById('loans-section'),
            transactionsSection: document.getElementById('transactions-section'),
            transactionsListDiv: document.getElementById('transactions-list'),
            transactionsTitle: document.getElementById('transactions-title'),
            backToAccountsButton: document.getElementById('back-to-accounts'),
            accountsSectionDiv: document.getElementById('accounts-section'),
            loanScheduleSection: document.getElementById('loan-schedule-section'),
            loanScheduleList: document.getElementById('loan-schedule-list'),
            loanScheduleInfo: document.getElementById('loan-schedule-info'),
            loanScheduleTitle: document.getElementById('loan-schedule-title'),
            backToLoansButton: document.getElementById('back-to-loans'),
            transferSection: document.getElementById('transfer-section'),
            showTransferButton: document.getElementById('show-transfer-button'),
            closeTransferButton: document.getElementById('close-transfer'),
            transferForm: document.getElementById('transfer-form'),
            fromAccountSelect: document.getElementById('from-account'),
            transferResultDiv: document.getElementById('transfer-result'),
            partyIdInput: document.getElementById('party-id-input'),
            changePartyIdButton: document.getElementById('change-party-id'),
            profileContent: document.getElementById('profile-content'),
            profileSection: document.getElementById('profile-section'),
            loanDetailsInfo: document.getElementById('loan-details-info'),
            // Navigation elements
            homeButton: document.getElementById('home-button'),
            showProfileButton: document.getElementById('show-profile-button')
        };
        
        // Check for critical elements
        if (!this._domElements.accountsListDiv || !this._domElements.homeButton) {
            this._log('Critical elements accountsListDiv or homeButton not found even after getElements.', 'error');
        }
        return this._domElements;
    },

    // --- Core View Logic ---
    _showHome() {
        this._log('Showing home view...');
        if (!this._domReady || !this._domElements) {
            this._log('DOM not ready or elements not fetched in _showHome. Aborting.', 'warn');
            return;
        }
        
        // Hide other sections
        this._domElements.profileSection?.classList.add('hidden');
        this._domElements.transactionsSection?.classList.add('hidden');
        this._domElements.loanScheduleSection?.classList.add('hidden');
        this._domElements.transferSection?.classList.add('hidden');
        
        // Show home sections
        this._domElements.accountsSectionDiv?.classList.remove('hidden');
        this._domElements.loansSectionDiv?.classList.remove('hidden');

        // Update navigation highlights
        this._updateNavigation('home');
        
        this._log(`Showing home view with party ID: ${this._partyId}`);
        this._fetchAccounts();
        this._fetchLoans();
        this._updatePartyIdDisplay();
    },

    _showProfile() {
        this._log('Showing profile view...');
        if (!this._domReady || !this._domElements) {
            this._log('DOM not ready or elements not fetched in _showProfile. Aborting.', 'warn');
            return;
        }
        
        // Hide other sections
        this._domElements.accountsSectionDiv?.classList.add('hidden');
        this._domElements.loansSectionDiv?.classList.add('hidden');
        this._domElements.transactionsSection?.classList.add('hidden');
        this._domElements.loanScheduleSection?.classList.add('hidden');
        this._domElements.transferSection?.classList.add('hidden');
        
        // Show profile section
        this._domElements.profileSection?.classList.remove('hidden');

        // Update navigation highlights
        this._updateNavigation('profile');
        
        this._fetchProfile();
    },

    _showTransfer() {
        this._log('Showing transfer view...');
        if (!this._domReady || !this._domElements) {
            this._log('DOM not ready or elements not fetched in _showTransfer. Aborting.', 'warn');
            return;
        }
        
        // Show transfer section
        this._domElements.transferSection?.classList.remove('hidden');

        // Update navigation highlights
        this._updateNavigation('transfer');
    },

    _hideTransfer() {
        this._domElements.transferSection?.classList.add('hidden');
        this._domElements.transferResultDiv && (this._domElements.transferResultDiv.textContent = '');
        this._domElements.transferForm?.reset();
        this._updateNavigation('home');
    },

    _updateNavigation(activeTab) {
        // Reset all navigation buttons
        const navButtons = [this._domElements.homeButton, this._domElements.showTransferButton, this._domElements.showProfileButton];
        navButtons.forEach(btn => {
            if (btn) {
                btn.classList.remove('text-blue-600');
                btn.classList.add('text-gray-500');
            }
        });

        // Highlight active button
        let activeButton;
        switch(activeTab) {
            case 'home':
                activeButton = this._domElements.homeButton;
                break;
            case 'profile':
                activeButton = this._domElements.showProfileButton;
                break;
            case 'transfer':
                activeButton = this._domElements.showTransferButton;
                break;
        }
        
        if (activeButton) {
            activeButton.classList.remove('text-gray-500');
            activeButton.classList.add('text-blue-600');
        }
    },

    _updatePartyIdDisplay() {
        this._log(`Updating party ID display to: ${this._partyId}`);
        
        // Try multiple ways to get the party ID input
        let partyIdInput = this._domElements?.partyIdInput;
        if (!partyIdInput) {
            partyIdInput = document.getElementById('party-id-input');
        }
        
        if (partyIdInput) {
            partyIdInput.value = this._partyId;
            this._log(`Party ID input updated to: ${this._partyId}`);
        } else {
            this._log('Party ID input not found for display update', 'warn');
        }
    },

    // --- DOM Polling and Initialization ---
    _checkDOMReady() {
        for (const id of this._KEY_ELEMENT_IDS) {
            if (!document.getElementById(id)) {
                this._log(`Element ${id} not found yet...`, 'info');
                return false;
            }
        }
        this._log('All key DOM elements found!', 'success');
        return true;
    },

    _initializeMobileAppView() {
        this._log('Initializing Mobile App View (DOM is ready)...');
        this._domReady = true;
        this._getElements();

        if (!this._domElements || !this._domElements.accountsListDiv || !this._domElements.homeButton) {
            this._log('Critical DOM elements NOT FOUND after DOM ready confirmation.', 'error', this._domElements);
            return;
        }
        
        this._addStaticListeners();
        this._showHome();
    },

    _waitForMobileAppDOM() {
        if (this._domReady && this._isActivating) {
            this._log('_waitForMobileAppDOM: DOM already ready and still activating.', 'info');
            this._initializeMobileAppView();
            return;
        }
        if (!this._isActivating) {
             this._log('_waitForMobileAppDOM: Not activating. Aborting DOM poll.', 'warn');
             if (this._pollIntervalId) clearInterval(this._pollIntervalId);
             this._pollIntervalId = null;
             return;
        }
        
        this._log('_waitForMobileAppDOM: Starting to poll for DOM elements...');

        if (this._pollIntervalId) {
            clearInterval(this._pollIntervalId);
        }

        let pollCount = 0;
        const maxPolls = 80; // Increased from 40 to 80 (20 seconds)
        const pollInterval = 250; // 250ms intervals

        this._pollIntervalId = setInterval(() => {
            if (!this._isActivating) {
                clearInterval(this._pollIntervalId);
                this._pollIntervalId = null;
                this._log('Polling stopped: Tab deactivated during DOM check.', 'warn');
                return;
            }
            
            pollCount++;
            this._log(`DOM check attempt ${pollCount}/${maxPolls}`, 'info');
            
            if (this._checkDOMReady()) {
                clearInterval(this._pollIntervalId);
                this._pollIntervalId = null;
                this._domReady = true;
                this._log('DOM ready! Initializing mobile app view...', 'success');
                this._initializeMobileAppView();
            } else if (pollCount >= maxPolls) {
                clearInterval(this._pollIntervalId);
                this._pollIntervalId = null;
                if (!this._domReady) {
                    this._log('Failed to find all mobile app DOM elements after timeout.', 'error');
                    // Show error in the tab content area
                    const tabContentArea = document.getElementById('mobile-content-area') || document.getElementById('tab-content-area');
                    if (tabContentArea && this._isActivating) {
                        tabContentArea.innerHTML = '<div class="p-4 text-red-500">Error: Mobile app interface failed to load. Key elements missing.</div>';
                    }
                }
            }
        }, pollInterval);
    },

    // --- Event Listeners ---
    _addStaticListeners() {
        if (this._staticListenersAdded) {
            this._log('Static listeners already added, skipping...');
            return;
        }
        
        this._log('Adding static event listeners...');
        
        // Get fresh DOM elements to ensure they exist
        this._getElements();
        
        // Navigation listeners
        if (this._domElements.homeButton) {
            this._domElements.homeButton.addEventListener('click', () => {
                this._log('Home button clicked');
                this._showHome();
            });
            this._log('Home button listener added');
        } else {
            this._log('Home button not found in DOM', 'error');
        }
        
        if (this._domElements.showProfileButton) {
            this._domElements.showProfileButton.addEventListener('click', () => {
                this._log('Profile button clicked');
                this._showProfile();
            });
            this._log('Profile button listener added');
        } else {
            this._log('Profile button not found in DOM', 'error');
        }
        
        if (this._domElements.showTransferButton) {
            this._domElements.showTransferButton.addEventListener('click', () => {
                this._log('Transfer button clicked');
                this._showTransfer();
            });
            this._log('Transfer button listener added');
        }
        
        if (this._domElements.closeTransferButton) {
            this._domElements.closeTransferButton.addEventListener('click', () => {
                this._log('Close transfer button clicked');
                this._hideTransfer();
            });
            this._log('Close transfer button listener added');
        }
        
        // Party ID change listener - this is the apply button
        if (this._domElements.changePartyIdButton) {
            this._domElements.changePartyIdButton.addEventListener('click', () => {
                this._log('Apply button clicked!');
                this._handlePartyIdChange();
            });
            this._log('Apply button (change party ID) listener added successfully');
        } else {
            this._log('Apply button (change party ID) not found in DOM elements', 'error');
            // Try to find it directly
            const applyBtn = document.getElementById('change-party-id');
            if (applyBtn) {
                this._log('Found apply button directly, adding listener');
                applyBtn.addEventListener('click', () => {
                    this._log('Apply button clicked (direct)!');
                    this._handlePartyIdChange();
                });
            } else {
                this._log('Apply button not found even with direct search', 'error');
            }
        }
        
        if (this._domElements.partyIdInput) {
            this._domElements.partyIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._log('Enter key pressed in party ID input');
                    this._handlePartyIdChange();
                }
            });
            this._log('Party ID input keypress listener added');
        } else {
            this._log('Party ID input not found in DOM elements', 'error');
            // Try to find it directly
            const partyInput = document.getElementById('party-id-input');
            if (partyInput) {
                this._log('Found party ID input directly, adding listener');
                partyInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this._log('Enter key pressed in party ID input (direct)');
                        this._handlePartyIdChange();
                    }
                });
            }
        }

        // Transfer form listener
        if (this._domElements.transferForm) {
            this._domElements.transferForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = {
                    from_account: e.target.elements.from_account.value,
                    to_account: e.target.elements.to_account.value,
                    amount: parseFloat(e.target.elements.amount.value)
                };
                this._submitTransfer(formData);
            });
            this._log('Transfer form listener added');
        }
        
        // Hide back buttons since we're using home button instead
        if (this._domElements.backToAccountsButton) {
            this._domElements.backToAccountsButton.style.display = 'none';
        }
        if (this._domElements.backToLoansButton) {
            this._domElements.backToLoansButton.style.display = 'none';
        }
        
        this._staticListenersAdded = true;
        this._log('All static listeners added successfully');
    },

    // --- API Functions ---
    async _fetchAccounts() {
        this._log("Fetching accounts for party ID:", this._partyId);
        if (!this._domElements.accountsListDiv) return;
        
        if (!this._partyId || this._partyId.trim() === "") {
            this._domElements.accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Please enter a Party ID above to load accounts.</div>';
            this._accountsData = [];
            return;
        }
        
        try {
            this._domElements.accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading accounts...</div>';
            
            const apiUrl = `/api/parties/${this._partyId}/accounts?_=${Date.now()}`;
            this._log("Fetching accounts from unified API: " + apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const accounts = await response.json();
            this._log("Accounts received from unified API:", accounts);
            
            this._accountsData = accounts;
            this._renderAccounts(this._accountsData, this._domElements.accountsListDiv);
            this._populateFromAccountSelect(this._accountsData);

            // Update headless tab if available
            this._updateHeadlessTab();
            
        } catch (error) {
            this._log("Error fetching accounts:", 'error', error);
            this._domElements.accountsListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load accounts: ${error.message}</div>`;
        }
    },

    async _fetchLoans() {
        this._log("Fetching loans for party ID:", this._partyId);
        if (!this._domElements.loansListDiv) return;
        
        if (!this._partyId || this._partyId.trim() === "") {
            this._domElements.loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Please enter a Party ID above to load loans.</div>';
            this._loansData = [];
            return;
        }
        
        try {
            this._domElements.loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loans...</div>';
            
            const apiUrl = `/api/parties/${this._partyId}/loans?_=${Date.now()}`;
            this._log("Fetching loans from unified API: " + apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const loans = await response.json();
            this._log("Loans received from unified API:", loans);
            
            if (loans.length === 0) {
                this._domElements.loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No loans found for this customer.</div>';
                this._loansData = [];
                return;
            }
            
            this._loansData = loans;
            this._renderLoans(this._loansData, this._domElements.loansListDiv);

            // Update headless tab if available
            this._updateHeadlessTab();
            
        } catch (error) {
            this._log("Error fetching loans:", 'error', error);
            this._domElements.loansListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load loans: ${error.message}</div>`;
        }
    },

    async _fetchProfile() {
        this._log(`Attempting to fetch profile for party ID: ${this._partyId}`);
        if (!this._domElements.profileContent) return null;

        try {
            this._domElements.profileContent.innerHTML = '<div class="text-center text-gray-500 py-2">Loading profile...</div>';
            
            const apiUrl = `/api/parties/${this._partyId}?_=${Date.now()}`;
            this._log("Fetching profile from API:", apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const profileData = await response.json();
            this._log(`Profile data for ${this._partyId}:`, profileData);
            
            this._renderProfile(profileData, this._domElements.profileContent);
            return profileData;
        } catch (error) {
            this._log(`Error fetching profile for ${this._partyId}:`, 'error', error);
            this._domElements.profileContent.innerHTML = `<div class="text-center text-red-500 py-2">Could not load profile: ${error.message}</div>`;
            return null;
        }
    },

    // --- Rendering Functions ---
    _renderAccounts(accounts, targetDiv) {
        if (!targetDiv) return;
        if (!accounts || accounts.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No accounts found.</div>';
            return;
        }
        
        const currentAccounts = accounts.filter(account => account.type === 'current' || account.productLine === 'ACCOUNTS');
        const termDeposits = accounts.filter(account => account.type === 'deposit' || account.productLine === 'DEPOSITS');
        
        let html = '';
        
        if (currentAccounts.length > 0) {
            html += '<div class="mb-4">';
            html += '<h3 class="text-lg font-semibold text-gray-800 mb-3">Your Accounts</h3>';
            html += '<div class="space-y-3">';
            html += currentAccounts.map(account => this._renderAccountCard(account)).join('');
            html += '</div>';
            html += '</div>';
        }
        
        if (termDeposits.length > 0) {
            html += '<div class="mb-4">';
            html += '<h3 class="text-lg font-semibold text-gray-800 mb-3">Your Deposits</h3>';
            html += '<div class="space-y-3">';
            html += termDeposits.map(account => this._renderAccountCard(account)).join('');
            html += '</div>';
            html += '</div>';
        }
        
        targetDiv.innerHTML = html;
        this._addTransactionButtonListeners();
    },

    _renderAccountCard(account) {
        const balance = account.currentBalance || 0;
        const availableBalance = account.availableBalance || 0;
        const isDeposit = account.type === 'deposit' || account.productLine === 'DEPOSITS';
        const accountTypeLabel = isDeposit ? 'Term Deposit' : 'Current Account';
        
        let balanceClass;
        if (isDeposit) {
            balanceClass = 'text-green-600';
            } else {
            balanceClass = balance < 0 ? 'text-red-600' : 'text-green-600';
        }
        
        const formattedBalance = this._formatCurrency(Math.abs(balance), account.currency);
        const formattedAvailable = this._formatCurrency(availableBalance, account.currency);

        return `
            <div class="account-card bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow" data-account-id="${account.accountId}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-semibold text-gray-800">${account.displayName || accountTypeLabel}</h4>
                        <p class="text-sm text-gray-600">${account.accountId}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-semibold ${balanceClass}">${formattedBalance}</div>
                        <div class="text-xs text-gray-500">${isDeposit ? 'Deposit Amount' : `Available: ${formattedAvailable}`}</div>
                    </div>
                </div>
                <div class="mt-3 flex space-x-2">
                    <button class="view-transactions-btn text-xs text-blue-600 hover:underline focus:outline-none" data-account-id="${account.accountId}">
                        View Transactions
                    </button>
                </div>
            </div>
        `;
    },

    _renderLoans(loans, targetDiv) {
        if (!targetDiv) return;
        if (!loans || loans.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No loans found.</div>';
            return;
        }
        
        let html = '<div class="mb-4">';
        html += '<h3 class="text-lg font-semibold text-gray-800 mb-3">Your Loans</h3>';
        html += '<div class="space-y-3">';
        html += loans.map(loan => this._renderLoanCard(loan)).join('');
        html += '</div>';
        html += '</div>';
        
        targetDiv.innerHTML = html;
        this._addLoanButtonListeners();
    },

    _renderLoanCard(loan) {
        const formattedBalance = this._formatCurrency(loan.outstandingBalance, loan.currency);
        return `
            <div class="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-semibold text-gray-800">${loan.displayName}</h4>
                        <p class="text-sm text-gray-600">ID: ${loan.loanId}</p>
                        <p class="text-sm text-gray-600">Status: ${loan.status}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-semibold text-red-600">${formattedBalance}</div>
                        <div class="text-xs text-gray-500">Outstanding</div>
                    </div>
                </div>
                <div class="mt-3 flex space-x-2">
                    <button class="view-loan-details-btn text-xs text-blue-600 hover:underline focus:outline-none" data-loan-id="${loan.loanId}">
                        View Details
                    </button>
                </div>
            </div>
        `;
    },

    _renderProfile(profile, targetDiv) {
        if (!targetDiv || !profile) return;
        
        let email = 'N/A';
        let phone = 'N/A';
        let address = 'N/A';
        
        if (profile.addresses && profile.addresses.length > 0) {
            const firstAddress = profile.addresses[0];
            if (firstAddress.electronicAddress) {
                email = firstAddress.electronicAddress;
            }
            if (firstAddress.phoneNo) {
                phone = firstAddress.phoneNo;
            }
            if (firstAddress.addressFreeFormat && firstAddress.addressFreeFormat.length > 0) {
                address = firstAddress.addressFreeFormat[0].addressLine || 'N/A';
            }
        }
        
        let nationality = 'N/A';
        if (profile.nationalities && profile.nationalities.length > 0) {
            nationality = profile.nationalities[0].country || 'N/A';
        }
        
        const profileInfo = `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">Name:</span>
                    <span class="text-sm text-gray-900">${profile.firstName || ''} ${profile.lastName || ''}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">Customer ID:</span>
                    <span class="text-sm text-gray-900">${profile.partyId || profile.customerId || 'N/A'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">Date of Birth:</span>
                    <span class="text-sm text-gray-900">${profile.dateOfBirth || 'N/A'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">Email:</span>
                    <span class="text-sm text-gray-900">${email}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">Mobile:</span>
                    <span class="text-sm text-gray-900">${phone}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">Nationality:</span>
                    <span class="text-sm text-gray-900">${nationality}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">City of Birth:</span>
                    <span class="text-sm text-gray-900">${profile.cityOfBirth || 'N/A'}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-600">Address:</span>
                    <span class="text-sm text-gray-900 text-right">${address}</span>
                </div>
            </div>
        `;
        
        targetDiv.innerHTML = profileInfo;
    },

    // --- Helper Functions ---
    _handlePartyIdChange() {
        this._log('Apply button clicked - handling party ID change...');
        
        // Get fresh DOM elements
        this._getElements();
        
        // Try multiple ways to get the party ID input
        let partyIdInput = this._domElements.partyIdInput;
        if (!partyIdInput) {
            partyIdInput = document.getElementById('party-id-input');
        }
        
        if (!partyIdInput) {
            this._log('Party ID input not found', 'error');
            return;
        }
        
        const newPartyId = partyIdInput.value.trim();
        this._log(`Current party ID: ${this._partyId}, New party ID: ${newPartyId}`);
        
        if (!newPartyId) {
            this._log('No party ID entered', 'warn');
            return;
        }
        
        if (newPartyId === this._partyId) {
            this._log('Party ID unchanged, refreshing data anyway...');
            // Refresh data even if same ID
            this._showHome(); // This will trigger data refresh
            return;
        }
        
        this._log(`Changing party ID from ${this._partyId} to ${newPartyId}`);
        this._partyId = newPartyId;
        
        // Save to localStorage
        localStorage.setItem('mobileAppPartyId', this._partyId);
        this._log(`Saved party ID to localStorage: ${this._partyId}`);
        
        // Clear existing data
        this._accountsData = [];
        this._loansData = [];
        
        // Show loading states
        if (this._domElements.profileContent) {
            this._domElements.profileContent.innerHTML = '<div class="text-center text-gray-500 py-2">Loading profile...</div>';
        }
        if (this._domElements.accountsListDiv) {
            this._domElements.accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading accounts...</div>';
        }
        if (this._domElements.loansListDiv) {
            this._domElements.loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loans...</div>';
        }
        
        // Show home view and fetch new data
        this._log('Showing home and fetching new data for party ID:', newPartyId);
        this._showHome();
    },

    _populateFromAccountSelect(accounts) {
        if (!this._domElements.fromAccountSelect) return;
        this._domElements.fromAccountSelect.innerHTML = '';
        accounts.forEach(acc => {
            if (acc.type === 'deposit') {
                const option = document.createElement('option');
                option.value = acc.accountId;
                option.textContent = `${acc.displayName} (...${acc.accountId.slice(-4)}) - ${this._formatCurrency(acc.availableBalance, acc.currency)}`;
                this._domElements.fromAccountSelect.appendChild(option);
            }
        });
    },

    async _submitTransfer(formData) {
        this._log("Submitting transfer:", formData);
        if (!this._domElements.transferResultDiv) return;
        
        this._domElements.transferResultDiv.textContent = 'Processing transfer...';
        this._domElements.transferResultDiv.className = 'mt-4 text-center text-gray-600';

        try {
            const debitPayload = {
                paymentTransactionReference: `TRF_${Date.now()}`,
                paymentReservationReference: `TRF_${Date.now()}`,
                paymentValueDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
                debitAccount: formData.from_account,
                debitCurrency: "USD",
                paymentAmount: formData.amount.toString(),
                paymentDescription: `Transfer to ${formData.to_account}`
            };
            
            const response = await fetch(`/api/proxy/deposits/payments/debitAccount`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(debitPayload),
            });
            
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const result = await response.json();
            this._log("Transfer result:", result);

            this._domElements.transferResultDiv.textContent = `Success: Transfer completed (ID: ${debitPayload.paymentTransactionReference})`;
            this._domElements.transferResultDiv.className = 'mt-4 text-center text-green-600 font-semibold';
            
            setTimeout(() => {
                this._hideTransfer();
                this._fetchAccounts();
            }, 2000);
        } catch (error) {
            this._log("Error submitting transfer:", 'error', error);
            this._domElements.transferResultDiv.textContent = `Error: ${error.message}`;
            this._domElements.transferResultDiv.className = 'mt-4 text-center text-red-600 font-semibold';
        }
    },

    _addTransactionButtonListeners() {
        if (!this._domElements.accountsListDiv) return;

        this._domElements.accountsListDiv.querySelectorAll('.view-transactions-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const accountId = e.target.getAttribute('data-account-id');
                this._showTransactions(accountId);
            });
        });
    },

    _addLoanButtonListeners() {
        if (!this._domElements.loansListDiv) return;
        
        document.querySelectorAll('.view-loan-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const loanId = e.target.getAttribute('data-loan-id');
                if (loanId) {
                    this._log(`View loan details for: ${loanId}`);
                    this._showLoanDetails(loanId);
                }
            });
        });

        // Back button from loan details to loans
        const backToLoansFromDetails = document.getElementById('back-to-loans-from-details');
        if (backToLoansFromDetails) {
            backToLoansFromDetails.addEventListener('click', () => this._showHome());
        }

        // Back button from loan schedule to loan details
        const backToLoanDetails = document.getElementById('back-to-loan-details');
        if (backToLoanDetails) {
            backToLoanDetails.addEventListener('click', () => {
                // Hide schedule section and show details section
                document.getElementById('loan-schedule-section').classList.add('hidden');
                document.getElementById('loan-details-section').classList.remove('hidden');
            });
        }
    },

    _showTransactions(accountId) {
        // Hide other sections
        this._domElements.accountsSectionDiv?.classList.add('hidden');
        this._domElements.loansSectionDiv?.classList.add('hidden');
        this._domElements.transferSection?.classList.add('hidden');
        this._domElements.profileSection?.classList.add('hidden');
        
        // Show transactions section
        this._domElements.transactionsSection?.classList.remove('hidden');
        
        // Update back button
        if (this._domElements.backToAccountsButton) {
            this._domElements.backToAccountsButton.onclick = () => this._showHome();
        }
        
        // Fetch and display transactions
        this._fetchTransactions(accountId);
    },

    async _fetchTransactions(accountId) {
        this._log(`Fetching transactions for account ID: ${accountId}`);
        if (!this._domElements.transactionsListDiv) return;
        
        try {
            this._domElements.transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading transactions...</div>';
            
            const apiUrl = `/api/accounts/${accountId}/transactions?partyId=${this._partyId}&_=${Date.now()}`;
            this._log("Fetching transactions from unified API:", apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const transactions = await response.json();
            this._log("Transactions data received from unified API:", transactions);
            
            if (transactions.length === 0) {
                this._domElements.transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
                return;
            }
            
            const formattedTransactions = transactions.map(tx => ({
                id: tx.transactionId || `tx-${Math.random().toString(36).substring(2, 10)}`,
                date: tx.valueDate || tx.bookingDate,
                amount: tx.amount || 0,
                currency: tx.currency || "USD",
                description: tx.description || "Transaction",
                type: tx.type || "debit",
                bookingDate: tx.bookingDate,
                icon: tx.type === "credit" ? "arrow-down" : "arrow-up",
                status: "Completed"
            }));
            
            this._renderTransactions(formattedTransactions, this._domElements.transactionsListDiv);
        } catch (error) {
            this._log("Error fetching transactions:", 'error', error);
            this._domElements.transactionsListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load transactions: ${error.message}</div>`;
        }
    },

    _renderTransactions(transactions, targetDiv) {
        if (!targetDiv) return;
        if (!transactions || transactions.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
            return;
        }
        
        const transactionHTML = transactions.map(transaction => {
            const formattedAmount = this._formatCurrency(transaction.amount, transaction.currency);
            const amountColorClass = transaction.type === 'credit' ? 'text-green-600' : 'text-red-600';
            
            return `
                <div class="transaction-item flex justify-between items-center py-3 px-4 border-b border-gray-100">
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="${transaction.icon === 'arrow-down' ? 'M19 14l-7 7m0 0l-7-7m7 7V3' : 'M5 10l7-7m0 0l7 7m-7-7v18'}"></path>
                            </svg>
                        </div>
                        <div>
                            <div class="font-medium text-gray-900">${transaction.description}</div>
                            <div class="text-sm text-gray-500">${transaction.date}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold ${amountColorClass}">${formattedAmount}</div>
                        <div class="text-xs text-gray-500">${transaction.status}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        targetDiv.innerHTML = transactionHTML;
    },

    // --- Loan Details Functions ---
    _showLoanDetails(loanId) {
        this._log(`Showing loan details for loan ID: ${loanId}`);
        
        // Hide other sections
        this._domElements.accountsSectionDiv?.classList.add('hidden');
        this._domElements.loansSectionDiv?.classList.add('hidden');
        this._domElements.transactionsSection?.classList.add('hidden');
        this._domElements.loanScheduleSection?.classList.add('hidden');
        this._domElements.profileSection?.classList.add('hidden');
        
        // Show loan details section
        document.getElementById('loan-details-section')?.classList.remove('hidden');
        
        // Fetch and display loan details
        this._fetchLoanDetails(loanId);
    },

    async _fetchLoanDetails(loanId) {
        this._log(`Fetching loan details for loan ID: ${loanId}`);
        
        const loanDetailsInfo = document.getElementById('loan-details-info');
        if (!loanDetailsInfo) {
            this._log('Loan details info element not found', 'error');
            return;
        }
        
        loanDetailsInfo.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loan details...</div>';
        
        try {
            const response = await fetch(`/api/loans/${loanId}/details`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this._log('Loan details fetched:', 'info', data);
            this._renderLoanDetails(data);
            
            // Set up the view payment schedule button
            const viewScheduleBtn = document.getElementById('view-payment-schedule-btn');
            if (viewScheduleBtn) {
                viewScheduleBtn.onclick = () => this._showLoanSchedule(loanId);
            }

            // Update headless tab if available
            this._updateHeadlessTab();
            
        } catch (error) {
            this._log('Error fetching loan details:', 'error', error);
            loanDetailsInfo.innerHTML = `
                <div class="text-center text-red-500 py-4">
                    <p>Failed to load loan details</p>
                    <p class="text-sm text-gray-500 mt-1">${error.message}</p>
                </div>
            `;
        }
    },

    _renderLoanDetails(loan) {
        const loanDetailsInfo = document.getElementById('loan-details-info');
        if (!loanDetailsInfo) return;
        
        const interestRate = loan.interestRate ? `${loan.interestRate}%` : 'N/A';
        const startDate = loan.startDate ? this._formatDate(loan.startDate) : 'N/A';
        const term = loan.term ? `${loan.term} months` : 'N/A';
        const maturityDate = loan.maturityDate ? this._formatDate(loan.maturityDate) : 'N/A';
        const nextPaymentDate = loan.nextPaymentDate ? this._formatDate(loan.nextPaymentDate) : 'N/A';
        
        loanDetailsInfo.innerHTML = `
            <div class="space-y-4">
                <div class="text-center border-b border-gray-100 pb-4">
                    <h4 class="text-lg font-semibold text-gray-800">${loan.productName || loan.productDisplayName || 'Loan'}</h4>
                    <p class="text-sm text-gray-600">ID: ${loan.loanId || loan.id || 'N/A'}</p>
                    <p class="text-sm text-gray-600">Status: ${loan.status || 'N/A'}</p>
                </div>
                
                <div class="space-y-3">
                    <div class="flex justify-between items-center py-2 border-b border-gray-50">
                        <span class="text-sm font-medium text-gray-600">Interest Rate</span>
                        <span class="text-sm font-semibold text-gray-800">${interestRate}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-50">
                        <span class="text-sm font-medium text-gray-600">Start Date</span>
                        <span class="text-sm font-semibold text-gray-800">${startDate}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-50">
                        <span class="text-sm font-medium text-gray-600">Term</span>
                        <span class="text-sm font-semibold text-gray-800">${term}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-50">
                        <span class="text-sm font-medium text-gray-600">Maturity Date</span>
                        <span class="text-sm font-semibold text-gray-800">${maturityDate}</span>
                    </div>
                    <div class="flex justify-between items-center py-2">
                        <span class="text-sm font-medium text-gray-600">Next Payment Date</span>
                        <span class="text-sm font-semibold text-gray-800">${nextPaymentDate}</span>
                    </div>
                </div>
            </div>
        `;
    },

    _showLoanSchedule(loanId) {
        this._log(`Showing loan schedule for loan ID: ${loanId}`);
        
        // Hide other sections
        document.getElementById('accounts-section')?.classList.add('hidden');
        document.getElementById('loans-section')?.classList.add('hidden');
        document.getElementById('transactions-section')?.classList.add('hidden');
        document.getElementById('loan-details-section')?.classList.add('hidden');
        
        // Show loan schedule section
        document.getElementById('loan-schedule-section')?.classList.remove('hidden');
        
        // Fetch and display loan schedule
        this._fetchLoanSchedule(loanId);
    },

    async _fetchLoanSchedule(loanId) {
        const loanScheduleList = document.getElementById('loan-schedule-list');
        const loanScheduleInfo = document.getElementById('loan-schedule-info');
        
        if (!loanScheduleList) {
            this._log('Loan schedule list element not found', 'error');
            return;
        }
        
        if (!loanScheduleInfo) {
            this._log('Loan schedule info element not found', 'error');
            return;
        }
        
        // Show loading state
        loanScheduleList.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loan schedule...</div>';
        loanScheduleInfo.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loan information...</div>';
        
        try {
            const response = await fetch(`/api/loans/${loanId}/schedule`, {
                headers: {
                    'X-Client-Type': 'mobile'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this._log('Loan schedule API response:', 'info', data);
            
            if (data && data.body && Array.isArray(data.body)) {
                // Get total payments from header
                const totalPayments = data.header?.total_size || data.body.length;
                
                // Get the full schedule first
                const fullSchedule = data.body;
                
                // Filter for future payments only and limit to next 10
                const futurePayments = fullSchedule
                    .filter(payment => new Date(payment.paymentDate) >= new Date())
                    .slice(0, 10);
                
                // Transform the schedule data
                const transformedSchedule = futurePayments.map((payment) => {
                    return {
                        dueDate: payment.paymentDate,
                        totalAmount: payment.totalAmount,
                        principalAmount: payment.principalAmount,
                        interestAmount: payment.interestAmount,
                        outstandingAmount: Math.abs(payment.outstandingAmount || 0)
                    };
                });
                
                // Get loan details from cache or fetch
                let loan = this._loansData.find(l => l.loanId === loanId);
                if (!loan) {
                    try {
                        const loanResponse = await fetch(`/api/loans/${loanId}/details`);
                        if (loanResponse.ok) {
                            const loanData = await loanResponse.json();
                            loan = loanData;
                        }
                    } catch (error) {
                        this._log('Error fetching loan details:', 'error', error);
                    }
                }
                
                // Add total payments to loan object
                if (loan) {
                    loan.totalPayments = totalPayments;
                }
                
                // Render the schedule and info
                this._renderLoanSchedule(transformedSchedule, loan?.currency || 'USD');
                this._renderLoanScheduleInfo(loan || { id: loanId, totalPayments: totalPayments }, transformedSchedule);

                // Update headless tab to show the loan schedule API call
                this._showLoanScheduleInHeadless();
                
            } else {
                loanScheduleList.innerHTML = '<div class="text-center text-gray-500 py-4">No schedule data available</div>';
                loanScheduleInfo.innerHTML = '<div class="text-center text-gray-500 py-4">No loan information available</div>';
            }
        } catch (error) {
            this._log('Error fetching loan schedule:', 'error', error);
            loanScheduleList.innerHTML = '<div class="text-center text-red-500 py-4">Error loading loan schedule</div>';
            loanScheduleInfo.innerHTML = '<div class="text-center text-red-500 py-4">Error loading loan information</div>';
        }
    },

    _renderLoanSchedule(schedule, currency = 'USD') {
        const loanScheduleList = document.getElementById('loan-schedule-list');
        
        if (!loanScheduleList) {
            this._log('Loan schedule list element not found', 'error');
            return;
        }
        
        if (!schedule || schedule.length === 0) {
            loanScheduleList.innerHTML = '<div class="text-center text-gray-500 py-4">No upcoming payments found</div>';
            return;
        }
        
        const scheduleHTML = schedule.map(payment => {
            const outstandingAmount = payment.outstandingAmount || 0;
            
            return `
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-gray-800">${this._formatDate(payment.dueDate)}</h3>
                    </div>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Amount:</span>
                            <span class="font-medium">${this._formatCurrency(payment.totalAmount, currency)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Principal:</span>
                            <span>${this._formatCurrency(payment.principalAmount, currency)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Interest:</span>
                            <span>${this._formatCurrency(payment.interestAmount, currency)}</span>
                        </div>
                        <div class="flex justify-between border-t pt-1 mt-2">
                            <span class="text-gray-600">Remaining Balance:</span>
                            <span class="font-medium text-blue-600">${this._formatCurrency(outstandingAmount, currency)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        loanScheduleList.innerHTML = scheduleHTML;
    },

    _renderLoanScheduleInfo(loan, schedule) {
        const loanScheduleInfo = document.getElementById('loan-schedule-info');
        
        if (!loanScheduleInfo) {
            this._log('Loan schedule info element not found', 'error');
            return;
        }
        
        // Get next payment info from schedule
        const nextPayment = schedule && schedule.length > 0 ? schedule[0] : null;
        const nextPaymentAmount = nextPayment ? this._formatCurrency(nextPayment.totalAmount, loan.currency || 'USD') : 'N/A';
        const nextPaymentDate = nextPayment ? this._formatDate(nextPayment.dueDate) : 'N/A';
        
        // Calculate remaining payments using total payments from loan object
        const remainingPayments = loan.totalPayments || schedule.length;
        
        // Get outstanding balance from the first payment in schedule (most current)
        const outstandingBalance = nextPayment ? Math.abs(nextPayment.outstandingAmount || 0) : 0;
        
        loanScheduleInfo.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">${loan.productName || loan.displayName || 'Loan'}</h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Loan ID:</span>
                        <span class="font-medium">${loan.id || loan.loanId || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Outstanding Balance:</span>
                        <span class="font-semibold text-red-600">${this._formatCurrency(outstandingBalance, loan.currency || 'USD')}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Next Payment:</span>
                        <span class="font-medium">${nextPaymentAmount}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Due Date:</span>
                        <span class="font-medium">${nextPaymentDate}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Remaining Payments:</span>
                        <span class="font-medium">${remainingPayments}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // --- Headless Integration Functions ---
    _updateHeadlessTab() {
        try {
            if (window.reloadHeadlessData) {
                this._log("Updating headless tab with API data");
                window.reloadHeadlessData();
            }
        } catch (e) {
            this._log("Headless tab not available:", 'warn', e);
        }
    },

    _showLoanScheduleInHeadless() {
        try {
            if (window.showLoanSchedulesApiCall) {
                this._log("Showing loan schedules API call in headless tab");
                window.showLoanSchedulesApiCall();
            }
        } catch (e) {
            this._log("Headless tab loan schedule function not available:", 'warn', e);
        }
    },

    // --- TabManager Lifecycle Hooks ---
    onInit() {
        this._log('onInit called');
        this._partyId = localStorage.getItem('mobileAppPartyId');
        if (!this._partyId || this._partyId.trim() === "") {
            this._partyId = "2514672778";
            this._log(`No party ID found in localStorage - using default: ${this._partyId}`);
            localStorage.setItem('mobileAppPartyId', this._partyId);
        } else {
            this._log(`Using Party ID from localStorage: ${this._partyId}`);
        }
        this._domReady = false;
        this._domElements = null;
    },

    onActivate(isRestoring) {
        this._log(`Activating mobile app (isRestoring: ${isRestoring})...`);
        this._isActivating = true;
        
        // Clear any existing polling interval
        if (this._pollIntervalId) {
            clearInterval(this._pollIntervalId);
            this._pollIntervalId = null;
        }

        if (this._domReady && this._domElements) {
            this._log('DOM already ready, re-initializing view...', 'info');
            this._initializeMobileAppView();
        } else {
            this._log('DOM not ready, starting DOM polling...', 'info');
            this._waitForMobileAppDOM();
        }
        
        this._log('Mobile app activation process initiated.');
    },

    onDeactivate: function(isUnloading) {
        this._log('Mobile app deactivated.');
        this._isActivating = false;
        
        // Clear any polling intervals immediately
        if (this._pollIntervalId) {
            clearInterval(this._pollIntervalId);
            this._pollIntervalId = null;
            this._log('Mobile DOM polling stopped due to deactivation.');
        }
        
        this._log('Mobile app cleanup completed.');
    },

    onDestroy: function(isUnloading) {
        this._log(`Destroying mobile app (isUnloading: ${isUnloading})...`);
        this._isActivating = false;
        if (this._pollIntervalId) {
            clearInterval(this._pollIntervalId);
            this._pollIntervalId = null;
        }
        this._domReady = false;
        this._log('Mobile app destroyed.');
    }
};

// Register with TabManager
function registerMobileApp() {
    console.log('[MobileAppModule] Attempting registration...');
    console.log('[MobileAppModule] window.TabManager exists:', !!window.TabManager);
    if (window.TabManager) {
        console.log('[MobileAppModule] TabManager found, registering tab "mobile"');
        window.TabManager.registerTab('mobile', MobileAppModule);
        console.log('[MobileAppModule] Successfully registered with TabManager');
        return true;
    } else {
        console.warn('[MobileAppModule] TabManager not found yet. Will retry...');
        return false;
    }
}

console.log('[MobileAppModule] About to start registration process...');

// Try to register immediately
if (!registerMobileApp()) {
    console.log('[MobileAppModule] Initial registration failed, starting retry loop...');
    // If TabManager not ready, wait and retry
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max
    const retryInterval = setInterval(() => {
        retryCount++;
        console.log(`[MobileAppModule] Retry attempt ${retryCount}/${maxRetries}`);
        if (registerMobileApp()) {
            console.log('[MobileAppModule] Registration successful on retry!');
            clearInterval(retryInterval);
        } else if (retryCount >= maxRetries) {
            clearInterval(retryInterval);
            console.error('[MobileAppModule] TabManager not found after maximum retries. Ensure tab-manager.js is loaded first.');
        }
    }, 100);
} else {
    console.log('[MobileAppModule] Registration successful on first attempt!');
}