document.addEventListener('DOMContentLoaded', () => {
    const tabLinks = document.querySelectorAll('nav ul li a.tab-link');
    const tabContentArea = document.getElementById('tab-content-area');
    let currentTab = null;
    let currentTabCSS = null;
    let currentTabJS = null;

    // --- Simple Event Bus ---
    // REMOVED - Switched to history fetch model
    // const eventBus = new EventTarget();
    // function publishEvent(eventName, detail) { ... }
    // function subscribeToEvent(eventName, handler) { ... }
    // window.publishAppEvent = publishEvent;
    // window.subscribeToEvent = subscribeToEvent;
    // -----------------------

    // Function to load tab content and assets
    async function loadTab(tabName) {
        if (currentTab === tabName) return; // Do nothing if already active

        console.log(`Loading tab: ${tabName}`);
        tabContentArea.innerHTML = '<p>Loading...</p>'; // Show loading indicator

        // --- Asset Management --- 
        // Remove previous tab's assets
        if (currentTabCSS) {
            currentTabCSS.remove();
            currentTabCSS = null;
            console.log(`Removed CSS for tab: ${currentTab}`);
        }

        // *** Call cleanup function before removing JS ***
        if (typeof window.cleanupCurrentTab === 'function') {
            try {
                // Pass the unsubscribe function if needed, or manage globally
                window.cleanupCurrentTab();
                console.log(`Executed cleanup for tab: ${currentTab}`);
            } catch (e) {
                console.error(`Error during cleanup for tab ${currentTab}:`, e);
            }
             // Remove the cleanup function itself from global scope
             // Use delete or set to undefined based on how it was defined
             try { delete window.cleanupCurrentTab; } catch (e) { window.cleanupCurrentTab = undefined; }
        }

        if (currentTabJS) {
            // Potentially call a cleanup function from the old script if needed
            // e.g., if (window.cleanupMyTab) window.cleanupMyTab();
            currentTabJS.remove();
            currentTabJS = null;
            console.log(`Removed JS for tab: ${currentTab}`);
        }
        // Clear any potential global variables or interval timers set by the previous script
        // (This requires careful design in the tab-specific JS)

        currentTab = tabName;

        // Load new tab's CSS
        const cssLink = document.createElement('link');
        cssLink.id = `tab-css-${tabName}`;
        cssLink.rel = 'stylesheet';
        cssLink.href = `/static/css/${tabName.replace('-', '_')}_app.css`; // Assuming pattern like mobile_app.css
        document.head.appendChild(cssLink);
        currentTabCSS = cssLink;
        console.log(`Loaded CSS for tab: ${tabName}`);

        // --- Content Loading --- 
        try {
            const response = await fetch(`/tab/${tabName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            tabContentArea.innerHTML = html;
            console.log(`Loaded HTML content for tab: ${tabName}`);

            // --- Load new tab's JS --- 
            // Load JS *after* content is in the DOM
            const jsScript = document.createElement('script');
            jsScript.id = `tab-js-${tabName}`;
            jsScript.src = `/static/js/${tabName.replace('-', '_')}_app.js`; // Assuming pattern like mobile_app.js
            jsScript.async = false; // Ensure it loads and executes in order if needed
            document.body.appendChild(jsScript); // Append to body to ensure DOM is ready
            currentTabJS = jsScript;
            console.log(`Loaded JS for tab: ${tabName}`);
            
            // Special handling for headless tab
            if (tabName === 'headless') {
                // Wait a moment for the script to load and execute
                setTimeout(() => {
                    if (typeof window.reloadHeadlessData === 'function') {
                        console.log("Refreshing headless data for tab");
                        window.reloadHeadlessData();
                    }
                }, 500);
            }

            // Optionally, call an init function if defined by the tab's script
            // Pass the publisher function to the init function if needed
            // e.g., if (window.initCurrentTab) window.initCurrentTab(publishEvent);

        } catch (error) {
            console.error('Error loading tab content:', error);
            tabContentArea.innerHTML = `<p style="color: red;">Error loading content for ${tabName}.</p>`;
        }
    }

    // Event Listeners for Tab Links
    tabLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const tabName = link.getAttribute('data-tab');

            // Update active class on links
            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Load the selected tab
            loadTab(tabName);
        });
    });

    // Load the initial active tab (e.g., the first one)
    const initialTab = document.querySelector('nav ul li a.tab-link.active');
    if (initialTab) {
        loadTab(initialTab.getAttribute('data-tab'));
    }
}); 