(function() {
    // Mobile App specific JavaScript
    console.log("mobile_app.js loaded and executing");

    // State
    let accountsData = [];
    let loansData = [];
    const knownGoodPartyId = "2514044333"; // Party ID known to work from curl tests
    let partyId = localStorage.getItem('mobileAppPartyId');
    
    // If localStorage had a value, check if it's the problematic one or if it's null/empty
    // If it is problematic, or no PartyId in local storage, use the known good one.
    if (!partyId || partyId === "2513960210") {
        partyId = knownGoodPartyId;
        localStorage.setItem('mobileAppPartyId', partyId); // Update localStorage with the good one
    }
    
    console.log("Using Party ID:", partyId); // Log the partyId being used

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
        
        // Format date - handle both YYYY-MM-DD and other formats
        const formatDate = (dateStr) => {
            if (!dateStr) return "N/A";
            
            try {
                // Try to parse as ISO date first (YYYY-MM-DD)
                if (dateStr.includes('-')) {
                    const date = new Date(dateStr);
                    return date.toLocaleDateString();
                } else if (dateStr.length === 8) {
                    // Handle YYYYMMDD format
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    return new Date(`${year}-${month}-${day}`).toLocaleDateString();
                }
                return dateStr; // Return as is if we can't parse
            } catch (e) {
                return dateStr; // Return original on error
            }
        };
        
        const date = formatDate(transaction.bookingDate);
        const icon = transaction.amount < 0 
            ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>`;

        return `
            <div class="flex justify-between items-center border-b border-gray-100 py-2 last:border-b-0 hover:bg-gray-50 transition-colors duration-150 rounded px-2">
                <div class="flex items-center">
                    <div class="mr-3 bg-gray-100 rounded-full p-2">
                        ${icon}
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-800">${transaction.description}</div>
                        <div class="text-xs text-gray-500">${date} • ${transaction.type}</div>
                    </div>
                </div>
                <div class="text-sm font-semibold ${amountClass}">${formattedAmount}</div>
            </div>
        `;
    }

    function renderLoanCard(loan) {
        const formattedPrincipal = new Intl.NumberFormat('en-US', { style: 'currency', currency: loan.currency }).format(loan.principalAmount);
        const formattedOutstanding = new Intl.NumberFormat('en-US', { style: 'currency', currency: loan.currency }).format(loan.outstandingBalance);
        const formattedNextPayment = new Intl.NumberFormat('en-US', { style: 'currency', currency: loan.currency }).format(loan.nextPaymentAmount);
        
        // Improved loan display name
        const loanDisplayName = `${loan.productName === 'MORTGAGE.PRODUCT' ? 'Mortgage' : (loan.productName || 'Loan')} (${loan.loanId})`;
        
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
                    <span class="font-semibold text-gray-800 text-lg truncate" title="${loanDisplayName}">${loanDisplayName}</span>
                    <span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">${loan.productName === 'MORTGAGE.PRODUCT' ? 'Mortgage' : loan.productName}</span>
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
                
                <div class="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                    <span class="text-xs text-gray-500">ID: ${loan.loanId}</span>
                    <button data-loan-id="${loan.loanId}" class="view-loan-transactions-btn text-sm text-blue-600 hover:underline focus:outline-none">
                        View Transactions
                    </button>
                </div>
                <div class="mt-3">
                    <button data-loan-id="${loan.loanId}" class="view-loan-details-btn w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                        View Payment Schedule
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
            
            // Make the API call via the Flask proxy
            const apiUrl = `/api/proxy/holdings/parties/${partyId}/arrangements?_=${Date.now()}`;
            console.log("Fetching accounts from URL (via proxy for arrangements): " + apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const arrangementsData = await response.json();
            console.log("Holdings arrangements received:", arrangementsData);
            
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
                // Only process accounts from the ACCOUNTS product line
                if (arrangement.productLine === "ACCOUNTS") {
                    // Get the account_id from alternateReferences 
                    let accountId = null;
                    if (arrangement.alternateReferences && arrangement.alternateReferences.length > 0) {
                        for (const ref of arrangement.alternateReferences) {
                            if (ref.alternateType === "ACCOUNT") {
                                accountId = ref.alternateId;
                                break;
                            }
                        }
                    }
                    
                    if (!accountId) {
                        // If no alternate ID found, use the arrangement ID
                        accountId = arrangement.arrangementId;
                    }
                    
                    // Get the balance for this account
                    try {
                        const balanceUrl = `/api/proxy/holdings/accounts/${accountId}/balances?_=${Date.now()}`;
                        console.log("Fetching balance from URL:", balanceUrl);
                        
                        const balanceResponse = await fetch(balanceUrl);
                        if (balanceResponse.ok) {
                            const balanceData = await balanceResponse.json();
                            console.log(`Balance data for ${accountId}:`, balanceData);
                            
                            // Check if we have balance items
                            const balanceItems = balanceData.items || [];
                            if (balanceItems.length > 0) {
                                const balance = balanceItems[0]; // Use the first balance item
                                
                                accounts.push({
                                    accountId: accountId,
                                    displayName: arrangement.productName || "Current Account",
                                    productName: arrangement.productGroup || "Current Account",
                                    type: "current",
                                    currency: balance.currencyId || "USD",
                                    currentBalance: balance.onlineActualBalance || 0,
                                    availableBalance: balance.availableBalance || 0,
                                    arrangementId: arrangement.arrangementId // Store the arrangement ID for later use
                                });
                            }
                        } else {
                            const errorText = await balanceResponse.text().catch(() => "Failed to get error text");
                            console.error(`Balance API Error ${balanceResponse.status}: ${balanceResponse.statusText}`, errorText);
                            
                            // Add the account with default balance values if balance API fails
                            accounts.push({
                                accountId: accountId,
                                displayName: arrangement.productName || "Current Account",
                                productName: arrangement.productGroup || "Current Account",
                                type: "current",
                                currency: "USD",
                                currentBalance: 0,
                                availableBalance: 0,
                                arrangementId: arrangement.arrangementId
                            });
                        }
                    } catch (error) {
                        console.error(`Error fetching balance for account ${accountId}:`, error);
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
            accountsListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load accounts: ${error.message}</div>`;
        }
    }

    async function fetchLoans() {
        console.log("Fetching loans for party ID:", partyId);
        const { loansListDiv } = getElements();
        if (!loansListDiv) return;
        
        try {
            // Show loading indicator
            loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading loans...</div>';
            
            // Make the API call via the Flask proxy
            const apiUrl = `/api/proxy/holdings/parties/${partyId}/arrangements?_=${Date.now()}`;
            console.log("Fetching loans from URL (via proxy for arrangements): " + apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const arrangementsData = await response.json();
            console.log("Holdings arrangements received:", arrangementsData);
            
            // Check if we have arrangements array
            const arrangements = arrangementsData.arrangements || [];
            
            // Filter for loan arrangements (LENDING product line)
            const loanArrangements = arrangements.filter(arr => arr.productLine === "LENDING");
            console.log("Filtered LENDING arrangements:", JSON.stringify(loanArrangements, null, 2)); // Log filtered loan arrangements

            if (loanArrangements.length === 0) {
                loansListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No loans found for this customer.</div>';
                loansData = [];
                return;
            }
            
            // Process each loan arrangement
            const loans = [];
            for (const arrangement of loanArrangements) {
                try {
                    // Get loan details from the contract reference
                    const loanId = arrangement.contractReference;
                    console.log(`Processing LENDING arrangement: ${arrangement.arrangementId}, contractReference (loanId): ${loanId}`); // Log loanId

                    if (!loanId) continue;
                    
                    // Get the account_id from alternateReferences for balance and potentially transactions
                    let accountIdForTransactions = null; // Changed variable name for clarity
                    if (arrangement.alternateReferences && arrangement.alternateReferences.length > 0) {
                        for (const ref of arrangement.alternateReferences) {
                            if (ref.alternateType === "ACCOUNT") {
                                accountIdForTransactions = ref.alternateId;
                                break;
                            }
                        }
                    }
                    
                    // If we have an account ID, fetch the balance
                    let balanceData = null;
                    if (accountIdForTransactions) { // Use the renamed variable
                        try {
                            const balanceUrl = `/api/proxy/holdings/accounts/${accountIdForTransactions}/balances?_=${Date.now()}`;
                            console.log(`Fetching loan balance from URL:`, balanceUrl);
                            
                            const balanceResponse = await fetch(balanceUrl);
                            if (balanceResponse.ok) {
                                const balanceResult = await balanceResponse.json();
                                if (balanceResult.items && balanceResult.items.length > 0) {
                                    balanceData = balanceResult.items[0];
                                }
                            } else {
                                const errorText = await balanceResponse.text().catch(() => "Failed to get error text");
                                console.error(`Loan Balance API Error ${balanceResponse.status}: ${balanceResponse.statusText}`, errorText);
                            }
                        } catch (error) {
                            console.error(`Error fetching balance for loan account ${accountIdForTransactions}:`, error);
                        }
                    }
                    
                    // Get additional loan details if needed (status, payment schedule, etc.)
                    const statusUrl = `/api/proxy/lending/arrangements/${loanId}/status?_=${Date.now()}`;
                    console.log(`Fetching loan status from URL:`, statusUrl);
                    
                    let statusResponse = null;
                    try {
                        statusResponse = await fetch(statusUrl);
                        if (!statusResponse.ok) {
                            console.error(`Failed to get loan status: ${statusResponse.status} ${statusResponse.statusText}`);
                        }
                    } catch (error) {
                        console.error(`Error fetching loan status: ${error}`);
                    }
                    
                    // Create a loan object with the data we have so far
                    const loan = {
                        loanId: loanId,
                        displayName: `Loan ${loanId.slice(-4)}`,
                        productName: arrangement.productGroup || "Personal Loan",
                        currency: balanceData?.currencyId || "USD",
                        principalAmount: 0,
                        outstandingBalance: balanceData?.onlineActualBalance || 0,
                        nextPaymentAmount: 0,
                        nextPaymentDate: "",
                        status: "Active",
                        interestRate: 4.5,
                        maturityDate: "",
                        arrangementId: arrangement.arrangementId,
                        accountIdForTransactions: accountIdForTransactions // Store it here
                    };
                    
                    // Add status data if available
                    if (statusResponse && statusResponse.ok) {
                        try {
                            const statusData = await statusResponse.json();
                            console.log(`Status data for ${loanId}:`, statusData);
                            
                            if (statusData && statusData.body) {
                                const status = statusData.body;
                                
                                // Update loan object with status data
                                if (status.outstandingBalance) {
                                    loan.outstandingBalance = parseFloat(status.outstandingBalance);
                                }
                                
                                if (status.principalAmount) {
                                    loan.principalAmount = parseFloat(status.principalAmount);
                                }
                                
                                if (status.nextPaymentAmount) {
                                    loan.nextPaymentAmount = parseFloat(status.nextPaymentAmount);
                                }
                                
                                if (status.nextPaymentDate) {
                                    loan.nextPaymentDate = status.nextPaymentDate;
                                }
                                
                                if (status.status) {
                                    loan.status = status.status;
                                }
                                
                                if (status.interestRate) {
                                    loan.interestRate = parseFloat(status.interestRate);
                                }
                                
                                if (status.maturityDate) {
                                    loan.maturityDate = status.maturityDate;
                                }
                            }
                        } catch (error) {
                            console.error(`Error processing loan status data for ${loanId}:`, error);
                        }
                    }
                    
                    loans.push(loan);
                } catch (error) {
                    console.error(`Error processing loan arrangement:`, error);
                }
            }
            
            loansData = loans;
            console.log("Processed loan data:", loansData);
            
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
            
            // Fetch transactions directly from the Holdings API
            const apiUrl = `/api/proxy/holdings/accounts/${accountId}/transactions?_=${Date.now()}`;
            console.log("Fetching transactions from URL:", apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const transactionsData = await response.json();
            console.log("Transactions data received:", transactionsData);
            
            // Check if we have transaction items
            const transactions = transactionsData.items || [];
            if (transactions.length === 0) {
                transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
                return;
            }
            
            // Transform API data into transaction objects for rendering
            const formattedTransactions = transactions.map(tx => ({
                id: tx.id || `tx-${Math.random().toString(36).substring(2, 10)}`,
                date: tx.valueDate || tx.bookingDate,
                amount: tx.transactionAmount || 0,
                currency: tx.currency || "USD",
                description: tx.narrative || "Transaction",
                type: tx.paymentIndicator || "Debit",
                icon: tx.paymentIndicator === "Credit" ? "arrow-down" : "arrow-up",
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
            
            // Fetch the loan schedule directly
            const apiUrl = `/api/proxy/lending/arrangements/${loanId}/schedules?_=${Date.now()}`;
            console.log("Fetching loan schedule from URL:", apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Failed to get error text");
                console.error(`HTTP Error ${response.status}: ${response.statusText}`, errorText);
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const scheduleData = await response.json();
            console.log(`Schedule data for ${loanId}:`, scheduleData);
            
            // The API returns payments directly in the "body" array, not as body.schedule
            if (!scheduleData || !scheduleData.body || !Array.isArray(scheduleData.body)) {
                throw new Error("Invalid schedule data format");
            }
            
            // Process the schedule data
            const rawSchedule = scheduleData.body; // Directly use the array of payments
            
            // Transform the schedule data
            const schedule = {
                currency: loan.currency || "USD",
                nextPaymentDate: loan.nextPaymentDate,
                remainingPayments: rawSchedule.length,
                payments: []
            };
            
            // Extract payments from the schedule
            let paymentNumber = 1;
            
            for (const item of rawSchedule) {
                // Skip entries without payment amount or due date
                if (!item.totalAmount || !item.paymentDate) continue;
                
                // Determine if payment is past due
                const dueDate = new Date(item.paymentDate);
                const today = new Date();
                
                // Simple logic to set status based on scheduleType or date comparison
                let paymentStatus = "Due";
                if (item.scheduleType === "DUE") {
                    paymentStatus = "Due Today";
                } else if (dueDate < today) {
                    paymentStatus = "Paid";
                }
                
                schedule.payments.push({
                    paymentNumber: paymentNumber++,
                    dueDate: item.paymentDate,
                    status: paymentStatus,
                    totalAmount: parseFloat(item.totalAmount),
                    principal: parseFloat(item.principalAmount || 0),
                    interest: parseFloat(item.interestAmount || 0),
                });
            }
            
            console.log(`Processed payment schedule for ${loanId}:`, schedule);
            
            // Find the loan details
            const loanDetails = loansData.find(l => l.loanId === loanId);
            if (!loanDetails) {
                console.error(`Loan details not found for ${loanId} in`, loansData);
                throw new Error(`Loan details not found for ${loanId}`);
            }
            
            // Update the UI
            renderLoanScheduleInfo(schedule, loanDetails, loanScheduleInfo);
            renderLoanSchedule(schedule, loanScheduleList);
            
            return schedule;
        } catch (error) {
            console.error(`Error fetching payment schedule for ${loanId}:`, error);
            loanScheduleList.innerHTML = `<div class="text-center text-red-500 py-4">Could not load payment schedule: ${error.message}</div>`;
            return null;
        }
    }

    // --- UI Interaction ---
    function showHome() {
        const { accountsSectionDiv, loansSectionDiv, transactionsSection, transferSection, loanScheduleSection } = getElements();
        
        // Show the main sections
        if(accountsSectionDiv) accountsSectionDiv.classList.remove('hidden');
        if(loansSectionDiv) loansSectionDiv.classList.remove('hidden');
        
        // Hide other detail sections
        if(transactionsSection) transactionsSection.classList.add('hidden');
        if(transferSection) transferSection.classList.add('hidden');
        if(loanScheduleSection) loanScheduleSection.classList.add('hidden');
        
        console.log("[showHome] Returned to home screen");
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