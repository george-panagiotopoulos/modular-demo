(function() {
    // Mobile App specific JavaScript
    console.log("mobile_app.js loaded and executing");

    // State
    let accountsData = [];
    let loansData = [];
    let partyId = localStorage.getItem('mobileAppPartyId');
    
    // Check if we have a party ID from localStorage, otherwise set to default
    if (!partyId || partyId.trim() === "") {
        partyId = "2514672778";
        console.log("No party ID found in localStorage - using default: 2514672778");
    } else {
        console.log("Using Party ID from localStorage:", partyId);
    }

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
    // Helper function to safely format currency
    function formatCurrency(amount, currency = 'USD') {
        // Handle null, undefined, or invalid amounts
        if (amount === null || amount === undefined || isNaN(amount)) {
            amount = 0;
        }
        
        // Handle empty or invalid currency codes
        if (!currency || typeof currency !== 'string' || currency.trim().length === 0) {
            currency = 'USD';
        }
        
        try {
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: currency.toUpperCase().trim()
            }).format(Number(amount));
        } catch (error) {
            // Fallback if currency is invalid
            console.warn(`Invalid currency code: ${currency}, using USD as fallback`);
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD'
            }).format(Number(amount));
        }
    }

    function renderAccountCard(account, isLoan = false) {
        const balance = account.currentBalance || 0;
        const availableBalance = account.availableBalance || 0;
        const balanceClass = balance < 0 ? 'text-red-600' : 'text-green-600';
        
        const formattedBalance = formatCurrency(Math.abs(balance), account.currency);
        const formattedAvailable = formatCurrency(availableBalance, account.currency);

        return `
            <div class="account-card p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors" data-account-id="${account.accountId}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-medium text-gray-900">${account.displayName || 'Account'}</h4>
                        <p class="text-sm text-gray-600">${account.accountId}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-semibold ${balanceClass}">${formattedBalance}</div>
                        <div class="text-xs text-gray-500">Available: ${formattedAvailable}</div>
                    </div>
                </div>
                <div class="mt-3 flex space-x-2">
                    <button class="view-transactions-btn text-xs text-blue-600 hover:underline focus:outline-none" data-account-id="${account.accountId}">
                        View Transactions
                    </button>
                </div>
            </div>
        `;
    }

    function renderTransactionItem(transaction) {
        const formattedAmount = formatCurrency(transaction.amount, transaction.currency);
        
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
                    <div class="font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}">${formattedAmount}</div>
                    <div class="text-xs text-gray-500">${transaction.status}</div>
                </div>
            </div>
        `;
    }

    function renderLoanCard(loan) {
        // Handle missing financial data gracefully
        const outstandingBalance = loan.outstandingBalance || loan.principalAmount || 0;
        const currency = loan.currency || 'USD';
        const formattedBalance = formatCurrency(outstandingBalance, currency);
        
        return `
            <div class="loan-card p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors" data-loan-id="${loan.loanId}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-medium text-gray-900">${loan.displayName || loan.productName || 'Loan'}</h4>
                        <p class="text-sm text-gray-600">${loan.loanId}</p>
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
    }

    function renderLoanSchedule(schedule, targetDiv) {
        if (!targetDiv) return;
        if (!schedule || !schedule.payments || schedule.payments.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No payment schedule available.</div>';
            return;
        }
        
        // Show only the next 10 payments
        const displayPayments = schedule.payments.slice(0, 10);
        
        // Use an elegant card layout optimized for mobile
        targetDiv.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg border border-gray-100">
                <div class="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h3 class="text-lg font-bold text-gray-800 mb-1">Payment Schedule</h3>
                    <p class="text-sm text-blue-600 font-medium">Next ${displayPayments.length} payments</p>
                </div>
                <div class="divide-y divide-gray-50">
                    ${displayPayments.map(payment => renderLoanScheduleMobileCard(payment, schedule.currency)).join('')}
                </div>
            </div>
        `;
    }

    function renderLoanScheduleMobileCard(payment, currency) {
        const formattedTotal = formatCurrency(payment.totalAmount, currency);
        const formattedPrincipal = formatCurrency(payment.principal, currency);
        const formattedInterest = formatCurrency(payment.interest, currency);

        // Format date - handle both YYYY-MM-DD and YYYYMMDD formats
        const formatDate = (dateStr) => {
            if (!dateStr) return "N/A";
            if (dateStr.includes('-')) {
                return new Date(dateStr).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            } else if (dateStr.length === 8) {
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            }
            return dateStr;
        };

        const statusColor = payment.status === "Due" ? "text-red-700 bg-red-100 border-red-200" : "text-blue-700 bg-blue-100 border-blue-200";

        return `
            <div class="p-5 hover:bg-gray-25 transition-colors duration-200">
                <div class="flex justify-between items-center mb-3">
                    <div class="flex-1">
                        <div class="text-base font-semibold text-gray-800 mb-1">${formatDate(payment.dueDate)}</div>
                        <div class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${statusColor}">
                            ${payment.status}
                        </div>
                    </div>
                    <div class="text-right ml-4">
                        <div class="text-xl font-bold text-gray-900">${formattedTotal}</div>
                        <div class="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Payment</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-gray-100">
                    <div class="text-center">
                        <div class="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Principal</div>
                        <div class="text-base font-semibold text-green-700">${formattedPrincipal}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Interest</div>
                        <div class="text-base font-semibold text-orange-600">${formattedInterest}</div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderLoanScheduleInfo(schedule, loan, targetDiv) {
        if (!targetDiv || !schedule || !loan) return;
        
        // Get next payment info from the first payment in the schedule
        let nextPaymentAmount = 0;
        let nextPaymentDate = "";
        
        if (schedule.payments && schedule.payments.length > 0) {
            // Find the first due or pending payment
            const nextPayment = schedule.payments.find(payment => 
                payment.status === "Due" || payment.status === "Pending"
            ) || schedule.payments[0];
            
            nextPaymentAmount = nextPayment.totalAmount || 0;
            nextPaymentDate = nextPayment.dueDate || "";
        }
        
        const formattedNext = formatCurrency(nextPaymentAmount, schedule.currency);
        const formattedOutstanding = formatCurrency(loan.outstandingBalance, schedule.currency);
        
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
        
        const nextDate = formatDate(nextPaymentDate);
        const remainingPayments = schedule.payments ? schedule.payments.filter(p => p.status === "Pending").length : 0;
        
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
                    ${remainingPayments} payments remaining until complete
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
        
        // Check if party ID is available
        if (!partyId || partyId.trim() === "") {
            accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Please enter a Party ID above to load accounts.</div>';
            accountsData = [];
            return;
        }
        
        try {
            // Show loading indicator
            accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading accounts...</div>';
            
            // Use the new unified API endpoint
            const apiUrl = `/api/parties/${partyId}/accounts?_=${Date.now()}`;
            console.log("Fetching accounts from unified API: " + apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const accounts = await response.json();
            console.log("Accounts received from unified API:", accounts);
            
            // Keep all accounts - don't filter by type since the API returns proper current accounts
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
            accountsListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load accounts: ${error.message}</div>`;
        }
    }

    async function fetchLoans() {
        console.log("Fetching loans for party ID:", partyId);
        const { loansListDiv } = getElements();
        if (!loansListDiv) return;
        
        // Check if party ID is available
        if (!partyId || partyId.trim() === "") {
            loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Please enter a Party ID above to load loans.</div>';
            loansData = [];
            return;
        }
        
        try {
            // Show loading indicator
            loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loans...</div>';
            
            // Use the new unified API endpoint for loans
            const apiUrl = `/api/parties/${partyId}/loans?_=${Date.now()}`;
            console.log("Fetching loans from unified API: " + apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const loans = await response.json();
            console.log("Loans received from unified API:", loans);
            
            if (loans.length === 0) {
                loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No loans found for this customer.</div>';
                loansData = [];
                return;
            }
            
            loansData = loans;
            console.log("Processed loan data:", loansData);
            
            renderLoans(loansData, loansListDiv);
        } catch (error) {
            console.error("Error fetching loans:", error);
            loansListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load loans: ${error.message}</div>`;
        }
    }

    async function fetchTransactions(accountId) {
        console.log(`Fetching transactions for account ID: ${accountId}`);
        const { transactionsListDiv } = getElements();
        if (!transactionsListDiv) return;
        
        try {
            // Show loading indicator
            transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading transactions...</div>';
            
            // Use the new unified API endpoint for transactions
            const apiUrl = `/api/accounts/${accountId}/transactions?partyId=${partyId}&_=${Date.now()}`;
            console.log("Fetching transactions from unified API:", apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const transactions = await response.json();
            console.log("Transactions data received from unified API:", transactions);
            
            if (transactions.length === 0) {
                transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
                return;
            }
            
            // Transform API data into transaction objects for rendering
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
            
            renderTransactions(formattedTransactions, transactionsListDiv);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            transactionsListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load transactions: ${error.message}</div>`;
        }
    }

    async function submitTransfer(formData) {
        console.log("Submitting transfer:", formData);
        const { transferResultDiv } = getElements();
        if (!transferResultDiv) return;
        transferResultDiv.textContent = 'Processing transfer...';
        transferResultDiv.className = 'mt-4 text-center text-gray-600'; // Reset style

        try {
            // Use the debit account API from Demoflow.py
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
            console.log("Transfer result:", result);

            transferResultDiv.textContent = `Success: Transfer completed (ID: ${debitPayload.paymentTransactionReference})`;
            transferResultDiv.className = 'mt-4 text-center text-green-600 font-semibold';
            
            // Optionally clear form or close section after delay
            setTimeout(() => {
                hideTransfer(); // Close transfer section after success
                fetchAccounts(); // Refresh account list to show new balance
            }, 2000); // Reduced delay slightly
        } catch (error) {
            console.error("Error submitting transfer:", error);
            transferResultDiv.textContent = `Error: ${error.message}`;
            transferResultDiv.className = 'mt-4 text-center text-red-600 font-semibold';
        }
    }

    async function fetchLoanSchedule(loanId) {
        console.log(`[fetchLoanSchedule] Attempting to fetch schedule for loan ID: ${loanId}`);
        const { loanScheduleList, loanScheduleInfo } = getElements(); // Corrected from loanScheduleDiv, loanScheduleInfoDiv
        
        if (!loanScheduleList) {
            console.error("[fetchLoanSchedule] loanScheduleList element not found in DOM!");
            // Optionally, display an error message in a general error area if available
            return null; // Exit if essential element is missing
        }
        if (!loanScheduleInfo) {
            console.warn("[fetchLoanSchedule] loanScheduleInfo element not found in DOM. Info will not be displayed.");
        }
        console.log("[fetchLoanSchedule] DOM elements for schedule:", { loanScheduleList, loanScheduleInfo });

        try {
            // Show loading indicator
            loanScheduleList.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loan schedule...</div>';
            
            // Get the loan from our cached data
            const loan = loansData.find(l => l.loanId === loanId);
            if (!loan) {
                throw new Error("Loan not found in cached data");
            }
            
            // Use the new unified API endpoint for loan schedules
            const apiUrl = `/api/loans/${loanId}/schedules?_=${Date.now()}`;
            console.log("Fetching loan schedule from unified API:", apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const scheduleData = await response.json();
            console.log(`Schedule data for ${loanId}:`, scheduleData);
            
            // The unified API returns schedules with scheduleItems
            if (!scheduleData || !scheduleData.schedules || !Array.isArray(scheduleData.schedules) || 
                scheduleData.schedules.length === 0 || !scheduleData.schedules[0].scheduleItems) {
                throw new Error("Invalid schedule data format");
            }
            
            // Extract the schedule items from the first schedule
            const scheduleItems = scheduleData.schedules[0].scheduleItems;
            
            // Transform the data to match what the rendering functions expect
            const transformedScheduleData = {
                loanId: scheduleData.loanId,
                currency: scheduleData.currency,
                payments: scheduleItems.map(item => ({
                    dueDate: item.dueDate,
                    principal: item.principal,
                    interest: item.interest,
                    totalAmount: item.totalAmount,
                    status: item.status
                }))
            };
            
            console.log(`Processed payment schedule for ${loanId}:`, transformedScheduleData);
            
            // Find the loan details
            const loanDetails = loansData.find(l => l.loanId === loanId);
            if (!loanDetails) {
                console.error(`Loan details not found for ${loanId} in`, loansData);
                throw new Error(`Loan details not found for ${loanId}`);
            }
            
            // Update the UI
            renderLoanScheduleInfo(transformedScheduleData, loanDetails, loanScheduleInfo);
            renderLoanSchedule(transformedScheduleData, loanScheduleList);
            
            return transformedScheduleData;
        } catch (error) {
            console.error(`Error fetching payment schedule for ${loanId}:`, error);
            loanScheduleList.innerHTML = `<div class="text-center text-red-500 py-4">Could not load payment schedule: ${error.message}</div>`;
            return null;
        }
    }

    // --- UI Interaction ---
    function showHome() {
        console.log("Showing home view with party ID:", partyId);
        
        // Show accounts and loans sections, hide others
        const elements = getElements();
        elements.accountsSectionDiv.classList.remove('hidden');
        elements.loansSectionDiv.classList.remove('hidden');
        elements.transactionsSection.classList.add('hidden');
        elements.loanScheduleSection.classList.add('hidden');
        elements.transferSection.classList.add('hidden');
        
        // Load data
        fetchAccounts();
        fetchLoans();
    }
    
    function showTransactions(id) {
        // Get the elements we need
        const { accountsSectionDiv, loansSectionDiv, transactionsSection, transferSection, loanScheduleSection } = getElements();
        console.log("[showTransactions] Destructured elements:", 
            { accountsSectionDiv, loansSectionDiv, transactionsSection, transferSection, loanScheduleSection });

        // Hide other sections
        if (accountsSectionDiv) {
            accountsSectionDiv.classList.add('hidden');
        } else {
            console.error("[showTransactions] accountsSectionDiv is null/undefined BEFORE classList access.");
        }

        if (loansSectionDiv) {
            loansSectionDiv.classList.add('hidden');
        } else {
            console.error("[showTransactions] loansSectionDiv is null/undefined BEFORE classList access.");
        }

        if (transferSection) {
            transferSection.classList.add('hidden');
        } else {
            console.error("[showTransactions] transferSection is null/undefined BEFORE classList access.");
        }

        if (loanScheduleSection) {
            loanScheduleSection.classList.add('hidden');
        } else {
            console.error("[showTransactions] loanScheduleSection is null/undefined BEFORE classList access.");
        }
        
        // Show transactions section
        if (transactionsSection) {
            transactionsSection.classList.remove('hidden');
        } else {
            console.error("[showTransactions] transactionsSection is null/undefined BEFORE classList access.");
        }
        
        // Update the header
        const account = accountsData.find(acc => acc.accountId === id);
        const loan = loansData.find(loan => loan.loanId === id);
        
        // Get the transaction header element
        const transactionHeader = document.querySelector('#transactions-section .flex.justify-between.items-center');
        
        // If there's no back button, create one
        let backButton = document.getElementById('transactions-back-button');
        if (!backButton && transactionHeader) {
            // Create a back button if it doesn't exist
            backButton = document.createElement('button');
            backButton.id = 'transactions-back-button';
            backButton.className = 'text-blue-600 hover:underline';
            backButton.innerHTML = '&larr; Back';
            
            // Add it to the header
            transactionHeader.insertBefore(backButton, transactionHeader.firstChild);
            
            // Add click event - always go back to home
            backButton.addEventListener('click', showHome);
        }
        
        // Set the account or loan name in the header
        const accountNameElem = document.getElementById('transaction-account-name');
        if (accountNameElem) {
            if (account) {
                const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.currentBalance);
                accountNameElem.textContent = `${account.displayName} (${account.accountId}) · ${formattedBalance}`;
            } else if (loan) {
                const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: loan.currency }).format(loan.outstandingBalance);
                const loanDisplayName = `${loan.productName || 'Loan'} (${loan.loanId})`;
                accountNameElem.textContent = `${loanDisplayName} · ${formattedBalance}`;
            } else {
                accountNameElem.textContent = "Account Details";
            }
        }
        
        // Fetch account transactions - make sure we use the correct accountId for API call
        if (account) {
            // Use account.accountId, not just 'id', to ensure correct API call
            console.log(`[showTransactions] Fetching transactions for account: ${account.accountId}`);
            fetchTransactions(account.accountId);
        } 
        // Fetch loan transactions using the Holdings API
        else if (loan) {
            const { transactionsListDiv } = getElements();
            transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading transactions...</div>';
            console.log(`[showTransactions] Showing transactions for loan: ${loan.loanId}`);
            
            if (loan.accountIdForTransactions) {
                const apiUrl = `/api/proxy/holdings/accounts/${loan.accountIdForTransactions}/transactions?_=${Date.now()}`;
                console.log("Fetching loan transactions from URL (using accountIdForTransactions from loan object):", apiUrl);
                
                fetch(apiUrl)
                    .then(response => {
                        if (!response.ok) {
                            return response.text().then(text => {
                                console.error(`HTTP Error ${response.status}: ${text}`);
                                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
                            });
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("Loan transactions data received:", data);
                        
                        const transactions = data.items || [];
                        if (transactions.length === 0) {
                            transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this loan.</div>';
                            return;
                        }
                        
                        // Format the transactions for display
                        const formattedTransactions = transactions.map(tx => ({
                            id: tx.id || `tx-${Math.random().toString(36).substring(2, 10)}`,
                            date: tx.valueDate || tx.bookingDate,
                            amount: tx.transactionAmount || 0,
                            currency: tx.currency || loan.currency,
                            description: tx.narrative || "Loan Transaction",
                            type: tx.paymentIndicator || "Debit",
                            icon: tx.paymentIndicator === "Credit" ? "arrow-down" : "arrow-up",
                            status: "Completed"
                        }));
                        
                        renderTransactions(formattedTransactions, transactionsListDiv);
                    })
                    .catch(error => {
                        console.error("Error fetching loan transactions:", error);
                        transactionsListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load loan transactions: ${error.message}</div>`;
                    });
            } else {
                console.warn(`Loan ${loan.loanId} does not have an accountIdForTransactions. Cannot fetch transactions.`);
                transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Transaction details are not available for this loan.</div>';
            }
        } else {
            const { transactionsListDiv } = getElements();
            transactionsListDiv.innerHTML = '<div class="text-center text-red-500 py-4">Account or loan not found.</div>';
        }
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
        
        // Get the schedule header element for adding back button
        const scheduleHeader = document.querySelector('#loan-schedule-section .flex.justify-between.items-center');
        
        // If there's no back button, create one
        let backButton = document.getElementById('back-to-loans');
        if (!backButton && scheduleHeader) {
            // Create a back button if it doesn't exist
            backButton = document.createElement('button');
            backButton.id = 'back-to-loans';
            backButton.className = 'text-blue-600 hover:underline';
            backButton.innerHTML = '&larr; Back';
            
            // Add it to the header
            scheduleHeader.insertBefore(backButton, scheduleHeader.firstChild);
            
            // Add click event - always go back to home
            backButton.addEventListener('click', showHome);
        }
        
        // Ensure loanScheduleList exists
        let loanScheduleList = document.getElementById('loan-schedule-list');
        if (!loanScheduleList && loanScheduleSection) {
            // Create the loan schedule list
            loanScheduleList = document.createElement('div');
            loanScheduleList.id = 'loan-schedule-list';
            loanScheduleList.className = 'space-y-2 max-h-96 overflow-y-auto p-2';
            loanScheduleSection.appendChild(loanScheduleList);
        }
        
        // Ensure loanScheduleInfo exists
        let loanScheduleInfo = document.getElementById('loan-schedule-info');
        if (!loanScheduleInfo && loanScheduleSection) {
            // Create the loan schedule info
            loanScheduleInfo = document.createElement('div');
            loanScheduleInfo.id = 'loan-schedule-info';
            loanScheduleInfo.className = 'bg-blue-50 p-4 border-b border-blue-100';
            
            // Add it before the schedule list
            if (loanScheduleList) {
                loanScheduleSection.insertBefore(loanScheduleInfo, loanScheduleList);
            } else {
                loanScheduleSection.appendChild(loanScheduleInfo);
            }
        }
        
        const loanDisplayName = `${loan.productName || 'Loan'} (${loan.loanId})`;
        if(loanScheduleTitle) loanScheduleTitle.textContent = `Payment Schedule: ${loanDisplayName}`;
        
        console.log(`[showLoanSchedule] Showing schedule for loan: ${loan.loanId}`);
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
        viewLoanDetails: [], // Array for dynamic loan detail button listeners
        changePartyId: null,
        fetchAccountBalance: null
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
        
        // Clear existing handlers for loan detail buttons if any
        if (!eventHandlers.viewLoanDetails) {
            eventHandlers.viewLoanDetails = [];
        } else {
            eventHandlers.viewLoanDetails.forEach(({button, handler}) => button.removeEventListener('click', handler));
            eventHandlers.viewLoanDetails = [];
        }
        
        // Clear existing handlers for loan transaction buttons if any
        if (!eventHandlers.viewLoanTransactions) {
            eventHandlers.viewLoanTransactions = [];
        } else {
            eventHandlers.viewLoanTransactions.forEach(({button, handler}) => button.removeEventListener('click', handler));
            eventHandlers.viewLoanTransactions = [];
        }

        // Add handlers for schedule buttons
        loansListDiv.querySelectorAll('.view-loan-details-btn').forEach(button => {
             const handler = (e) => {
                const loanId = e.target.getAttribute('data-loan-id');
                showLoanSchedule(loanId);
             };
             button.addEventListener('click', handler);
             eventHandlers.viewLoanDetails.push({ button, handler });
        });
        
        // Add handlers for transaction buttons
        loansListDiv.querySelectorAll('.view-loan-transactions-btn').forEach(button => {
             const handler = (e) => {
                const loanId = e.target.getAttribute('data-loan-id');
                showTransactions(loanId);
             };
             button.addEventListener('click', handler);
             eventHandlers.viewLoanTransactions.push({ button, handler });
        });
    }

    function addStaticListeners() {
        if (staticListenersAdded) return;
        
        const { 
            backToAccountsButton, 
            backToLoansButton, 
            showTransferButton, 
            closeTransferButton,
            transferForm,
            changePartyIdButton,
        } = getElements();

        // Hide the static back buttons since we're creating dynamic ones
        if (backToAccountsButton) {
            backToAccountsButton.classList.add('hidden');
        }
        
        if (backToLoansButton) {
            backToLoansButton.classList.add('hidden');
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
        
        if (changePartyIdButton) {
            eventHandlers.changePartyId = handlePartyIdChange;
            changePartyIdButton.addEventListener('click', eventHandlers.changePartyId);
        }
        
        staticListenersAdded = true;
    }

    function removeAllListeners() {
        console.log("Removing all event listeners");
        
        // Get all elements
        const { 
            backToAccountsButton, 
            backToLoansButton, 
            showTransferButton, 
            closeTransferButton,
            transferForm,
            changePartyIdButton,
        } = getElements();

        // Remove handlers for dynamic transaction buttons
        if (eventHandlers.viewTransaction.length > 0) {
            const transactionButtons = document.querySelectorAll('.view-transactions-btn');
            transactionButtons.forEach((btn, index) => {
                if (eventHandlers.viewTransaction[index]) {
                    btn.removeEventListener('click', eventHandlers.viewTransaction[index]);
                }
            });
            eventHandlers.viewTransaction = [];
        }

        // Remove handlers for dynamic loan detail buttons
        if (eventHandlers.viewLoanDetails.length > 0) {
            const loanDetailsButtons = document.querySelectorAll('.view-loan-details-btn');
            loanDetailsButtons.forEach((btn, index) => {
                if (eventHandlers.viewLoanDetails[index]) {
                    btn.removeEventListener('click', eventHandlers.viewLoanDetails[index]);
                }
            });
            eventHandlers.viewLoanDetails = [];
        }

        // Remove back to accounts handler
        if (backToAccountsButton && eventHandlers.backToAccounts) {
            backToAccountsButton.removeEventListener('click', eventHandlers.backToAccounts);
            eventHandlers.backToAccounts = null;
        }
        
        // Remove back to loans handler
        if (backToLoansButton && eventHandlers.backToLoans) {
            backToLoansButton.removeEventListener('click', eventHandlers.backToLoans);
            eventHandlers.backToLoans = null;
        }
        
        // Remove show transfer handler
        if (showTransferButton && eventHandlers.showTransfer) {
            showTransferButton.removeEventListener('click', eventHandlers.showTransfer);
            eventHandlers.showTransfer = null;
        }
        
        // Remove close transfer handler
        if (closeTransferButton && eventHandlers.closeTransfer) {
            closeTransferButton.removeEventListener('click', eventHandlers.closeTransfer);
            eventHandlers.closeTransfer = null;
        }
        
        // Remove transfer form submit handler
        if (transferForm && eventHandlers.submitTransferForm) {
            transferForm.removeEventListener('submit', eventHandlers.submitTransferForm);
            eventHandlers.submitTransferForm = null;
        }
        
        // Remove change party ID handler
        if (changePartyIdButton && eventHandlers.changePartyId) {
            changePartyIdButton.removeEventListener('click', eventHandlers.changePartyId);
            eventHandlers.changePartyId = null;
        }
        
        staticListenersAdded = false;
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
        console.log("Initializing mobile app tab");
        
        // Set the party ID input field value
        const elements = getElements();
        if (elements.partyIdInput) {
            elements.partyIdInput.value = partyId;
        }
        
        // Add static listeners if not already added
        if (!staticListenersAdded) {
            addStaticListeners();
            staticListenersAdded = true;
        }
        
        // Load initial data
        showHome();
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

    // Helper to get account or loan by ID
    function getAccountOrLoanById(id) {
        // First check accounts
        const account = accountsData.find(acc => acc.accountId === id || acc.arrangementId === id);
        if (account) return { item: account, type: 'account' };
        
        // Then check loans
        const loan = loansData.find(l => l.loanId === id || l.arrangementId === id || l.accountId === id);
        if (loan) return { item: loan, type: 'loan' };
        
        return null;
    }

})(); // End of IIFE