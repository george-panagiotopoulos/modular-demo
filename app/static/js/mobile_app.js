(function() {
    // Mobile App specific JavaScript
    console.log("mobile_app.js loaded and executing");

    // State
    let accountsData = [];
    let staticListenersAdded = false;

    // --- DOM Elements ---
    function getElements() {
        return {
            accountsListDiv: document.getElementById('accounts-list'),
            transactionsSection: document.getElementById('transactions-section'),
            transactionsListDiv: document.getElementById('transactions-list'),
            transactionsTitle: document.getElementById('transactions-title'),
            backToAccountsButton: document.getElementById('back-to-accounts'),
            accountsSectionDiv: document.getElementById('accounts-section'),
            transferSection: document.getElementById('transfer-section'),
            showTransferButton: document.getElementById('show-transfer-button'),
            closeTransferButton: document.getElementById('close-transfer'),
            transferForm: document.getElementById('transfer-form'),
            fromAccountSelect: document.getElementById('from-account'),
            transferResultDiv: document.getElementById('transfer-result'),
        };
    }

    // --- Rendering Functions ---
    function renderAccountCard(account) {
        const isLoan = account.type === 'loan';
        const balance = isLoan ? account.principalAmount : account.currentBalance;
        const balanceLabel = isLoan ? 'Principal' : 'Balance';
        const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(Math.abs(balance));

        return `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-semibold text-gray-800">${account.displayName} (${account.accountId})</span>
                    <span class="text-xs ${isLoan ? 'text-red-600' : 'text-green-600'} font-medium">${account.productName}</span>
                </div>
                <div class="text-2xl font-bold text-gray-900 mb-3">${formattedBalance}</div>
                <div class="text-sm text-gray-600 mb-3">
                    ${!isLoan ? `Available: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.availableBalance)}` : `Next Payment: ${account.nextPaymentAmount} on ${account.nextPaymentDate}`}
                </div>
                <button data-account-id="${account.accountId}" class="view-transactions-btn text-sm text-blue-600 hover:underline focus:outline-none">
                    View Transactions
                </button>
            </div>
        `;
    }

    function renderTransactionItem(transaction) {
        const amountClass = transaction.amount < 0 ? 'text-red-600' : 'text-green-600';
        const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency }).format(transaction.amount);
        const date = new Date(transaction.bookingDate).toLocaleDateString();

        return `
            <div class="flex justify-between items-center border-b border-gray-100 py-2 last:border-b-0">
                <div>
                    <div class="text-sm font-medium text-gray-800">${transaction.description}</div>
                    <div class="text-xs text-gray-500">${date} - ${transaction.type}</div>
                </div>
                <div class="text-sm font-semibold ${amountClass}">${formattedAmount}</div>
            </div>
        `;
    }

    function renderAccounts(accounts, targetDiv) {
        if (!targetDiv) return;
        if (!accounts || accounts.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No accounts found.</div>';
            return;
        }
        targetDiv.innerHTML = accounts.map(renderAccountCard).join('');
        addTransactionButtonListeners(); // Re-add listeners after rendering
    }

    function renderTransactions(transactions, targetDiv) {
        if (!targetDiv) return;
        if (!transactions || transactions.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
            return;
        }
        targetDiv.innerHTML = transactions.map(renderTransactionItem).join('');
    }

    // --- API Fetching ---
    async function fetchAccounts() {
        console.log("Fetching accounts...");
        const { accountsListDiv } = getElements();
        if (!accountsListDiv) return;
        try {
            const response = await fetch(`/api/mobile/accounts?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            accountsData = await response.json();
            console.log("Accounts received:", accountsData);
            renderAccounts(accountsData, accountsListDiv);
            populateFromAccountSelect(accountsData);
        } catch (error) {
            console.error("Error fetching accounts:", error);
            accountsListDiv.innerHTML = '<div class="text-center text-red-500 py-4">Could not load accounts.</div>';
        }
    }

    async function fetchTransactions(accountId) {
        console.log(`Fetching transactions for ${accountId}...`);
        const { transactionsListDiv } = getElements();
        if (!transactionsListDiv) return;
        transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading transactions...</div>'; // Show loading
        try {
            const response = await fetch(`/api/mobile/accounts/${accountId}/transactions?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const transactions = await response.json();
            console.log(`Transactions for ${accountId}:`, transactions);
            renderTransactions(transactions, transactionsListDiv);
        } catch (error) {
            console.error(`Error fetching transactions for ${accountId}:`, error);
            transactionsListDiv.innerHTML = '<div class="text-center text-red-500 py-4">Could not load transactions.</div>';
        }
    }

    async function submitTransfer(formData) {
        console.log("Submitting transfer:", formData);
        const { transferResultDiv } = getElements();
        if (!transferResultDiv) return;
        transferResultDiv.textContent = 'Processing transfer...';
        transferResultDiv.className = 'mt-4 text-center text-gray-600'; // Reset style

        try {
            const response = await fetch(`/api/mobile/transfer?_=${Date.now()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const result = await response.json();
            console.log("Transfer result:", result);

            if (result.status === 'Completed') {
                transferResultDiv.textContent = `Success: ${result.message} (ID: ${result.transferId})`;
                transferResultDiv.className = 'mt-4 text-center text-green-600 font-semibold';
                // Optionally clear form or close section after delay
                setTimeout(() => {
                    hideTransfer(); // Close transfer section after success
                    fetchAccounts(); // Refresh account list to show new balance
                }, 2000); // Reduced delay slightly
            } else {
                throw new Error(result.message || 'Transfer failed');
            }
        } catch (error) {
            console.error("Error submitting transfer:", error);
            transferResultDiv.textContent = `Error: ${error.message}`;
            transferResultDiv.className = 'mt-4 text-center text-red-600 font-semibold';
        }
    }

    // --- UI Interaction ---
    function showTransactions(accountId) {
        const account = accountsData.find(acc => acc.accountId === accountId);
        if (!account) return;

        const { accountsSectionDiv, transactionsSection, transactionsTitle } = getElements();
        if(accountsSectionDiv) accountsSectionDiv.classList.add('hidden');
        if(transactionsSection) transactionsSection.classList.remove('hidden');
        if(transactionsTitle) transactionsTitle.textContent = `Transactions for ${account.displayName}`;
        fetchTransactions(accountId);
    }

    function showAccounts() {
        const { accountsSectionDiv, transactionsSection } = getElements();
         if(accountsSectionDiv) accountsSectionDiv.classList.remove('hidden');
         if(transactionsSection) transactionsSection.classList.add('hidden');
    }

    function showTransfer() {
        const { transferSection } = getElements();
        if(transferSection) transferSection.classList.remove('hidden');
        // Maybe scroll into view if needed
    }

    function hideTransfer() {
        const { transferSection, transferResultDiv, transferForm } = getElements();
        if(transferSection) transferSection.classList.add('hidden');
        if(transferResultDiv) transferResultDiv.textContent = ''; // Clear result message
        if(transferForm) transferForm.reset(); // Reset form
    }

    function populateFromAccountSelect(accounts) {
        const { fromAccountSelect } = getElements();
        if (!fromAccountSelect) return;
        fromAccountSelect.innerHTML = ''; // Clear existing options
        accounts.forEach(acc => {
            // Only allow transfers from deposit accounts in this stub
            if (acc.type === 'deposit') {
                const option = document.createElement('option');
                option.value = acc.accountId;
                option.textContent = `${acc.displayName} (...${acc.accountId.slice(-4)}) - ${new Intl.NumberFormat('en-US', { style: 'currency', currency: acc.currency }).format(acc.availableBalance)}`;
                fromAccountSelect.appendChild(option);
            }
        });
    }

    // --- Event Listener Management ---
    const eventHandlers = {
        backToAccounts: null,
        showTransfer: null,
        closeTransfer: null,
        submitTransferForm: null,
        viewTransaction: [] // Array for dynamic buttons
    };

    function addTransactionButtonListeners() {
        const { accountsListDiv } = getElements();
        if (!accountsListDiv) return;

        // Remove previous dynamic listeners
        eventHandlers.viewTransaction.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewTransaction = [];

        accountsListDiv.querySelectorAll('.view-transactions-btn').forEach(button => {
             const handler = (e) => {
                const accountId = e.target.getAttribute('data-account-id');
                showTransactions(accountId);
             };
             button.addEventListener('click', handler);
             eventHandlers.viewTransaction.push({ button, handler });
        });
    }

    function addStaticListeners() {
        if (staticListenersAdded) return;
        const { backToAccountsButton, showTransferButton, closeTransferButton, transferForm } = getElements();

        if (backToAccountsButton) {
             eventHandlers.backToAccounts = showAccounts;
             backToAccountsButton.addEventListener('click', eventHandlers.backToAccounts);
        }
        if (showTransferButton) {
            eventHandlers.showTransfer = showTransfer;
            showTransferButton.addEventListener('click', eventHandlers.showTransfer);
        }
        if (closeTransferButton) {
            eventHandlers.closeTransfer = hideTransfer;
            closeTransferButton.addEventListener('click', eventHandlers.closeTransfer);
        }
        if (transferForm) {
            eventHandlers.submitTransferForm = (e) => {
                e.preventDefault();
                const formData = {
                    from_account: e.target.elements.from_account.value,
                    to_account: e.target.elements.to_account.value,
                    amount: parseFloat(e.target.elements.amount.value)
                };
                submitTransfer(formData);
            };
            transferForm.addEventListener('submit', eventHandlers.submitTransferForm);
        }
        staticListenersAdded = true;
    }

    function removeAllListeners() {
        console.log("Removing Mobile App listeners...");
        const { backToAccountsButton, showTransferButton, closeTransferButton, transferForm } = getElements();

         if (eventHandlers.backToAccounts && backToAccountsButton) {
            backToAccountsButton.removeEventListener('click', eventHandlers.backToAccounts);
            eventHandlers.backToAccounts = null;
        }
         if (eventHandlers.showTransfer && showTransferButton) {
            showTransferButton.removeEventListener('click', eventHandlers.showTransfer);
            eventHandlers.showTransfer = null;
        }
         if (eventHandlers.closeTransfer && closeTransferButton) {
            closeTransferButton.removeEventListener('click', eventHandlers.closeTransfer);
            eventHandlers.closeTransfer = null;
        }
        if (eventHandlers.submitTransferForm && transferForm) {
            transferForm.removeEventListener('submit', eventHandlers.submitTransferForm);
            eventHandlers.submitTransferForm = null;
        }
        eventHandlers.viewTransaction.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewTransaction = [];
        staticListenersAdded = false;
        console.log("Mobile App listeners removed.");
    }


    // --- Initialization ---
    function initMobileAppTab() {
        console.log("Initializing Mobile App Tab...");
        fetchAccounts(); // Initial data load
        addStaticListeners(); // Add listeners for static elements
    }

     // --- Global Cleanup Function --- 
    window.cleanupCurrentTab = function() {
        console.log("Running cleanup for Mobile App Tab...");
        removeAllListeners();
    };

    // --- Initial Execution ---
    initMobileAppTab();

})(); // End of IIFE 