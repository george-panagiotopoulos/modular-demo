(function() {
    // Architecture Tab specific JavaScript
    console.log("architecture_app.js loaded and executing");

    // --- Diagram Loading --- 
    function loadArchitectureDiagram() {
        const diagramContainer = document.getElementById('architecture-diagram');
        if (!diagramContainer) {
            console.error("Architecture diagram container not found.");
            return;
        }

        diagramContainer.innerHTML = '<p>Loading architecture diagram...</p>'; // Show loading message
        console.log("Fetching architecture diagram path...");

        fetch(`/api/architecture/diagram_path?_=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json(); // Expecting JSON like {"diagram_url": "/static/images/....png"}
            })
            .then(data => {
                if (data.diagram_url) {
                    console.log("Diagram path received:", data.diagram_url);
                    // Create and append the image tag
                    const img = document.createElement('img');
                    img.src = data.diagram_url;
                    img.alt = "Architecture Diagram";
                    // Apply styling via CSS (architecture_app.css) instead of inline
                    // img.style.maxWidth = "90%";
                    // img.style.height = "auto";
                    diagramContainer.innerHTML = ''; // Clear loading message
                    diagramContainer.appendChild(img);
                } else {
                    throw new Error(data.error || "Diagram URL not found in response.");
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

    // --- Initialization ---
    function initArchitectureTab() {
        console.log("Initializing Architecture Tab...");
        loadArchitectureDiagram();
    }

    // --- Global Cleanup Function --- 
    window.cleanupCurrentTab = function() {
        console.log("Running cleanup for Architecture Tab...");
        // No specific listeners or intervals to clear in this simple version
    };

    // --- Initial Execution ---
    initArchitectureTab();

})(); // End of IIFE

// Optional: Cleanup function
// function cleanupArchitectureTab() { ... }
// window.tabCleanupFunctions = window.tabCleanupFunctions || {};
// window.tabCleanupFunctions.architecture = cleanupArchitectureTab; 