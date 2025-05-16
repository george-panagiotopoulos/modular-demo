(function() {
    // Branch App specific JavaScript
    console.log("branch_app.js loaded and executing");

    // State (now scoped to this IIFE)
    let customersData = [];
    let selectedCustomerId = null;
    let customerAccounts = [];
    let staticListenersAdded = false; // Track if static listeners are added
    let selectedLoanId = null; // Track the selected loan ID

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

        // Only include the requested fields
        customerDetailsArea.appendChild(createDetailItem('Customer ID', customer.customerId));
        customerDetailsArea.appendChild(createDetailItem('Name', `${customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`));
        customerDetailsArea.appendChild(createDetailItem('Date of Birth', customer.dateOfBirth));
        customerDetailsArea.appendChild(createDetailItem('Nationality', customer.nationality));
        customerDetailsArea.appendChild(createDetailItem('City of Birth', customer.cityOfBirth));
        customerDetailsArea.appendChild(createDetailItem('Email', customer.primaryEmail));
        customerDetailsArea.appendChild(createDetailItem('Mobile', customer.mobilePhone));
        customerDetailsArea.appendChild(createDetailItem('Home Phone', customer.homePhone));

        customerDetailsArea.classList.remove('hidden');
    }

    function renderAccountRow(account) {
        const isLoan = account.type === 'loan';
        const balance = isLoan ? account.principalAmount : account.currentBalance;
        const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(Math.abs(balance));

        // Customize the button based on account type
        let actionButton = `
            <button data-account-id="${account.accountId}" class="view-transactions-btn text-xs text-blue-600 hover:underline focus:outline-none">
                View Transactions
            </button>
        `;

        // For loans, show a "View Loan Details" button instead
        if (isLoan) {
            actionButton = `
                <button data-loan-id="${account.accountId}" class="view-loan-details-btn text-xs text-blue-600 hover:underline focus:outline-none">
                    View Loan Details
                </button>
            `;
        }

        return `
            <div class="flex justify-between items-center p-3 border rounded-md bg-gray-50 hover:bg-gray-100 mb-2">
                <div>
                    <span class="font-medium text-gray-800">${account.displayName} (${account.accountId})</span>
                    <span class="text-xs text-gray-500 ml-2">${account.productName} - Opened: ${account.openDate || 'N/A'}</span>
                </div>
                <div class="text-right">
                    <div class="font-semibold ${isLoan ? 'text-red-700' : 'text-gray-900'}">${formattedBalance} ${account.currency}</div>
                    ${actionButton}
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

    function renderLoanDetails(loanData) {
        const { transactionsListDiv, transactionsTitle } = getElements();
        if (!transactionsListDiv || !transactionsTitle) return;
        
        // Set the title
        transactionsTitle.textContent = `Loan Details: ${loanData.productDisplayName || selectedLoanId}`;
        
        // Format the loan details
        const loanStatus = loanData.status || {};
        const loanInfo = loanData.loanInformation || {};
        
        // Create a div to contain the loan details
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'loan-details-container space-y-4';
        
        // Loan summary section
        const summarySection = document.createElement('div');
        summarySection.className = 'bg-white p-4 rounded-lg shadow';
        summarySection.innerHTML = `
            <h3 class="text-lg font-semibold mb-2 text-gray-800">Loan Summary</h3>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm"><span class="font-medium">Loan ID:</span> ${loanData.id || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Status:</span> ${loanStatus.state || 'Active'}</p>
                    <p class="text-sm"><span class="font-medium">Product:</span> ${loanData.productDisplayName || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Start Date:</span> ${loanInfo.startDate || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Maturity Date:</span> ${loanInfo.maturityDate || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm"><span class="font-medium">Original Amount:</span> ${formatCurrency(loanInfo.originalPrincipal || 0, loanInfo.currency || 'USD')}</p>
                    <p class="text-sm"><span class="font-medium">Current Balance:</span> ${formatCurrency(loanStatus.currentBalance || 0, loanInfo.currency || 'USD')}</p>
                    <p class="text-sm"><span class="font-medium">Interest Rate:</span> ${(loanInfo.interestRate || 0).toFixed(2)}%</p>
                    <p class="text-sm"><span class="font-medium">Term:</span> ${loanInfo.term || 'N/A'} ${loanInfo.termUnit || 'Months'}</p>
                    <p class="text-sm"><span class="font-medium">Payment Frequency:</span> ${loanInfo.paymentFrequency || 'Monthly'}</p>
                </div>
            </div>
        `;
        detailsContainer.appendChild(summarySection);
        
        // Payment details section
        const paymentSection = document.createElement('div');
        paymentSection.className = 'bg-white p-4 rounded-lg shadow';
        
        const nextPayment = loanStatus.nextPaymentDue || {};
        paymentSection.innerHTML = `
            <h3 class="text-lg font-semibold mb-2 text-gray-800">Payment Information</h3>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm"><span class="font-medium">Next Payment Date:</span> ${nextPayment.dueDate || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Next Payment Amount:</span> ${formatCurrency(nextPayment.totalAmount || 0, loanInfo.currency || 'USD')}</p>
                    <p class="text-sm"><span class="font-medium">Principal:</span> ${formatCurrency(nextPayment.principalAmount || 0, loanInfo.currency || 'USD')}</p>
                    <p class="text-sm"><span class="font-medium">Interest:</span> ${formatCurrency(nextPayment.interestAmount || 0, loanInfo.currency || 'USD')}</p>
                </div>
                <div>
                    <p class="text-sm"><span class="font-medium">Payments Made:</span> ${loanStatus.paymentsMade || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Payments Remaining:</span> ${loanStatus.paymentsRemaining || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Paid To Date:</span> ${formatCurrency(loanStatus.paidToDate || 0, loanInfo.currency || 'USD')}</p>
                    <p class="text-sm"><span class="font-medium">Last Payment Date:</span> ${loanStatus.lastPaymentDate || 'N/A'}</p>
                </div>
            </div>
        `;
        detailsContainer.appendChild(paymentSection);
        
        // Button to view payment schedule
        const scheduleButtonDiv = document.createElement('div');
        scheduleButtonDiv.className = 'flex justify-center mt-4';
        scheduleButtonDiv.innerHTML = `
            <button id="view-loan-schedule-btn" data-loan-id="${selectedLoanId}" class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm">
                View Payment Schedule
            </button>
        `;
        detailsContainer.appendChild(scheduleButtonDiv);
        
        // Clear previous content and add the new details
        transactionsListDiv.innerHTML = '';
        transactionsListDiv.appendChild(detailsContainer);
        
        // Add event listener for the schedule button
        const scheduleButton = document.getElementById('view-loan-schedule-btn');
        if (scheduleButton) {
            const handler = () => {
                fetchLoanSchedules(selectedLoanId);
            };
            scheduleButton.addEventListener('click', handler);
            if (eventHandlers.viewLoanSchedules.length > 0) {
                // Remove previous handler
                const prevHandler = eventHandlers.viewLoanSchedules.pop();
                if (prevHandler && prevHandler.button && prevHandler.handler) {
                    prevHandler.button.removeEventListener('click', prevHandler.handler);
                }
            }
            eventHandlers.viewLoanSchedules.push({ button: scheduleButton, handler });
        }
    }
    
    function renderLoanSchedule(scheduleData) {
        const { transactionsListDiv, transactionsTitle } = getElements();
        if (!transactionsListDiv || !transactionsTitle) return;
        
        // Set the title
        transactionsTitle.textContent = `Payment Schedule: ${selectedLoanId}`;
        
        // Create container for schedule
        const scheduleContainer = document.createElement('div');
        scheduleContainer.className = 'loan-schedule-container space-y-4';
        
        // Create back button
        const backButtonDiv = document.createElement('div');
        backButtonDiv.className = 'mb-4';
        backButtonDiv.innerHTML = `
            <button id="back-to-loan-details" class="text-blue-600 hover:text-blue-800 flex items-center text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Loan Details
            </button>
        `;
        scheduleContainer.appendChild(backButtonDiv);
        
        // Get schedule items from the API response based on the format
        let scheduleItems = [];
        
        // Check for mobile API response format (has payments array)
        if (scheduleData.payments && Array.isArray(scheduleData.payments)) {
            console.log("Using mobile API payment format");
            scheduleItems = scheduleData.payments.map(payment => ({
                dueDate: payment.dueDate,
                totalAmount: payment.totalAmount,
                principalAmount: payment.principal,
                interestAmount: payment.interest,
                outstandingPrincipal: 0, // Not provided in this format
                status: payment.status
            }));
        }
        // Check for lending API response format (nested schedules)
        else if (scheduleData.schedules && scheduleData.schedules.length > 0) {
            console.log("Using lending API schedule format");
            scheduleItems = scheduleData.schedules[0].scheduleItems || [];
        }
        // Handle raw body array format
        else if (scheduleData.body && Array.isArray(scheduleData.body)) {
            console.log("Using raw body array format");
            scheduleItems = scheduleData.body.map(item => ({
                dueDate: item.paymentDate,
                totalAmount: parseFloat(item.totalAmount || 0),
                principalAmount: parseFloat(item.principalAmount || 0),
                interestAmount: parseFloat(item.interestAmount || 0),
                outstandingPrincipal: 0, // Not provided in this format
                status: item.scheduleType === "FUTURE" ? "Upcoming" : 
                       item.scheduleType === "DUE" ? "Due" : 
                       item.scheduleType === "PAID" ? "PAID" : "Unknown"
            }));
        }
        
        console.log("Schedule items:", scheduleItems);
        
        if (scheduleItems.length === 0) {
            scheduleContainer.innerHTML += `
                <div class="bg-gray-100 p-4 rounded-md">
                    <p class="text-gray-500">No schedule items available for this loan.</p>
                </div>
            `;
        } else {
            // Create table for schedule
            const table = document.createElement('table');
            table.className = 'min-w-full divide-y divide-gray-200';
            
            // Create table header
            const thead = document.createElement('thead');
            thead.className = 'bg-gray-50';
            thead.innerHTML = `
                <tr>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th scope="col" class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                    <th scope="col" class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                    <th scope="col" class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                    <th scope="col" class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th scope="col" class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
            `;
            table.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement('tbody');
            tbody.className = 'bg-white divide-y divide-gray-200';
            
            // Sort schedule items by due date (handle different date formats)
            scheduleItems.sort((a, b) => {
                const dateA = formatDateToComparable(a.dueDate);
                const dateB = formatDateToComparable(b.dueDate);
                return dateA.localeCompare(dateB);
            });
            
            // Function to format date string to a comparable format (YYYY-MM-DD)
            function formatDateToComparable(dateStr) {
                if (!dateStr) return "9999-99-99"; // Default for empty dates
                
                // If already in YYYY-MM-DD format
                if (dateStr.includes('-')) return dateStr;
                
                // If in YYYYMMDD format
                if (dateStr.length === 8) {
                    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                }
                
                // Other formats or invalid - return as is
                return dateStr;
            }
            
            // Function to format date for display
            function formatDateForDisplay(dateStr) {
                if (!dateStr) return "N/A";
                
                try {
                    let year, month, day;
                    
                    // If in YYYY-MM-DD format
                    if (dateStr.includes('-')) {
                        [year, month, day] = dateStr.split('-');
                    }
                    // If in YYYYMMDD format
                    else if (dateStr.length === 8) {
                        year = dateStr.substring(0, 4);
                        month = dateStr.substring(4, 6);
                        day = dateStr.substring(6, 8);
                    }
                    // Other formats - return as is
                    else {
                        return dateStr;
                    }
                    
                    // Create date and format
                    const date = new Date(`${year}-${month}-${day}`);
                    return date.toLocaleDateString();
                } catch (e) {
                    console.error("Error formatting date:", e);
                    return dateStr || "N/A";
                }
            }
            
            // Add rows for each schedule item
            scheduleItems.forEach((item, index) => {
                const row = document.createElement('tr');
                row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                
                const dueDate = formatDateForDisplay(item.dueDate);
                const totalAmount = formatCurrency(item.totalAmount || 0, scheduleData.currency || 'USD');
                const principalAmount = formatCurrency(item.principalAmount || 0, scheduleData.currency || 'USD');
                const interestAmount = formatCurrency(item.interestAmount || 0, scheduleData.currency || 'USD');
                const remainingBalance = formatCurrency(item.outstandingPrincipal || 0, scheduleData.currency || 'USD');
                
                // Determine status based on due date and payment status
                const today = new Date();
                const isPast = new Date(formatDateToComparable(item.dueDate)) < today;
                let status = 'Upcoming';
                let statusClass = 'bg-blue-100 text-blue-800';
                
                if (item.status === 'PAID' || item.status === 'Paid') {
                    status = 'Paid';
                    statusClass = 'bg-green-100 text-green-800';
                } else if (item.status === 'Due' || (isPast && item.status !== 'Paid')) {
                    status = 'Due';
                    statusClass = 'bg-red-100 text-red-800';
                }
                
                row.innerHTML = `
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-600">${dueDate}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-600 text-right">${totalAmount}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-600 text-right">${principalAmount}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-600 text-right">${interestAmount}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-600 text-right">${remainingBalance}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-center">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                            ${status}
                        </span>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            
            // Create table container (for scrolling)
            const tableContainer = document.createElement('div');
            tableContainer.className = 'overflow-x-auto rounded-lg border border-gray-200 shadow';
            tableContainer.appendChild(table);
            
            scheduleContainer.appendChild(tableContainer);
        }
        
        // Clear previous content and add the new schedule
        transactionsListDiv.innerHTML = '';
        transactionsListDiv.appendChild(scheduleContainer);
        
        // Add event listener for back button
        const backButton = document.getElementById('back-to-loan-details');
        if (backButton) {
            const handler = () => {
                fetchLoanDetails(selectedLoanId);
            };
            backButton.addEventListener('click', handler);
            
            if (eventHandlers.backToLoanDetails) {
                // Remove previous handler from a different button
                const { button, handler: prevHandler } = eventHandlers.backToLoanDetails;
                if (button && prevHandler) {
                    button.removeEventListener('click', prevHandler);
                }
            }
            
            eventHandlers.backToLoanDetails = { button: backButton, handler };
        }
    }
    
    // Helper function to format currency
    function formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: currency 
        }).format(amount);
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

    async function fetchLoanDetails(loanId) {
        console.log(`Fetching loan details for ${loanId}...`);
        const { transactionsListDiv, transactionsTitle } = getElements();
        if (!transactionsListDiv || !transactionsTitle) return;
        
        // Set selected loan ID
        selectedLoanId = loanId;
        
        // Show the transactions area which we'll reuse for loan details
        showTransactionsView(loanId);
        
        // Set loading state
        transactionsTitle.textContent = `Loan Details: ${loanId}`;
        transactionsListDiv.innerHTML = '<div class="text-gray-500">Loading loan details...</div>';
        
        try {
            const response = await fetch(`/api/branch/loans/${loanId}/details?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const loanData = await response.json();
            console.log("Loan details received:", loanData);
            
            renderLoanDetails(loanData);
        } catch (error) {
            console.error(`Error fetching loan details for ${loanId}:`, error);
            transactionsListDiv.innerHTML = `<div class="text-red-500">Could not load loan details: ${error.message}</div>`;
        }
    }
    
    async function fetchLoanSchedules(loanId) {
        console.log(`Fetching loan schedules for ${loanId}...`);
        const { transactionsListDiv, transactionsTitle } = getElements();
        if (!transactionsListDiv || !transactionsTitle) return;
        
        // Set the title and loading state
        transactionsTitle.textContent = `Payment Schedule: ${loanId}`;
        transactionsListDiv.innerHTML = '<div class="text-gray-500">Loading payment schedule...</div>';
        
        try {
            const response = await fetch(`/api/branch/loans/${loanId}/schedules?_=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const scheduleData = await response.json();
            console.log("Loan schedule received:", scheduleData);
            
            renderLoanSchedule(scheduleData);
        } catch (error) {
            console.error(`Error fetching loan schedule for ${loanId}:`, error);
            transactionsListDiv.innerHTML = `<div class="text-red-500">Could not load payment schedule: ${error.message}</div>`;
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
        viewTransaction: [], // Array for dynamic buttons
        viewLoanDetails: [], // Array for dynamic loan details buttons
        viewLoanSchedules: [], // Array for dynamic loan schedules buttons
        backToLoanDetails: null // Handler for back button from schedules to details
    };

    function addAccountTransactionButtonListeners() {
        const { accountsListDiv } = getElements();
        if (!accountsListDiv) return;

        // Remove previous dynamic listeners
        eventHandlers.viewTransaction.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewTransaction = []; // Clear array
        
        // Remove previous loan detail listeners
        eventHandlers.viewLoanDetails.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewLoanDetails = []; // Clear array

        // Add listeners for transaction buttons
        accountsListDiv.querySelectorAll('.view-transactions-btn').forEach(button => {
             const handler = (e) => {
                const accountId = e.target.getAttribute('data-account-id');
                showTransactionsView(accountId);
                fetchBranchTransactions(accountId);
             };
             button.addEventListener('click', handler);
             eventHandlers.viewTransaction.push({ button, handler }); // Store for removal
        });
        
        // Add listeners for loan detail buttons
        accountsListDiv.querySelectorAll('.view-loan-details-btn').forEach(button => {
             const handler = (e) => {
                const loanId = e.target.getAttribute('data-loan-id');
                fetchLoanDetails(loanId);
             };
             button.addEventListener('click', handler);
             eventHandlers.viewLoanDetails.push({ button, handler }); // Store for removal
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
        
        // Clean up loan detail related listeners
        eventHandlers.viewLoanDetails.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewLoanDetails = [];
        
        eventHandlers.viewLoanSchedules.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewLoanSchedules = [];
        
        if (eventHandlers.backToLoanDetails) {
            const { button, handler } = eventHandlers.backToLoanDetails;
            if (button && handler) {
                button.removeEventListener('click', handler);
            }
            eventHandlers.backToLoanDetails = null;
        }
        
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