/**
 * JOLT Service
 * Handles API calls for JOLT transformations
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

/**
 * Fetch all transformations
 * @returns {Promise<Array>} Array of transformations
 */
export const fetchTransformations = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/transformations`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching transformations:', error);
    throw error;
  }
};

/**
 * Save a transformation
 * @param {Object} transformation - The transformation to save
 * @returns {Promise<Object>} Saved transformation
 */
export const saveTransformation = async (transformation) => {
  try {
    const response = await fetch(`${API_BASE_URL}/transformations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transformation)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error saving transformation:', error);
    throw error;
  }
};

/**
 * Delete a transformation
 * @param {string} id - The ID of the transformation to delete
 * @returns {Promise<void>}
 */
export const deleteTransformation = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/transformations/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting transformation:', error);
    throw error;
  }
};

/**
 * Update a transformation
 * @param {string} id - The ID of the transformation to update
 * @param {Object} transformation - The updated transformation data
 * @returns {Promise<Object>} Updated transformation
 */
export const updateTransformation = async (id, transformation) => {
  try {
    const response = await fetch(`${API_BASE_URL}/transformations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transformation)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating transformation:', error);
    throw error;
  }
};

/**
 * Execute a JOLT transformation
 * @param {Object} spec - The JOLT specification
 * @param {Object} input - The input data to transform
 * @returns {Promise<Object>} Transformed data
 */
export const executeTransformation = async (spec, input) => {
  try {
    const response = await fetch(`${API_BASE_URL}/transformations/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spec, input })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error executing transformation:', error);
    throw error;
  }
}; 