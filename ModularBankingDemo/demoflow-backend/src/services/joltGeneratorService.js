/**
 * JOLT Generator Service
 * Handles JOLT specification generation using Azure OpenAI
 */

/**
 * Validates if the provided string is valid JSON
 * @param {string} jsonString - The JSON string to validate
 * @throws {Error} If JSON is invalid or empty
 */
const validateJSON = (jsonString) => {
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
 * Calls Azure OpenAI API to generate JOLT specification
 * @param {string} inputJSON - The input JSON structure
 * @param {string} outputJSON - The desired output JSON structure
 * @param {string} instructions - Additional instructions for the LLM
 * @returns {Promise<string>} The generated JOLT specification
 */
const callLLM = async (inputJSON, outputJSON, instructions = '') => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';

  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI credentials are not configured. Please check your environment variables.');
  }

  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;

  const systemPrompt = `You are a JOLT transformation expert. Your task is to generate a JOLT specification that transforms the given input JSON structure to the desired output JSON structure.

JOLT (JSON to JSON transformation library) uses operations like:
- "shift": Move and rename fields
- "default": Set default values
- "remove": Remove fields
- "sort": Sort arrays
- "cardinality": Modify array structures

Please provide ONLY the JOLT specification as a valid JSON array. Do not include explanations or additional text.

Example JOLT specification format:
[
  {
    "operation": "shift",
    "spec": {
      "sourceField": "destinationField"
    }
  }
]`;

  const userPrompt = `Generate a JOLT specification to transform this input JSON:
${inputJSON}

Into this output JSON:
${outputJSON}

${instructions ? `Additional instructions: ${instructions}` : ''}

Provide only the JOLT specification as valid JSON.`;

  const requestBody = {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.1,
    stream: false
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Azure OpenAI API');
    }

    const joltSpec = data.choices[0].message.content.trim();
    
    // Validate that the response is valid JSON
    try {
      JSON.parse(joltSpec);
      return joltSpec;
    } catch (parseError) {
      throw new Error('Generated JOLT specification is not valid JSON');
    }

  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to Azure OpenAI API. Please check your internet connection.');
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
const generateJOLT = async (inputJSON, outputJSON, instructions = '') => {
  // Validate both JSON inputs
  validateJSON(inputJSON);
  validateJSON(outputJSON);

  try {
    // Call LLM to generate JOLT specification
    const joltSpec = await callLLM(inputJSON, outputJSON, instructions);
    return joltSpec;
  } catch (error) {
    throw new Error(`Failed to generate JOLT specification: ${error.message}`);
  }
};

/**
 * Debug function to check environment variables
 */
const debugEnvironmentVariables = () => {
  console.log('Backend Environment Variables Debug:');
  console.log('AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT ? 'Set' : 'Not Set');
  console.log('AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? 'Set' : 'Not Set');
  console.log('AZURE_OPENAI_DEPLOYMENT:', process.env.AZURE_OPENAI_DEPLOYMENT || 'Not Set');
};

module.exports = {
  generateJOLT,
  validateJSON,
  debugEnvironmentVariables
}; 