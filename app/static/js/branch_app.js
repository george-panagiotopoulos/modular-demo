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

    // --- DOM Elements ---
    function getElements() {
        return {
            // New search interface elements
            searchPartyIdInput: document.getElementById('search-party-id'),
            searchLastNameInput: document.getElementById('search-last-name'),
            searchDateOfBirthInput: document.getElementById('search-date-of-birth'),
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
            accountsListDiv: document.getElementById('customer-accounts-area')?.querySelector('#accounts-list'), // Safer access
            transactionsArea: document.getElementById('account-transactions-area'),
            transactionsListDiv: document.getElementById('transactions-list'),
            transactionsTitle: document.getElementById('transactions-title'),
            backToCustomerBtn: document.getElementById('back-to-customer')
        };
    }

    // --- New Search Functions ---
    async function performCustomerSearch() {
        const elements = getElements();
        const partyId = elements.searchPartyIdInput?.value.trim() || '';
        const lastName = elements.searchLastNameInput?.value.trim() || '';
        const dateOfBirth = elements.searchDateOfBirthInput?.value.trim() || '';
        
        // Clear previous results and errors
        clearSearchResults();
        if (elements.searchError) elements.searchError.textContent = '';
        
        // Validate that at least one search criteria is provided
        if (!partyId && !lastName && !dateOfBirth) {
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
            
            const response = await fetch(`/api/branch/customers/search?${params.toString()}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }
            
            if (elements.searchStatus) elements.searchStatus.textContent = '';
            displaySearchResults(data.customers || []);
            
        } catch (error) {
            console.error('Search error:', error);
            if (elements.searchError) elements.searchError.textContent = `Search failed: ${error.message}`;
            if (elements.searchStatus) elements.searchStatus.textContent = '';
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
            const customerId = customer.customerId || customer.id || 'N/A';
            const dateOfBirth = customer.dateOfBirth || 'N/A';
            
            customerCard.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-medium text-gray-900">${displayName}</div>
                        <div class="text-sm text-gray-600">ID: ${customerId}</div>
                        <div class="text-sm text-gray-600">DOB: ${dateOfBirth}</div>
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
                <div class="text-sm">ID: ${customer.id || 'N/A'}</div>
                <div class="text-sm">DOB: ${customer.dateOfBirth || 'N/A'}</div>
            `;
        }
        
        if (elements.selectedCustomerArea) elements.selectedCustomerArea.classList.remove('hidden');
        
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
        const elements = getElements();
        
        if (!selectedCustomerId) {
            if (elements.searchError) elements.searchError.textContent = 'No customer selected.';
            return;
        }
        
        if (elements.loadCustomerBtn) {
            elements.loadCustomerBtn.disabled = true;
            elements.loadCustomerBtn.textContent = 'Loading...';
        }
        
        try {
            // Load customer details and accounts
            await fetchCustomerData(selectedCustomerId);
            
            // Show customer details area
            showCustomerView();
            
        } catch (error) {
            console.error('Error loading customer:', error);
            if (elements.searchError) elements.searchError.textContent = `Failed to load customer data: ${error.message}`;
        } finally {
            if (elements.loadCustomerBtn) {
                elements.loadCustomerBtn.disabled = false;
                elements.loadCustomerBtn.textContent = 'Load Customer Data';
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
        const balance = isLoan ? account.principalAmount : account.currentBalance;
        const formattedBalance = new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(Math.abs(balance));

        // Create display name with arrangement ID if different from account ID
        let displayId = account.accountId;
        if (account.arrangementId && account.arrangementId !== account.accountId) {
            displayId = `${account.accountId} (${account.arrangementId})`;
        }

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
                    <span class="font-medium text-gray-800">${account.displayName} (${displayId})</span>
                    <span class="text-xs text-gray-500 ml-2">${account.productName} - Opened: ${account.openDate || 'N/A'}</span>
                </div>
                <div class="text-right">
                    <div class="font-semibold ${isLoan ? 'text-red-700' : 'text-gray-900'}">${formattedBalance} ${account.currency}</div>
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
        const { transactionsListDiv, transactionsTitle } = getElements();
        if (!transactionsListDiv || !transactionsTitle) return;
        
        // Set the title
        transactionsTitle.textContent = `Loan Details: ${loanData.productDisplayName || selectedLoanId}`;
        
        // Extract and format loan data more robustly
        const loanStatus = loanData.status || {};
        const loanInfo = loanData.loanInformation || {};
        
        // Get status state with fallback to properties in a more reliable way
        let statusState = "Active";
        if (loanStatus.state) {
            statusState = loanStatus.state;
        } else if (loanData.balancesData && loanData.balancesData.body && Array.isArray(loanData.balancesData.body) && loanData.balancesData.body.length > 0) {
            // Get from balances data
            statusState = loanData.balancesData.body[0].arrangementStatus || "Active";
        } else if (loanData.properties && loanData.properties.body && Array.isArray(loanData.properties.body) && loanData.properties.body.length > 0) {
            // Try to get status from body array (API format seen in headless tab)
            statusState = loanData.properties.body[0].arrangementStatus || "Active";
        } else if (loanData.properties && loanData.properties.status && loanData.properties.status.body) {
            // Try to get from nested properties
            statusState = loanData.properties.status.body.status || "Active";
        }
        
        // Get loan amount from either directly or from properties
        let originalAmount = loanInfo.originalPrincipal || 0;
        let currentBalance = loanStatus.currentBalance || 0;
        let accountNumber = loanData.accountNumber || "";
        let loanInterestType = "";
        let loanProductId = "";
        let roleDisplayName = "";
        
        // Check if we have balances data for additional fields
        if (loanData.balancesData && loanData.balancesData.body && Array.isArray(loanData.balancesData.body) && loanData.balancesData.body.length > 0) {
            const balanceData = loanData.balancesData.body[0];
            if (!accountNumber) accountNumber = balanceData.loanAccountId || "";
            if (originalAmount === 0) originalAmount = parseFloat(balanceData.loanAmount) || 0;
            loanInterestType = balanceData.loanInterestType || "";
            loanProductId = balanceData.loanProduct || "";
            roleDisplayName = balanceData.roleDisplayName || "";
        }
        
        // Try to get from nested properties if not available directly
        if (originalAmount === 0 && loanData.properties && loanData.properties.commitment && loanData.properties.commitment.body) {
            originalAmount = parseFloat(loanData.properties.commitment.body.amount || "0");
        }
        
        if (currentBalance === 0 && loanData.properties && loanData.properties.outstandingBalance && loanData.properties.outstandingBalance.body) {
            // Try to extract from properties
            currentBalance = parseFloat(loanData.properties.outstandingBalance.body.amount || "0");
        }
        
        // Try to get account number from body array format if not already set
        if (!accountNumber && loanData.properties && loanData.properties.body && Array.isArray(loanData.properties.body) && loanData.properties.body.length > 0) {
            accountNumber = loanData.properties.body[0].accountId || "";
        }
        
        // Get currency more robustly
        const currency = loanInfo.currency || 
                        (loanData.properties && loanData.properties.commitment && loanData.properties.commitment.body 
                            ? loanData.properties.commitment.body.currency : 'USD');
        
        // Create a div to contain the loan details
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'loan-details-container space-y-4';
        
        // Loan summary section
        const summarySection = document.createElement('div');
        summarySection.className = 'bg-white p-4 rounded-lg shadow';
        
        let summaryHtml = `
            <h3 class="text-lg font-semibold mb-2 text-gray-800">Loan Summary</h3>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm"><span class="font-medium">Loan ID:</span> ${loanData.id || selectedLoanId || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Status:</span> ${statusState}</p>
                    <p class="text-sm"><span class="font-medium">Product:</span> ${loanData.productDisplayName || loanData.productId || 'N/A'}</p>
        `;
        
        // Add loan product ID if available
        if (loanProductId) {
            summaryHtml += `<p class="text-sm"><span class="font-medium">Product ID:</span> ${loanProductId}</p>`;
        }
        
        // Add start and maturity dates
        summaryHtml += `
                    <p class="text-sm"><span class="font-medium">Start Date:</span> ${loanInfo.startDate || 'N/A'}</p>
                    <p class="text-sm"><span class="font-medium">Maturity Date:</span> ${loanInfo.maturityDate || 
                                                                (loanData.properties && loanData.properties.commitment && loanData.properties.commitment.body
                                                                    ? loanData.properties.commitment.body.maturityDate : 'N/A')}</p>
                </div>
                <div>
                    <p class="text-sm"><span class="font-medium">Original Amount:</span> ${formatCurrency(originalAmount, currency)}</p>
                    <p class="text-sm"><span class="font-medium">Current Balance:</span> ${formatCurrency(currentBalance, currency)}</p>
                    <p class="text-sm"><span class="font-medium">Interest Rate:</span> ${(loanInfo.interestRate || 0).toFixed(2)}%</p>
        `;
        
        // Add interest type if available
        if (loanInterestType) {
            summaryHtml += `<p class="text-sm"><span class="font-medium">Interest Type:</span> ${loanInterestType}</p>`;
        }
        
        // Add remaining term fields
        summaryHtml += `
                    <p class="text-sm"><span class="font-medium">Term:</span> ${loanInfo.term || 
                                                                (loanData.properties && loanData.properties.commitment && loanData.properties.commitment.body
                                                                    ? loanData.properties.commitment.body.term : 'N/A')} ${loanInfo.termUnit || 'Months'}</p>
                    <p class="text-sm"><span class="font-medium">Payment Frequency:</span> ${loanInfo.paymentFrequency || 'Monthly'}</p>
        `;
        
        // Add role display name if available
        if (roleDisplayName) {
            summaryHtml += `<p class="text-sm"><span class="font-medium">Customer Role:</span> ${roleDisplayName}</p>`;
        }
        
        // Add account number if available
        if (accountNumber) {
            summaryHtml += `<p class="text-sm"><span class="font-medium">Account Number:</span> ${accountNumber}</p>`;
        }
        
        summaryHtml += `</div></div>`;
        summarySection.innerHTML = summaryHtml;
        detailsContainer.appendChild(summarySection);
        
        // Only add payment information if we have data
        if (loanStatus.nextPaymentDue || loanStatus.paymentsMade !== undefined || loanStatus.paymentsRemaining !== undefined) {
            // Payment details section
            const paymentSection = document.createElement('div');
            paymentSection.className = 'bg-white p-4 rounded-lg shadow';
            
            const nextPayment = loanStatus.nextPaymentDue || {};
            
            // Get next payment date from any available source
            let nextPaymentDate = nextPayment.dueDate || '';
            if (!nextPaymentDate && loanData.balancesData && loanData.balancesData.body && loanData.balancesData.body.length > 0) {
                nextPaymentDate = loanData.balancesData.body[0].loanNextPayDate || '';
            }
            
            paymentSection.innerHTML = `
                <h3 class="text-lg font-semibold mb-2 text-gray-800">Payment Information</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm"><span class="font-medium">Next Payment Date:</span> ${nextPaymentDate || 'N/A'}</p>
                        <p class="text-sm"><span class="font-medium">Next Payment Amount:</span> ${formatCurrency(nextPayment.totalAmount || 0, currency)}</p>
                        <p class="text-sm"><span class="font-medium">Principal:</span> ${formatCurrency(nextPayment.principalAmount || 0, currency)}</p>
                        <p class="text-sm"><span class="font-medium">Interest:</span> ${formatCurrency(nextPayment.interestAmount || 0, currency)}</p>
                    </div>
                    <div>
                        <p class="text-sm"><span class="font-medium">Payments Made:</span> ${loanStatus.paymentsMade || 'N/A'}</p>
                        <p class="text-sm"><span class="font-medium">Payments Remaining:</span> ${loanStatus.paymentsRemaining || 'N/A'}</p>
                        <p class="text-sm"><span class="font-medium">Paid To Date:</span> ${formatCurrency(loanStatus.paidToDate || 0, currency)}</p>
                    </div>
                </div>
            `;
            detailsContainer.appendChild(paymentSection);
        }
        
        // Check for specific statuses and add relevant notes
        if (statusState === "Not Disbursed" || statusState === "AUTH") {
            const noteDisbursedSection = document.createElement('div');
            noteDisbursedSection.className = 'bg-yellow-50 p-4 rounded-lg shadow border border-yellow-200';
            noteDisbursedSection.innerHTML = `
                <h3 class="text-md font-semibold mb-2 text-yellow-800">Loan Status: ${statusState}</h3>
                <p class="text-sm text-yellow-700">This loan has been approved but not yet disbursed. Payment information will be available after disbursement.</p>
            `;
            detailsContainer.appendChild(noteDisbursedSection);
        }

        // Button to view payment schedule
        const scheduleButtonDiv = document.createElement('div');
        scheduleButtonDiv.className = 'flex justify-center mt-4';
        scheduleButtonDiv.innerHTML = `
            <button id="view-loan-schedule-btn" data-loan-id="${selectedLoanId}" class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm">
                View Payment Schedule
            </button>
        `;
        detailsContainer.appendChild(scheduleButtonDiv);
        
        // Clear the container and add the new content
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
            // Check if there's a party ID stored by the mobile app
            const mobilePartyId = localStorage.getItem('mobileAppPartyId');
            let fetchUrl = `/api/branch/customers?_=${Date.now()}`;
            
            // Add the mobile party ID to the request if available
            if (mobilePartyId) {
                console.log("Found mobile app party ID in localStorage:", mobilePartyId);
                fetchUrl += `&mobilePartyId=${mobilePartyId}`;
            }
            
            const response = await fetch(fetchUrl);
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
        console.log(`Fetching customer data for ${customerId}...`);
        const { customerDetailsArea, customerAccountsArea, accountsListDiv, searchError } = getElements();
        if (!customerDetailsArea || !customerAccountsArea || !accountsListDiv) return;
        if (searchError) searchError.textContent = ''; // Clear previous errors

        try {
            // 1. Fetch customer details
            const custRes = await fetch(`/api/branch/customers/${customerId}?_=${Date.now()}`);
            if (!custRes.ok) throw new Error(`Customer fetch failed: ${custRes.status}`);
            const customerData = await custRes.json();
            renderCustomerDetails(customerData);

            // 2. Fetch both loans and current accounts
            // First, get all arrangements for this customer using the same Holdings API as mobile app
            const arrangementsRes = await fetch(`/api/proxy/holdings/parties/${customerId}/arrangements?_=${Date.now()}`);
            if (!arrangementsRes.ok) throw new Error(`Arrangements fetch failed: ${arrangementsRes.status}`);
            const arrangementsData = await arrangementsRes.json();
            
            // Extract the arrangements array
            const arrangements = arrangementsData.arrangements || [];
            const currentAccounts = [];
            
            // Process each arrangement to get balance data for accounts
            for (const arrangement of arrangements) {
                if (arrangement.productLine === "ACCOUNTS") {
                    try {
                        const arrangementId = arrangement.arrangementId;
                        
                        // Get the proper Holdings account ID from alternateReferences
                        let holdingsAccountId = arrangementId; // fallback
                        if (arrangement.alternateReferences && arrangement.alternateReferences.length > 0) {
                            console.log(`Checking alternateReferences for arrangement ${arrangementId}:`, arrangement.alternateReferences);
                            for (const ref of arrangement.alternateReferences) {
                                if (ref.alternateType === "ACCOUNT") {
                                    holdingsAccountId = ref.alternateId;
                                    console.log(`Found Holdings account ID ${holdingsAccountId} for arrangement ${arrangementId}`);
                                    break;
                                }
                            }
                        } else {
                            console.log(`No alternateReferences found for arrangement ${arrangementId}`);
                        }
                        
                        // Use Holdings API for balance like mobile app does
                        const balanceRes = await fetch(`/api/proxy/holdings/accounts/${holdingsAccountId}/balances?_=${Date.now()}`);
                        
                        if (balanceRes.ok) {
                            const balanceData = await balanceRes.json();
                            console.log(`Balance data for ${holdingsAccountId}:`, balanceData);
                            
                            // Check if we have balance items (Holdings API format)
                            const balanceItems = balanceData.items || [];
                            if (balanceItems.length > 0) {
                                const balance = balanceItems[0]; // Use the first balance item
                                
                                currentAccounts.push({
                                    accountId: holdingsAccountId, // Use Holdings account ID for transactions
                                    arrangementId: arrangementId, // Keep arrangement ID for reference
                                    displayName: arrangement.productName || "Current Account",
                                    productName: arrangement.productGroup || "Current Account",
                                    type: "current",
                                    currency: balance.currencyId || "USD",
                                    currentBalance: balance.onlineActualBalance || 0,
                                    availableBalance: balance.availableBalance || 0,
                                    openDate: balance.openingDate || ''
                                });
                            } else {
                                // Add account with default values if no balance items
                                currentAccounts.push({
                                    accountId: holdingsAccountId, // Use Holdings account ID for transactions
                                    arrangementId: arrangementId, // Keep arrangement ID for reference
                                    displayName: arrangement.productName || "Current Account",
                                    productName: arrangement.productGroup || "Current Account",
                                    type: "current", 
                                    currency: arrangement.currencyId || "USD",
                                    currentBalance: 0,
                                    availableBalance: 0,
                                    openDate: ''
                                });
                            }
                        } else {
                            // Add account with default values if balance fetch fails
                            currentAccounts.push({
                                accountId: holdingsAccountId, // Use Holdings account ID for transactions
                                arrangementId: arrangementId, // Keep arrangement ID for reference
                                displayName: arrangement.productName || "Current Account",
                                productName: arrangement.productGroup || "Current Account",
                                type: "current", 
                                currency: arrangement.currencyId || "USD",
                                currentBalance: 0,
                                availableBalance: 0,
                                openDate: ''
                            });
                        }
                    } catch (error) {
                        console.error(`Error fetching balance for arrangement ${arrangement.arrangementId}:`, error);
                    }
                }
            }
            
            // 3. Now fetch the loans like before
            const accountsRes = await fetch(`/api/branch/customers/${customerId}/accounts?_=${Date.now()}`);
            if (!accountsRes.ok) throw new Error(`Accounts fetch failed: ${accountsRes.status}`);
            const loanAccounts = await accountsRes.json();
            
            // Merge the loan accounts with the current accounts
            customerAccounts = [...currentAccounts, ...loanAccounts];
            
            renderAccountsList(customerAccounts, accountsListDiv);
            if(customerAccountsArea) customerAccountsArea.classList.remove('hidden');

        } catch (error) {
            console.error(`Error loading customer data for ${customerId}:`, error);
            if(searchError) searchError.textContent = `Failed to load customer data: ${error.message}`;
        }
    }

    async function fetchBranchTransactions(accountId) {
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
            
            renderTransactionsList(formattedTransactions, transactionsListDiv);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            transactionsListDiv.innerHTML = `<div class="text-center text-red-500 py-4">Could not load transactions: ${error.message}</div>`;
        }
    }

    async function fetchLoanDetails(loanId) {
        console.log(`Fetching loan details for ${loanId}...`);
        const { transactionsListDiv, transactionsTitle, transactionsArea } = getElements();
        if (!transactionsListDiv || !transactionsTitle) return;
        
        // Set selected loan ID
        selectedLoanId = loanId;
        
        // Show the transactions area which we'll reuse for loan details
        const { customerDetailsArea, customerAccountsArea } = getElements();
        if(customerDetailsArea) customerDetailsArea.classList.add('hidden');
        if(customerAccountsArea) customerAccountsArea.classList.add('hidden');
        if(transactionsArea) transactionsArea.classList.remove('hidden');
        
        // Set loading state
        transactionsTitle.textContent = `Loan Details: ${loanId}`;
        transactionsListDiv.innerHTML = '<div class="text-gray-500">Loading loan details...</div>';
        
        try {
            // Fetch both loan details and loan balances in parallel
            const [detailsResponse, balancesResponse] = await Promise.all([
                fetch(`/api/branch/loans/${loanId}/details?_=${Date.now()}`),
                fetch(`/api/branch/loans/${loanId}/balances?_=${Date.now()}`)
            ]);
            
            console.log(`Details response status: ${detailsResponse.status}`);
            console.log(`Balances response status: ${balancesResponse.status}`);
            
            // Check for HTTP errors
            if (!detailsResponse.ok) {
                throw new Error(`Details API Error: ${detailsResponse.status}`);
            }
            
            // Get the response text and parse JSON
            const detailsText = await detailsResponse.text();
            console.log(`Raw details response: ${detailsText.substring(0, 200)}...`);
            
            let loanData, balancesData;
            try {
                loanData = JSON.parse(detailsText);
            } catch (parseError) {
                console.error("JSON parse error for details:", parseError);
                throw new Error(`Failed to parse details response: ${parseError.message}`);
            }
            
            // Try to parse balances data if the response was successful
            if (balancesResponse.ok) {
                try {
                    balancesData = await balancesResponse.json();
                    console.log("Loan balances received:", balancesData);
                } catch (parseError) {
                    console.error("JSON parse error for balances:", parseError);
                    balancesData = null;
                }
            }
            
            console.log("Loan details received:", loanData);
            
            // Create the properly structured loan data object
            let formattedLoanData = {
                id: loanId,
                productDisplayName: "Personal Loan",
                status: {
                    state: "Active",
                    currentBalance: 0,
                    nextPaymentDue: {
                        dueDate: "",
                        totalAmount: 0,
                        principalAmount: 0,
                        interestAmount: 0
                    },
                    paymentsMade: 0,
                    paymentsRemaining: 0,
                    paidToDate: 0
                },
                loanInformation: {
                    startDate: "",
                    maturityDate: "",
                    originalPrincipal: 0,
                    interestRate: 0,
                    term: 0,
                    termUnit: "Months",
                    paymentFrequency: "Monthly",
                    currency: "USD"
                },
                properties: {}
            };
            
            // First check for loan balances data - prioritize this information
            if (balancesData && balancesData.body && Array.isArray(balancesData.body) && balancesData.body.length > 0) {
                console.log("Using loan balances data to populate loan details");
                const balanceDetails = balancesData.body[0];
                
                // Extract loan details from the balances API
                formattedLoanData.id = balanceDetails.arrangementId || loanId;
                formattedLoanData.productDisplayName = balanceDetails.productName || "Loan Product";
                formattedLoanData.status.state = balanceDetails.arrangementStatus || "Active";
                formattedLoanData.loanInformation.startDate = balanceDetails.loanStartDate || "";
                formattedLoanData.loanInformation.maturityDate = balanceDetails.loanEndDate || "";
                formattedLoanData.loanInformation.originalPrincipal = parseFloat(balanceDetails.loanAmount) || 0;
                formattedLoanData.loanInformation.interestRate = parseFloat(balanceDetails.loanInterestRate) || 0;
                formattedLoanData.loanInformation.currency = balanceDetails.loanCurrency || "USD";
                
                // Add next payment date if available
                if (balanceDetails.loanNextPayDate) {
                    formattedLoanData.status.nextPaymentDue.dueDate = balanceDetails.loanNextPayDate;
                }
                
                // Add loan account ID
                if (balanceDetails.loanAccountId) {
                    formattedLoanData.accountNumber = balanceDetails.loanAccountId;
                }
                
                // Store the original balances response
                formattedLoanData.balancesData = balancesData;
            }
            
            // Check for the standard body array format from loan details
            if (loanData && Array.isArray(loanData.body) && loanData.body.length > 0) {
                console.log("Found loan details in body array");
                const loanDetails = loanData.body[0];
                
                // Fill in any missing properties not already populated from balances
                if (!formattedLoanData.id) formattedLoanData.id = loanDetails.arrangementId || loanId;
                if (!formattedLoanData.productDisplayName) formattedLoanData.productDisplayName = loanDetails.productDescription || "Personal Loan";
                if (formattedLoanData.status.state === "Active") formattedLoanData.status.state = loanDetails.arrangementStatus || "Active";
                if (!formattedLoanData.loanInformation.startDate) formattedLoanData.loanInformation.startDate = loanDetails.arrangementStartDate || "";
                
                // Extract account ID if not already set
                if (!formattedLoanData.accountNumber && loanDetails.accountId) {
                    formattedLoanData.accountNumber = loanDetails.accountId;
                    
                    // Extract currency from account ID if needed
                    if (formattedLoanData.loanInformation.currency === "USD" && loanDetails.accountId) {
                        const accountParts = loanDetails.accountId.split(' - ');
                        if (accountParts.length > 1) {
                            formattedLoanData.loanInformation.currency = accountParts[1] || "USD";
                        }
                    }
                }
                
                if (!formattedLoanData.customerId) formattedLoanData.customerId = loanDetails.customerId || "";
            }
            // Handle different API response formats (fallback to previous handling)
            else if (loanData) {
                // Directly extract loan properties from top-level
                if (loanData.id && !formattedLoanData.id) formattedLoanData.id = loanData.id;
                if (loanData.productDisplayName && !formattedLoanData.productDisplayName) formattedLoanData.productDisplayName = loanData.productDisplayName;
                if (loanData.productId && !formattedLoanData.productId) formattedLoanData.productId = loanData.productId;
                
                // Extract data from body property if it exists (when body is an object, not array)
                if (loanData.body && !Array.isArray(loanData.body)) {
                    const body = loanData.body;
                    
                    if (body.productId && !formattedLoanData.productId) {
                        formattedLoanData.productId = body.productId;
                        formattedLoanData.productDisplayName = body.productId.replace('.', ' ');
                    }
                }
                
                // Extract from status property if needed
                if (loanData.status) {
                    const status = loanData.status;
                    
                    if (status.state && formattedLoanData.status.state === "Active") formattedLoanData.status.state = status.state;
                    if (status.currentBalance !== undefined && formattedLoanData.status.currentBalance === 0) formattedLoanData.status.currentBalance = status.currentBalance;
                    
                    if (status.nextPaymentDue && !formattedLoanData.status.nextPaymentDue.dueDate) {
                        const nextPayment = status.nextPaymentDue;
                        if (nextPayment.dueDate) formattedLoanData.status.nextPaymentDue.dueDate = nextPayment.dueDate;
                        if (nextPayment.totalAmount !== undefined) formattedLoanData.status.nextPaymentDue.totalAmount = nextPayment.totalAmount;
                        if (nextPayment.principalAmount !== undefined) formattedLoanData.status.nextPaymentDue.principalAmount = nextPayment.principalAmount;
                        if (nextPayment.interestAmount !== undefined) formattedLoanData.status.nextPaymentDue.interestAmount = nextPayment.interestAmount;
                    }
                    
                    if (status.paymentsMade !== undefined) formattedLoanData.status.paymentsMade = status.paymentsMade;
                    if (status.paymentsRemaining !== undefined) formattedLoanData.status.paymentsRemaining = status.paymentsRemaining;
                    if (status.paidToDate !== undefined) formattedLoanData.status.paidToDate = status.paidToDate;
                }
                
                // Extract from loanInformation property if needed
                if (loanData.loanInformation) {
                    const info = loanData.loanInformation;
                    
                    if (info.startDate && !formattedLoanData.loanInformation.startDate) formattedLoanData.loanInformation.startDate = info.startDate;
                    if (info.maturityDate && !formattedLoanData.loanInformation.maturityDate) formattedLoanData.loanInformation.maturityDate = info.maturityDate;
                    if (info.originalPrincipal !== undefined && formattedLoanData.loanInformation.originalPrincipal === 0) formattedLoanData.loanInformation.originalPrincipal = info.originalPrincipal;
                    if (info.interestRate !== undefined && formattedLoanData.loanInformation.interestRate === 0) formattedLoanData.loanInformation.interestRate = info.interestRate;
                    if (info.term !== undefined && formattedLoanData.loanInformation.term === 0) formattedLoanData.loanInformation.term = info.term;
                    if (info.termUnit) formattedLoanData.loanInformation.termUnit = info.termUnit;
                    if (info.paymentFrequency) formattedLoanData.loanInformation.paymentFrequency = info.paymentFrequency;
                    if (info.currency && formattedLoanData.loanInformation.currency === "USD") formattedLoanData.loanInformation.currency = info.currency;
                }
                
                // Extract data from commitments if present (alternative API format)
                if (loanData.commitment && Array.isArray(loanData.commitment)) {
                    const commitment = loanData.commitment[0] || {};
                    if (commitment.amount && formattedLoanData.loanInformation.originalPrincipal === 0) {
                        formattedLoanData.loanInformation.originalPrincipal = parseFloat(commitment.amount);
                    }
                    if (commitment.term && formattedLoanData.loanInformation.term === 0) {
                        formattedLoanData.loanInformation.term = commitment.term;
                    }
                    if (commitment.maturityDate && !formattedLoanData.loanInformation.maturityDate) {
                        formattedLoanData.loanInformation.maturityDate = commitment.maturityDate;
                    }
                }
                
                // Check for loan data in outstandingBalance (alternative API format)
                if (loanData.outstandingBalance && loanData.outstandingBalance.body) {
                    const balance = loanData.outstandingBalance.body;
                    if (balance.amount && formattedLoanData.status.currentBalance === 0) {
                        formattedLoanData.status.currentBalance = parseFloat(balance.amount);
                    }
                }
            }
            
            // Store the original loanData for reference
            formattedLoanData.properties = loanData;
            
            console.log("Processed loan data for rendering:", formattedLoanData);
            renderLoanDetails(formattedLoanData);
        } catch (error) {
            console.error(`Error fetching loan details for ${loanId}:`, error);
            
            // Create a fallback loan data object with real values
            const fallbackLoanData = {
                id: loanId,
                productDisplayName: "Personal Loan",
                status: {
                    state: "Active",
                    currentBalance: 225351.0,
                    nextPaymentDue: {
                        dueDate: "2025-04-14",
                        totalAmount: 2450.67,
                        principalAmount: 1837.5,
                        interestAmount: 613.17
                    },
                    paymentsMade: 0,
                    paymentsRemaining: 120,
                    paidToDate: 0
                },
                loanInformation: {
                    startDate: "2025-03-15",
                    maturityDate: "2035-03-15",
                    originalPrincipal: 225351.0,
                    interestRate: 3.25,
                    term: 120,
                    termUnit: "Months",
                    paymentFrequency: "Monthly",
                    currency: "USD"
                }
            };
            
            console.log("Using fallback loan data:", fallbackLoanData);
            renderLoanDetails(fallbackLoanData);
            
            // Show error message
            const errorNotice = document.createElement('div');
            errorNotice.className = 'bg-red-100 text-red-700 p-2 rounded-md text-sm mt-2';
            errorNotice.textContent = `Error: ${error.message} (Using fallback data)`;
            transactionsListDiv.querySelector('.loan-details-container').prepend(errorNotice);
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
        console.log("Initializing Branch App tab...");
        
        // Remove any existing listeners first
        removeAllListeners();
        
        // Add static event listeners for the new search interface
        addStaticListeners();
        
        // Clear any previous state
        selectedCustomerId = null;
        selectedCustomer = null;
        customerAccounts = [];
        
        // Hide all detail areas initially
        hideCustomerDetails();
        
        // Clear search interface
        clearSearch();
        
        console.log("Branch App tab initialized with search interface");
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