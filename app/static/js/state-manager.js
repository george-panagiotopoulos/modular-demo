/**
 * StateManager IIFE
 * Manages the saving and retrieval of UI state for different tabs using localStorage.
 */
window.StateManager = (() => {
    const SCRIPT_NAME = 'StateManager';
    const LOG_LEVELS = { 'info': '#27ae60', 'warn': '#e67e22', 'error': '#c0392b' }; // Green, Orange, Red
    const LAST_ACTIVE_TAB_KEY = '_INTERNAL_LAST_ACTIVE_TAB'; // Internal key for last active tab

    function _log(message, type = 'info', data = null) {
        const timestamp = new Date().toISOString();
        const consoleMethod = console[type] || console.log;
        const styleHeader = `color: ${LOG_LEVELS[type] || '#27ae60'}; font-weight: bold;`;
        const styleTimestamp = 'color: #bdc3c7; font-weight: normal;';

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

    function _getStorageKey(tabName, key) {
        if (!tabName || !key) {
            _log('Tab name and key are required to generate a storage key.', 'error');
            return null;
        }
        // For the last active tab, we don't prefix with tabName, it's a global StateManager property
        if (key === LAST_ACTIVE_TAB_KEY) {
            return LAST_ACTIVE_TAB_KEY;
        }
        return `tab_${tabName}_${key}`;
    }

    return {
        /**
         * Saves a piece of state for a specific tab.
         * @param {string} tabName - The name of the tab (e.g., 'headless-v2').
         * @param {string} key - The specific key for the state within that tab (e.g., 'selectedComponent').
         * @param {any} value - The value to save (will be JSON.stringified).
         */
        saveState: (tabName, key, value) => {
            const storageKey = _getStorageKey(tabName, key);
            if (!storageKey) return;

            try {
                const serializedValue = JSON.stringify(value);
                localStorage.setItem(storageKey, serializedValue);
                _log(`State saved for tab '${tabName}', key '${key}'.`, 'info', { value });
            } catch (error) {
                _log(`Error saving state for tab '${tabName}', key '${key}':`, 'error', error);
            }
        },

        /**
         * Retrieves a piece of state for a specific tab.
         * @param {string} tabName - The name of the tab.
         * @param {string} key - The specific key for the state.
         * @returns {any|null} The retrieved value (JSON.parse-d), or null if not found or error.
         */
        retrieveState: (tabName, key) => {
            const storageKey = _getStorageKey(tabName, key);
            if (!storageKey) return null;

            try {
                const serializedValue = localStorage.getItem(storageKey);
                if (serializedValue === null) {
                    _log(`No state found for tab '${tabName}', key '${key}'.`, 'info');
                    return null;
                }
                const value = JSON.parse(serializedValue);
                _log(`State retrieved for tab '${tabName}', key '${key}'.`, 'info', { value });
                return value;
            } catch (error) {
                _log(`Error retrieving state for tab '${tabName}', key '${key}':`, 'error', error);
                return null;
            }
        },

        /**
         * Clears a specific piece of state for a tab.
         * @param {string} tabName - The name of the tab.
         * @param {string} key - The specific key for the state to clear.
         */
        clearState: (tabName, key) => {
            const storageKey = _getStorageKey(tabName, key);
            if (!storageKey) return;

            try {
                localStorage.removeItem(storageKey);
                _log(`State cleared for tab '${tabName}', key '${key}'.`, 'info');
            } catch (error) {
                _log(`Error clearing state for tab '${tabName}', key '${key}':`, 'error', error);
            }
        },

        /**
         * Clears all persisted state for a specific tab.
         * Iterates through localStorage keys and removes those matching the tabName prefix.
         * @param {string} tabName - The name of the tab whose state should be cleared.
         */
        clearAllStateForTab: (tabName) => {
            if (!tabName) {
                _log('Tab name is required to clear all state for a tab.', 'error');
                return;
            }
            const prefix = `tab_${tabName}_`;
            let clearedCount = 0;
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        localStorage.removeItem(key);
                        clearedCount++;
                    }
                }
                if (clearedCount > 0) {
                    _log(`Cleared all ${clearedCount} state entries for tab '${tabName}'.`, 'info');
                } else {
                    _log(`No state found to clear for tab '${tabName}'.`, 'info');
                }
            } catch (error) {
                _log(`Error clearing all state for tab '${tabName}':`, 'error', error);
            }
        },

        /**
         * Clears all tab-related state managed by StateManager from localStorage.
         * Iterates through localStorage keys and removes those matching the `tab_` prefix.
         */
        clearAllManagedState: () => {
            const prefix = 'tab_';
            let clearedCount = 0;
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const storageKey = localStorage.key(i);
                    // Clear tab-specific keys and also the last active tab key
                    if (storageKey && (storageKey.startsWith(prefix) || storageKey === LAST_ACTIVE_TAB_KEY)) {
                        localStorage.removeItem(storageKey);
                        clearedCount++;
                    }
                }
                if (clearedCount > 0) {
                    _log(`Cleared all ${clearedCount} managed tab state entries from localStorage.`, 'info');
                } else {
                    _log('No managed tab state found in localStorage to clear.', 'info');
                }
            } catch (error) {
                _log('Error clearing all managed tab state:', 'error', error);
            }
        },

        /**
         * Saves the name of the last active tab.
         * This is a global StateManager property, not tied to a specific tab's own state.
         * @param {string} tabName - The name of the tab that was activated.
         */
        setLastActiveTab: (tabName) => {
            if (!tabName) {
                _log('Tab name is required to set the last active tab.', 'error');
                return;
            }
            try {
                localStorage.setItem(LAST_ACTIVE_TAB_KEY, tabName);
                _log(`Last active tab set to: ${tabName}`, 'info');
            } catch (error) {
                _log('Error saving last active tab:', 'error', error);
            }
        },

        /**
         * Retrieves the name of the last active tab.
         * @returns {string|null} The name of the last active tab, or null if not set or error.
         */
        getLastActiveTab: () => {
            try {
                const tabName = localStorage.getItem(LAST_ACTIVE_TAB_KEY);
                if (tabName) {
                    _log(`Retrieved last active tab: ${tabName}`, 'info');
                    return tabName;
                }
                _log('No last active tab found in storage.', 'info');
                return null;
            } catch (error) {
                _log('Error retrieving last active tab:', 'error', error);
                return null;
            }
        }
    };
})();

// Example Usage:
/*
// To save state for a tab called 'userProfile' and a key 'username'
// StateManager.saveState('userProfile', 'username', 'JohnDoe');

// To retrieve the saved username for 'userProfile'
// const username = StateManager.retrieveState('userProfile', 'username');
// if (username) {
//     console.log('Retrieved username:', username);
// }

// To clear just the username state for 'userProfile'
// StateManager.clearState('userProfile', 'username');

// To clear all persisted data for the 'userProfile' tab
// StateManager.clearAllStateForTab('userProfile');

// To clear all data managed by StateManager across all tabs
// StateManager.clearAllManagedState();
*/ 