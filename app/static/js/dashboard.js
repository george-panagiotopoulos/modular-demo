document.addEventListener('DOMContentLoaded', () => {
    const tabContentArea = document.getElementById('tab-content-area');
    let currentTab = null;
    let currentTabCSS = null;
    let currentTabJS = null;

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
                window.cleanupCurrentTab();
                console.log(`Executed cleanup for tab: ${currentTab}`);
            } catch (e) {
                console.error(`Error during cleanup for tab ${currentTab}:`, e);
            }
             // Remove the cleanup function itself from global scope
             try { delete window.cleanupCurrentTab; } catch (e) { window.cleanupCurrentTab = undefined; }
        }

        if (currentTabJS) {
            currentTabJS.remove();
            currentTabJS = null;
            console.log(`Removed JS for tab: ${currentTab}`);
        }

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

            // Update active tab styling
            updateActiveTab(tabName);

        } catch (error) {
            console.error('Error loading tab content:', error);
            tabContentArea.innerHTML = `<p style="color: red;">Error loading content for ${tabName}.</p>`;
        }
    }

    // Function to update active tab styling
    function updateActiveTab(activeTabName) {
        const tabLinks = document.querySelectorAll('nav a.tab-link');
        tabLinks.forEach(link => {
            link.classList.remove('border-indigo-500', 'text-indigo-600');
            link.classList.add('border-transparent', 'text-gray-500');
        });
        
        // Find and activate the current tab
        tabLinks.forEach(link => {
            const onclick = link.getAttribute('onclick');
            if (onclick && onclick.includes(`'${activeTabName}'`)) {
                link.classList.remove('border-transparent', 'text-gray-500');
                link.classList.add('border-indigo-500', 'text-indigo-600');
            }
        });
    }

    // Make loadTab function globally available for onclick handlers
    window.loadTab = loadTab;

    // Load the initial tab (mobile by default)
    loadTab('mobile');
}); 