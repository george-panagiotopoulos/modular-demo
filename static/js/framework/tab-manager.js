// tab-manager.js

/**
 * TabManager - Singleton for managing dashboard tab lifecycle
 */
const TabManager = (function() {
  // Private properties
  const _registeredTabs = {};
  let _activeTabId = null;
  let _previousTabId = null;
  
  // Private methods
  function _initGlobalListeners() {
    // Listen for hash changes to detect tab navigation
    window.addEventListener('hashchange', () => {
      const newTabId = location.hash.substring(1) || 'dashboard'; // Assuming 'dashboard' is a valid default
      if (_registeredTabs[newTabId]) {
        TabManager.activateTab(newTabId); // Use public API
      }
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (_activeTabId && _registeredTabs[_activeTabId]) {
        if (document.hidden) {
          _registeredTabs[_activeTabId].onVisibilityLost();
        } else {
          _registeredTabs[_activeTabId].onVisibilityRestored();
        }
      }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      // Clean up all tabs on page unload
      Object.values(_registeredTabs).forEach(tab => {
        if (tab.initialized) {
          tab.onUnload(); // This should also trigger resource cleanup if designed well
        }
      });
      // Consider a final cleanup for BackendConnector if needed
      if (typeof BackendConnector !== 'undefined' && BackendConnector.disconnectAllEventStreams) {
        BackendConnector.disconnectAllEventStreams();
      }
    });
  }
  
  // Public API
  return {
    /**
     * Initialize the tab manager
     */
    init: function() {
      _initGlobalListeners();
      
      // Activate initial tab based on hash or default
      // Ensure a default tab ID like 'mobile' or 'dashboard' exists and is registered.
      // For this example, let's assume 'mobile' is the default if no hash.
      const initialTabId = location.hash.substring(1) || 'mobile'; 
      if (_registeredTabs[initialTabId]) {
        this.activateTab(initialTabId);
      } else if (Object.keys(_registeredTabs).length > 0) {
        // Fallback to the first registered tab if initial is not found
        this.activateTab(Object.keys(_registeredTabs)[0]);
      }
      
      console.log('TabManager initialized');
    },
    
    /**
     * Register a new tab with the tab manager
     * 
     * @param {string} tabId - Unique identifier for the tab
     * @param {Object} options - Tab configuration and lifecycle hooks
     * @returns {Object} - The registered tab object
     */
    registerTab: function(tabId, options) {
      if (_registeredTabs[tabId]) {
        console.warn(`Tab with ID ${tabId} already registered`);
        return _registeredTabs[tabId];
      }
      
      const defaultOptions = {
        id: tabId,
        contentSelector: `#${tabId}-tab`, // Default selector convention
        initialized: false,
        active: false,
        resources: [],
        
        onInit: function() { console.log(`Tab ${this.id}: onInit`); },
        onActivate: function() { console.log(`Tab ${this.id}: onActivate`); },
        onDeactivate: function() { console.log(`Tab ${this.id}: onDeactivate`); },
        onVisibilityLost: function() { console.log(`Tab ${this.id}: onVisibilityLost`); },
        onVisibilityRestored: function() { console.log(`Tab ${this.id}: onVisibilityRestored`); },
        onUnload: function() { 
            console.log(`Tab ${this.id}: onUnload`);
            this.cleanupResources(); // Ensure resources are cleaned on unload
        },
        saveState: function() { return {}; },
        loadState: function(state) {},
        
        registerResource: function(resource, cleanupFn) {
          if (typeof cleanupFn !== 'function') {
            console.error(`Cleanup function for resource in tab ${this.id} is not a function.`);
            return;
          }
          this.resources.push({ resource, cleanup: cleanupFn });
          console.log(`Resource registered in tab ${this.id}`);
        },
        
        cleanupResources: function() {
          if (this.resources.length > 0) {
            console.log(`Cleaning up ${this.resources.length} resources for tab ${this.id}`);
            this.resources.forEach(r => {
              try {
                r.cleanup(r.resource);
              } catch (e) {
                console.error(`Error cleaning up resource for tab ${this.id}:`, e);
              }
            });
            this.resources = [];
          }
        }
      };
      
      _registeredTabs[tabId] = { ...defaultOptions, ...options, id: tabId, initialized: false, active: false, resources: [] };
      
      console.log(`Tab "${tabId}" registered`);
      return _registeredTabs[tabId];
    },
    
    /**
     * Activate a specific tab
     * 
     * @param {string} tabId - ID of the tab to activate
     */
    activateTab: function(tabId) {
      if (!_registeredTabs[tabId]) {
        console.error(`Cannot activate tab "${tabId}": not registered`);
        return;
      }
      
      if (_activeTabId === tabId && _registeredTabs[tabId].active) {
        console.log(`Tab "${tabId}" is already active, re-running onActivate.`);
        // Optionally, re-run onActivate or a specific "reFocus" hook if needed
        try {
          _registeredTabs[tabId].onActivate();
        } catch (e) {
          console.error(`Error in onActivate for already active tab ${tabId}:`, e);
        }
        return;
      }
      
      console.log(`Activating tab "${tabId}"`);
      _previousTabId = _activeTabId;
      
      if (_activeTabId && _registeredTabs[_activeTabId] && _registeredTabs[_activeTabId].active) {
        const currentTab = _registeredTabs[_activeTabId];
        console.log(`Deactivating tab "${_activeTabId}"`);
        try {
          const state = currentTab.saveState();
          StateManager.saveTabState(_activeTabId, state);
        } catch (e) {
          console.error(`Error saving state for tab ${_activeTabId}:`, e);
        }
        
        const currentTabContent = document.querySelector(currentTab.contentSelector);
        if (currentTabContent) currentTabContent.style.display = 'none';
        
        try {
          currentTab.onDeactivate();
        } catch (e) {
          console.error(`Error in onDeactivate for tab ${_activeTabId}:`, e);
        }
        currentTab.cleanupResources(); // Crucial: cleanup resources on deactivation
        currentTab.active = false;
      }
      
      const newTab = _registeredTabs[tabId];
      _activeTabId = tabId;
      
      if (!newTab.initialized) {
        try {
          newTab.onInit();
          newTab.initialized = true;
        } catch (e) {
          console.error(`Error in onInit for tab ${tabId}:`, e);
        }
      }
      
      try {
        const savedState = StateManager.getTabState(tabId);
        if (savedState) {
          newTab.loadState(savedState);
          console.log(`State loaded for tab "${tabId}"`);
        }
      } catch (e) {
        console.error(`Error loading state for tab ${tabId}:`, e);
      }
      
      const newTabContent = document.querySelector(newTab.contentSelector);
      if (newTabContent) newTabContent.style.display = 'block';
      else console.warn(`Content container not found for tab ${tabId} with selector ${newTab.contentSelector}`);

      try {
        newTab.onActivate();
      } catch (e) {
        console.error(`Error in onActivate for tab ${tabId}:`, e);
      }
      
      newTab.active = true;
      console.log(`Tab "${tabId}" activated`);
      
      if (location.hash !== `#${tabId}`) {
        history.replaceState(null, '', `#${tabId}`);
      }
    },
    
    getActiveTab: function() {
      return _activeTabId ? _registeredTabs[_activeTabId] : null;
    },
    
    getTab: function(tabId) {
      return _registeredTabs[tabId] || null;
    },
    
    cleanupTabResources: function(tabId) {
      if (_registeredTabs[tabId]) {
        _registeredTabs[tabId].cleanupResources();
      }
    },
    
    cleanupAllTabs: function() {
      Object.values(_registeredTabs).forEach(tab => {
        if (tab.initialized) {
          try {
            // Deactivate hook should ideally handle pre-cleanup state saving if needed
            if (tab.active) tab.onDeactivate(); 
            tab.cleanupResources();
            if (tab.active) tab.active = false; // Mark as inactive
          } catch (e) {
            console.error(`Error cleaning up tab ${tab.id}:`, e);
          }
        }
      });
      _activeTabId = null; // No tab is active after full cleanup
      console.log("All tabs cleaned up.");
    }
  };
})(); 