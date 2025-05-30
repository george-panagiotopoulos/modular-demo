// state-manager.js

/**
 * StateManager - Handles persisting and retrieving tab states
 */
const StateManager = (function() {
  // Storage key prefix
  const STATE_PREFIX = 'vibe_tab_state_';
  
  /**
   * Save tab state to localStorage
   * 
   * @param {string} tabId - Tab identifier
   * @param {Object} state - State object to persist
   */
  function saveTabState(tabId, state) {
    if (!tabId || typeof state === 'undefined') {
        console.warn('StateManager: saveTabState called with invalid tabId or state.');
        return;
    }
    
    try {
      const stateStr = JSON.stringify(state);
      localStorage.setItem(`${STATE_PREFIX}${tabId}`, stateStr);
      console.log(`StateManager: State saved for tab ${tabId}`);
    } catch (e) {
      console.error(`StateManager: Error saving state for tab ${tabId}:`, e);
    }
  }
  
  /**
   * Get saved tab state from localStorage
   * 
   * @param {string} tabId - Tab identifier
   * @returns {Object|null} - The saved state or null if not found/error
   */
  function getTabState(tabId) {
    if (!tabId) {
        console.warn('StateManager: getTabState called with invalid tabId.');
        return null;
    }
    
    try {
      const stateStr = localStorage.getItem(`${STATE_PREFIX}${tabId}`);
      if (stateStr === null) {
        console.log(`StateManager: No state found for tab ${tabId}`);
        return null;
      }
      const parsedState = JSON.parse(stateStr);
      console.log(`StateManager: State retrieved for tab ${tabId}`);
      return parsedState;
    } catch (e) {
      console.error(`StateManager: Error loading state for tab ${tabId}:`, e);
      return null;
    }
  }
  
  /**
   * Clear saved state for a tab
   * 
   * @param {string} tabId - Tab identifier
   */
  function clearTabState(tabId) {
    if (!tabId) {
        console.warn('StateManager: clearTabState called with invalid tabId.');
        return;
    }
    localStorage.removeItem(`${STATE_PREFIX}${tabId}`);
    console.log(`StateManager: State cleared for tab ${tabId}`);
  }
  
  /**
   * Clear all saved tab states
   */
  function clearAllTabStates() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STATE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`StateManager: All tab states cleared. (${keysToRemove.length} items)`);
  }
  
  // Public API
  return {
    saveTabState,
    getTabState,
    clearTabState,
    clearAllTabStates
  };
})(); 