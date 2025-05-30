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
        console.log('Setting up configuration event listeners...');
        
        // Endpoints management
        const toggleBtn = document.getElementById('toggle-endpoints-btn');
        const editBtn = document.getElementById('edit-endpoints-btn');
        const saveBtn = document.getElementById('save-endpoints-btn');
        const cancelBtn = document.getElementById('cancel-endpoints-btn');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleEndpointsSection);
            console.log('Toggle endpoints button listener added');
        }
        if (editBtn) {
            editBtn.addEventListener('click', showEndpointsEdit);
            console.log('Edit endpoints button listener added');
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', saveEndpoints);
            console.log('Save endpoints button listener added');
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', hideEndpointsEdit);
            console.log('Cancel endpoints button listener added');
        }
        
        // Demo data management
        const createDemoDataBtn = document.getElementById('create-demo-data-btn');
        
        if (createDemoDataBtn) {
            createDemoDataBtn.addEventListener('click', createDemoData);
            console.log('Create demo data button listener added');
        } else {
            console.warn('Create demo data button not found');
        }
        
        // Add validation for current account dependency
        const productCheckboxes = ['create-mortgage', 'create-consumer-loan', 'create-term-deposit'];
        productCheckboxes.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', (e) => {
                    console.log(`Checkbox ${id} changed to:`, e.target.checked);
                    validateCurrentAccountDependency();
                });
                console.log(`Checkbox listener added for: ${id}`);
            } else {
                console.warn(`Checkbox not found: ${id}`);
            }
        });
        
        // Also add listener for current account checkbox
        const currentAccountEl = document.getElementById('create-current-account');
        if (currentAccountEl) {
            currentAccountEl.addEventListener('change', (e) => {
                console.log('Current account checkbox changed to:', e.target.checked);
            });
            console.log('Current account checkbox listener added');
        } else {
            console.warn('Current account checkbox not found');
        }
        
        console.log('Configuration event listeners setup complete');
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
        console.log('Validating current account dependency...');
        
        const currentAccount = document.getElementById('create-current-account');
        const productCheckboxes = ['create-mortgage', 'create-consumer-loan', 'create-term-deposit'];
        
        if (!currentAccount) {
            console.warn('Current account checkbox not found');
            return;
        }
        
        const otherProducts = productCheckboxes.some(id => {
            const element = document.getElementById(id);
            const isChecked = element && element.checked;
            console.log(`Product ${id}: ${isChecked ? 'checked' : 'unchecked'}`);
            return isChecked;
        });
        
        console.log(`Other products selected: ${otherProducts}`);
        console.log(`Current account checked: ${currentAccount.checked}`);
        
        if (otherProducts && !currentAccount.checked) {
            console.log('Auto-checking current account because other products are selected');
            currentAccount.checked = true;
            showNotification('Current Account is required when other products are selected', 'warning');
        }
    }
    
    function createDemoData() {
        console.log('Creating demo data...');
        
        // Reset demo status at the beginning of new demo creation
        resetDemoStatus();
        
        // Disable the button and show progress
        const createButton = document.getElementById('create-demo-data-btn');
        createButton.disabled = true;
        createButton.textContent = 'Creating...';
        
        showDemoProgress();
        
        // Clear any previous results
        const resultsDiv = document.getElementById('demo-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = '';
            resultsDiv.style.display = 'none';
        }

        // First, save the demo configuration (checkbox values) to the backend
        const demoConfig = getDemoConfig();
        console.log('Saving demo configuration before creating data:', demoConfig);
        
        fetch('/api/configuration/demo-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(demoConfig)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(configResult => {
            console.log('Demo configuration saved successfully:', configResult);
            
            // Now create the demo data with the saved configuration
            return fetch('/api/configuration/create-demo-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Demo creation initiated:', data);
            
            if (data.status === 'success') {
                console.log('Demo creation started, beginning polling...');
                pollDemoStatus();
            } else {
                throw new Error(data.message || 'Failed to start demo creation');
            }
        })
        .catch(error => {
            console.error('Error creating demo data:', error);
            showDemoError('Failed to create demo data: ' + error.message);
            resetCreateButton();
            hideDemoProgress();
        });
    }
    
    function resetCreateButton() {
        const createButton = document.getElementById('create-demo-data-btn');
        if (createButton) {
            createButton.disabled = false;
            createButton.textContent = 'Create Demo Data';
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
        console.log('Displaying demo results:', results);
        
        const resultsDiv = document.getElementById('demo-results');
        if (!resultsDiv) {
            console.error('Demo results div not found');
            return;
        }

        let html = '<div class="demo-results-content">';
        html += '<h4><i class="fas fa-check-circle text-success"></i> Demo Data Created Successfully!</h4>';
        
        if (results.party_id) {
            html += `<div class="result-item"><strong>Party ID:</strong> <span class="result-value">${results.party_id}</span></div>`;
        }
        
        if (results.account_id) {
            html += `<div class="result-item"><strong>Account ID:</strong> <span class="result-value">${results.account_id}</span></div>`;
        }
        
        if (results.loan_ids && results.loan_ids.length > 0) {
            html += `<div class="result-item"><strong>Loan IDs:</strong>`;
            results.loan_ids.forEach((loanId, index) => {
                if (index > 0) html += '<br>'; // Add line break between loan IDs
                html += `<span class="result-value loan-id">${loanId}</span>`;
            });
            html += `</div>`;
        }
        
        if (results.term_deposit_id) {
            html += `<div class="result-item"><strong>Term Deposit ID:</strong> <span class="result-value">${results.term_deposit_id}</span></div>`;
        }
        
        html += '</div>';
        
        resultsDiv.innerHTML = html;
        resultsDiv.style.display = 'block';
        
        // Show success notification
        showNotification('Demo data created successfully!', 'success');
        
        console.log('Demo results displayed successfully');
    }
    
    function resetDemoStatus() {
        console.log('Resetting demo status to idle for next run...'); // Debug log
        
        fetch('/api/configuration/demo-status/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
                console.log('Demo status reset successfully'); // Debug log
            } else {
                console.error('Error resetting demo status:', result.message);
            }
        })
        .catch(error => {
            console.error('Error resetting demo status:', error);
        });
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
    
    // Don't initialize immediately - wait for tab activation
    // initializeConfiguration();

    // Create module object for TabManager registration with correct method names
    const ConfigurationModule = {
        onInit: function() {
            console.log('[ConfigurationModule] Initializing...');
            // Initialization logic if needed
        },
        
        onActivate: function(isRestoring = false) {
            console.log('[ConfigurationModule] Activating...', isRestoring ? '(restoring)' : '');
            // Wait a bit for DOM to be ready, then initialize
            setTimeout(() => {
                if (document.getElementById('configuration-content')) {
                    console.log('[ConfigurationModule] DOM ready, initializing configuration...');
                    initializeConfiguration();
                } else {
                    console.warn('[ConfigurationModule] Configuration content not found in DOM');
                }
            }, 100);
        },
        
        onDeactivate: function(isUnloading = false) {
            console.log('[ConfigurationModule] Deactivating...', isUnloading ? '(unloading)' : '');
            cleanupConfiguration();
        },
        
        onDestroy: function(isUnloading = false) {
            console.log('[ConfigurationModule] Destroying...', isUnloading ? '(unloading)' : '');
            cleanupConfiguration();
        }
    };

    // Register with TabManager if available
    function registerConfigurationApp() {
        if (window.TabManager) {
            window.TabManager.registerTab('configuration', ConfigurationModule);
            console.log('[ConfigurationModule] Successfully registered with TabManager');
            return true;
        } else {
            console.warn('[ConfigurationModule] TabManager not found yet. Will retry...');
            return false;
        }
    }

    // Try to register immediately
    if (!registerConfigurationApp()) {
        // If TabManager not ready, wait and retry
        let retryCount = 0;
        const maxRetries = 50; // 5 seconds max
        const retryInterval = setInterval(() => {
            retryCount++;
            if (registerConfigurationApp()) {
                clearInterval(retryInterval);
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                console.error('[ConfigurationModule] TabManager not found after maximum retries. Ensure tab-manager.js is loaded first.');
            }
        }, 100);
    }

})(); 