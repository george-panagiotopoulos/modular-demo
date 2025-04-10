(function() {
    // Branch App specific JavaScript
    console.log("branch_app.js loaded and executing");

    // State (now scoped to this IIFE)
    let customersData = [];
    let selectedCustomerId = null;
    let customerAccounts = [];
    let staticListenersAdded = false; // Track if static listeners are added

    // --- DOM Elements ---
    function getElements() {
        return {
            customerSelect: document.getElementById('customer-search'),
            loadCustomerBtn: document.getElementById('load-customer-btn'),
            customerLoadError: document.getElementById('customer-load-error'),
            customerDetailsArea: document.getElementById('customer-details-area'),
            customerAccountsArea: document.getElementById('customer-accounts-area'),
            accountsListDiv: document.getElementById('customer-accounts-area')?.querySelector('#accounts-list'), // Safer access
            transactionsArea: document.getElementById('account-transactions-area'),
            transactionsListDiv: document.getElementById('account-transactions-area')?.querySelector('#transactions-list'), // Safer access
            transactionsTitle: document.getElementById('account-transactions-area')?.querySelector('#transactions-title'),
            backToCustomerBtn: document.getElementById('back-to-customer')
        };
    }

    // --- Rendering Functions ---
    function populateCustomerSelect(customers) {
        const { customerSelect } = getElements();
        if (!customerSelect) return;
        customerSelect.innerHTML = '<option value="">Select a customer...</option>'; // Reset
        customers.forEach(c => {
            const option = document.createElement('option');
            option.value = c.customerId;
            option.textContent = `${c.lastName}, ${c.firstName} (${c.customerId})`;
            customerSelect.appendChild(option);
        });
    }

    function renderCustomerDetails(customer) {
        const { customerDetailsArea } = getElements();
        if (!customerDetailsArea) return;

        // Clear previous details (except the title)
        const titleElement = customerDetailsArea.querySelector('h2');
        customerDetailsArea.innerHTML = '';
        if(titleElement) customerDetailsArea.appendChild(titleElement);

        function createDetailItem(label, value) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'text-sm';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'font-medium text-gray-600';
            labelSpan.textContent = `${label}: `;
            itemDiv.appendChild(labelSpan);
            itemDiv.appendChild(document.createTextNode(value || 'N/A'));
            return itemDiv;
        }

        customerDetailsArea.appendChild(createDetailItem('Customer ID', customer.customerId));
        customerDetailsArea.appendChild(createDetailItem('Name', `${customer.title || ''} ${customer.firstName} ${customer.lastName}`));
        customerDetailsArea.appendChild(createDetailItem('Status', customer.status));
        customerDetailsArea.appendChild(createDetailItem('Date of Birth', customer.dateOfBirth));
        customerDetailsArea.appendChild(createDetailItem('Nationality', customer.nationality));
        customerDetailsArea.appendChild(createDetailItem('Email', customer.primaryEmail));
        customerDetailsArea.appendChild(createDetailItem('Mobile', customer.mobilePhone));
        customerDetailsArea.appendChild(createDetailItem('Home Phone', customer.homePhone));
        customerDetailsArea.appendChild(createDetailItem('Employment', `${customer.employmentStatus} - ${customer.jobTitle || ''} at ${customer.employerName || ''}`));

        if (customer.address) {
            const addr = customer.address;
            customerDetailsArea.appendChild(createDetailItem('Address', `${addr.streetAddress1}${addr.streetAddress2 ? ", "+addr.streetAddress2 : ""}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`));
        }
        customerDetailsArea.appendChild(createDetailItem('Language', customer.preferredLanguage));
        customerDetailsArea.appendChild(createDetailItem('Marketing Consent', customer.marketingConsent ? 'Yes' : 'No'));
        customerDetailsArea.appendChild(createDetailItem('Last Login', customer.lastLogin ? new Date(customer.lastLogin).toLocaleString() : 'N/A'));
        customerDetailsArea.appendChild(createDetailItem('Member Since', customer.creationDate ? new Date(customer.creationDate).toLocaleDateString() : 'N/A'));

        customerDetailsArea.classList.remove('hidden');
    }

    function renderAccountRow(account) {
        const isLoan = account.type === 'loan';
        const balance = isLoan ? account.principalAmount : account.currentBalance;
        const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(Math.abs(balance));

        return `
            <div class="flex justify-between items-center p-3 border rounded-md bg-gray-50 hover:bg-gray-100">
                <div>
                    <span class="font-medium text-gray-800">${account.displayName} (${account.accountId})</span>
                    <span class="text-xs text-gray-500 ml-2">${account.productName} - Opened: ${account.openDate || 'N/A'}</span>
                </div>
                <div class="text-right">
                    <div class="font-semibold ${isLoan ? 'text-red-700' : 'text-gray-900'}">${formattedBalance} ${account.currency}</div>
                    <button data-account-id="${account.accountId}" class="view-transactions-btn text-xs text-blue-600 hover:underline focus:outline-none">
                        View Transactions
                    </button>
                </div>
            </div>
        `;
    }

    function renderTransactionRow(transaction) {
        const amountClass = transaction.amount < 0 ? 'text-red-600' : 'text-green-600';
        const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency }).format(transaction.amount);
        const date = new Date(transaction.bookingDate).toLocaleDateString();

        return `
            <div class="flex justify-between items-center border-b border-gray-200 py-2">
                <div>
                    <div class="text-sm text-gray-800">${transaction.description}</div>
                    <div class="text-xs text-gray-500">${date} - ${transaction.type}</div>
                </div>
                <div class="text-sm font-medium ${amountClass}">${formattedAmount}</div>
            </div>
        `;
    }

    function renderAccountsList(accounts, targetDiv) {
        if (!targetDiv) return;
        if (!accounts || accounts.length === 0) {
            targetDiv.innerHTML = '<div class="text-gray-500">No accounts found for this customer.</div>';
            return;
        }
        targetDiv.innerHTML = accounts.map(renderAccountRow).join('');
        addAccountTransactionButtonListeners();
    }

    function renderTransactionsList(transactions, targetDiv) {
        if (!targetDiv) return;
        if (!transactions || transactions.length === 0) {
            targetDiv.innerHTML = '<div class="text-gray-500">No transactions found for this account.</div>';
            return;
        }
        targetDiv.innerHTML = transactions.map(renderTransactionRow).join('');
    }

    // --- API Fetching ---
    async function fetchCustomers() {
        console.log("Fetching customers...");
        try {
            const response = await fetch(`/api/branch/customers?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            customersData = await response.json();
            console.log("Customers received:", customersData);
            populateCustomerSelect(customersData);
        } catch (error) {
            console.error("Error fetching customers:", error);
            // Maybe show error near dropdown
        }
    }

    async function fetchCustomerData(customerId) {
        console.log(`Fetching data for customer ${customerId}...`);
        const { customerDetailsArea, customerAccountsArea, accountsListDiv, customerLoadError } = getElements();
        // Ensure elements exist before manipulating
        if(customerDetailsArea) customerDetailsArea.classList.add('hidden');
        if(customerAccountsArea) customerAccountsArea.classList.add('hidden');
        if(accountsListDiv) accountsListDiv.innerHTML = '<div class="text-gray-500">Loading accounts...</div>';
        if(customerLoadError) customerLoadError.textContent = ''; // Clear previous errors

        try {
            // Fetch details and accounts in parallel
            const [detailsRes, accountsRes] = await Promise.all([
                fetch(`/api/branch/customers/${customerId}?_=${Date.now()}`),
                fetch(`/api/branch/customers/${customerId}/accounts?_=${Date.now()}`)
            ]);

            if (!detailsRes.ok) throw new Error(`Details fetch failed: ${detailsRes.status}`);
            const customerDetails = await detailsRes.json();
            renderCustomerDetails(customerDetails);

            if (!accountsRes.ok) throw new Error(`Accounts fetch failed: ${accountsRes.status}`);
            customerAccounts = await accountsRes.json();
            renderAccountsList(customerAccounts, accountsListDiv);
            if(customerAccountsArea) customerAccountsArea.classList.remove('hidden');

        } catch (error) {
            console.error(`Error loading customer data for ${customerId}:`, error);
            if(customerLoadError) customerLoadError.textContent = `Failed to load customer data: ${error.message}`;
        }
    }

    async function fetchBranchTransactions(accountId) {
        console.log(`Fetching branch transactions for ${accountId}...`);
        const { transactionsListDiv } = getElements();
        if(!transactionsListDiv) return;
        transactionsListDiv.innerHTML = '<div class="text-gray-500">Loading transactions...</div>';
        try {
            const response = await fetch(`/api/branch/accounts/${accountId}/transactions?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const transactions = await response.json();
            renderTransactionsList(transactions, transactionsListDiv);

        } catch (error) {
            console.error(`Error fetching branch transactions for ${accountId}:`, error);
            transactionsListDiv.innerHTML = '<div class="text-red-500">Could not load transactions.</div>';
        }
    }

    // --- UI Interaction ---
    function showCustomerView() {
        const { customerDetailsArea, customerAccountsArea, transactionsArea } = getElements();
        if(customerDetailsArea) customerDetailsArea.classList.remove('hidden');
        if(customerAccountsArea) customerAccountsArea.classList.remove('hidden');
        if(transactionsArea) transactionsArea.classList.add('hidden');
    }

    function showTransactionsView(accountId) {
        const { customerDetailsArea, customerAccountsArea, transactionsArea, transactionsTitle } = getElements();
        if(customerDetailsArea) customerDetailsArea.classList.add('hidden');
        if(customerAccountsArea) customerAccountsArea.classList.add('hidden');
        if(transactionsArea) transactionsArea.classList.remove('hidden');

        // Set title
        const account = customerAccounts.find(acc => acc.accountId === accountId);
        if (transactionsTitle) {
             transactionsTitle.textContent = `Transactions for ${account ? account.displayName : accountId}`;
        }

        fetchBranchTransactions(accountId);
    }


    // --- Event Listener Management ---
    // Store handlers to remove them later
    const eventHandlers = {
        loadCustomer: null,
        backToCustomer: null,
        viewTransaction: [] // Array for dynamic buttons
    };

    function addAccountTransactionButtonListeners() {
        const { accountsListDiv } = getElements();
        if (!accountsListDiv) return;

        // Remove previous dynamic listeners
        eventHandlers.viewTransaction.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewTransaction = []; // Clear array

        accountsListDiv.querySelectorAll('.view-transactions-btn').forEach(button => {
             const handler = (e) => {
                const accountId = e.target.getAttribute('data-account-id');
                showTransactionsView(accountId);
             };
             button.addEventListener('click', handler);
             eventHandlers.viewTransaction.push({ button, handler }); // Store for removal
        });
    }

    function addStaticListeners() {
        if (staticListenersAdded) return; // Add static listeners only once
        const { loadCustomerBtn, customerSelect, backToCustomerBtn } = getElements();

        if (loadCustomerBtn && customerSelect) {
            eventHandlers.loadCustomer = () => {
                selectedCustomerId = customerSelect.value;
                if (selectedCustomerId) {
                    fetchCustomerData(selectedCustomerId);
                    showCustomerView(); // Ensure customer view is shown initially
                } else {
                    const errEl = getElements().customerLoadError;
                    if(errEl) errEl.textContent = 'Please select a customer.';
                }
            };
            loadCustomerBtn.addEventListener('click', eventHandlers.loadCustomer);
        }

        if (backToCustomerBtn) {
            eventHandlers.backToCustomer = showCustomerView;
            backToCustomerBtn.addEventListener('click', eventHandlers.backToCustomer);
        }
        staticListenersAdded = true;
    }

    function removeAllListeners() {
         console.log("Removing Branch App listeners...");
         const { loadCustomerBtn, backToCustomerBtn } = getElements();

         if (eventHandlers.loadCustomer && loadCustomerBtn) {
             loadCustomerBtn.removeEventListener('click', eventHandlers.loadCustomer);
             eventHandlers.loadCustomer = null;
         }
         if (eventHandlers.backToCustomer && backToCustomerBtn) {
            backToCustomerBtn.removeEventListener('click', eventHandlers.backToCustomer);
            eventHandlers.backToCustomer = null;
        }
        eventHandlers.viewTransaction.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewTransaction = [];
        staticListenersAdded = false; // Reset flag
        console.log("Branch App listeners removed.");
    }

    // --- Initialization ---
    function initBranchAppTab() {
        console.log("Initializing Branch App Tab...");
        fetchCustomers(); // Load customer list for dropdown
        addStaticListeners();
        // Initially hide details/accounts sections until a customer is loaded
        const { customerDetailsArea, customerAccountsArea, transactionsArea } = getElements();
        if(customerDetailsArea) customerDetailsArea.classList.add('hidden');
        if(customerAccountsArea) customerAccountsArea.classList.add('hidden');
        if(transactionsArea) transactionsArea.classList.add('hidden');
    }

    // --- Global Cleanup Function --- 
    // Exposed for dashboard.js to call before removing script
    window.cleanupCurrentTab = function() {
        console.log("Running cleanup for Branch App Tab...");
        removeAllListeners();
        // Add any other cleanup (e.g., clearing intervals, removing specific elements created by this script)
    };

    // --- Initial Execution --- 
    initBranchAppTab();

})(); // End of IIFE 