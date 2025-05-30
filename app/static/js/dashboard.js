document.addEventListener('DOMContentLoaded', () => {
    const tabContentArea = document.getElementById('tab-content-area');
    let currentTabName = null; // Renamed for clarity, will store the name like 'headless-v3'
    let currentTabCSS = null;
    // let currentTabJS = null; // No longer needed as JS is included directly

    // Function to load tab content via HTMX-style fetch
    async function loadTab(tabName) {
        console.log(`Loading tab content for: ${tabName}`);
        
        // Deactivate current tab first
        if (window.TabManager) {
            console.log(`Deactivating current tab via TabManager`);
            TabManager.deactivateCurrentTab();
        }
        
        const tabContentArea = document.getElementById('tab-content-area');
        if (!tabContentArea) {
            console.error('Tab content area not found');
            return;
        }

        try {
            // Fetch the tab content
            const response = await fetch(`/tab/${tabName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            tabContentArea.innerHTML = html;
            console.log(`Loaded HTML content for tab: ${tabName}`);

            // Wait for the DOM to be ready before activating the tab
            // Use requestAnimationFrame to ensure the DOM is fully rendered
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    // Double requestAnimationFrame to ensure DOM is fully rendered
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });

            // Activate the new tab using TabManager
            // This should trigger onActivate for the newly loaded tab's JS
            if (window.TabManager) {
                console.log(`Activating tab: ${tabName} via TabManager`);
                TabManager.activateTab(tabName);
            }
            
            // Update active tab visual styling in the navigation
            updateActiveTabVisuals(tabName);

        } catch (error) {
            console.error(`Error loading tab content for ${tabName}:`, error);
            tabContentArea.innerHTML = `<p style="color: red;">Error loading content for ${tabName}.</p>`;
        }
    }

    // Function to update active tab styling in the navigation
    function updateActiveTabVisuals(activeTabName) {
        const tabLinks = document.querySelectorAll('nav a.tab-link');
        tabLinks.forEach(link => {
            link.classList.remove('border-indigo-500', 'text-indigo-600');
            link.classList.add('border-transparent', 'text-gray-500');
        });
        
        tabLinks.forEach(link => {
            // Extract tab name from onclick attribute more robustly
            const onclickAttr = link.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/loadTab\('([^']+)'\)/);
                if (match && match[1] === activeTabName) {
                    link.classList.remove('border-transparent', 'text-gray-500');
                    link.classList.add('border-indigo-500', 'text-indigo-600');
                }
            }
        });
    }

    // Make loadTab function globally available for onclick handlers
    window.loadTab = loadTab;

    // Initialize TabManager after all scripts are loaded and DOM is ready
    if (window.TabManager) {
        console.log("Initializing TabManager...");
        TabManager.init();
        // Optionally, load an initial tab. The previously used 'mobile' can be the default.
        // TabManager.init() will call onActivate for the default active tab if one is set during registration.
        // Or, explicitly load and activate a default tab here:
        const initialTab = 'mobile'; // Or your desired default tab
        console.log(`Loading initial tab: ${initialTab}`);
        loadTab(initialTab); 
    } else {
        console.error("TabManager is not defined. Ensure tab-manager.js is loaded correctly.");
    }
}); 