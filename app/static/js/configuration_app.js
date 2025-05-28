// Configuration Tab JavaScript
(function() {
    'use strict';
    
    let currentEndpoints = {};
    let endpointsVisible = false;
    
    // Initialize when DOM is ready
    function initializeConfiguration() {
        console.log('Initializing Configuration tab...');
        
        // Load initial data
        loadDemoConfig();
        
        // Set up event listeners
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Endpoints management
        const toggleBtn = document.getElementById('toggle-endpoints-btn');
        const editBtn = document.getElementById('edit-endpoints-btn');
        const saveBtn = document.getElementById('save-endpoints-btn');
        const cancelBtn = document.getElementById('cancel-endpoints-btn');
        
        if (toggleBtn) toggleBtn.addEventListener('click', toggleEndpointsSection);
        if (editBtn) editBtn.addEventListener('click', showEndpointsEdit);
        if (saveBtn) saveBtn.addEventListener('click', saveEndpoints);
        if (cancelBtn) cancelBtn.addEventListener('click', hideEndpointsEdit);
        
        // Demo data management
        const createDemoDataBtn = document.getElementById('create-demo-data-btn');
        
        if (createDemoDataBtn) createDemoDataBtn.addEventListener('click', createDemoData);
        
        // Add validation for current account dependency
        const productCheckboxes = ['create-mortgage', 'create-consumer-loan', 'create-term-deposit'];
        productCheckboxes.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', validateCurrentAccountDependency);
            }
        });
    }
    
    function toggleEndpointsSection() {
        const toggleBtn = document.getElementById('toggle-endpoints-btn');
        const endpointsSection = document.getElementById('endpoints-section');
        const endpointsCollapsed = document.getElementById('endpoints-collapsed');
        const editBtn = document.getElementById('edit-endpoints-btn');
        
        if (!endpointsVisible) {
            // Show endpoints
            endpointsSection.classList.remove('hidden');
            endpointsCollapsed.classList.add('hidden');
            editBtn.classList.remove('hidden');
            toggleBtn.textContent = 'Hide Endpoints';
            endpointsVisible = true;
            
            // Load endpoints data if not already loaded
            if (Object.keys(currentEndpoints).length === 0) {
                loadEndpoints();
            }
        } else {
            // Hide endpoints
            endpointsSection.classList.add('hidden');
            endpointsCollapsed.classList.remove('hidden');
            editBtn.classList.add('hidden');
            toggleBtn.textContent = 'Show Endpoints';
            endpointsVisible = false;
            
            // Also hide edit mode if it's open
            hideEndpointsEdit();
        }
    }
    
    function loadEndpoints() {
        fetch('/api/configuration/endpoints')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                currentEndpoints = data;
                displayEndpoints(data);
            })
            .catch(error => {
                console.error('Error loading endpoints:', error);
                const container = document.getElementById('endpoints-display');
                if (container) {
                    container.innerHTML = '<div class="text-red-500">Error loading endpoints: ' + error.message + '</div>';
                }
            });
    }
    
    function displayEndpoints(endpoints) {
        const container = document.getElementById('endpoints-display');
        if (!container) return;
        
        const html = Object.entries(endpoints).map(([key, value]) => `
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="font-medium text-gray-600">${key}:</span>
                <span class="text-gray-800 text-sm break-all max-w-md">${value || 'Not set'}</span>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    function showEndpointsEdit() {
        const editContainer = document.getElementById('endpoints-edit');
        if (!editContainer) return;
        
        const html = Object.entries(currentEndpoints).map(([key, value]) => `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">${key}</label>
                <input type="text" name="${key}" value="${value || ''}" 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
        `).join('');
        
        editContainer.innerHTML = html;
        
        // Toggle visibility
        document.getElementById('endpoints-display').classList.add('hidden');
        document.getElementById('endpoints-edit').classList.remove('hidden');
        document.getElementById('edit-endpoints-btn').classList.add('hidden');
        document.getElementById('save-endpoints-btn').classList.remove('hidden');
        document.getElementById('cancel-endpoints-btn').classList.remove('hidden');
    }
    
    function hideEndpointsEdit() {
        document.getElementById('endpoints-display').classList.remove('hidden');
        document.getElementById('endpoints-edit').classList.add('hidden');
        document.getElementById('edit-endpoints-btn').classList.remove('hidden');
        document.getElementById('save-endpoints-btn').classList.add('hidden');
        document.getElementById('cancel-endpoints-btn').classList.add('hidden');
    }
    
    function saveEndpoints() {
        const editContainer = document.getElementById('endpoints-edit');
        if (!editContainer) return;
        
        const inputs = editContainer.querySelectorAll('input[type="text"]');
        const data = {};
        
        inputs.forEach(input => {
            data[input.name] = input.value;
        });
        
        fetch('/api/configuration/endpoints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.status === 'success') {
                currentEndpoints = data;
                displayEndpoints(data);
                hideEndpointsEdit();
                showNotification('Endpoints updated successfully', 'success');
            } else {
                showNotification('Error updating endpoints: ' + result.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error saving endpoints:', error);
            showNotification('Error saving endpoints: ' + error.message, 'error');
        });
    }
    
    function loadDemoConfig() {
        fetch('/api/configuration/demo-config')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const currentAccountEl = document.getElementById('create-current-account');
                const mortgageEl = document.getElementById('create-mortgage');
                const consumerLoanEl = document.getElementById('create-consumer-loan');
                const termDepositEl = document.getElementById('create-term-deposit');
                
                if (currentAccountEl) currentAccountEl.checked = data.CREATE_CURRENT_ACCOUNT || false;
                if (mortgageEl) mortgageEl.checked = data.CREATE_MORTGAGE || false;
                if (consumerLoanEl) consumerLoanEl.checked = data.CREATE_CONSUMER_LOAN || false;
                if (termDepositEl) termDepositEl.checked = data.CREATE_TERM_DEPOSIT || false;
            })
            .catch(error => {
                console.error('Error loading demo config:', error);
                showNotification('Error loading demo configuration: ' + error.message, 'error');
            });
    }
    
    function getDemoConfig() {
        const currentAccountEl = document.getElementById('create-current-account');
        const mortgageEl = document.getElementById('create-mortgage');
        const consumerLoanEl = document.getElementById('create-consumer-loan');
        const termDepositEl = document.getElementById('create-term-deposit');
        
        return {
            CREATE_CURRENT_ACCOUNT: currentAccountEl ? currentAccountEl.checked : false,
            CREATE_MORTGAGE: mortgageEl ? mortgageEl.checked : false,
            CREATE_CONSUMER_LOAN: consumerLoanEl ? consumerLoanEl.checked : false,
            CREATE_TERM_DEPOSIT: termDepositEl ? termDepositEl.checked : false
        };
    }
    
    function validateCurrentAccountDependency() {
        const currentAccount = document.getElementById('create-current-account');
        const productCheckboxes = ['create-mortgage', 'create-consumer-loan', 'create-term-deposit'];
        
        const otherProducts = productCheckboxes.some(id => {
            const element = document.getElementById(id);
            return element && element.checked;
        });
        
        if (otherProducts && currentAccount && !currentAccount.checked) {
            currentAccount.checked = true;
            showNotification('Current Account is required when other products are selected', 'warning');
        }
    }
    
    function createDemoData() {
        const config = getDemoConfig();
        
        // Validate current account dependency
        if (!config.CREATE_CURRENT_ACCOUNT && 
            (config.CREATE_MORTGAGE || config.CREATE_CONSUMER_LOAN || config.CREATE_TERM_DEPOSIT)) {
            showNotification('Current Account must be selected when other products are enabled', 'error');
            return;
        }
        
        // Disable the button to prevent multiple clicks
        const createBtn = document.getElementById('create-demo-data-btn');
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';
        }
        
        // Show the progress message
        showDemoProgress();
        
        // Update demo configuration first
        fetch('/api/configuration/demo-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.status === 'success') {
                // Start demo data creation
                return fetch('/api/configuration/create-demo-data', {
                    method: 'POST'
                });
            } else {
                throw new Error(result.message);
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.status === 'success') {
                // Start polling for status
                pollDemoStatus();
            } else {
                throw new Error(result.message);
            }
        })
        .catch(error => {
            console.error('Error creating demo data:', error);
            showNotification('Error creating demo data: ' + error.message, 'error');
            hideDemoProgress();
            resetCreateButton();
        });
    }
    
    function resetCreateButton() {
        const createBtn = document.getElementById('create-demo-data-btn');
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = 'Create User and Products';
        }
    }
    
    function showDemoProgress() {
        const progressContainer = document.getElementById('demo-progress');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
    }
    
    function hideDemoProgress() {
        const progressContainer = document.getElementById('demo-progress');
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
    }
    
    function pollDemoStatus() {
        let pollCount = 0;
        const maxPolls = 120; // 4 minutes max (2 second intervals)
        
        const poll = () => {
            pollCount++;
            console.log(`Poll attempt ${pollCount}/${maxPolls}`); // Debug log
            
            fetch('/api/configuration/demo-status')
                .then(response => {
                    console.log('Response status:', response.status); // Debug log
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Demo status response:', data); // Debug log
                    console.log('Status:', data.status, 'Results:', data.results); // Debug log
                    
                    if (data.status === 'running') {
                        console.log('Demo still running, continuing to poll...'); // Debug log
                        // Keep showing the progress message
                        if (pollCount < maxPolls) {
                            setTimeout(poll, 2000); // Poll every 2 seconds
                        } else {
                            console.log('Max polls reached, stopping'); // Debug log
                            hideDemoProgress();
                            showDemoError('Demo creation is taking longer than expected. Please check the server logs.');
                            resetCreateButton();
                        }
                    } else if (data.status === 'completed') {
                        console.log('Demo completed! Processing results...'); // Debug log
                        console.log('Demo completed, results:', data.results); // Debug log
                        hideDemoProgress();
                        displayDemoResults(data.results);
                        resetCreateButton();
                    } else if (data.status === 'error') {
                        console.log('Demo failed with error:', data.error); // Debug log
                        hideDemoProgress();
                        showDemoError(`Error: ${data.error}`);
                        showNotification('Demo creation failed: ' + data.error, 'error');
                        resetCreateButton();
                    } else {
                        console.log('Unknown status:', data.status, 'continuing to poll...'); // Debug log
                        // Unknown status, continue polling for a bit
                        if (pollCount < maxPolls) {
                            setTimeout(poll, 2000);
                        } else {
                            console.log('Max polls reached with unknown status, stopping'); // Debug log
                            hideDemoProgress();
                            showDemoError('Demo creation status unknown. Please check manually.');
                            resetCreateButton();
                        }
                    }
                })
                .catch(error => {
                    console.error('Error polling status:', error);
                    hideDemoProgress();
                    showDemoError('Error checking status: ' + error.message);
                    showNotification('Error checking demo creation status', 'error');
                    resetCreateButton();
                });
        };
        
        poll();
    }
    
    function displayDemoResults(results) {
        console.log('=== displayDemoResults called ==='); // Debug log
        console.log('displayDemoResults called with:', results); // Debug log
        console.log('Type of results:', typeof results); // Debug log
        console.log('Results keys:', Object.keys(results || {})); // Debug log
        
        const resultsContainer = document.getElementById('demo-results');
        const resultsContent = document.getElementById('results-content');
        
        console.log('Results container found:', !!resultsContainer); // Debug log
        console.log('Results content found:', !!resultsContent); // Debug log
        console.log('Results container element:', resultsContainer); // Debug log
        console.log('Results content element:', resultsContent); // Debug log
        
        if (!resultsContainer) {
            console.error('Results container not found!'); // Debug log
            return;
        }
        
        let html = '';
        
        if (results.party_id) {
            html += `<div class="mb-2"><strong>Party ID:</strong> ${results.party_id}</div>`;
            console.log('Added party_id to HTML'); // Debug log
        }
        
        if (results.account_id) {
            html += `<div class="mb-2"><strong>Account ID:</strong> ${results.account_id}</div>`;
            console.log('Added account_id to HTML'); // Debug log
        }
        
        if (results.loan_ids && results.loan_ids.length > 0) {
            html += `<div class="mb-2"><strong>Loan IDs:</strong></div>`;
            results.loan_ids.forEach((id, index) => {
                const loanType = index === 0 ? 'Mortgage' : 'Consumer Loan';
                html += `<div class="ml-4">• ${loanType}: ${id}</div>`;
            });
            console.log('Added loan_ids to HTML'); // Debug log
        }
        
        if (results.term_deposit_id) {
            html += `<div class="mb-2"><strong>Term Deposit ID:</strong> ${results.term_deposit_id}</div>`;
            console.log('Added term_deposit_id to HTML'); // Debug log
        }
        
        console.log('Generated HTML length:', html.length); // Debug log
        console.log('Generated HTML:', html); // Debug log
        
        // Populate the results content if it exists, otherwise use the container
        if (resultsContent) {
            console.log('Setting innerHTML on results-content'); // Debug log
            resultsContent.innerHTML = html;
            console.log('innerHTML set on results-content'); // Debug log
        } else {
            console.log('Setting innerHTML on results container'); // Debug log
            resultsContainer.innerHTML = html;
            console.log('innerHTML set on results container'); // Debug log
        }
        
        console.log('Removing hidden class from results container'); // Debug log
        resultsContainer.classList.remove('hidden');
        console.log('Hidden class removed, container should be visible'); // Debug log
        console.log('Container classes after removal:', resultsContainer.className); // Debug log
        console.log('Results container should now be visible'); // Debug log
        showNotification('Demo data creation completed successfully!', 'success');
        console.log('=== displayDemoResults completed ==='); // Debug log
    }
    
    function showDemoError(message) {
        const errorContainer = document.getElementById('demo-error');
        if (!errorContainer) return;
        
        const errorText = document.getElementById('error-text');
        if (errorText) {
            errorText.textContent = message;
        }
        
        errorContainer.classList.remove('hidden');
    }
    
    function showNotification(message, type) {
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        });
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds for success/info, 8 seconds for errors
        const timeout = type === 'error' ? 8000 : 5000;
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, timeout);
    }
    
    // Cleanup function for when tab is switched
    function cleanupConfiguration() {
        console.log('Cleaning up Configuration tab...');
        
        // Remove any notifications
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        });
        
        // Reset button state
        resetCreateButton();
    }
    
    // Export cleanup function to global scope for dashboard.js
    window.cleanupCurrentTab = cleanupConfiguration;
    
    // Initialize when script loads
    initializeConfiguration();
    
})(); 