/**
 * JOLT Generation Routes
 * API endpoints for JOLT specification generation
 */

const express = require('express');
const router = express.Router();
const { generateJOLT, debugEnvironmentVariables } = require('../services/joltGeneratorService');

/**
 * POST /api/jolt/generate
 * Generate JOLT specification from input and output JSON
 */
router.post('/generate', async (req, res) => {
  try {
    const { inputJSON, outputJSON, instructions } = req.body;

    // Validate required fields
    if (!inputJSON || !outputJSON) {
      return res.status(400).json({
        success: false,
        error: 'Both inputJSON and outputJSON are required'
      });
    }

    // Generate JOLT specification
    const joltSpec = await generateJOLT(inputJSON, outputJSON, instructions || '');

    res.json({
      success: true,
      joltSpecification: joltSpec
    });

  } catch (error) {
    console.error('JOLT generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/jolt/debug
 * Debug endpoint to check environment variables
 */
router.get('/debug', (req, res) => {
  debugEnvironmentVariables();
  res.json({
    success: true,
    message: 'Environment variables debug info logged to console'
  });
});

/**
 * POST /api/jolt/validate
 * Validate JSON input
 */
router.post('/validate', (req, res) => {
  try {
    const { jsonString } = req.body;

    if (!jsonString) {
      return res.status(400).json({
        success: false,
        error: 'jsonString is required'
      });
    }

    // Validate JSON
    const { validateJSON } = require('../services/joltGeneratorService');
    validateJSON(jsonString);

    res.json({
      success: true,
      message: 'JSON is valid'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 