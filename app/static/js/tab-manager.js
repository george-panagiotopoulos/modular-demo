/**
 * TabManager Singleton
 * Manages the lifecycle of different tabs within the application.
 * Ensures proper initialization, activation, deactivation, and destruction of tab-specific logic.
 */
console.log('[TabManager] Creating TabManager singleton...');
window.TabManager = (() => {
    // Private properties
    let _tabs = {}; // Stores registered tab modules: { tabName: { onInit, onActivate, onDeactivate, onDestroy, isInitialized, isActive, resources } }
    let _activeTab = null;
    let _initialized = false;
    const _eventListeners = {}; // To store global event listeners managed by TabManager

    // --- Private Methods ---

    function _log(message, type = 'info', data = null) {
        const SCRIPT_NAME = 'TabManager';
        const LOG_LEVELS = { 'info': '#3498db', 'warn': '#f39c12', 'error': '#e74c3c', 'success': '#2ecc71' }; // Blue, Orange, Red, Green
        const timestamp = new Date().toISOString();
        const consoleMethod = console[type] || console.log;
        const styleHeader = `color: ${LOG_LEVELS[type] || '#3498db'}; font-weight: bold;`;
        const styleTimestamp = 'color: #95a5a6; font-weight: normal;';

        if (data) {
            consoleMethod(
                `%c[${SCRIPT_NAME}]%c [${timestamp}] ${message}`,
                styleHeader,
                styleTimestamp,
                data
            );
        } else {
            consoleMethod(
                `%c[${SCRIPT_NAME}]%c [${timestamp}] ${message}`,
                styleHeader,
                styleTimestamp
            );
        }
    }

    function _isValidTabModule(tabModule) {
        return tabModule && typeof tabModule.onInit === 'function' &&
               typeof tabModule.onActivate === 'function' &&
               typeof tabModule.onDeactivate === 'function' &&
               typeof tabModule.onDestroy === 'function';
    }

    function _cleanupResource(resource) {
        if (resource) {
            if (typeof resource.cleanup === 'function') {
                try {
                    resource.cleanup();
                    _log(`Cleaned up resource: ${resource.name || 'Unnamed Resource'}`, 'info');
                } catch (e) {
                    _log(`Error cleaning up resource: ${resource.name || 'Unnamed Resource'}`, 'error', e);
                }
            } else if (resource.eventSource && typeof resource.eventSource.close === 'function') {
                // Specific handling for EventSource objects if no custom cleanup is provided
                try {
                    resource.eventSource.close();
                    _log(`Closed EventSource: ${resource.name || 'Unnamed EventSource'}`, 'info');
                } catch (e) {
                    _log(`Error closing EventSource: ${resource.name || 'Unnamed EventSource'}`, 'error', e);
                }
            } else if (resource.intervalId) {
                try {
                    clearInterval(resource.intervalId);
                    _log(`Cleared interval: ${resource.name || 'Unnamed Interval'}`, 'info');
                } catch (e) {
                     _log(`Error clearing interval: ${resource.name || 'Unnamed Interval'}`, 'error', e);
                }
            }
        }
    }

    function _cleanupTabResources(tabName) {
        const tab = _tabs[tabName];
        if (tab && tab.resources) {
            _log(`Cleaning up resources for tab: ${tabName}`, 'info');
            tab.resources.forEach(resource => _cleanupResource(resource));
            tab.resources = []; // Clear resources after cleanup
        }
    }
    
    function _initializeGlobalListeners() {
        // Handle page unload for graceful cleanup
        _eventListeners.beforeunload = (event) => {
            _log('Page is unloading. Cleaning up all tabs...', 'warn');
            Object.keys(_tabs).forEach(tabName => {
                if (_tabs[tabName].isActive) {
                    _deactivateTabInternal(tabName, true); // isUnloading = true
                }
                _destroyTabInternal(tabName, true); // isUnloading = true
            });
            // Note: Some browsers might not execute all async operations here.
            // It's best if server-side sessions also have timeouts.
        };
        window.addEventListener('beforeunload', _eventListeners.beforeunload );

        // Handle visibility change (e.g., browser tab switched, window minimized)
        _eventListeners.visibilitychange = () => {
            if (document.hidden) {
                _log('Page became hidden. Deactivating active tab if any.', 'info');
                if (_activeTab && _tabs[_activeTab] && _tabs[_activeTab].isActive) {
                    // Optionally, you could have a specific hook like onHide, or just use onDeactivate
                    // For now, we treat it like a deactivation for resource saving purposes.
                    // _deactivateTabInternal(_activeTab, false, true); // isHiding = true
                    // This might be too aggressive for simple visibility changes, depending on tab needs.
                    // For now, let's just log it. Tabs can implement their own visibility listeners if needed.
                }
            } else {
                _log('Page became visible. Re-activating tab if it was active.', 'info');
                if (_activeTab && _tabs[_activeTab] && !_tabs[_activeTab].isActive) {
                    // Similar to above, could have onShow or use onActivate.
                    // _activateTabInternal(_activeTab, false, true); // isShowing = true
                }
            }
        };
        document.addEventListener('visibilitychange', _eventListeners.visibilitychange);
        _log('Global event listeners initialized (beforeunload, visibilitychange).', 'success');
    }

    function _destroyGlobalListeners() {
        if (_eventListeners.beforeunload) {
            window.removeEventListener('beforeunload', _eventListeners.beforeunload);
            delete _eventListeners.beforeunload;
        }
        if (_eventListeners.visibilitychange) {
            document.removeEventListener('visibilitychange', _eventListeners.visibilitychange);
            delete _eventListeners.visibilitychange;
        }
        _log('Global event listeners destroyed.', 'success');
    }

    function _initTab(tabName) {
        const tab = _tabs[tabName];
        if (tab && !tab.isInitialized) {
            try {
                _log(`Initializing tab: ${tabName}`, 'info');
                tab.onInit();
                tab.isInitialized = true;
                _log(`Tab initialized successfully: ${tabName}`, 'success');
            } catch (e) {
                _log(`Error initializing tab: ${tabName}`, 'error', e);
                // Optionally, remove the tab or mark as failed initialization
            }
        }
    }

    function _activateTabInternal(tabName, isInitialActivation = false, isRestoring = false) {
        const tab = _tabs[tabName];
        if (!tab) {
            _log(`Tab not registered: ${tabName}. Cannot activate.`, 'error');
            return;
        }

        if (!tab.isInitialized) {
            _initTab(tabName); 
            // If init failed, tab.isInitialized will still be false. The onActivate guard below will catch it.
            if(!tab.isInitialized){
                _log(`Cannot activate tab ${tabName} as initialization failed.`, 'error');
                return;
            }
        }

        if (tab.isActive && !isRestoring) {
            _log(`Tab ${tabName} is already active.`, 'info');
            return;
        }

        try {
            _log(`Activating tab: ${tabName}${isInitialActivation ? ' (initial)' : ''}${isRestoring ? ' (restoring)' : ''}`, 'info');
            tab.onActivate(isRestoring);
            tab.isActive = true;
            _activeTab = tabName;
            _log(`Tab activated successfully: ${tabName}`, 'success');
        } catch (e) {
            _log(`Error activating tab: ${tabName}`, 'error', e);
        }
    }

    function _deactivateTabInternal(tabName, isUnloading = false, isHiding = false) {
        const tab = _tabs[tabName];
        if (!tab || !tab.isActive) {
            _log(`Tab ${tabName} is not active or not registered. Cannot deactivate.`, 'info');
            return;
        }

        try {
            _log(`Deactivating tab: ${tabName}${isUnloading ? ' (unloading)' : ''}${isHiding ? ' (hiding)' : ''}`, 'info');
            tab.onDeactivate(isUnloading); // Pass unloading flag for special handling if needed
            tab.isActive = false;
            if (_activeTab === tabName) {
                _activeTab = null;
            }
            // Don't cleanup resources here if it's just a visibility change (isHiding)
            // unless specifically designed to do so.
            // For a full deactivation (not just hiding), cleanup resources.
            if (!isHiding) {
                 _cleanupTabResources(tabName); // Cleanup resources on deactivation unless merely hiding
            }
            _log(`Tab deactivated successfully: ${tabName}`, 'success');
        } catch (e) {
            _log(`Error deactivating tab: ${tabName}`, 'error', e);
        }
    }

    function _destroyTabInternal(tabName, isUnloading = false) {
        const tab = _tabs[tabName];
        if (!tab) {
            _log(`Tab ${tabName} not registered. Cannot destroy.`, 'info');
            return;
        }

        if (tab.isActive) {
            _deactivateTabInternal(tabName, isUnloading);
        }

        try {
            _log(`Destroying tab: ${tabName}${isUnloading ? ' (unloading)' : ''}`, 'info');
            tab.onDestroy(isUnloading);
            _cleanupTabResources(tabName); // Ensure all resources are cleaned up on destroy
            delete _tabs[tabName];
            _log(`Tab destroyed successfully: ${tabName}`, 'success');
        } catch (e) {
            _log(`Error destroying tab: ${tabName}`, 'error', e);
        }
    }

    // --- Public API ---
    return {
        /**
         * Initializes the TabManager. 
         * Must be called once the DOM is ready and all tab scripts have potentially registered.
         * @param {string} [defaultTabName] - Optional. The name of the tab to activate by default.
         */
        init(defaultTabName = null) {
            if (_initialized) {
                _log('TabManager already initialized.', 'warn');
                return;
            }
            _log('Initializing TabManager...', 'info');
            _initializeGlobalListeners();
            _initialized = true;
            _log('TabManager initialized successfully.', 'success');

            Object.keys(_tabs).forEach(tabName => {
                _initTab(tabName);
            });

            if (defaultTabName && _tabs[defaultTabName]) {
                const lastActiveTab = StateManager.getLastActiveTab();
                if (lastActiveTab && _tabs[lastActiveTab]) {
                    _log(`Restoring last active tab: ${lastActiveTab}`, 'info');
                    this.activateTab(lastActiveTab, true);
                } else {
                    _log(`Activating default tab: ${defaultTabName}`, 'info');
                    this.activateTab(defaultTabName, false, true);
                }
            } else if (Object.keys(_tabs).length > 0) {
                const firstRegisteredTab = Object.keys(_tabs)[0];
                _log(`No default tab specified, activating first registered tab: ${firstRegisteredTab}`, 'info');
                this.activateTab(firstRegisteredTab, false, true);
            } else {
                _log('No tabs registered and no default tab specified.', 'warn');
            }
        },

        /**
         * Registers a new tab module with the TabManager.
         * @param {string} tabName - The unique name of the tab.
         * @param {object} tabModule - The module object with onInit, onActivate, onDeactivate, onDestroy methods.
         */
        registerTab(tabName, tabModule) {
            _log(`Registration attempt for tab: ${tabName}`, 'info');
            if (!tabName || !tabModule) {
                _log('Tab name and module are required for registration.', 'error');
                return;
            }
            if (_tabs[tabName]) {
                _log(`Tab already registered: ${tabName}`, 'warn');
                return;
            }
            _log(`Validating tab module for: ${tabName}`, 'info');
            if (!_isValidTabModule(tabModule)) {
                _log(`Invalid tab module for: ${tabName}. Module must implement onInit, onActivate, onDeactivate, onDestroy.`, 'error');
                _log(`Module methods check:`, 'info', {
                    onInit: typeof tabModule.onInit,
                    onActivate: typeof tabModule.onActivate,
                    onDeactivate: typeof tabModule.onDeactivate,
                    onDestroy: typeof tabModule.onDestroy
                });
                return;
            }

            _tabs[tabName] = { 
                ...tabModule, 
                isInitialized: false, 
                isActive: false,
                resources: []
            };
            _log(`Tab registered: ${tabName}`, 'success');
            _log(`Current registered tabs:`, 'info', Object.keys(_tabs));

            if (_initialized) {
                _initTab(tabName);
            }
        },

        /**
         * Activates a registered tab. Deactivates the currently active tab if any.
         * @param {string} tabName - The name of the tab to activate.
         * @param {boolean} [isRestoring=false] - Internal flag, true if restoring state
         * @param {boolean} [isInitialActivation=false] - Internal flag, true if this is the very first tab activation.
         */
        activateTab(tabName, isRestoring = false, isInitialActivation = false) {
            if (!_initialized) {
                _log('TabManager not initialized. Call init() first.', 'error');
                this.init(tabName);
                return;
            }

            const tabToActivate = _tabs[tabName];
            if (!tabToActivate) {
                _log(`Tab not registered: ${tabName}. Cannot activate.`, 'error');
                return;
            }

            if (_activeTab && _activeTab !== tabName) {
                _deactivateTabInternal(_activeTab);
            }
            
            _activateTabInternal(tabName, isInitialActivation, isRestoring);
            StateManager.setLastActiveTab(tabName);
        },

        /**
         * Deactivates a tab.
         * @param {string} tabName - The name of the tab to deactivate.
         */
        deactivateTab(tabName) {
            if (!_initialized) {
                _log('TabManager not initialized.', 'error');
                return;
            }
            _deactivateTabInternal(tabName);
        },

        /**
         * Deactivates the currently active tab.
         */
        deactivateCurrentTab() {
            if (!_initialized) {
                _log('TabManager not initialized.', 'error');
                return;
            }
            if (_activeTab) {
                _log(`Deactivating current tab: ${_activeTab}`, 'info');
                _deactivateTabInternal(_activeTab);
            } else {
                _log('No active tab to deactivate.', 'info');
            }
        },

        /**
         * Destroys a tab, cleaning up its resources.
         * @param {string} tabName - The name of the tab to destroy.
         */
        destroyTab(tabName) {
             if (!_initialized) {
                _log('TabManager not initialized.', 'error');
                return;
            }
            _destroyTabInternal(tabName);
        },

        /**
         * Registers a resource (e.g., EventSource, interval) for a specific tab.
         * These resources will be automatically cleaned up when the tab is deactivated or destroyed.
         * @param {string} tabName - The name of the tab owning the resource.
         * @param {object} resource - The resource object. It should have a unique `id` or `name` and a `cleanup` function.
         *                             Alternatively, if it has an `eventSource` property (EventSource instance) or `intervalId`,
         *                             TabManager will attempt to close/clear it.
         *                             Example: { name: 'myEventStream', eventSource: new EventSource(...), cleanup: () => myEventSource.close() }
         *                             Example: { name: 'myPolling', intervalId: setInterval(...), cleanup: () => clearInterval(intervalId) }
         */
        registerResource(tabName, resource) {
            const tab = _tabs[tabName];
            if (!tab) {
                _log(`Tab not registered: ${tabName}. Cannot register resource.`, 'error');
                return;
            }
            if (!resource || (!resource.name && !resource.id)) {
                _log(`Resource for tab ${tabName} must have a 'name' or 'id'.`, 'error');
                return;
            }
            if (tab.resources.some(r => (r.name && r.name === resource.name) || (r.id && r.id === resource.id))) {
                _log(`Resource already registered for tab ${tabName}: ${resource.name || resource.id}`, 'warn');
                return;
            }
            tab.resources.push(resource);
            _log(`Resource registered for tab ${tabName}: ${resource.name || resource.id}`, 'success');
        },

        /**
         * Unregisters a resource for a specific tab and cleans it up.
         * @param {string} tabName - The name of the tab.
         * @param {string} resourceNameOrId - The name or ID of the resource to unregister.
         */
        unregisterResource(tabName, resourceNameOrId) {
            const tab = _tabs[tabName];
            if (!tab) {
                _log(`Tab not registered: ${tabName}. Cannot unregister resource.`, 'error');
                return;
            }
            
            const resourceIndex = tab.resources.findIndex(r => r.name === resourceNameOrId || r.id === resourceNameOrId);
            if (resourceIndex === -1) {
                _log(`Resource not found for tab ${tabName}: ${resourceNameOrId}`, 'warn');
                return;
            }
            const resource = tab.resources[resourceIndex];
            _cleanupResource(resource);
            tab.resources.splice(resourceIndex, 1);
            _log(`Resource unregistered and cleaned up for tab ${tabName}: ${resourceNameOrId}`, 'success');
        },

        /**
         * Retrieves the module for a given tab.
         * @param {string} tabName - The name of the tab.
         * @returns {object|null} The tab module or null if not found.
         */
        getTabModule(tabName) {
            return _tabs[tabName] || null;
        },

        /**
         * Gets the name of the currently active tab.
         * @returns {string|null} The active tab name or null.
         */
        getActiveTab() {
            return _activeTab;
        },
        
        /**
         * Shuts down the TabManager, cleaning up all tabs and global listeners.
         * Typically called if the application itself is being torn down.
         */
        shutdown() {
            _log('Shutting down TabManager...', 'warn');
            Object.keys(_tabs).forEach(tabName => {
                if (_tabs[tabName].isActive) {
                    _deactivateTabInternal(tabName, true);
                }
                _destroyTabInternal(tabName, true);
            });
            _destroyGlobalListeners();
            _tabs = {};
            _activeTab = null;
            _initialized = false;
            _log('TabManager shut down complete.', 'success');
        }
    };
})(); // End of IIFE 