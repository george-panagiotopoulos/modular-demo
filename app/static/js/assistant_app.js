(function() {
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

    // --- Global Cleanup Function --- 
    window.cleanupCurrentTab = function() {
        console.log("Running cleanup for Assistant Tab...");
        const queryButton = document.querySelector('#assistant-content button');
        if (queryButton && queryButtonListener) {
            queryButton.removeEventListener('click', queryButtonListener);
            queryButtonListener = null;
            console.log("Removed assistant query button listener.");
        }
    };

    // --- Initial Execution ---
    initAssistantTab();

})(); // End of IIFE 