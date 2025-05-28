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
            profileContent: document.getElementById('profile-content'),
            profileSection: document.getElementById('profile-section'),
            loanDetailsInfo: document.getElementById('loan-details-info'),
        };
    }

    // --- Rendering Functions ---
    // Helper function to safely format currency
    function formatCurrency(amount, currency = 'USD') {
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
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            // Handle different date formats
            let date;
            if (dateString.includes('-')) {
                // YYYY-MM-DD format
                date = new Date(dateString);
            } else if (dateString.length === 8) {
                // YYYYMMDD format
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                date = new Date(`${year}-${month}-${day}`);
            } else {
                date = new Date(dateString);
            }
            
            if (isNaN(date.getTime())) {
                return 'N/A';
            }
            
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'N/A';
        }
    }

    function renderAccountCard(account, isLoan = false) {
        const balance = account.currentBalance || 0;
        const availableBalance = account.availableBalance || 0;
        
        // Determine if this is a deposit account
        const isDeposit = account.type === 'deposit' || account.productLine === 'DEPOSITS';
        const accountTypeLabel = isDeposit ? 'Term Deposit' : 'Current Account';
        
        // Set balance color: green for deposits, red for negative balances, green for positive balances
        let balanceClass;
        if (isDeposit) {
            balanceClass = 'text-green-600'; // Always green for term deposits
        } else {
            balanceClass = balance < 0 ? 'text-red-600' : 'text-green-600';
        }
        
        const formattedBalance = formatCurrency(Math.abs(balance), account.currency);
        const formattedAvailable = formatCurrency(availableBalance, account.currency);

        // Consistent card styling for all account types
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
    }

    function renderTransactionItem(transaction) {
        const formattedAmount = formatCurrency(transaction.amount, transaction.currency);
        
        // Determine transaction color - green for credits/deposits, red for debits
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
    }

    function renderLoanCard(loan) {
        const formattedBalance = formatCurrency(loan.outstandingBalance, loan.currency);
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
    }

    function renderLoanSchedule(schedule, currency = 'USD') {
        const loanScheduleList = document.getElementById('loan-schedule-list');
        
        if (!loanScheduleList) {
            console.error('Loan schedule list element not found');
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
                        <h3 class="font-bold text-gray-800">${formatDate(payment.dueDate)}</h3>
                    </div>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Amount:</span>
                            <span class="font-medium">${formatCurrency(payment.totalAmount, currency)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Principal:</span>
                            <span>${formatCurrency(payment.principalAmount, currency)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Interest:</span>
                            <span>${formatCurrency(payment.interestAmount, currency)}</span>
                        </div>
                        <div class="flex justify-between border-t pt-1 mt-2">
                            <span class="text-gray-600">Remaining Balance:</span>
                            <span class="font-medium text-blue-600">${formatCurrency(outstandingAmount, currency)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        loanScheduleList.innerHTML = scheduleHTML;
    }

    function renderLoanScheduleInfo(loan, schedule) {
        const loanScheduleInfo = document.getElementById('loan-schedule-info');
        
        if (!loanScheduleInfo) {
            console.error('Loan schedule info element not found');
            return;
        }
        
        // Get next payment info from schedule
        const nextPayment = schedule && schedule.length > 0 ? schedule[0] : null;
        const nextPaymentAmount = nextPayment ? formatCurrency(nextPayment.totalAmount, loan.currency || 'USD') : 'N/A';
        const nextPaymentDate = nextPayment ? formatDate(nextPayment.dueDate) : 'N/A';
        
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
                        <span class="font-semibold text-red-600">${formatCurrency(outstandingBalance, loan.currency || 'USD')}</span>
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
    }

    function renderAccounts(accounts, targetDiv) {
        if (!targetDiv) return;
        if (!accounts || accounts.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No accounts found.</div>';
            return;
        }
        
        // Separate current accounts and term deposits
        const currentAccounts = accounts.filter(account => account.type === 'current' || account.productLine === 'ACCOUNTS');
        const termDeposits = accounts.filter(account => account.type === 'deposit' || account.productLine === 'DEPOSITS');
        
        let html = '';
        
        // Render current accounts first
        if (currentAccounts.length > 0) {
            html += '<div class="mb-4">';
            html += '<h3 class="text-lg font-semibold text-gray-800 mb-3">Your Accounts</h3>';
            html += '<div class="space-y-3">';
            html += currentAccounts.map(renderAccountCard).join('');
            html += '</div>';
            html += '</div>';
        }
        
        // Render term deposits second
        if (termDeposits.length > 0) {
            html += '<div class="mb-4">';
            html += '<h3 class="text-lg font-semibold text-gray-800 mb-3">Your Deposits</h3>';
            html += '<div class="space-y-3">';
            html += termDeposits.map(renderAccountCard).join('');
            html += '</div>';
            html += '</div>';
        }
        
        targetDiv.innerHTML = html;
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
        
        let html = '<div class="mb-4">';
        html += '<h3 class="text-lg font-semibold text-gray-800 mb-3">Your Loans</h3>';
        html += '<div class="space-y-3">';
        html += loans.map(renderLoanCard).join('');
        html += '</div>';
        html += '</div>';
        
        targetDiv.innerHTML = html;
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
        const loanScheduleList = document.getElementById('loan-schedule-list');
        const loanScheduleInfo = document.getElementById('loan-schedule-info');
        
        if (!loanScheduleList) {
            console.error('Loan schedule list element not found');
            return;
        }
        
        if (!loanScheduleInfo) {
            console.error('Loan schedule info element not found');
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
            console.log('Loan schedule API response:', data);
            
            if (data && data.body && Array.isArray(data.body)) {
                // Get total payments from header
                const totalPayments = data.header?.total_size || data.body.length;
                
                // Get the full schedule first
                const fullSchedule = data.body;
                
                // Filter for future payments only and limit to next 10
                const futurePayments = fullSchedule
                    .filter(payment => new Date(payment.paymentDate) >= new Date())
                    .slice(0, 10);
                
                // Transform the schedule data without payment numbers
                const transformedSchedule = futurePayments.map((payment, index) => {
                    return {
                        dueDate: payment.paymentDate,
                        totalAmount: payment.totalAmount,
                        principalAmount: payment.principalAmount,
                        interestAmount: payment.interestAmount,
                        // Use outstandingAmount from API and make it positive
                        outstandingAmount: Math.abs(payment.outstandingAmount || 0)
                    };
                });
                
                // Get loan details from cache or fetch
                let loan = loansData.find(l => l.loanId === loanId);
                if (!loan) {
                    try {
                        const loanResponse = await fetch(`/api/loans/${loanId}/details`);
                        if (loanResponse.ok) {
                            const loanData = await loanResponse.json();
                            loan = loanData;
                        }
                    } catch (error) {
                        console.error('Error fetching loan details:', error);
                    }
                }
                
                // Add total payments to loan object
                if (loan) {
                    loan.totalPayments = totalPayments;
                }
                
                // Render the schedule and info
                renderLoanSchedule(transformedSchedule, loan?.currency || 'USD');
                renderLoanScheduleInfo(loan || { id: loanId, totalPayments: totalPayments }, transformedSchedule);
            } else {
                loanScheduleList.innerHTML = '<div class="text-center text-gray-500 py-4">No schedule data available</div>';
                loanScheduleInfo.innerHTML = '<div class="text-center text-gray-500 py-4">No loan information available</div>';
            }
        } catch (error) {
            console.error('Error fetching loan schedule:', error);
            loanScheduleList.innerHTML = '<div class="text-center text-red-500 py-4">Error loading loan schedule</div>';
            loanScheduleInfo.innerHTML = '<div class="text-center text-red-500 py-4">Error loading loan information</div>';
        }
    }

    async function fetchProfile() {
        console.log(`[fetchProfile] Attempting to fetch profile for party ID: ${partyId}`);
        const { profileContent } = getElements();
        
        if (!profileContent) {
            console.error("[fetchProfile] profileContent element not found in DOM!");
            return null;
        }

        try {
            // Show loading indicator
            profileContent.innerHTML = '<div class="text-center text-gray-500 py-2">Loading profile...</div>';
            
            // Use the party details API endpoint
            const apiUrl = `/api/parties/${partyId}?_=${Date.now()}`;
            console.log("Fetching profile from API:", apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const profileData = await response.json();
            console.log(`Profile data for ${partyId}:`, profileData);
            
            // Render the profile
            renderProfile(profileData, profileContent);
            
            return profileData;
        } catch (error) {
            console.error(`Error fetching profile for ${partyId}:`, error);
            profileContent.innerHTML = `<div class="text-center text-red-500 py-2">Could not load profile: ${error.message}</div>`;
            return null;
        }
    }

    function renderProfile(profile, targetDiv) {
        if (!targetDiv || !profile) return;
        
        // Extract email and phone from addresses array
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
        
        // Extract nationality
        let nationality = 'N/A';
        if (profile.nationalities && profile.nationalities.length > 0) {
            nationality = profile.nationalities[0].country || 'N/A';
        }
        
        // Create profile information display
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
        elements.profileSection.classList.add('hidden');
        
        // Also hide loan details section
        document.getElementById('loan-details-section').classList.add('hidden');
        
        // Load data
        fetchAccounts();
        fetchLoans();
    }
    
    function showProfile() {
        console.log("Showing profile view");
        
        // Hide other sections, show profile
        const elements = getElements();
        elements.accountsSectionDiv.classList.add('hidden');
        elements.loansSectionDiv.classList.add('hidden');
        elements.transactionsSection.classList.add('hidden');
        elements.loanScheduleSection.classList.add('hidden');
        elements.transferSection.classList.add('hidden');
        elements.profileSection.classList.remove('hidden');
        
        // Load profile data
        fetchProfile();
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
        console.log('Showing loan schedule for loan ID:', loanId);
        
        // Hide other sections
        document.getElementById('accounts-section').classList.add('hidden');
        document.getElementById('loans-section').classList.add('hidden');
        document.getElementById('transactions-section').classList.add('hidden');
        document.getElementById('loan-details-section').classList.add('hidden');
        
        // Show loan schedule section
        document.getElementById('loan-schedule-section').classList.remove('hidden');
        
        // Fetch and display loan schedule
        fetchLoanSchedule(loanId);
    }

    function showLoans() {
        // Hide other sections
        document.getElementById('accounts-section').classList.add('hidden');
        document.getElementById('transactions-section').classList.add('hidden');
        document.getElementById('loan-details-section').classList.add('hidden');
        document.getElementById('loan-schedule-section').classList.add('hidden');
        
        // Show loans section
        document.getElementById('loans-section').classList.remove('hidden');
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

        // Add event listeners for loan detail buttons
        document.querySelectorAll('.view-loan-details-btn').forEach(button => {
            button.addEventListener('click', function() {
                const loanId = this.getAttribute('data-loan-id');
                if (loanId) {
                    showLoanDetails(loanId);
                }
            });
        });

        // Back button from loan details to loans
        const backToLoansFromDetails = document.getElementById('back-to-loans-from-details');
        if (backToLoansFromDetails) {
            backToLoansFromDetails.addEventListener('click', showHome);
        }

        // Back button from loan schedule to loan details
        const backToLoanDetails = document.getElementById('back-to-loan-details');
        if (backToLoanDetails) {
            backToLoanDetails.addEventListener('click', function() {
                // Hide schedule section and show details section
                document.getElementById('loan-schedule-section').classList.add('hidden');
                document.getElementById('loan-details-section').classList.remove('hidden');
            });
        }
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

        // Get profile-related buttons
        const showProfileButton = document.getElementById('show-profile-button');
        const closeProfileButton = document.getElementById('close-profile');
        const homeButton = document.getElementById('home-button');

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
        
        if (showProfileButton) {
            eventHandlers.showProfile = showProfile;
            showProfileButton.addEventListener('click', eventHandlers.showProfile);
        }
        
        if (closeProfileButton) {
            eventHandlers.closeProfile = showHome;
            closeProfileButton.addEventListener('click', eventHandlers.closeProfile);
        }
        
        if (homeButton) {
            eventHandlers.showHome = showHome;
            homeButton.addEventListener('click', eventHandlers.showHome);
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

        // Get profile-related buttons
        const showProfileButton = document.getElementById('show-profile-button');
        const closeProfileButton = document.getElementById('close-profile');
        const homeButton = document.getElementById('home-button');

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
        
        // Remove profile handlers
        if (showProfileButton && eventHandlers.showProfile) {
            showProfileButton.removeEventListener('click', eventHandlers.showProfile);
            eventHandlers.showProfile = null;
        }
        
        if (closeProfileButton && eventHandlers.closeProfile) {
            closeProfileButton.removeEventListener('click', eventHandlers.closeProfile);
            eventHandlers.closeProfile = null;
        }
        
        if (homeButton && eventHandlers.showHome) {
            homeButton.removeEventListener('click', eventHandlers.showHome);
            eventHandlers.showHome = null;
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
        const { partyIdInput, accountsListDiv, loansListDiv, profileContent } = getElements();
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
            if (profileContent) {
                profileContent.innerHTML = '<div class="text-center text-gray-500 py-2">Loading profile...</div>';
            }
            if (accountsListDiv) {
                accountsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading accounts...</div>';
            }
            if (loansListDiv) {
                loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loans...</div>';
            }
            
            // Fetch profile, accounts and loans with the new party ID
            fetchProfile();
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

    // Show loan details (first level)
    function showLoanDetails(loanId) {
        console.log('Showing loan details for loan ID:', loanId);
        
        // Hide other sections
        document.getElementById('accounts-section').classList.add('hidden');
        document.getElementById('loans-section').classList.add('hidden');
        document.getElementById('transactions-section').classList.add('hidden');
        document.getElementById('loan-schedule-section').classList.add('hidden');
        
        // Show loan details section
        document.getElementById('loan-details-section').classList.remove('hidden');
        
        // Fetch and display loan details
        fetchLoanDetails(loanId);
    }

    // Fetch loan details from API
    function fetchLoanDetails(loanId) {
        console.log('Fetching loan details for loan ID:', loanId);
        
        const loanDetailsInfo = document.getElementById('loan-details-info');
        loanDetailsInfo.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loan details...</div>';
        
        // Fetch loan details from the enhanced API
        fetch(`/api/loans/${loanId}/details`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Loan details fetched:', data);
                renderLoanDetails(data);
                
                // Set up the view payment schedule button
                const viewScheduleBtn = document.getElementById('view-payment-schedule-btn');
                viewScheduleBtn.onclick = () => showLoanSchedule(loanId);
            })
            .catch(error => {
                console.error('Error fetching loan details:', error);
                loanDetailsInfo.innerHTML = `
                    <div class="text-center text-red-500 py-4">
                        <p>Failed to load loan details</p>
                        <p class="text-sm text-gray-500 mt-1">${error.message}</p>
                    </div>
                `;
            });
    }

    // Render loan details in the details section
    function renderLoanDetails(loan) {
        const loanDetailsInfo = document.getElementById('loan-details-info');
        
        const interestRate = loan.interestRate ? `${loan.interestRate}%` : 'N/A';
        const startDate = loan.startDate ? formatDate(loan.startDate) : 'N/A';
        const term = loan.term ? `${loan.term} months` : 'N/A';
        const maturityDate = loan.maturityDate ? formatDate(loan.maturityDate) : 'N/A';
        const nextPaymentDate = loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A';
        
        loanDetailsInfo.innerHTML = `
            <div class="space-y-4">
                <div class="text-center border-b border-gray-100 pb-4">
                    <h4 class="text-lg font-semibold text-gray-800">${loan.productName || 'Loan'}</h4>
                    <p class="text-sm text-gray-600">ID: ${loan.loanId || 'N/A'}</p>
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
    }

})(); // End of IIFE