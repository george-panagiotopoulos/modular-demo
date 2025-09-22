/**
 * JOLT Generator Utility Functions
 * Provides JSON validation and JOLT specification generation via backend API
 * NO Azure AI credentials in frontend - all AI processing is done in backend
 */

/**
 * Validates if the provided string is valid JSON
 * @param {string} jsonString - The JSON string to validate
 * @throws {Error} If JSON is invalid or empty
 */
export const validateJSON = (jsonString) => {
  if (!jsonString || jsonString.trim() === '') {
    throw new Error('JSON input cannot be empty');
  }

  try {
    JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
};

/**
 * Calls backend API to generate JOLT specification
 * @param {string} inputJSON - The input JSON structure
 * @param {string} outputJSON - The desired output JSON structure
 * @param {string} instructions - Additional instructions for the LLM
 * @returns {Promise<string>} The generated JOLT specification
 */
export const callLLM = async (inputJSON, outputJSON, instructions = '') => {
  const backendUrl = 'http://localhost:5011';
  const url = `${backendUrl}/api/jolt/generate`;

  const requestBody = {
    inputJSON,
    outputJSON,
    instructions
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Backend API error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.joltSpecification) {
      throw new Error('Invalid response format from backend API');
    }

    return data.joltSpecification;

  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to backend API. Please check your connection.');
    }
    throw error;
  }
};

/**
 * Generates JOLT specification from input and output JSON
 * @param {string} inputJSON - The input JSON structure
 * @param {string} outputJSON - The desired output JSON structure
 * @param {string} instructions - Additional instructions for generation
 * @returns {Promise<string>} The generated JOLT specification
 */
export const generateJOLT = async (inputJSON, outputJSON, instructions = '') => {
  // Validate both JSON inputs
  validateJSON(inputJSON);
  validateJSON(outputJSON);

  try {
    // Call backend API to generate JOLT specification
    const joltSpec = await callLLM(inputJSON, outputJSON, instructions);
    return joltSpec;
  } catch (error) {
    throw new Error(`Failed to generate JOLT specification: ${error.message}`);
  }
};

/**
 * Streaming version - calls backend API (non-streaming for now)
 * @param {string} inputJSON - The input JSON structure
 * @param {string} outputJSON - The desired output JSON structure
 * @param {string} instructions - Additional instructions for the LLM
 * @param {Function} onChunk - Callback function for each chunk of data
 * @returns {Promise<string>} The complete generated JOLT specification
 */
export const callLLMStreaming = async (inputJSON, outputJSON, instructions = '', onChunk) => {
  // For now, use the non-streaming version
  const result = await callLLM(inputJSON, outputJSON, instructions);
  
  // Simulate streaming by calling onChunk with the full result
  if (onChunk) {
    onChunk(result);
  }
  
  return result;
};

// Debug function to check backend connection
export const debugEnvironmentVariables = () => {
  console.log('Frontend Debug: Testing backend connection...');
  
  // Test backend connection
  fetch('http://localhost:5011/api/jolt/debug')
    .then(response => response.json())
    .then(data => {
      console.log('Backend connection test:', data);
    })
    .catch(error => {
      console.error('Backend connection failed:', error);
    });
}; 