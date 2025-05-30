(function() {
    'use strict';
    
    // --- Architecture Tab Logic ---
    function loadArchitectureDiagram() {
        const diagramContainer = document.getElementById('architecture-diagram');
        if (!diagramContainer) {
            console.warn('Architecture diagram container not found');
            return;
        }
        
        diagramContainer.innerHTML = '<div class="text-center text-gray-500 py-4">Loading architecture diagram...</div>';
        
        fetch(`/api/architecture/diagram_path?_=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Check if container still exists before updating
                const currentContainer = document.getElementById('architecture-diagram');
                if (currentContainer) {
                    if (data.diagram_path) {
                        currentContainer.innerHTML = `
                            <div class="text-center">
                                <img src="${data.diagram_path}" alt="Architecture Diagram" class="mx-auto max-w-full h-auto">
                            </div>
                        `;
                    } else {
                        currentContainer.innerHTML = '<p class="text-center text-gray-500">No architecture diagram available.</p>';
                    }
                }
            })
            .catch(error => {
                console.error('Error loading architecture diagram:', error);
                // Check if container still exists before updating
                const currentContainer = document.getElementById('architecture-diagram');
                if(currentContainer) {
                    currentContainer.innerHTML = `<p style="color: red;">Could not load architecture diagram: ${error.message}</p>`;
                }
            });
    }

    // --- Architecture Module for TabManager ---
    const ArchitectureModule = {
        onInit: function() {
            console.log('[ArchitectureModule] Initializing...');
        },
        
        onActivate: function(isRestoring = false) {
            console.log('[ArchitectureModule] Activating...', isRestoring ? '(restoring)' : '');
            // Wait a bit for DOM to be ready, then load diagram
            setTimeout(() => {
                if (document.getElementById('architecture-diagram')) {
                    console.log('[ArchitectureModule] DOM ready, loading architecture diagram...');
                    loadArchitectureDiagram();
                } else {
                    console.warn('[ArchitectureModule] Architecture diagram container not found in DOM');
                }
            }, 100);
        },
        
        onDeactivate: function(isUnloading = false) {
            console.log('[ArchitectureModule] Deactivating...', isUnloading ? '(unloading)' : '');
            // No specific cleanup needed for architecture tab
        },
        
        onDestroy: function(isUnloading = false) {
            console.log('[ArchitectureModule] Destroying...', isUnloading ? '(unloading)' : '');
            // No specific cleanup needed for architecture tab
        }
    };

    // Register with TabManager
    function registerArchitectureApp() {
        if (window.TabManager) {
            window.TabManager.registerTab('architecture', ArchitectureModule);
            console.log('[ArchitectureModule] Successfully registered with TabManager');
            return true;
        } else {
            console.warn('[ArchitectureModule] TabManager not found yet. Will retry...');
            return false;
        }
    }

    // Try to register immediately
    if (!registerArchitectureApp()) {
        // If TabManager not ready, wait and retry
        let retryCount = 0;
        const maxRetries = 50; // 5 seconds max
        const retryInterval = setInterval(() => {
            retryCount++;
            if (registerArchitectureApp()) {
                clearInterval(retryInterval);
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                console.error('[ArchitectureModule] TabManager not found after maximum retries. Ensure tab-manager.js is loaded first.');
            }
        }, 100);
    }

})(); 