(function() {
    // Mobile App specific JavaScript
    console.log("mobile_app.js loaded and executing");

    // State
    let accountsData = [];
    let loansData = [];
    let partyId = localStorage.getItem('mobileAppPartyId') || "2513655771"; // Get from localStorage with fallback
    let staticListenersAdded = false;

    // --- DOM Elements ---
    function getElements() {
        return {
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

    function renderLoanCard(loan) {
        const formattedPrincipal = new Intl.NumberFormat('en-US', { style: 'currency', currency: loan.currency }).format(loan.principalAmount);
        const formattedOutstanding = new Intl.NumberFormat('en-US', { style: 'currency', currency: loan.currency }).format(loan.outstandingBalance);
        const formattedNextPayment = new Intl.NumberFormat('en-US', { style: 'currency', currency: loan.currency }).format(loan.nextPaymentAmount);
        
        // Format the date from YYYYMMDD to a more readable format
        const formatDate = (dateStr) => {
            if (!dateStr || dateStr.length !== 8) return "N/A";
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${month}/${day}/${year}`;
        };
        
        const nextPaymentDate = formatDate(loan.nextPaymentDate);
        const maturityDate = formatDate(loan.maturityDate);

        return `
            <div class="bg-white p-5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-semibold text-gray-800 text-lg">${loan.displayName}</span>
                    <span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">${loan.productName}</span>
                </div>
                <div class="text-2xl font-bold text-gray-900 mb-4">${formattedOutstanding}</div>
                
                <div class="bg-gray-50 p-3 rounded-lg mb-4">
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div class="flex flex-col">
                            <span class="text-gray-500 text-xs">Original Principal</span>
                            <span class="font-medium text-gray-800">${formattedPrincipal}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-gray-500 text-xs">Status</span>
                            <span class="font-medium text-green-600">${loan.status}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-gray-500 text-xs">Next Payment</span>
                            <span class="font-medium text-gray-800">${formattedNextPayment}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-gray-500 text-xs">Payment Date</span>
                            <span class="font-medium text-gray-800">${nextPaymentDate}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-gray-500 text-xs">Interest Rate</span>
                            <span class="font-medium text-gray-800">${loan.interestRate}%</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-gray-500 text-xs">Maturity Date</span>
                            <span class="font-medium text-gray-800">${maturityDate}</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500">ID: ${loan.loanId}</span>
                    <button data-loan-id="${loan.loanId}" class="view-loan-details-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                        View Schedule
                    </button>
                </div>
            </div>
        `;
    }

    function renderLoanScheduleItem(payment, currency) {
        const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(payment.totalAmount);
        const formattedPrincipal = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(payment.principal);
        const formattedInterest = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(payment.interest);
        
        // Format date from YYYYMMDD or YYYY-MM-DD to MM/DD/YYYY
        const formatDate = (dateStr) => {
            if (!dateStr) return "N/A";
            
            let year, month, day;
            
            // Handle YYYY-MM-DD format from API
            if (dateStr.includes('-')) {
                [year, month, day] = dateStr.split('-');
            } 
            // Handle YYYYMMDD format from fallback data
            else if (dateStr.length === 8) {
                year = dateStr.substring(0, 4);
                month = dateStr.substring(4, 6);
                day = dateStr.substring(6, 8);
            } else {
                return "N/A"; // Invalid format
            }
            
            return `${month}/${day}/${year}`;
        };
        
        const dueDate = formatDate(payment.dueDate);
        
        // Determine status class and badge
        let statusClass = 'bg-gray-100 text-gray-600'; // default
        if (payment.status === 'Due') {
            statusClass = 'bg-red-100 text-red-600';
        } else if (payment.status === 'Paid') {
            statusClass = 'bg-green-100 text-green-600';
        }
        
        return `
            <div class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center">
                        <span class="text-gray-800 font-semibold">Payment #${payment.paymentNumber}</span>
                        <span class="ml-2 px-2 py-0.5 text-xs rounded-full ${statusClass} font-medium">${payment.status}</span>
                    </div>
                    <span class="text-base font-bold text-gray-900">${formattedTotal}</span>
                </div>
                
                <div class="flex items-center mb-2 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span class="text-gray-600">Due on <span class="font-medium">${dueDate}</span></span>
                </div>
                
                <div class="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-gray-100">
                    <div class="flex flex-col">
                        <span class="text-xs text-gray-500">Principal</span>
                        <span class="text-sm font-medium text-gray-700">${formattedPrincipal}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs text-gray-500">Interest</span>
                        <span class="text-sm font-medium text-gray-700">${formattedInterest}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderLoanSchedule(schedule, targetDiv) {
        if (!targetDiv) return;
        if (!schedule || !schedule.payments || schedule.payments.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No payment schedule available.</div>';
            return;
        }
        
        // Show only the next 10 payments
        const displayPayments = schedule.payments.slice(0, 10);
        targetDiv.innerHTML = displayPayments.map(payment => renderLoanScheduleItem(payment, schedule.currency)).join('');
    }

    function renderLoanScheduleInfo(schedule, loan, targetDiv) {
        if (!targetDiv || !schedule || !loan) return;
        
        const formattedNext = new Intl.NumberFormat('en-US', { style: 'currency', currency: schedule.currency }).format(loan.nextPaymentAmount);
        const formattedOutstanding = new Intl.NumberFormat('en-US', { style: 'currency', currency: schedule.currency }).format(loan.outstandingBalance);
        
        // Format date from YYYYMMDD or YYYY-MM-DD to MM/DD/YYYY
        const formatDate = (dateStr) => {
            if (!dateStr) return "N/A";
            
            let year, month, day;
            
            // Handle YYYY-MM-DD format from API
            if (dateStr.includes('-')) {
                [year, month, day] = dateStr.split('-');
            } 
            // Handle YYYYMMDD format from fallback data
            else if (dateStr.length === 8) {
                year = dateStr.substring(0, 4);
                month = dateStr.substring(4, 6);
                day = dateStr.substring(6, 8);
            } else {
                return "N/A"; // Invalid format
            }
            
            return `${month}/${day}/${year}`;
        };
        
        const nextDate = formatDate(schedule.nextPaymentDate);
        
        targetDiv.innerHTML = `
            <div class="">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${loan.displayName}</h3>
                        <p class="text-sm text-gray-500">ID: ${loan.loanId} • ${loan.status}</p>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-sm text-gray-500">Outstanding Balance</span>
                        <span class="text-lg font-bold text-gray-900">${formattedOutstanding}</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mt-2">
                    <div class="bg-white rounded-lg p-3 border border-blue-100">
                        <span class="text-xs text-gray-500 block">Next Payment</span>
                        <span class="text-base font-semibold text-gray-900">${formattedNext}</span>
                    </div>
                    <div class="bg-white rounded-lg p-3 border border-blue-100">
                        <span class="text-xs text-gray-500 block">Due Date</span>
                        <span class="text-base font-semibold text-gray-900">${nextDate}</span>
                    </div>
                </div>
                
                <div class="mt-3 text-xs text-gray-600">
                    ${schedule.remainingPayments} payments remaining until complete
                </div>
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

    function renderLoans(loans, targetDiv) {
        if (!targetDiv) return;
        if (!loans || loans.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No loans found.</div>';
            return;
        }
        targetDiv.innerHTML = loans.map(renderLoanCard).join('');
        addLoanButtonListeners(); // Add listeners after rendering
    }

    // --- API Fetching ---
    async function fetchAccounts() {
        console.log("Fetching accounts for party ID:", partyId);
        const { accountsListDiv } = getElements();
        if (!accountsListDiv) return;
        try {
            // Show loading indicator
            accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading accounts...</div>';
            
            // Make the API call to get party arrangements from the new API
            const response = await fetch(`/api/mobile/party/${partyId}/arrangements?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const arrangementsData = await response.json();
            console.log("Party arrangements received:", arrangementsData);
            
            // Check if we have arrangements array
            const arrangements = arrangementsData.arrangements || [];
            if (arrangements.length === 0) {
                accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No accounts found for this customer.</div>';
                accountsData = [];
                return;
            }
            
            // Transform arrangements into account data
            const accounts = [];
            for (const arrangement of arrangements) {
                if (arrangement.productId === "CHECKING.ACCOUNT") {
                    // Get the balance for this arrangement
                    try {
                        const arrangementId = arrangement.arrangementId;
                        const balanceResponse = await fetch(`/api/mobile/accounts/${arrangementId}/balances?_=${Date.now()}`);
                        if (balanceResponse.ok) {
                            const balanceData = await balanceResponse.json();
                            accounts.push({
                                accountId: arrangementId,
                                displayName: arrangement.productName || "Current Account",
                                productName: arrangement.productTypeName || "Current Account",
                                type: "current",
                                currency: arrangement.currencyId || "USD",
                                currentBalance: balanceData.ledgerBalance || 0,
                                availableBalance: balanceData.availableBalance || 0,
                                creditLimit: balanceData.creditLimit || 0
                            });
                        } else {
                            // Add the account with default balance values if balance API fails
                            accounts.push({
                                accountId: arrangementId,
                                displayName: arrangement.productName || "Current Account",
                                productName: arrangement.productTypeName || "Current Account",
                                type: "current",
                                currency: arrangement.currencyId || "USD",
                                currentBalance: 0,
                                availableBalance: 0,
                                creditLimit: 0
                            });
                        }
                    } catch (error) {
                        console.error(`Error fetching balance for arrangement ${arrangement.arrangementId}:`, error);
                    }
                }
            }
            
            accountsData = accounts;
            console.log("Processed account data:", accountsData);
            
            // Update headless tab if it's initialized
            try {
                if (window.reloadHeadlessData) {
                    console.log("Updating headless tab with account API data");
                    window.reloadHeadlessData();
                }
            } catch (e) {
                console.log("Headless tab not available:", e);
            }
            
            renderAccounts(accountsData, accountsListDiv);
            populateFromAccountSelect(accountsData);
        } catch (error) {
            console.error("Error fetching accounts:", error);
            accountsListDiv.innerHTML = '<div class="text-center text-red-500 py-4">Could not load accounts.</div>';
        }
    }

    async function fetchLoans() {
        console.log("Fetching loans for party ID:", partyId);
        const { loansListDiv } = getElements();
        if (!loansListDiv) return;
        
        try {
            // Show loading indicator
            loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loans...</div>';
            
            // Make the API call
            const response = await fetch(`/api/mobile/party/${partyId}/loans?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            loansData = await response.json();
            console.log("Loans received:", loansData);
            
            // Update headless tab if it's initialized
            try {
                if (window.reloadHeadlessData) {
                    console.log("Updating headless tab with loan API data");
                    window.reloadHeadlessData();
                }
            } catch (e) {
                console.log("Headless tab not available:", e);
            }
            
            renderLoans(loansData, loansListDiv);
        } catch (error) {
            console.error("Error fetching loans:", error);
            loansListDiv.innerHTML = '<div class="text-center text-red-500 py-4">Could not load loans.</div>';
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

    async function fetchLoanSchedule(loanId) {
        console.log(`Fetching payment schedule for loan ${loanId}...`);
        const { loanScheduleList } = getElements();
        if (!loanScheduleList) return;
        
        loanScheduleList.innerHTML = '<div class="text-center text-gray-500 py-4">Loading payment schedule...</div>'; // Show loading
        
        try {
            // Make the API call
            const response = await fetch(`/api/mobile/loans/${loanId}/schedules?_=${Date.now()}`);
            if (!response.ok) {
                console.error(`HTTP Error: ${response.status} - ${response.statusText}`);
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const schedule = await response.json();
            console.log(`Payment schedule for ${loanId}:`, schedule);
            
            // Validate schedule data
            if (!schedule) {
                console.error("Empty schedule data received");
                throw new Error("No schedule data received from server");
            }
            
            if (!schedule.payments || !Array.isArray(schedule.payments)) {
                console.error("Invalid or missing payments array in schedule data:", schedule);
                throw new Error("Invalid schedule data format");
            }
            
            // Update headless tab to show schedules API call
            try {
                if (window.reloadHeadlessData) {
                    console.log("Updating headless tab with schedule API data");
                    setTimeout(() => {
                        if (window.showLoanSchedulesApiCall) {
                            window.showLoanSchedulesApiCall();
                        }
                    }, 500); // Give time for the API call to be stored
                }
            } catch (e) {
                console.log("Headless tab not available:", e);
            }
            
            // Find the loan details
            const loan = loansData.find(loan => loan.loanId === loanId);
            if (!loan) {
                console.error(`Loan details not found for ${loanId} in`, loansData);
                throw new Error(`Loan details not found for ${loanId}`);
            }
            
            // Update the UI
            const { loanScheduleInfo } = getElements();
            renderLoanScheduleInfo(schedule, loan, loanScheduleInfo);
            renderLoanSchedule(schedule, loanScheduleList);
            
            return schedule;
        } catch (error) {
            console.error(`Error fetching payment schedule for ${loanId}:`, error);
            loanScheduleList.innerHTML = `<div class="text-center text-red-500 py-4">Could not load payment schedule: ${error.message}</div>`;
            return null;
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

    function showLoanSchedule(loanId) {
        const loan = loansData.find(loan => loan.loanId === loanId);
        if (!loan) return;

        const { loansSectionDiv, loanScheduleSection, loanScheduleTitle } = getElements();
        if(loansSectionDiv) loansSectionDiv.classList.add('hidden');
        if(loanScheduleSection) loanScheduleSection.classList.remove('hidden');
        if(loanScheduleTitle) loanScheduleTitle.textContent = `Payment Schedule: ${loan.displayName}`;
        
        // Fetch the schedule, which will update the headless tab automatically
        fetchLoanSchedule(loanId);
    }

    function showLoans() {
        const { loansSectionDiv, loanScheduleSection } = getElements();
         if(loansSectionDiv) loansSectionDiv.classList.remove('hidden');
         if(loanScheduleSection) loanScheduleSection.classList.add('hidden');
    }

    // --- Event Listener Management ---
    const eventHandlers = {
        backToAccounts: null,
        backToLoans: null,
        showTransfer: null,
        closeTransfer: null,
        submitTransferForm: null,
        viewTransaction: [], // Array for dynamic buttons
        viewLoanDetails: [] // Array for dynamic loan detail button listeners
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

    function addLoanButtonListeners() {
        const { loansListDiv } = getElements();
        if (!loansListDiv) return;

        // Remove previous dynamic listeners if they exist
        if (!eventHandlers.viewLoanDetails) {
            eventHandlers.viewLoanDetails = [];
        } else {
            eventHandlers.viewLoanDetails.forEach(({button, handler}) => button.removeEventListener('click', handler));
            eventHandlers.viewLoanDetails = [];
        }

        loansListDiv.querySelectorAll('.view-loan-details-btn').forEach(button => {
             const handler = (e) => {
                const loanId = e.target.getAttribute('data-loan-id');
                showLoanSchedule(loanId);
             };
             button.addEventListener('click', handler);
             eventHandlers.viewLoanDetails.push({ button, handler });
        });
    }

    function addStaticListeners() {
        if (staticListenersAdded) return;
        const { 
            backToAccountsButton, 
            backToLoansButton, 
            showTransferButton, 
            closeTransferButton, 
            transferForm 
        } = getElements();

        if (backToAccountsButton) {
             eventHandlers.backToAccounts = showAccounts;
             backToAccountsButton.addEventListener('click', eventHandlers.backToAccounts);
        }
        
        if (backToLoansButton) {
            eventHandlers.backToLoans = showLoans;
            backToLoansButton.addEventListener('click', eventHandlers.backToLoans);
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
        const { 
            backToAccountsButton, 
            backToLoansButton,
            showTransferButton, 
            closeTransferButton, 
            transferForm 
        } = getElements();

         if (eventHandlers.backToAccounts && backToAccountsButton) {
            backToAccountsButton.removeEventListener('click', eventHandlers.backToAccounts);
            eventHandlers.backToAccounts = null;
        }
        
        if (eventHandlers.backToLoans && backToLoansButton) {
            backToLoansButton.removeEventListener('click', eventHandlers.backToLoans);
            eventHandlers.backToLoans = null;
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
        eventHandlers.viewLoanDetails.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewLoanDetails = [];
        staticListenersAdded = false;
        console.log("Mobile App listeners removed.");
    }

    // --- Party ID Change Handling ---
    function addPartyIdChangeListener() {
        const { partyIdInput, changePartyIdButton } = getElements();
        if (partyIdInput && changePartyIdButton) {
            changePartyIdButton.addEventListener('click', handlePartyIdChange);
            
            // Also handle Enter key in the input
            partyIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePartyIdChange();
                }
            });
        }
    }
    
    function handlePartyIdChange() {
        const { partyIdInput, accountsListDiv, loansListDiv } = getElements();
        if (!partyIdInput) return;
        
        const newPartyId = partyIdInput.value.trim();
        
        if (newPartyId && newPartyId !== partyId) {
            console.log(`Changing party ID from ${partyId} to ${newPartyId}`);
            partyId = newPartyId;
            
            // Store in localStorage for persistence
            localStorage.setItem('mobileAppPartyId', partyId);
            
            // Reset data
            accountsData = [];
            loansData = [];
            
            // Show loading messages
            if (accountsListDiv) {
                accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading accounts...</div>';
            }
            if (loansListDiv) {
                loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loans...</div>';
            }
            
            // Fetch both accounts and loans with the new party ID
            fetchAccounts();
            fetchLoans();
        }
    }

    // --- Initialization ---
    function initMobileAppTab() {
        console.log("Initializing Mobile App Tab...");
        
        // Set the input field to show the current party ID
        const { partyIdInput } = getElements();
        if (partyIdInput) {
            partyIdInput.value = partyId;
        }
        
        addStaticListeners();
        addPartyIdChangeListener();
        fetchAccounts();
        fetchLoans();
    }

    // --- Global Cleanup Function --- 
    // Exposed for dashboard.js to call when switching tabs
    window.cleanupCurrentTab = function() {
        console.log("Running cleanup for Mobile App Tab...");
        removeAllListeners();

        // Remove party ID change listeners
        const { partyIdInput, changePartyIdButton } = getElements();
        if (partyIdInput) {
            partyIdInput.removeEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePartyIdChange();
                }
            });
        }
        if (changePartyIdButton) {
            changePartyIdButton.removeEventListener('click', handlePartyIdChange);
        }
    };

    // Initialize when loaded
    initMobileAppTab();

})(); // End of IIFE 