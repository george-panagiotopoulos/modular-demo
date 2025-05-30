(function() {
    'use strict';
    
    // Assistant Tab specific JavaScript
    console.log("assistant_app.js loaded and executing");

    let queryButtonListener = null; // Store listener

    function initAssistantTab() {
        console.log("Initializing Assistant Tab...");

        const queryButton = document.querySelector('#assistant-content button'); // Simplified selector
        const queryInput = document.getElementById('assistant-query');
        const responseDiv = document.getElementById('assistant-response');

        if (queryButton && queryInput && responseDiv) {
            // Define listener function
            queryButtonListener = async (e) => {
                e.preventDefault(); 
                const query = queryInput.value.trim();
                if (!query) {
                    responseDiv.textContent = 'Please enter a question.';
                    return;
                }

                responseDiv.textContent = 'Thinking...'; 
                console.log(`Sending query: ${query}`);

                try {
                    // Placeholder for actual API call
                    await new Promise(resolve => setTimeout(resolve, 1000)); 

                    // --- STUB RESPONSE --- 
                    let assistantResponse = "I am a stub assistant. I received your query: \"" + query + "\".";
                    if (query.toLowerCase().includes("holdings")) {
                        assistantResponse += "\nThe Holdings Service typically manages account balances and transaction history.";
                    } else if (query.toLowerCase().includes("customer")) {
                        assistantResponse += "\nThe Customer Service manages customer profiles and authentication.";
                    }
                    // --- END STUB --- 

                    responseDiv.textContent = assistantResponse;
                    console.log(`Received response: ${assistantResponse}`);

                } catch (error) {
                    console.error("Error querying assistant:", error);
                    responseDiv.textContent = `Error: Could not get response. ${error.message}`;
                }
            };
            queryButton.addEventListener('click', queryButtonListener);
        }
    }

    function cleanupAssistantTab() {
        console.log("Running cleanup for Assistant Tab...");
        const queryButton = document.querySelector('#assistant-content button');
        if (queryButton && queryButtonListener) {
            queryButton.removeEventListener('click', queryButtonListener);
            queryButtonListener = null;
            console.log("Removed assistant query button listener.");
        }
    }

    // --- Assistant Module for TabManager ---
    const AssistantModule = {
        onInit: function() {
            console.log('[AssistantModule] Initializing...');
        },
        
        onActivate: function(isRestoring = false) {
            console.log('[AssistantModule] Activating...', isRestoring ? '(restoring)' : '');
            // Wait a bit for DOM to be ready, then initialize
            setTimeout(() => {
                if (document.getElementById('assistant-content')) {
                    console.log('[AssistantModule] DOM ready, initializing assistant...');
                    initAssistantTab();
                } else {
                    console.warn('[AssistantModule] Assistant content not found in DOM');
                }
            }, 100);
        },
        
        onDeactivate: function(isUnloading = false) {
            console.log('[AssistantModule] Deactivating...', isUnloading ? '(unloading)' : '');
            cleanupAssistantTab();
        },
        
        onDestroy: function(isUnloading = false) {
            console.log('[AssistantModule] Destroying...', isUnloading ? '(unloading)' : '');
            cleanupAssistantTab();
        }
    };

    // Register with TabManager
    function registerAssistantApp() {
        if (window.TabManager) {
            window.TabManager.registerTab('assistant', AssistantModule);
            console.log('[AssistantModule] Successfully registered with TabManager');
            return true;
        } else {
            console.warn('[AssistantModule] TabManager not found yet. Will retry...');
            return false;
        }
    }

    // Try to register immediately
    if (!registerAssistantApp()) {
        // If TabManager not ready, wait and retry
        let retryCount = 0;
        const maxRetries = 50; // 5 seconds max
        const retryInterval = setInterval(() => {
            retryCount++;
            if (registerAssistantApp()) {
                clearInterval(retryInterval);
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                console.error('[AssistantModule] TabManager not found after maximum retries. Ensure tab-manager.js is loaded first.');
            }
        }, 100);
    }

})(); // End of IIFE 