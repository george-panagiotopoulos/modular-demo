import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      
      case 'mapping':
        return (
          <div className="jolt-mapping-section">
            <h3>JOLT Operations Reference</h3>
            <p>Comprehensive guide to JOLT transformation operations</p>
            
            <div className="jolt-documentation">
              <div className="jolt-doc-section">
                <h4>Core JOLT Operations</h4>
                
                <div className="jolt-operation">
                  <h5>shift</h5>
                  <p>Moves data from one location to another in the JSON structure. This is the most commonly used operation.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "shift",</code>
                    <code>  "spec": {`{`}</code>
                    <code>    "oldField": "newField"</code>
                    <code>  {`}`}</code>
                    <code>{`}`}</code>
                    <p>Moves 'oldField' to 'newField' in the output</p>
                  </div>
                </div>

                <div className="jolt-operation">
                  <h5>default</h5>
                  <p>Sets default values for fields that don't exist in the input or are null/undefined.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "default",</code>
                    <code>  "spec": {`{`}</code>
                    <code>    "status": "ACTIVE",</code>
                    <code>    "createdDate": "2024-01-01"</code>
                    <code>  {`}`}</code>
                    <code>{`}`}</code>
                    <p>Sets default values for status and createdDate</p>
                  </div>
                </div>

                <div className="jolt-operation">
                  <h5>remove</h5>
                  <p>Removes specified fields from the JSON structure.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "remove",</code>
                    <code>  "spec": ["field1", "field2"]</code>
                    <code>{`}`}</code>
                    <p>Removes field1 and field2 from the output</p>
                  </div>
                </div>

                <div className="jolt-operation">
                  <h5>sort</h5>
                  <p>Sorts arrays in the JSON structure based on specified criteria.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "sort",</code>
                    <code>  "spec": {`{`}</code>
                    <code>    "transactions": "date"</code>
                    <code>  {`}`}</code>
                    <code>{`}`}</code>
                    <p>Sorts transactions array by date field</p>
                  </div>
                </div>

                <div className="jolt-operation">
                  <h5>cardinality</h5>
                  <p>Converts single values to arrays or arrays to single values.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "cardinality",</code>
                    <code>  "spec": {`{`}</code>
                    <code>    "singleField": "MANY",</code>
                    <code>    "arrayField": "ONE"</code>
                    <code>  {`}`}</code>
                    <code>{`}`}</code>
                    <p>Converts singleField to array, arrayField to single value</p>
                  </div>
                </div>

                <div className="jolt-operation">
                  <h5>modify</h5>
                  <p>Modifies values using various functions like toUpper, toLower, concat, etc.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "modify-overwrite-beta",</code>
                    <code>  "spec": {`{`}</code>
                    <code>    "name": "=toUpper"</code>
                    <code>  {`}`}</code>
                    <code>{`}`}</code>
                    <p>Converts name field to uppercase</p>
                  </div>
                </div>

                <div className="jolt-operation">
                  <h5>concat</h5>
                  <p>Concatenates multiple fields or values into a single string.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "modify-overwrite-beta",</code>
                    <code>  "spec": {`{`}</code>
                    <code>    "fullName": "=concat(@(1,firstName),' ',@(1,lastName))"</code>
                    <code>  {`}`}</code>
                    <code>{`}`}</code>
                    <p>Combines firstName and lastName with space</p>
                  </div>
                </div>

                <div className="jolt-operation">
                  <h5>conditional</h5>
                  <p>Applies transformations based on conditions using if-then-else logic.</p>
                  <div className="jolt-example-simple">
                    <code>{`{`}</code>
                    <code>  "operation": "shift",</code>
                    <code>  "spec": {`{`}</code>
                    <code>    "balance": {`{`}</code>
                    <code>      "$(balance,&lt;1000)": "lowBalance",</code>
                    <code>      "$(balance,&gt;=1000)": "highBalance"</code>
                    <code>    {`}`}</code>
                    <code>  {`}`}</code>
                    <code>{`}`}</code>
                    <p>Routes balance to different fields based on amount</p>
                  </div>
                </div>
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
          onClick={() => setActiveSection('overview')}
        >
          <span className="jolt-nav-icon">🏠</span>
          Overview
        </button>
        <button
          className={`jolt-nav-button ${activeSection === 'transformer' ? 'active' : ''}`}
          onClick={() => setActiveSection('transformer')}
        >
          <span className="jolt-nav-icon">🔄</span>
          Transformer
        </button>
        <button
          className={`jolt-nav-button ${activeSection === 'mapping' ? 'active' : ''}`}
          onClick={() => setActiveSection('mapping')}
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