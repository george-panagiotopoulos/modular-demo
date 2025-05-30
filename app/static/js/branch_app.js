console.log('[BranchAppModule] Script loaded and executing...');

(function() {
    // Branch App specific JavaScript
    console.log("branch_app.js loaded and executing");

    // State (now scoped to this IIFE)
    let customersData = [];
    let selectedCustomerId = null;
    let selectedCustomer = null;
    let customerAccounts = [];
    let staticListenersAdded = false; // Track if static listeners are added
    let selectedLoanId = null; // Track the selected loan ID
    let currentBranchScreen = 'customer-management'; // Current active screen

    // --- DOM Elements ---
    function getElements() {
        return {
            // New search interface elements
            searchPartyIdInput: document.getElementById('search-party-id'),
            searchLastNameInput: document.getElementById('search-last-name'),
            searchDateOfBirthInput: document.getElementById('search-date-of-birth'),
            searchPhoneInput: document.getElementById('search-phone'),
            searchEmailInput: document.getElementById('search-email'),
            searchCustomersBtn: document.getElementById('search-customers-btn'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
            searchStatus: document.getElementById('search-status'),
            searchError: document.getElementById('search-error'),
            searchResultsArea: document.getElementById('search-results-area'),
            searchResultsList: document.getElementById('search-results-list'),
            selectedCustomerArea: document.getElementById('selected-customer-area'),
            selectedCustomerInfo: document.getElementById('selected-customer-info'),
            loadCustomerBtn: document.getElementById('load-customer-btn'),
            
            // Existing elements
            customerDetailsArea: document.getElementById('customer-details-area'),
            customerAccountsArea: document.getElementById('customer-accounts-area'),
            accountsListDiv: document.getElementById('accounts-list'), // Fixed to get the correct div
            transactionsArea: document.getElementById('account-transactions-area'),
            transactionsListDiv: document.getElementById('transactions-list'),
            transactionsTitle: document.getElementById('transactions-title'),
            backToCustomerBtn: document.getElementById('back-to-customer'),
            transactionsLoadingDiv: document.getElementById('transactions-loading-div'),
            transactionsErrorDiv: document.getElementById('transactions-error-div'),
            loanDetailsDiv: document.getElementById('loan-details-div')
        };
    }

    // --- New Search Functions ---
    async function performCustomerSearch() {
        const elements = getElements();
        const partyId = elements.searchPartyIdInput?.value.trim() || '';
        const lastName = elements.searchLastNameInput?.value.trim() || '';
        const dateOfBirth = elements.searchDateOfBirthInput?.value.trim() || '';
        const phoneNumber = elements.searchPhoneInput?.value.trim() || '';
        const email = elements.searchEmailInput?.value.trim() || '';
        
        // Clear previous results and errors
        clearSearchResults();
        if (elements.searchError) elements.searchError.textContent = '';
        
        // Validate that at least one search criteria is provided
        if (!partyId && !lastName && !dateOfBirth && !phoneNumber && !email) {
            if (elements.searchError) elements.searchError.textContent = 'Please enter at least one search criteria.';
            return;
        }
        
        // Show loading status
        if (elements.searchStatus) elements.searchStatus.textContent = 'Searching for customers...';
        if (elements.searchCustomersBtn) elements.searchCustomersBtn.disabled = true;
        
        try {
            // Build search parameters with correct parameter names (camelCase)
            const params = new URLSearchParams();
            if (partyId) params.append('partyId', partyId);
            if (lastName) params.append('lastName', lastName);
            if (dateOfBirth) params.append('dateOfBirth', dateOfBirth);
            if (phoneNumber) params.append('phoneNumber', phoneNumber);
            if (email) params.append('email', email);
            
            // Perform the search API call
            const response = await fetch(`/api/parties/search?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Search response:', data);
            
            // Update the display with search results
            displaySearchResults(data.customers || []);
            
            // Update headless tab if available
            updateHeadlessTab();
            
        } catch (error) {
            console.error('Error performing customer search:', error);
            if (elements.searchStatus) elements.searchStatus.textContent = '';
            if (elements.searchError) elements.searchError.textContent = `Search failed: ${error.message}`;
        } finally {
            if (elements.searchCustomersBtn) elements.searchCustomersBtn.disabled = false;
        }
    }

    function displaySearchResults(customers) {
        const elements = getElements();
        
        if (customers.length === 0) {
            if (elements.searchStatus) elements.searchStatus.textContent = 'No customers found matching your search criteria.';
            if (elements.searchResultsArea) elements.searchResultsArea.classList.add('hidden');
            return;
        }
        
        // Clear previous results
        if (elements.searchResultsList) elements.searchResultsList.innerHTML = '';
        
        // Display each customer as a selectable card
        customers.forEach(customer => {
            const customerCard = document.createElement('div');
            customerCard.className = 'p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors';
            
            // Map API response fields to display format
            const displayName = `${customer.firstName || 'N/A'} ${customer.lastName || ''}`.trim();
            const customerId = customer.customerId || customer.partyId || customer.id || 'N/A';
            const dateOfBirth = customer.dateOfBirth || 'N/A';
            
            customerCard.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-medium text-gray-900">${displayName}</div>
                        <div class="text-sm text-gray-600">Customer ID: ${customerId}</div>
                        <div class="text-sm text-gray-600">Date of Birth: ${dateOfBirth}</div>
                    </div>
                    <button class="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
                        Select
                    </button>
                </div>
            `;
            
            // Add click handler to select this customer - normalize the customer object
            const normalizedCustomer = {
                id: customerId,
                name: customer.firstName || '',
                lastName: customer.lastName || '',
                dateOfBirth: dateOfBirth,
                // Keep all original fields for backend compatibility
                customerId: customerId,
                firstName: customer.firstName,
                middleName: customer.middleName,
                cityOfBirth: customer.cityOfBirth
            };
            
            customerCard.addEventListener('click', () => selectCustomer(normalizedCustomer));
            
            if (elements.searchResultsList) elements.searchResultsList.appendChild(customerCard);
        });
        
        if (elements.searchResultsArea) elements.searchResultsArea.classList.remove('hidden');
        if (elements.searchStatus) elements.searchStatus.textContent = `Found ${customers.length} customer(s)`;
    }

    function selectCustomer(customer) {
        const elements = getElements();
        selectedCustomer = customer;
        selectedCustomerId = customer.id;
        
        // Update selected customer display
        if (elements.selectedCustomerInfo) {
            elements.selectedCustomerInfo.innerHTML = `
                <div class="font-medium">${customer.name || 'N/A'} ${customer.lastName || ''}</div>
                <div class="text-sm">Customer ID: ${customer.id || 'N/A'}</div>
                <div class="text-sm">Date of Birth: ${customer.dateOfBirth || 'N/A'}</div>
            `;
        }
        
        if (elements.selectedCustomerArea) elements.selectedCustomerArea.classList.remove('hidden');
        
        // Show action buttons immediately when customer is selected
        const actionButtonsDiv = document.getElementById('customer-action-buttons');
        if (actionButtonsDiv) {
            actionButtonsDiv.classList.remove('hidden');
        }
        
        // Hide search results to focus on selected customer
        if (elements.searchResultsArea) elements.searchResultsArea.classList.add('hidden');
        
        // Clear any previous customer details
        hideCustomerDetails();
    }

    function clearSearch() {
        const elements = getElements();
        
        // Clear all input fields
        if (elements.searchPartyIdInput) elements.searchPartyIdInput.value = '';
        if (elements.searchLastNameInput) elements.searchLastNameInput.value = '';
        if (elements.searchDateOfBirthInput) elements.searchDateOfBirthInput.value = '';
        
        // Clear results and status
        clearSearchResults();
        if (elements.searchStatus) elements.searchStatus.textContent = '';
        if (elements.searchError) elements.searchError.textContent = '';
        
        // Hide selected customer
        if (elements.selectedCustomerArea) elements.selectedCustomerArea.classList.add('hidden');
        
        // Hide action buttons when no customer is selected
        const actionButtonsDiv = document.getElementById('customer-action-buttons');
        if (actionButtonsDiv) {
            actionButtonsDiv.classList.add('hidden');
        }
        
        selectedCustomer = null;
        selectedCustomerId = null;
        
        // Hide customer details
        hideCustomerDetails();
    }

    function clearSearchResults() {
        const elements = getElements();
        if (elements.searchResultsList) elements.searchResultsList.innerHTML = '';
        if (elements.searchResultsArea) elements.searchResultsArea.classList.add('hidden');
    }

    async function loadSelectedCustomer() {
        if (!selectedCustomer) {
            console.error('No customer selected');
            return;
        }
        
        try {
            const customerId = selectedCustomer.id;
            console.log(`Loading customer data for ID: ${customerId}`);
            
            // Let fetchCustomerData handle everything - it doesn't return data, it renders directly
            await fetchCustomerData(customerId);
            
        } catch (error) {
            console.error('Error loading customer data:', error);
            
            const elements = getElements();
            if (elements.customerDetailsArea) {
                elements.customerDetailsArea.innerHTML = '<h2 class="col-span-full text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Customer Details</h2><div class="col-span-full text-red-600">Failed to load customer details</div>';
                elements.customerDetailsArea.classList.remove('hidden');
            }
        }
    }

    function hideCustomerDetails() {
        const elements = getElements();
        if (elements.customerDetailsArea) elements.customerDetailsArea.classList.add('hidden');
        if (elements.customerAccountsArea) elements.customerAccountsArea.classList.add('hidden');
        if (elements.transactionsArea) elements.transactionsArea.classList.add('hidden');
    }

    // --- Rendering Functions ---
    function populateCustomerSelect(customers) {
        // This function is no longer needed with the new search interface
        // Keeping it for backward compatibility but it won't be used
        console.log('populateCustomerSelect called but not used in new search interface');
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
        const isDeposit = account.type === 'deposit' || account.productLine === 'DEPOSITS';
        const balance = isLoan ? (account.outstandingBalance || account.principalAmount || 0) : (account.currentBalance || 0);
        const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(Math.abs(balance));

        // Create display name - for loans, show arrangement ID only
        let displayId = account.accountId;
        if (isLoan) {
            // For loans, show the correct loan ID (contractReference/loanId) not the arrangementId
            displayId = account.loanId || account.contractReference || account.accountId;
        } else if (account.arrangementId && account.arrangementId !== account.accountId) {
            displayId = `${account.accountId} (${account.arrangementId})`;
        }

        // Clean up product name to avoid undefined
        const productName = account.productName || account.displayName || 'Product';
        const startOrOpenDate = account.startDate || account.openDate || 'N/A';

        // Customize the button based on account type
        let actionButton = `
            <button data-account-id="${account.accountId}" class="view-transactions-btn text-xs text-blue-600 hover:underline focus:outline-none">
                View Transactions
            </button>
        `;

        // For loans, show a "View Loan Details" button instead and use the correct loan ID
        if (isLoan) {
            const loanId = account.loanId || account.contractReference || account.accountId;
            actionButton = `
                <button data-loan-id="${loanId}" class="view-loan-details-btn text-xs text-blue-600 hover:underline focus:outline-none">
                    View Loan Details
                </button>
            `;
        }

        // Determine styling based on account type
        const bgColorClass = isDeposit ? 'bg-green-50 hover:bg-green-100' : (isLoan ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100');
        const balanceColorClass = isLoan ? 'text-red-700' : (isDeposit ? 'text-green-700' : 'text-gray-900');
        const balanceLabel = isLoan ? 'Outstanding' : (isDeposit ? 'Deposit Amount' : 'Available');
        
        // Add type indicator for deposits
        const typeIndicator = isDeposit ? '<span class="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full ml-2">Term Deposit</span>' : '';

        return `
            <div class="flex justify-between items-center p-3 border rounded-md ${bgColorClass} mb-2">
                <div>
                    <span class="font-medium text-gray-800">${account.displayName || 'Account'} (${displayId})</span>
                    ${typeIndicator}
                    <span class="text-xs text-gray-500 ml-2">${productName} - ${isLoan ? 'Start' : 'Opened'}: ${startOrOpenDate}</span>
                </div>
                <div class="text-right">
                    <div class="font-semibold ${balanceColorClass}">${formattedBalance} ${account.currency}</div>
                    <div class="text-xs text-gray-500 mb-1">${balanceLabel}</div>
                    ${actionButton}
                </div>
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
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
            return;
        }
        
        // Use the same transaction rendering as mobile app
        targetDiv.innerHTML = transactions.map(transaction => {
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
            
            const date = formatDate(transaction.date);
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
        }).join('');
    }

    function renderLoanDetails(loanData) {
        const { loanDetailsDiv } = getElements();
        if (!loanDetailsDiv || !loanData) return;
        
        // Get the loan balance from the unified API data (if available)
        const currentBalance = loanData.outstandingBalance || loanData.principalAmount || 0;
        const formattedBalance = formatCurrency(currentBalance, loanData.currency || 'USD');
        
        loanDetailsDiv.innerHTML = `
            <div class="bg-white rounded-lg border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-6">Loan Summary</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Loan ID</label>
                            <div class="text-base text-gray-900">${loanData.id || loanData.loanId || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Status</label>
                            <div class="text-base text-gray-900">${loanData.status || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Product</label>
                            <div class="text-base text-gray-900">${loanData.productDisplayName || loanData.displayName || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Interest Rate</label>
                            <div class="text-base text-gray-900">${loanData.interestRate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Start Date</label>
                            <div class="text-base text-gray-900">${loanData.startDate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Term</label>
                            <div class="text-base text-gray-900">${loanData.term || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Payment Frequency</label>
                            <div class="text-base text-gray-900">Monthly</div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Current Balance</label>
                            <div class="text-lg font-semibold text-red-600">${formattedBalance}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Maturity Date</label>
                            <div class="text-base text-gray-900">${loanData.maturityDate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Next Payment Date</label>
                            <div class="text-base text-gray-900">${loanData.nextPaymentDate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Total Due</label>
                            <div class="text-base text-gray-900">${loanData.totalDue || 'N/A'}</div>
                        </div>
                        
                        <div class="pt-4">
                            <button id="view-loan-schedule-btn" data-loan-id="${loanData.loanId || loanData.id}" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                                View Payment Schedule
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
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

    // --- API Fetching ---
    async function fetchCustomers() {
        console.log("Fetching customers...");
        try {
            // Check if there's a party ID stored by the mobile app
            const mobilePartyId = localStorage.getItem('mobileAppPartyId');
            let fetchUrl = `/api/parties?_=${Date.now()}`;
            
            // Add the mobile party ID to the request if available
            if (mobilePartyId) {
                console.log("Found mobile app party ID in localStorage:", mobilePartyId);
                fetchUrl += `&mobilePartyId=${mobilePartyId}`;
            }
            
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();
            console.log("Customers received:", data);
            
            // Extract customers from the response (data is already an array)
            customersData = Array.isArray(data) ? data : [];
            populateCustomerSelect(customersData);

            // Update headless tab if available
            updateHeadlessTab();
        } catch (error) {
            console.error("Error fetching customers:", error);
            // Maybe show error near dropdown
        }
    }

    async function fetchCustomerData(customerId) {
        console.log(`Fetching customer data for ID: ${customerId}`);
        const { customerDetailsArea, customerAccountsArea } = getElements();
        
        try {
            // Show loading state in customer details area
            if (customerDetailsArea) {
                customerDetailsArea.innerHTML = '<h2 class="col-span-full text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Customer Details</h2><div class="text-gray-500">Loading customer details...</div>';
                customerDetailsArea.classList.remove('hidden');
            }
            
            // Show loading state in accounts area
            if (customerAccountsArea) {
                const accountsListDiv = document.getElementById('accounts-list');
                if (accountsListDiv) {
                    accountsListDiv.innerHTML = '<div class="text-gray-500">Loading accounts...</div>';
                }
                customerAccountsArea.classList.remove('hidden');
            }
            
            // Fetch customer details, accounts, and loans using unified APIs
            const [customerResponse, accountsResponse, loansResponse] = await Promise.all([
                fetch(`/api/parties/${customerId}?_=${Date.now()}`),
                fetch(`/api/parties/${customerId}/accounts?_=${Date.now()}`),
                fetch(`/api/parties/${customerId}/loans?_=${Date.now()}`)
            ]);
            
            // Handle customer details
            if (!customerResponse.ok) {
                throw new Error(`Failed to fetch customer details: ${customerResponse.status}`);
            }
            const customer = await customerResponse.json();
            
            // Handle accounts
            const accounts = accountsResponse.ok ? await accountsResponse.json() : [];
            
            // Handle loans
            const loans = loansResponse.ok ? await loansResponse.json() : [];
            
            // Combine accounts and loans for display
            const allAccountsAndLoans = [...accounts, ...loans];
            customerAccounts = allAccountsAndLoans; // Store for later use
            
            console.log(`Found ${accounts.length} accounts and ${loans.length} loans for customer ${customerId}`);
            
            // Render customer details
            renderCustomerDetails(customer);
            
            // Get the actual accounts list div, not the entire customer accounts area
            const accountsListDiv = document.getElementById('accounts-list');
            if (accountsListDiv) {
                renderAccountsList(allAccountsAndLoans, accountsListDiv);
            }
            
            // Show action buttons after loading customer data
            const actionButtonsDiv = document.getElementById('customer-action-buttons');
            if (actionButtonsDiv && customerAccounts.length > 0) {
                actionButtonsDiv.classList.remove('hidden');
            }

            // Update headless tab if available
            updateHeadlessTab();
            
        } catch (error) {
            console.error('Error fetching customer data:', error);
            
            // Show error message in customer details area
            if (customerDetailsArea) {
                customerDetailsArea.innerHTML = `
                    <h2 class="col-span-full text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Customer Details</h2>
                    <div class="col-span-full text-red-600">Error: ${error.message}</div>
                `;
            }
            
            // Show error in accounts area
            const accountsListDiv = document.getElementById('accounts-list');
            if (accountsListDiv) {
                accountsListDiv.innerHTML = '<div class="text-red-600">Failed to load customer accounts</div>';
            }
        }
    }

    async function fetchBranchTransactions(accountId) {
        console.log(`Fetching branch transactions for account: ${accountId}`);
        const { transactionsListDiv, transactionsLoadingDiv, transactionsErrorDiv } = getElements();
        
        if (!transactionsListDiv) return;
        
        try {
            // Show loading state
            if (transactionsLoadingDiv) transactionsLoadingDiv.style.display = 'block';
            if (transactionsErrorDiv) transactionsErrorDiv.style.display = 'none';
            transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Loading transactions...</div>';
            
            // Use the same unified API as mobile app
            const response = await fetch(`/api/accounts/${accountId}/transactions?_=${Date.now()}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch transactions: ${response.status}`);
            }
            
            const transactions = await response.json();
            console.log(`Found ${transactions.length} transactions for account ${accountId}`);
            
            if (transactions.length === 0) {
                transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
                if (transactionsLoadingDiv) transactionsLoadingDiv.style.display = 'none';
                return;
            }
            
            // Transform API data into transaction objects for rendering (same as mobile app)
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
            
            // Use the exact same rendering as mobile app
            renderTransactionsMobile(formattedTransactions, transactionsListDiv);
            
            // Hide loading state
            if (transactionsLoadingDiv) transactionsLoadingDiv.style.display = 'none';

            // Update headless tab if available
            updateHeadlessTab();
            
        } catch (error) {
            console.error('Error fetching transactions:', error);
            
            // Show error message
            if (transactionsErrorDiv) {
                transactionsErrorDiv.textContent = `Error loading transactions: ${error.message}`;
                transactionsErrorDiv.style.display = 'block';
            }
            
            // Hide loading state
            if (transactionsLoadingDiv) transactionsLoadingDiv.style.display = 'none';
            
            // Show empty state
            transactionsListDiv.innerHTML = '<div class="text-center text-gray-500 py-4">Failed to load transactions</div>';
        }
    }
    
    // Use the exact same transaction rendering as mobile app
    function renderTransactionsMobile(transactions, targetDiv) {
        if (!targetDiv) return;
        if (!transactions || transactions.length === 0) {
            targetDiv.innerHTML = '<div class="text-center text-gray-500 py-4">No transactions found for this account.</div>';
            return;
        }
        targetDiv.innerHTML = transactions.map(renderTransactionItemMobile).join('');
    }
    
    function renderTransactionItemMobile(transaction) {
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

    async function fetchLoanDetails(loanId) {
        console.log(`Fetching loan details for loan ID: ${loanId}`);
        selectedLoanId = loanId; // Store for later use
        
        // Show the transactions area and hide the customer sections  
        const { customerDetailsArea, customerAccountsArea, transactionsArea, transactionsTitle, transactionsListDiv } = getElements();
        if(customerDetailsArea) customerDetailsArea.classList.add('hidden');
        if(customerAccountsArea) customerAccountsArea.classList.add('hidden');
        if(transactionsArea) transactionsArea.classList.remove('hidden');
        
        // Set title to indicate loan details
        if (transactionsTitle) {
            transactionsTitle.textContent = `Loan Details: ${loanId}`;
        }
        
        // Show loading state
        if (transactionsListDiv) {
            transactionsListDiv.innerHTML = '<div class="text-gray-500">Loading loan details...</div>';
        }
        
        try {
            // First, get the customer's loan data from the unified loans API to get current balance
            const loansResponse = await fetch(`/api/parties/${selectedCustomerId}/loans?_=${Date.now()}`);
            let loanBalance = 0;
            let loanCurrency = 'USD';
            let loanDisplayName = 'N/A';
            let loanStatus = 'N/A';
            
            if (loansResponse.ok) {
                const loans = await loansResponse.json();
                const loan = loans.find(l => l.loanId === loanId);
                if (loan) {
                    loanBalance = loan.outstandingBalance || loan.principalAmount || 0;
                    loanCurrency = loan.currency || 'USD';
                    loanDisplayName = loan.displayName || 'N/A';
                    loanStatus = loan.status || 'N/A';
                }
            }
            
            // Get loan details from the details API for additional info
            const detailsResponse = await fetch(`/api/loans/${loanId}/details?_=${Date.now()}`);
            
            if (detailsResponse.ok) {
                const detailsData = await detailsResponse.json();
                
                // Combine data from both APIs
                const combinedData = {
                    id: loanId,
                    loanId: loanId,
                    status: loanStatus,
                    productDisplayName: detailsData.productDisplayName || loanDisplayName,
                    displayName: loanDisplayName,
                    outstandingBalance: loanBalance,
                    currency: loanCurrency,
                    interestRate: detailsData.interestRate,
                    startDate: detailsData.startDate,
                    term: detailsData.term,
                    maturityDate: detailsData.maturityDate,
                    nextPaymentDate: detailsData.nextPaymentDate,
                    totalDue: detailsData.totalDue
                };
                
                // Render loan details in the transactions list area
                renderLoanDetailsInTransactionArea(combinedData);

                // Update headless tab if available
                updateHeadlessTab();
                
            } else {
                // Fall back to just unified API data
                const fallbackData = {
                    id: loanId,
                    loanId: loanId,
                    status: loanStatus,
                    productDisplayName: loanDisplayName,
                    displayName: loanDisplayName,
                    outstandingBalance: loanBalance,
                    currency: loanCurrency,
                    interestRate: 'N/A',
                    startDate: 'N/A',
                    term: 'N/A',
                    maturityDate: 'N/A',
                    nextPaymentDate: 'N/A',
                    totalDue: 'N/A'
                };
                
                renderLoanDetailsInTransactionArea(fallbackData);

                // Update headless tab if available
                updateHeadlessTab();
            }
            
        } catch (error) {
            console.error('Error fetching loan details:', error);
            
            // Show error in transactions area
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<div class="text-red-500">Failed to load loan details</div>';
            }
        }
    }
    
    function renderLoanDetailsInTransactionArea(loanData) {
        const { transactionsListDiv } = getElements();
        if (!transactionsListDiv || !loanData) return;
        
        // Get the loan balance
        const currentBalance = loanData.outstandingBalance || loanData.principalAmount || 0;
        const formattedBalance = formatCurrency(currentBalance, loanData.currency || 'USD');
        
        transactionsListDiv.innerHTML = `
            <div class="bg-white rounded-lg border border-gray-200 p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Loan ID</label>
                            <div class="text-base text-gray-900">${loanData.id || loanData.loanId || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Status</label>
                            <div class="text-base text-gray-900">${loanData.status || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Product</label>
                            <div class="text-base text-gray-900">${loanData.productDisplayName || loanData.displayName || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Interest Rate</label>
                            <div class="text-base text-gray-900">${loanData.interestRate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Start Date</label>
                            <div class="text-base text-gray-900">${loanData.startDate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Term</label>
                            <div class="text-base text-gray-900">${loanData.term || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Payment Frequency</label>
                            <div class="text-base text-gray-900">Monthly</div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Current Balance</label>
                            <div class="text-lg font-semibold text-red-600">${formattedBalance}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Maturity Date</label>
                            <div class="text-base text-gray-900">${loanData.maturityDate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Next Payment Date</label>
                            <div class="text-base text-gray-900">${loanData.nextPaymentDate || 'N/A'}</div>
                        </div>
                        
                        <div class="border-b border-gray-100 pb-2">
                            <label class="text-sm font-medium text-gray-500">Total Due</label>
                            <div class="text-base text-gray-900">${loanData.totalDue || 'N/A'}</div>
                        </div>
                        
                        <div class="pt-4">
                            <button id="view-loan-schedule-btn" data-loan-id="${loanData.loanId || loanData.id}" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                                View Payment Schedule
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listener for the schedule button
        const scheduleBtn = document.getElementById('view-loan-schedule-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', (e) => {
                const loanId = e.target.getAttribute('data-loan-id');
                fetchLoanSchedules(loanId);
            });
        }
    }

    async function fetchLoanSchedules(loanId) {
        console.log(`Fetching loan schedules for loan ID: ${loanId}`);
        
        // Show the transactions area and hide the customer sections  
        const { customerDetailsArea, customerAccountsArea, transactionsArea, transactionsTitle, transactionsListDiv } = getElements();
        if(customerDetailsArea) customerDetailsArea.classList.add('hidden');
        if(customerAccountsArea) customerAccountsArea.classList.add('hidden');
        if(transactionsArea) transactionsArea.classList.remove('hidden');
        
        // Set title to indicate loan schedule
        if (transactionsTitle) {
            transactionsTitle.textContent = `Payment Schedule: ${loanId}`;
        }
        
        // Show loading state
        if (transactionsListDiv) {
            transactionsListDiv.innerHTML = '<div class="text-gray-500">Loading payment schedule...</div>';
        }
        
        try {
            const response = await fetch(`/api/loans/${loanId}/schedule?_=${Date.now()}`, {
                headers: {
                    'X-Client-Type': 'branch'
                }
            });
            
            if (response.ok) {
                const scheduleData = await response.json();
                renderLoanScheduleInTransactionArea(scheduleData);

                // Update headless tab to show the loan schedule API call
                showLoanScheduleInHeadless();
                
            } else {
                throw new Error(`Failed to fetch loan schedules: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Error fetching loan schedules:', error);
            
            // Show error in transactions area
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<div class="text-red-500">Failed to load payment schedule</div>';
            }
        }
    }
    
    function renderLoanScheduleInTransactionArea(scheduleData) {
        const { transactionsListDiv } = getElements();
        if (!transactionsListDiv || !scheduleData || !scheduleData.schedules) return;
        
        const schedules = scheduleData.schedules;
        const currency = scheduleData.currency || 'USD';
        
        // Extract the schedule items from the first schedule
        const scheduleItems = schedules[0].scheduleItems || schedules;
        
        // Transform the data to match mobile app format
        const transformedScheduleData = {
            loanId: scheduleData.loanId,
            currency: currency,
            payments: scheduleItems.map(item => ({
                dueDate: item.dueDate,
                principal: item.principal || 0,
                interest: item.interest || 0,
                totalAmount: item.totalAmount || 0,
                status: item.status || 'Pending'
            }))
        };
        
        // Use the exact same mobile rendering function
        renderLoanScheduleMobile(transformedScheduleData, transactionsListDiv);
    }
    
    // Use the exact same loan schedule rendering as mobile app
    function renderLoanScheduleMobile(schedule, targetDiv) {
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
        backToLoanDetails: null, // Handler for back button from schedules to details
        searchCustomers: null,
        clearSearch: null,
        searchKeypress: []
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
        const elements = getElements();

        // Search functionality event listeners
        if (elements.searchCustomersBtn) {
            eventHandlers.searchCustomers = performCustomerSearch;
            elements.searchCustomersBtn.addEventListener('click', eventHandlers.searchCustomers);
        }

        if (elements.clearSearchBtn) {
            eventHandlers.clearSearch = clearSearch;
            elements.clearSearchBtn.addEventListener('click', eventHandlers.clearSearch);
        }

        if (elements.loadCustomerBtn) {
            eventHandlers.loadCustomer = loadSelectedCustomer;
            elements.loadCustomerBtn.addEventListener('click', eventHandlers.loadCustomer);
        }

        // Allow Enter key to trigger search in input fields
        [elements.searchPartyIdInput, elements.searchLastNameInput, elements.searchDateOfBirthInput].forEach(input => {
            if (input) {
                const handler = (e) => {
                    if (e.key === 'Enter') {
                        performCustomerSearch();
                    }
                };
                input.addEventListener('keypress', handler);
                eventHandlers.searchKeypress = eventHandlers.searchKeypress || [];
                eventHandlers.searchKeypress.push({ input, handler });
            }
        });

        if (elements.backToCustomerBtn) {
            eventHandlers.backToCustomer = showCustomerView;
            elements.backToCustomerBtn.addEventListener('click', eventHandlers.backToCustomer);
        }

        staticListenersAdded = true;
    }

    function removeAllListeners() {
        const elements = getElements();

        // Remove search-related listeners
        if (eventHandlers.searchCustomers && elements.searchCustomersBtn) {
            elements.searchCustomersBtn.removeEventListener('click', eventHandlers.searchCustomers);
        }
        if (eventHandlers.clearSearch && elements.clearSearchBtn) {
            elements.clearSearchBtn.removeEventListener('click', eventHandlers.clearSearch);
        }
        if (eventHandlers.loadCustomer && elements.loadCustomerBtn) {
            elements.loadCustomerBtn.removeEventListener('click', eventHandlers.loadCustomer);
        }
        if (eventHandlers.backToCustomer && elements.backToCustomerBtn) {
            elements.backToCustomerBtn.removeEventListener('click', eventHandlers.backToCustomer);
        }

        // Remove keypress listeners
        if (eventHandlers.searchKeypress) {
            eventHandlers.searchKeypress.forEach(({ input, handler }) => {
                input.removeEventListener('keypress', handler);
            });
        }

        // Remove dynamic listeners
        eventHandlers.viewTransaction.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewLoanDetails.forEach(({button, handler}) => button.removeEventListener('click', handler));
        eventHandlers.viewLoanSchedules.forEach(({button, handler}) => button.removeEventListener('click', handler));

        // Clear all handlers
        Object.keys(eventHandlers).forEach(key => {
            if (Array.isArray(eventHandlers[key])) {
                eventHandlers[key] = [];
            } else {
                eventHandlers[key] = null;
            }
        });

        staticListenersAdded = false;
    }

    function initBranchAppTab() {
        console.log("Initializing Branch App Tab with search interface...");
        console.log("Current selectedCustomerId on init:", selectedCustomerId);
        console.log("Current selectedCustomer on init:", selectedCustomer);
        
        // Clean up existing listeners first
        removeAllListeners();
        
        // Add static event listeners 
        addStaticListeners();
        
        // Add new navigation and form listeners
        addBranchNavigationListeners();
        addCreateAccountFormListener();
        addCreateLoanFormListener();
        
        // Only clear state if we don't have a selected customer
        // This preserves customer selection when navigating between tabs
        if (!selectedCustomer && !selectedCustomerId) {
            console.log("No customer selected, clearing state");
            selectedCustomerId = null;
            selectedCustomer = null;
            customerAccounts = [];
            
            // Hide all detail areas initially
            hideCustomerDetails();
            
            // Clear search interface
            clearSearch();
        } else {
            console.log("Customer already selected, preserving state");
        }
        
        // Initialize with customer management screen
        showBranchScreen('customer-management');
        
        console.log("Branch App tab initialized with search interface and new features");
        console.log("Final selectedCustomerId:", selectedCustomerId);
        console.log("Final selectedCustomer:", selectedCustomer);
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

    // --- Internal Navigation Functions ---
    function showBranchScreen(screenName) {
        console.log(`Switching to branch screen: ${screenName}`);
        
        // Hide all screens
        document.querySelectorAll('.branch-screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show the selected screen
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
            currentBranchScreen = screenName;
            
            // Update active menu item
            document.querySelectorAll('[data-branch-tab]').forEach(link => {
                link.classList.remove('bg-gray-700', 'font-semibold');
                link.classList.add('hover:bg-gray-700');
            });
            
            const activeLink = document.querySelector(`[data-branch-tab="${screenName}"]`);
            if (activeLink) {
                activeLink.classList.add('bg-gray-700', 'font-semibold');
                activeLink.classList.remove('hover:bg-gray-700');
            }
        }
    }
    
    function addBranchNavigationListeners() {
        // Add event listeners for internal navigation
        document.querySelectorAll('[data-branch-tab]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const screenName = link.getAttribute('data-branch-tab');
                showBranchScreen(screenName);
                
                // Special handling for navigation with pre-filled data
                if (screenName === 'account-services' && selectedCustomerId) {
                    document.getElementById('account-party-id').value = selectedCustomerId;
                }
                if (screenName === 'loan-applications' && selectedCustomerId) {
                    document.getElementById('loan-party-id').value = selectedCustomerId;
                    populateDisburseAccountDropdown();
                }
            });
        });
        
        // Add listeners for create account/loan buttons from customer management
        const createAccountBtn = document.getElementById('create-new-account-btn');
        const createLoanBtn = document.getElementById('create-new-loan-btn');
        
        if (createAccountBtn) {
            createAccountBtn.addEventListener('click', () => {
                console.log('Create New Account button clicked');
                console.log('Selected Customer ID:', selectedCustomerId);
                console.log('Selected Customer:', selectedCustomer);
                
                showBranchScreen('account-services');
                
                // Use setTimeout to ensure DOM is updated after screen switch
                setTimeout(() => {
                    const partyIdField = document.getElementById('account-party-id');
                    if (partyIdField && selectedCustomerId) {
                        partyIdField.value = selectedCustomerId;
                        console.log('Auto-populated account party ID:', selectedCustomerId);
                    } else {
                        console.log('Failed to auto-populate account party ID:', {
                            fieldExists: !!partyIdField,
                            customerIdAvailable: !!selectedCustomerId
                        });
                    }
                }, 100);
            });
        }
        
        if (createLoanBtn) {
            createLoanBtn.addEventListener('click', () => {
                console.log('Create New Loan button clicked');
                console.log('Selected Customer ID:', selectedCustomerId);
                console.log('Selected Customer:', selectedCustomer);
                
                showBranchScreen('loan-applications');
                
                // Use setTimeout to ensure DOM is updated after screen switch
                setTimeout(() => {
                    const partyIdField = document.getElementById('loan-party-id');
                    if (partyIdField && selectedCustomerId) {
                        partyIdField.value = selectedCustomerId;
                        console.log('Auto-populated loan party ID:', selectedCustomerId);
                        populateDisburseAccountDropdown();
                    } else {
                        console.log('Failed to auto-populate loan party ID:', {
                            fieldExists: !!partyIdField,
                            customerIdAvailable: !!selectedCustomerId
                        });
                    }
                }, 100);
            });
        }
    }
    
    function populateDisburseAccountDropdown() {
        const dropdown = document.getElementById('loan-disburse-account');
        if (!dropdown) return;
        
        // Clear existing options except the first placeholder
        dropdown.innerHTML = '<option value="">Select disbursement account...</option>';
        
        // Filter customer accounts to only show valid current accounts
        if (customerAccounts && customerAccounts.length > 0) {
            // Filter to only include:
            // 1. Accounts that are NOT loans (exclude type === 'loan')
            // 2. Accounts that have valid account numbers/IDs
            // 3. Accounts that are current/checking accounts
            const validCurrentAccounts = customerAccounts.filter(account => {
                // Exclude loans
                if (account.type === 'loan') return false;
                
                // Must have a valid account number or ID
                const accountId = account.accountNumber || account.accountId || account.id;
                if (!accountId || accountId === 'undefined' || accountId === 'null') return false;
                
                // Only include current/checking accounts (exclude savings, etc. if needed)
                // Check product ID or name to identify current accounts
                const productId = account.productId || account.productName || account.displayName || '';
                const isCurrentAccount = 
                    productId.includes('CURRENT') || 
                    productId.includes('CHECKING') || 
                    productId.includes('DDA') ||
                    productId.includes('Current') ||
                    productId.includes('Checking') ||
                    // If we can't determine type, include it (to be safe)
                    (!account.type || account.type === 'account');
                
                return isCurrentAccount;
            });
            
            if (validCurrentAccounts.length > 0) {
                validCurrentAccounts.forEach(account => {
                    const option = document.createElement('option');
                    
                    // Use the account number for the value (this will be used in the 3-part key)
                    const accountId = account.accountNumber || account.accountId || account.id;
                    option.value = accountId;
                    
                    // Create clean display text with fallbacks for undefined values
                    const productName = account.productDisplayName || account.productName || account.productId || 'Current Account';
                    const displayText = `${accountId} - ${productName}`;
                    option.textContent = displayText;
                    
                    dropdown.appendChild(option);
                });
            } else {
                // If no valid current accounts found
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No current accounts found for this customer';
                option.disabled = true;
                dropdown.appendChild(option);
            }
        } else {
            // If no accounts at all
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No accounts found for this customer';
            option.disabled = true;
            dropdown.appendChild(option);
        }
    }
    
    // --- Account Creation Functions ---
    async function createAccount(partyId, productId, currency) {
        console.log(`Creating account for party ${partyId} with product ${productId} and currency ${currency}`);
        
        try {
            // Use exactly the same payload structure as headless_v2 tab that generates events
            // Fixed values that are known to work (from headless_v2 samplePayload)
            const payload = {
                "parties": [
                    {
                        "partyId": partyId,
                        "partyRole": "OWNER"
                    }
                ],
                "accountName": "current",
                "openingDate": "20250314",  // Fixed date that works
                "productId": "CHECKING.ACCOUNT",
                "currency": "USD",
                "branchCode": "01123",
                "quotationReference": "QUOT246813"  // Fixed quotation ref that works
            };
            
            // Use exactly the same API call as headless_v2 tab
            const response = await fetch('/api/headless/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uri: 'http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/currentAccounts',
                    method: 'POST',
                    payload: payload,
                    domain: 'deposits' // Track which domain the call came from
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Account creation result via headless track:', result);
            
            // Extract the account reference from the tracked API call response (same as headless_v2)
            let accountReference = null;
            if (result.api_call && result.api_call.response && result.api_call.response.accountReference) {
                accountReference = result.api_call.response.accountReference;
            }
            
            // Return in the format expected by the UI
            return {
                success: true,
                accountReference: accountReference,
                message: `Account ${accountReference} created successfully for party ${partyId}`,
                status: 200,
                method: 'headless_track_fixed_payload',
                raw_result: result
            };
            
        } catch (error) {
            console.error('Error creating account:', error);
            throw error;
        }
    }
    
    // --- Loan Creation Functions ---
    async function createLoan(partyId, productId, currency, amount, termYears, disburseAccount) {
        console.log(`Creating loan for party ${partyId} with product ${productId}, currency ${currency}, amount ${amount}, term ${termYears} years, disburse to ${disburseAccount}`);
        
        try {
            // Use exactly the same headless track approach as account creation
            // Extract just the account number from the disburseAccount (e.g., "GB0010001-1013717563" -> "1013717563")
            const accountNumber = disburseAccount.includes('-') ? disburseAccount.split('-')[1] : disburseAccount;
            const accountReference = `DDAComposable|GB0010001|${accountNumber}`;
            
            console.log("=== LOAN CREATION PAYLOAD DEBUG ===");
            console.log("Disbursement Account Full:", disburseAccount);
            console.log("Extracted Account Number:", accountNumber);
            console.log("Formatted Account Reference:", accountReference);
            
            // Use exactly the payload structure specified by the user
            const payload = {
                "header": {},
                "body": {
                    "partyIds": [
                        {
                            "partyId": partyId,
                            "partyRole": "OWNER"
                        }
                    ],
                    "productId": productId,
                    "currency": currency,
                    "arrangementEffectiveDate": "",  // Empty as specified by user
                    "commitment": [
                        {
                            "amount": amount.toString(),
                            "term": `${termYears}Y`
                        }
                    ],
                    "schedule": [
                        {
                            "payment": [
                                {},
                                {
                                    "paymentFrequency": "e0Y e1M e0W e0D e0F"
                                }
                            ]
                        }
                    ],
                    "settlement": [
                        {
                            "payout": [
                                {
                                    "payoutSettlement": "YES",
                                    "property": [
                                        {
                                            "payoutAccount": accountReference
                                        }
                                    ]
                                }
                            ],
                            "assocSettlement": [
                                {
                                    "payinSettlement": "YES",
                                    "reference": [
                                        {
                                            "payinAccount": accountReference
                                        }
                                    ]
                                },
                                {
                                    "payinSettlement": "YES",
                                    "reference": [
                                        {
                                            "payinAccount": accountReference
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            };
            
            console.log("=== COMPLETE LOAN PAYLOAD ===");
            console.log(JSON.stringify(payload, null, 2));
            
            const fullRequestBody = {
                uri: 'http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/consumerLoans',
                method: 'POST',
                payload: payload,
                domain: 'lending' // Track which domain the call came from
            };
            
            console.log("=== COMPLETE REQUEST BODY TO /api/headless/track ===");
            console.log(JSON.stringify(fullRequestBody, null, 2));
            
            // Use exactly the same headless track endpoint as account creation
            const response = await fetch('/api/headless/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fullRequestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('=== LOAN CREATION RESPONSE ===');
            console.log(JSON.stringify(result, null, 2));
            
            // Extract the loan ID from the tracked API call response
            let loanId = null;
            if (result.api_call && result.api_call.response) {
                const apiResponse = result.api_call.response;
                loanId = apiResponse.arrangementId || apiResponse.loanId || apiResponse.id;
                console.log("Extracted Loan ID:", loanId);
            }
            
            // Return in the format expected by the UI
            return {
                success: true,
                loanId: loanId,
                message: `Loan ${loanId} created successfully for party ${partyId}`,
                status: 200,
                method: 'headless_track_fixed_account_ref',
                raw_result: result
            };
            
        } catch (error) {
            console.error('=== LOAN CREATION ERROR ===');
            console.error('Error creating loan:', error);
            throw error;
        }
    }
    
    // --- Form Handlers ---
    function addCreateAccountFormListener() {
        const form = document.getElementById('create-account-form');
        const submitBtn = document.getElementById('create-account-submit-btn');
        const resultDiv = document.getElementById('account-creation-result');
        const messageDiv = document.getElementById('account-creation-message');
        
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const partyId = document.getElementById('account-party-id').value;
                const productId = document.getElementById('account-product').value;
                const currency = document.getElementById('account-currency').value;
                
                // Disable submit button and show loading
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating Account...';
                
                // Hide previous results
                resultDiv.classList.add('hidden');
                
                try {
                    const result = await createAccount(partyId, productId, currency);
                    
                    // Show result
                    resultDiv.classList.remove('hidden');
                    
                    if (result.success) {
                        resultDiv.className = 'mt-4 p-4 rounded-md bg-green-100 border border-green-200';
                        messageDiv.innerHTML = `
                            <div class="text-green-800 font-medium">${result.message}</div>
                            <div class="text-green-700 text-sm mt-2">Account creation successful!</div>
                        `;
                        
                        // Reset form
                        form.reset();

                        // Update headless tab if available
                        updateHeadlessTab();
                    } else {
                        resultDiv.className = 'mt-4 p-4 rounded-md bg-red-100 border border-red-200';
                        messageDiv.innerHTML = `
                            <div class="text-red-800 font-medium">Account Creation Failed</div>
                            <div class="text-red-700 text-sm mt-2">${result.message}</div>
                        `;
                    }
                } catch (error) {
                    resultDiv.classList.remove('hidden');
                    resultDiv.className = 'mt-4 p-4 rounded-md bg-red-100 border border-red-200';
                    messageDiv.innerHTML = `
                        <div class="text-red-800 font-medium">Error</div>
                        <div class="text-red-700 text-sm mt-2">An unexpected error occurred</div>
                    `;
                } finally {
                    // Re-enable submit button
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Account';
                }
            });
        }
    }
    
    function addCreateLoanFormListener() {
        const form = document.getElementById('create-loan-form');
        const submitBtn = document.getElementById('create-loan-submit-btn');
        const resultDiv = document.getElementById('loan-creation-result');
        const messageDiv = document.getElementById('loan-creation-message');
        
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const partyId = document.getElementById('loan-party-id').value;
                const productId = document.getElementById('loan-product').value;
                const currency = document.getElementById('loan-currency').value;
                const amount = parseFloat(document.getElementById('loan-amount').value);
                const termYears = parseInt(document.getElementById('loan-term').value);
                const disburseAccount = document.getElementById('loan-disburse-account').value;
                
                // Disable submit button and show loading
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating Loan...';
                
                // Hide previous results
                resultDiv.classList.add('hidden');
                
                try {
                    const result = await createLoan(partyId, productId, currency, amount, termYears, disburseAccount);
                    
                    // Show result
                    resultDiv.classList.remove('hidden');
                    
                    if (result.success) {
                        resultDiv.className = 'mt-4 p-4 rounded-md bg-green-100 border border-green-200';
                        messageDiv.innerHTML = `
                            <div class="text-green-800 font-medium">${result.message}</div>
                            <div class="text-green-700 text-sm mt-2">Loan application submitted successfully!</div>
                        `;
                        
                        // Reset form
                        form.reset();
                        // Clear the disbursement dropdown since form.reset() might not clear it
                        document.getElementById('loan-disburse-account').innerHTML = '<option value="">Select disbursement account...</option>';

                        // Update headless tab if available
                        updateHeadlessTab();
                    } else {
                        resultDiv.className = 'mt-4 p-4 rounded-md bg-red-100 border border-red-200';
                        messageDiv.innerHTML = `
                            <div class="text-red-800 font-medium">Loan Creation Failed</div>
                            <div class="text-red-700 text-sm mt-2">${result.message}</div>
                        `;
                    }
                } catch (error) {
                    resultDiv.classList.remove('hidden');
                    resultDiv.className = 'mt-4 p-4 rounded-md bg-red-100 border border-red-200';
                    messageDiv.innerHTML = `
                        <div class="text-red-800 font-medium">Error</div>
                        <div class="text-red-700 text-sm mt-2">An unexpected error occurred</div>
                    `;
                } finally {
                    // Re-enable submit button
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Loan';
                }
            });
        }
    }

    // Add DOM checking functionality for branch app
    let _isActivating = false;
    let _domReady = false;
    let _pollIntervalId = null;

    // Key elements that must be present for branch app to function
    const _KEY_ELEMENT_IDS = [
        'search-party-id',
        'search-customers-btn',
        'search-results-area',
        'selected-customer-area',
        'customer-details-area'
    ];

    function _checkBranchDOMReady() {
        const missingElements = [];
        for (const elementId of _KEY_ELEMENT_IDS) {
            const element = document.getElementById(elementId);
            if (!element) {
                missingElements.push(elementId);
            }
        }
        
        if (missingElements.length > 0) {
            console.log(`Branch DOM check: Missing elements: ${missingElements.join(', ')}`);
            return false;
        }
        
        console.log('Branch DOM check: All key elements found');
        return true;
    }

    function _waitForBranchDOM() {
        if (_domReady && _isActivating) {
            console.log('_waitForBranchDOM: DOM already ready and still activating.');
            _initializeBranchView();
            return;
        }
        if (!_isActivating) {
            console.log('_waitForBranchDOM: Not activating. Aborting DOM poll.');
            if (_pollIntervalId) clearInterval(_pollIntervalId);
            _pollIntervalId = null;
            return;
        }

        console.log('_waitForBranchDOM: Starting to poll for DOM elements...');
        
        if (_pollIntervalId) clearInterval(_pollIntervalId);

        let pollCount = 0;
        const maxPolls = 80; // 20 seconds
        const pollInterval = 250; // 250ms intervals

        _pollIntervalId = setInterval(() => {
            if (!_isActivating) { 
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                console.log('Polling stopped (Branch): Tab deactivated during DOM check.');
                return;
            }
            pollCount++;
            console.log(`Branch DOM check attempt ${pollCount}/${maxPolls}`);
            
            if (_checkBranchDOMReady()) { 
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                console.log('Branch DOM ready! Initializing view...');
                _domReady = true;
                _initializeBranchView(); 
            } else if (pollCount >= maxPolls) {
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                console.log('Failed to find all Branch DOM elements after timeout.');
                const tabContentArea = document.getElementById('branch-content-area') || document.getElementById('tab-content-area'); 
                if (tabContentArea && _isActivating) { 
                    tabContentArea.innerHTML = '<div class="p-4 text-red-500">Error: Branch interface failed to load. Key elements missing.</div>';
                }
            }
        }, pollInterval);
    }

    function _initializeBranchView() {
        console.log('Initializing Branch view...');
        if (typeof initBranchAppTab === 'function') {
            initBranchAppTab();
        }
    }

    // Create BranchAppModule for TabManager (moved inside IIFE to access variables)
    const BranchAppModule = {
        onInit() {
            console.log('[BranchAppModule] onInit called');
            // Initialize any module-level state here
        },

        onActivate(isRestoring) {
            console.log('[BranchAppModule] onActivate called. isRestoring:', isRestoring);
            _isActivating = true;
            
            // Clear any existing polling intervals
            if (_pollIntervalId) {
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
            }
            
            // Check if DOM is already ready
            if (_checkBranchDOMReady()) {
                console.log('Branch DOM already ready on activation.');
                _domReady = true;
                _initializeBranchView();
            } else {
                console.log('Branch DOM not ready on activation. Starting polling...');
                _domReady = false;
                _waitForBranchDOM();
            }
        },

        onDeactivate(isUnloading) {
            console.log('[BranchAppModule] onDeactivate called. isUnloading:', isUnloading);
            _isActivating = false;
            
            // Clear any polling intervals immediately
            if (_pollIntervalId) {
                clearInterval(_pollIntervalId);
                _pollIntervalId = null;
                console.log('Branch DOM polling stopped due to deactivation.');
            }
            
            // Clean up event listeners
            if (typeof removeAllListeners === 'function') {
                removeAllListeners();
            }
            
            console.log('Branch app cleanup completed.');
        },

        onDestroy() {
            console.log('[BranchAppModule] onDestroy called');
            // Final cleanup
        }
    };

    // Register with TabManager
    function registerBranchApp() {
        console.log('[BranchAppModule] Attempting registration...');
        console.log('[BranchAppModule] window.TabManager exists:', !!window.TabManager);
        if (window.TabManager) {
            console.log('[BranchAppModule] TabManager found, registering tab "branch"');
            window.TabManager.registerTab('branch', BranchAppModule);
            console.log('[BranchAppModule] Successfully registered with TabManager');
            return true;
        } else {
            console.warn('[BranchAppModule] TabManager not found yet. Will retry...');
            return false;
        }
    }

    console.log('[BranchAppModule] About to start registration process...');

    // Try to register immediately
    if (!registerBranchApp()) {
        console.log('[BranchAppModule] Initial registration failed, starting retry loop...');
        // If TabManager not ready, wait and retry
        let retryCount = 0;
        const maxRetries = 50; // 5 seconds max
        const retryInterval = setInterval(() => {
            retryCount++;
            console.log(`[BranchAppModule] Retry attempt ${retryCount}/${maxRetries}`);
            if (registerBranchApp()) {
                console.log('[BranchAppModule] Registration successful on retry!');
                clearInterval(retryInterval);
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                console.error('[BranchAppModule] TabManager not found after maximum retries. Ensure tab-manager.js is loaded first.');
            }
        }, 100);
    } else {
        console.log('[BranchAppModule] Registration successful on first attempt!');
    }

    // --- Headless Integration Functions ---
    function updateHeadlessTab() {
        console.log("[BranchApp] updateHeadlessTab() called");
        try {
            if (window.reloadHeadlessData) {
                console.log("[BranchApp] Calling window.reloadHeadlessData()");
                window.reloadHeadlessData();
            } else {
                console.log("[BranchApp] window.reloadHeadlessData not available");
            }
        } catch (e) {
            console.log("[BranchApp] Error calling headless tab:", e);
        }
    }

    function showLoanScheduleInHeadless() {
        try {
            if (window.showLoanSchedulesApiCall) {
                console.log("Showing loan schedules API call in headless tab");
                window.showLoanSchedulesApiCall();
            }
        } catch (e) {
            console.log("Headless tab loan schedule function not available:", e);
        }
    }

})(); // End of IIFE