import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTransformations, saveTransformation, deleteTransformation } from '../../services/joltService';
import { generateJOLT, validateJSON, callLLMStreaming, debugEnvironmentVariables } from '../../utils/joltGenerator';
import './JoltMapper.css';

const JOLT_API_URL = 'http://localhost:8081/transform';

const JoltMapper = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [simpleJoltSpec, setSimpleJoltSpec] = useState('');
  const [complexJoltSpec, setComplexJoltSpec] = useState('');
  const [sampleData, setSampleData] = useState({
    simple: { input: {}, joltSpec: [], output: {} },
    medium: { input: {}, joltSpec: [], output: {} }
  });
  const [loading, setLoading] = useState(true);
  const [simpleOutput, setSimpleOutput] = useState('');
  const [complexOutput, setComplexOutput] = useState('');
  
  // JOLT Spec Generator state
  const [generatorInputJson, setGeneratorInputJson] = useState('');
  const [generatorOutputJson, setGeneratorOutputJson] = useState('');
  const [generatedJoltSpec, setGeneratedJoltSpec] = useState('');
  const [generatorErrors, setGeneratorErrors] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorInstructions, setGeneratorInstructions] = useState('');
  const [streamingOutput, setStreamingOutput] = useState('');
  
  const navigate = useNavigate();

  // Fetch and set sample data
  useEffect(() => {
    const loadSampleData = async () => {
      try {
        const simpleInput = await fetch('/joltsamples/simple-input.json');
        const simpleJoltSpec = await fetch('/joltsamples/simple-jolt-spec.json');
        const simpleOutput = await fetch('/joltsamples/simple-output.json');
        const mediumInput = await fetch('/joltsamples/medium-input.json');
        const mediumJoltSpec = await fetch('/joltsamples/medium-jolt-spec.json');
        const mediumOutput = await fetch('/joltsamples/medium-output.json');
        
        const simpleInputData = await simpleInput.json();
        const simpleJoltSpecData = await simpleJoltSpec.json();
        const simpleOutputData = await simpleOutput.json();
        const mediumInputData = await mediumInput.json();
        const mediumJoltSpecData = await mediumJoltSpec.json();
        const mediumOutputData = await mediumOutput.json();
        
        setSampleData({
          simple: {
            input: simpleInputData,
            joltSpec: simpleJoltSpecData,
            output: simpleOutputData
          },
          medium: {
            input: mediumInputData,
            joltSpec: mediumJoltSpecData,
            output: mediumOutputData
          }
        });
        
        setSimpleJoltSpec(JSON.stringify(simpleJoltSpecData, null, 2));
        setComplexJoltSpec(JSON.stringify(mediumJoltSpecData, null, 2));
        setLoading(false);
      } catch (error) {
        console.error('Error loading sample data:', error);
        setLoading(false);
      }
    };
    loadSampleData();
  }, []);

  // Call Java JOLT service for simple transformation
  const runSimpleTransformation = async (input, spec) => {
    try {
      const response = await fetch(JOLT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, spec: JSON.parse(spec) })
      });
      if (!response.ok) throw new Error('JOLT service error');
      const data = await response.json();
      setSimpleOutput(JSON.stringify(data, null, 2));
    } catch (error) {
      setSimpleOutput('Error: ' + error.message);
    }
  };

  // Call Java JOLT service for complex transformation
  const runComplexTransformation = async (input, spec) => {
    try {
      const response = await fetch(JOLT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, spec: JSON.parse(spec) })
      });
      if (!response.ok) throw new Error('JOLT service error');
      const data = await response.json();
      setComplexOutput(JSON.stringify(data, null, 2));
    } catch (error) {
      setComplexOutput('Error: ' + error.message);
    }
  };

  // Validate JSON input for generator
  const validateJsonInput = (jsonString, fieldName) => {
    try {
      validateJSON(jsonString);
      setGeneratorErrors(prev => ({ ...prev, [fieldName]: '' }));
      return true;
    } catch (error) {
      setGeneratorErrors(prev => ({ ...prev, [fieldName]: error.message }));
      return false;
    }
  };

  // Generate JOLT specification using LLM
  const generateJoltSpecification = async () => {
    // Clear previous errors and results
    setGeneratorErrors({});
    setGeneratedJoltSpec('');
    setStreamingOutput('');

    // Validate inputs
    const inputValid = validateJsonInput(generatorInputJson, 'input');
    const outputValid = validateJsonInput(generatorOutputJson, 'output');

    if (!inputValid || !outputValid) {
      return;
    }

    setIsGenerating(true);

    try {
      // Use streaming for better user experience
      const joltSpec = await callLLMStreaming(
        generatorInputJson,
        generatorOutputJson,
        generatorInstructions,
        (chunk) => {
          setStreamingOutput(prev => prev + chunk);
        }
      );

      setGeneratedJoltSpec(joltSpec);
      setStreamingOutput('');
    } catch (error) {
      setGeneratorErrors({ general: error.message });
      setStreamingOutput('');
    } finally {
      setIsGenerating(false);
    }
  };

  // Run transformation when spec or input changes
  useEffect(() => {
    if (!loading && sampleData.simple.input && Object.keys(sampleData.simple.input).length > 0) {
      runSimpleTransformation(sampleData.simple.input, simpleJoltSpec);
    }
  }, [simpleJoltSpec, loading, sampleData.simple.input]);

  useEffect(() => {
    if (!loading && sampleData.medium.input && Object.keys(sampleData.medium.input).length > 0) {
      runComplexTransformation(sampleData.medium.input, complexJoltSpec);
    }
  }, [complexJoltSpec, loading, sampleData.medium.input]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      navigate('/additional-demos');
    }
  };

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleTabChange = (tab) => {
    setActiveSection(tab);
    if (tab === 'generator') {
      debugEnvironmentVariables(); // Debug environment variables
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="jolt-mapper-overview">
            <div className="jolt-mapper-header">
              <h2>JOLT Mapper</h2>
              <p>Data transformation and mapping utility for modular banking architecture</p>
            </div>
            
            <div className="jolt-mapper-features">
              <div className="jolt-feature-card">
                <div className="jolt-feature-icon">🔄</div>
                <h3>Data Transformation</h3>
                <p>Transform data between different formats and structures using JOLT specifications</p>
              </div>
              
              <div className="jolt-feature-card">
                <div className="jolt-feature-icon">📊</div>
                <h3>Schema Mapping</h3>
                <p>Map between different data schemas and formats with powerful JOLT operations</p>
              </div>
              
              <div className="jolt-feature-card">
                <div className="jolt-feature-icon">⚡</div>
                <h3>Real-time Processing</h3>
                <p>Process data transformations in real-time with high performance</p>
              </div>

              <div className="jolt-feature-card config-link">
                <div className="jolt-feature-icon">⚙️</div>
                <h3>Generic Configuration</h3>
                <p>JOLT transformation specifications are stored and managed in the Generic Configuration microservice</p>
                <button 
                  className="config-link-button"
                  onClick={() => navigate('/supporting-services')}
                >
                  View Generic Configuration
                </button>
              </div>
            </div>
          </div>
        );
      
      case 'generator':
        return (
          <div className="jolt-spec-generator-section">
            <div className="jolt-generator-header">
              <h3>JOLT Spec Generator</h3>
              <p>Generate JOLT specifications using AI by providing input and desired output JSON structures.</p>
            </div>

            {generatorErrors.general && (
              <div className="jolt-error-message">
                {generatorErrors.general}
              </div>
            )}

            <div className="jolt-generator-grid">
              <div className="jolt-generator-panel">
                <h4>Input JSON Structure</h4>
                <textarea
                  className={`jolt-json-input ${generatorErrors.input ? 'error' : ''}`}
                  value={generatorInputJson}
                  onChange={(e) => setGeneratorInputJson(e.target.value)}
                  placeholder="Enter your input JSON structure here..."
                  rows={12}
                />
                {generatorErrors.input && (
                  <div className="jolt-field-error">{generatorErrors.input}</div>
                )}
              </div>

              <div className="jolt-generator-panel">
                <h4>Desired Output JSON Structure</h4>
                <textarea
                  className={`jolt-json-input ${generatorErrors.output ? 'error' : ''}`}
                  value={generatorOutputJson}
                  onChange={(e) => setGeneratorOutputJson(e.target.value)}
                  placeholder="Enter your desired output JSON structure here..."
                  rows={12}
                />
                {generatorErrors.output && (
                  <div className="jolt-field-error">{generatorErrors.output}</div>
                )}
              </div>
            </div>

            <div className="jolt-generator-panel">
              <h4>Additional Instructions (Optional)</h4>
              <textarea
                className="jolt-json-input"
                value={generatorInstructions}
                onChange={(e) => setGeneratorInstructions(e.target.value)}
                placeholder="Enter any additional instructions or requirements for the JOLT transformation..."
                rows={3}
              />
            </div>

            <div className="jolt-generator-actions">
              <button
                className={`jolt-generate-button ${isGenerating ? 'generating' : ''}`}
                onClick={generateJoltSpecification}
                disabled={isGenerating || !generatorInputJson.trim() || !generatorOutputJson.trim()}
              >
                {isGenerating ? 'Generating...' : 'Generate JOLT Specification'}
              </button>
            </div>

            {(streamingOutput || generatedJoltSpec) && (
              <div className="jolt-generator-panel">
                <h4>Generated JOLT Specification</h4>
                <div className="jolt-spec-output">
                  <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {streamingOutput || generatedJoltSpec}
                  </pre>
                </div>
                {generatedJoltSpec && (
                  <div className="jolt-generator-actions">
                    <button
                      className="jolt-copy-button"
                      onClick={async (event) => {
                        try {
                          await navigator.clipboard.writeText(generatedJoltSpec);
                          // Show success feedback
                          const button = event.target;
                          const originalText = button.textContent;
                          button.textContent = 'Copied!';
                          button.style.backgroundColor = '#28a745';
                          setTimeout(() => {
                            button.textContent = originalText;
                            button.style.backgroundColor = '';
                          }, 2000);
                        } catch (error) {
                          console.error('Failed to copy to clipboard:', error);
                          // Fallback for older browsers
                          const textArea = document.createElement('textarea');
                          textArea.value = generatedJoltSpec;
                          document.body.appendChild(textArea);
                          textArea.select();
                          try {
                            document.execCommand('copy');
                            const button = event.target;
                            const originalText = button.textContent;
                            button.textContent = 'Copied!';
                            button.style.backgroundColor = '#28a745';
                            setTimeout(() => {
                              button.textContent = originalText;
                              button.style.backgroundColor = '';
                            }, 2000);
                          } catch (fallbackError) {
                            console.error('Fallback copy failed:', fallbackError);
                            alert('Failed to copy to clipboard. Please select and copy the text manually.');
                          }
                          document.body.removeChild(textArea);
                        }
                      }}
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="jolt-generator-help">
              <h4>How to use:</h4>
              <ol>
                <li>Paste your input JSON structure in the first textarea</li>
                <li>Paste your desired output JSON structure in the second textarea</li>
                <li>Optionally, add specific instructions or requirements</li>
                <li>Click "Generate JOLT Specification" to create the transformation</li>
                <li>Copy the generated specification and use it in your JOLT transformations</li>
              </ol>
            </div>
          </div>
        );
      
      case 'transformer':
        if (loading) {
          return (
            <div className="jolt-transformer-section">
              <h3>Loading Sample Data...</h3>
              <p>Please wait while we load the JOLT transformation examples.</p>
              
              <div className="jolt-examples">
                <div className="jolt-example">
                  <h4>Simple Transformation</h4>
                  <p>Basic field mapping and restructuring</p>
                  
                  <div className="jolt-example-grid">
                    <div className="jolt-panel">
                      <h5>Input JSON</h5>
                      <div className="json-display">
                        Loading...
                      </div>
                    </div>
                    
                    <div className="jolt-panel">
                      <h5>JOLT Specification</h5>
                      <textarea
                        className="jolt-spec-editor"
                        value="Loading..."
                        readOnly
                        placeholder="Loading JOLT specification..."
                      />
                    </div>
                    
                    <div className="jolt-panel">
                      <h5>Output JSON</h5>
                      <div className="json-display">
                        Loading...
                      </div>
                    </div>
                  </div>
                </div>

                <div className="jolt-example complex-example">
                  <h4>Complex Banking Transformation</h4>
                  <p>Advanced transformation with nested structures and banking data</p>
                  
                  <div className="jolt-example-grid">
                    <div className="jolt-panel">
                      <h5>Input JSON</h5>
                      <div className="json-display">
                        Loading...
                      </div>
                    </div>
                    
                    <div className="jolt-panel">
                      <h5>JOLT Specification</h5>
                      <textarea
                        className="jolt-spec-editor"
                        value="Loading..."
                        readOnly
                        placeholder="Loading JOLT specification..."
                      />
                    </div>
                    
                    <div className="jolt-panel">
                      <h5>Output JSON</h5>
                      <div className="json-display">
                        Loading...
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        return (
          <div className="jolt-transformer-section">
            <h3>Interactive JOLT Transformer</h3>
            <p>Edit JOLT specifications and see real-time transformations using real sample data</p>
            
            <div className="jolt-examples">
              <div className="jolt-example">
                <h4>Simple Transformation</h4>
                <p>Basic field mapping and restructuring - Users to User Array</p>
                
                <div className="jolt-example-grid">
                  <div className="jolt-panel">
                    <h5>Input JSON</h5>
                    <div className="json-display">
                      {JSON.stringify(sampleData.simple.input, null, 2)}
                    </div>
                  </div>
                  
                  <div className="jolt-panel">
                    <h5>JOLT Specification</h5>
                    <textarea
                      className="jolt-spec-editor"
                      value={simpleJoltSpec}
                      onChange={(e) => setSimpleJoltSpec(e.target.value)}
                      placeholder="Enter JOLT specification..."
                    />
                  </div>
                  
                  <div className="jolt-panel">
                    <h5>Output JSON</h5>
                    <div className="json-display">
                      {simpleOutput}
                    </div>
                  </div>
                </div>
              </div>

              <div className="jolt-example complex-example">
                <h4>Complex Banking Transformation</h4>
                <p>Advanced transformation with nested structures and banking data</p>
                
                <div className="jolt-example-grid">
                  <div className="jolt-panel">
                    <h5>Input JSON</h5>
                    <div className="json-display">
                      {JSON.stringify(sampleData.medium.input, null, 2)}
                    </div>
                  </div>
                  
                  <div className="jolt-panel">
                    <h5>JOLT Specification</h5>
                    <textarea
                      className="jolt-spec-editor"
                      value={complexJoltSpec}
                      onChange={(e) => setComplexJoltSpec(e.target.value)}
                      placeholder="Enter JOLT specification..."
                    />
                  </div>
                  
                  <div className="jolt-panel">
                    <h5>Output JSON</h5>
                    <div className="json-display">
                      {complexOutput}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'reference':
        return (
          <div className="jolt-documentation">
            <h3>JOLT Reference Documentation</h3>
            <p>Comprehensive guide to JOLT transformation operations and syntax</p>
            
            <div className="jolt-doc-section">
              <h4>Core Operations</h4>
              
              <div className="jolt-operation">
                <h5>shift</h5>
                <p>Moves data from the input tree and places it in the output tree</p>
              </div>
              
              <div className="jolt-operation">
                <h5>default</h5>
                <p>Applies default values when data is missing from the input</p>
              </div>
              
              <div className="jolt-operation">
                <h5>remove</h5>
                <p>Removes data from the input tree</p>
              </div>
              
              <div className="jolt-operation">
                <h5>sort</h5>
                <p>Sorts any arrays present in the input JSON</p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="jolt-mapper-container">
      <div className="jolt-mapper-sidebar">
        <button 
          className={`jolt-nav-button ${activeSection === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
        >
          <span className="jolt-nav-icon">🏠</span>
          Overview
        </button>
        
        <button 
          className={`jolt-nav-button ${activeSection === 'transformer' ? 'active' : ''}`}
          onClick={() => handleTabChange('transformer')}
        >
          <span className="jolt-nav-icon">🔄</span>
          Transformer
        </button>

        <button 
          className={`jolt-nav-button ${activeSection === 'generator' ? 'active' : ''}`}
          onClick={() => handleTabChange('generator')}
        >
          <span className="jolt-nav-icon">🧠</span>
          JOLT Spec Generator
        </button>
        
        <button 
          className={`jolt-nav-button ${activeSection === 'reference' ? 'active' : ''}`}
          onClick={() => handleTabChange('reference')}
        >
          <span className="jolt-nav-icon">📊</span>
          Reference
        </button>
      </div>
      
      <div className="jolt-mapper-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default JoltMapper; 