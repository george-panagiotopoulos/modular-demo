import React, { useState, useCallback, useRef, useEffect } from 'react';
import './APIViewer.css';
import apiConfig from '../config/apiConfig';

const APIViewer = () => {
  // State management
  const [selectedService, setSelectedService] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [uri, setUri] = useState('');
  const [payload, setPayload] = useState('{\n  \n}');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [responseStatus, setResponseStatus] = useState(null);
  
  // Configuration values with defaults from demooutput.txt
  const [partyId, setPartyId] = useState('2517636814');
  const [accountReference, setAccountReference] = useState('1013720122');
  const [loanArrangementId, setLoanArrangementId] = useState('AA25073BRT40');
  
  // Refs for form elements
  const uriInputRef = useRef(null);
  const payloadInputRef = useRef(null);

  // API endpoints configuration using apiConfig
  const apiEndpoints = {
    'party': {
      name: 'Party Management',
      description: 'Customer/Party Management APIs',
      endpoints: [
        {
          id: 'create_party',
          name: 'Create Party/Customer',
          method: 'POST',
          uri: apiConfig.buildUrl('party', 'create'),
          requiresPayload: true,
          description: 'Create a new customer/party in the system'
        },
        {
          id: 'get_party_by_id',
          name: 'Get Party by ID',
          method: 'GET',
          uri: apiConfig.buildUrl('party', 'getById', { partyId: '{partyId}' }),
          requiresPayload: false,
          description: 'Retrieve party details by party ID'
        },
        {
          id: 'get_party_by_dob',
          name: 'Get Party by Date of Birth',
          method: 'GET',
          uri: apiConfig.buildUrl('party', 'getByDateOfBirth', { dateOfBirth: '1991-12-29' }),
          requiresPayload: false,
          description: 'Search for parties by date of birth'
        },
        {
          id: 'get_party_by_lastname',
          name: 'Get Party by Last Name',
          method: 'GET',
          uri: apiConfig.buildUrl('party', 'getByLastName', { lastName: 'Wilson' }),
          requiresPayload: false,
          description: 'Search for parties by last name'
        },
        {
          id: 'get_party_by_phone',
          name: 'Get Party by Phone',
          method: 'GET',
          uri: apiConfig.buildUrl('party', 'getByPhone', { contactNumber: '3666496860' }),
          requiresPayload: false,
          description: 'Search for parties by phone number'
        },
        {
          id: 'get_party_by_email',
          name: 'Get Party by Email',
          method: 'GET',
          uri: apiConfig.buildUrl('party', 'getByEmail', { emailId: 'ian.wilson@gmail.com' }),
          requiresPayload: false,
          description: 'Search for parties by email address'
        }
      ]
    },
    'deposits': {
      name: 'Deposits',
      description: 'Account & Deposit Management APIs',
      endpoints: [
        {
          id: 'create_current_account',
          name: 'Create Current Account',
          method: 'POST',
          uri: apiConfig.buildUrl('deposits', 'createCurrentAccount'),
          requiresPayload: true,
          description: 'Create a new current account for a party'
        },
        {
          id: 'get_account_balance',
          name: 'Get Account Balance',
          method: 'GET',
          uri: apiConfig.buildUrl('deposits', 'getAccountBalance', { accountReference: '{accountReference}' }),
          requiresPayload: false,
          description: 'Get current account balance and details'
        },
        {
          id: 'get_party_arrangements',
          name: 'Get Party Arrangements',
          method: 'GET',
          uri: apiConfig.buildUrl('deposits', 'getPartyArrangements', { partyId: '{partyId}' }),
          requiresPayload: false,
          description: 'Get all arrangements (accounts/loans) for a party'
        },
        {
          id: 'create_term_deposit',
          name: 'Create Term Deposit',
          method: 'POST',
          uri: apiConfig.buildUrl('deposits', 'createTermDeposit'),
          requiresPayload: true,
          description: 'Create a term deposit account'
        },
        {
          id: 'debit_account',
          name: 'Debit Account Transaction',
          method: 'POST',
          uri: apiConfig.buildUrl('deposits', 'debitAccount'),
          requiresPayload: true,
          description: 'Perform a debit transaction on an account'
        },
        {
          id: 'credit_account',
          name: 'Credit Account Transaction',
          method: 'POST',
          uri: apiConfig.buildUrl('deposits', 'creditAccount'),
          requiresPayload: true,
          description: 'Perform a credit transaction on an account'
        }
      ]
    },
    'lending': {
      name: 'Lending',
      description: 'Loan & Credit Management APIs',
      endpoints: [
        {
          id: 'create_mortgage_loan',
          name: 'Create Mortgage Loan',
          method: 'POST',
          uri: apiConfig.buildUrl('lending', 'createPersonalLoan'),
          requiresPayload: true,
          description: 'Create a new mortgage loan arrangement'
        },
        {
          id: 'create_consumer_loan',
          name: 'Create Consumer Loan',
          method: 'POST',
          uri: apiConfig.buildUrl('lending', 'createConsumerLoan'),
          requiresPayload: true,
          description: 'Create a new consumer loan arrangement'
        },
        {
          id: 'get_loan_status',
          name: 'Get Loan Status',
          method: 'GET',
          uri: apiConfig.buildUrl('lending', 'getLoanStatus', { loanArrangementId: '{loanArrangementId}' }),
          requiresPayload: false,
          description: 'Get current status of a loan arrangement'
        },
        {
          id: 'get_loan_schedules',
          name: 'Get Loan Payment Schedules',
          method: 'GET',
          uri: apiConfig.buildUrl('lending', 'getLoanSchedules', { loanArrangementId: '{loanArrangementId}' }),
          requiresPayload: false,
          description: 'Get payment schedules for a loan'
        },
        {
          id: 'get_customer_arrangements',
          name: 'Get Customer Loan Arrangements',
          method: 'GET',
          uri: apiConfig.buildUrl('lending', 'getCustomerArrangements', { partyId: '{partyId}' }),
          requiresPayload: false,
          description: 'Get all loan arrangements for a customer'
        }
      ]
    },
    'holdings': {
      name: 'Holdings',
      description: 'Holdings & Portfolio Management APIs',
      endpoints: [
        {
          id: 'get_holdings_party_arrangements',
          name: 'Get Holdings Party Arrangements',
          method: 'GET',
          uri: apiConfig.buildUrl('holdings', 'getPartyArrangements', { partyId: '{partyId}' }),
          requiresPayload: false,
          description: 'Get all holdings arrangements for a party'
        },
        {
          id: 'get_holdings_account_balances',
          name: 'Get Holdings Account Balances',
          method: 'GET',
          uri: apiConfig.buildUrl('holdings', 'getAccountBalances', { accountReference: '{accountReference}' }),
          requiresPayload: false,
          description: 'Get account balances from holdings service'
        },
        {
          id: 'get_holdings_account_transactions',
          name: 'Get Holdings Account Transactions',
          method: 'GET',
          uri: apiConfig.buildUrl('holdings', 'getAccountTransactions', { accountReference: '{accountReference}' }),
          requiresPayload: false,
          description: 'Get account transaction history from holdings service'
        }
      ]
    }
  };

  // Sample payloads for different endpoints
  const samplePayloads = {
    'create_party': {
      "dateOfBirth": "1991-12-29",
      "cityOfBirth": "San Diego",
      "firstName": "Ian",
      "lastName": "Wilson",
      "nickName": "Ian",
      "nationalities": [{"country": "US"}],
      "addresses": [{
        "communicationNature": "MailingAddress",
        "communicationType": "Physical",
        "electronicAddress": "ian.wilson@gmail.com",
        "iddPrefixPhone": "1",
        "phoneNo": "3666496860",
        "countryCode": "US",
        "addressFreeFormat": [{"addressLine": "159 Willow Walk, Seaside, Jacksonville, Florida"}]
      }]
    },
    'create_current_account': {
      "parties": [{"partyId": "2517636814", "partyRole": "OWNER"}],
      "accountName": "current",
      "openingDate": "20250314",
      "productId": "CHECKING.ACCOUNT",
      "currency": "USD",
      "branchCode": "01123",
      "quotationReference": "QUOT4F7A79"
    },
    'create_mortgage_loan': {
      "header": {},
      "body": {
        "partyIds": [{"partyId": "2517636814", "partyRole": "OWNER"}],
        "productId": "MORTGAGE.PRODUCT",
        "currency": "USD",
        "arrangementEffectiveDate": "",
        "commitment": [{"amount": "178777", "term": "10Y"}],
        "schedule": [{"payment": [{}, {"paymentFrequency": "e0Y e1M e0W e0D e0F"}]}],
        "settlement": [{
          "payout": [{"payoutSettlement": "YES", "property": [{"payoutAccount": "DDAComposable|GB0010001|1013720122"}]}],
          "assocSettlement": [
            {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013720122"}]},
            {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013720122"}]}
          ]
        }]
      }
    },
    'create_consumer_loan': {
      "header": {},
      "body": {
        "partyIds": [{"partyId": "2517636814", "partyRole": "OWNER"}],
        "productId": "GS.FIXED.LOAN",
        "currency": "USD",
        "arrangementEffectiveDate": "",
        "commitment": [{"amount": "5000", "term": "2Y"}],
        "schedule": [{"payment": [{}, {"paymentFrequency": "e0Y e1M e0W e0D e0F"}]}],
        "settlement": [{
          "payout": [{"payoutSettlement": "YES", "property": [{"payoutAccount": "DDAComposable|GB0010001|1013720122"}]}],
          "assocSettlement": [
            {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013720122"}]},
            {"payinSettlement": "YES", "reference": [{"payinAccount": "DDAComposable|GB0010001|1013720122"}]}
          ]
        }]
      }
    },
    'create_term_deposit': {
      "parties": [{"partyId": "2517636814", "partyRole": "OWNER"}],
      "accountName": "MyDepositAccount",
      "productId": "TermDepositWor",
      "openingDate": "20250314",
      "currency": "USD",
      "branchCode": "01123",
      "quotationReference": "QUOTABC123",
      "depositAmount": "10000",
      "depositTerm": "1Y",
      "interestPayoutOption": "Settle at Scheduled Frequency",
      "interestPayoutFrequency": "Monthly",
      "fundingAccount": "1013720122",
      "payoutAccount": "1013720122"
    },
    'debit_account': {
      "paymentTransactionReference": "DEBIT_UTILITYBIL_1234567890123_456",
      "paymentReservationReference": "DEBIT_UTILITYBIL_1234567890123_456",
      "paymentValueDate": "20250415",
      "debitAccount": "1013720122",
      "debitCurrency": "USD",
      "paymentAmount": "250",
      "paymentDescription": "Utility Bill Payment"
    },
    'credit_account': {
      "paymentTransactionReference": "CREDIT_SALARY_1234567890123_789",
      "paymentReservationReference": "CREDIT_SALARY_1234567890123_789",
      "paymentValueDate": "20250415",
      "creditAccount": "1013720122",
      "creditCurrency": "USD",
      "paymentAmount": "1500",
      "paymentDescription": "Salary Deposit"
    }
  };

  // Handle service selection change
  const handleServiceChange = useCallback((event) => {
    const value = event.target.value;
    setSelectedService(value);
    setSelectedEndpoint('');
    setUri('');
    setPayload('{\n  \n}');
  }, []);

  // Handle endpoint selection change
  const handleEndpointChange = useCallback((event) => {
    const value = event.target.value;
    setSelectedEndpoint(value);
    
    if (value && selectedService) {
      const endpoint = apiEndpoints[selectedService].endpoints.find(ep => ep.id === value);
      if (endpoint) {
        // Set HTTP method
        setHttpMethod(endpoint.method);
        
        // Process URI with parameter substitution
        let processedUri = endpoint.uri;
        processedUri = processedUri.replace('{partyId}', partyId);
        processedUri = processedUri.replace('{accountReference}', accountReference);
        processedUri = processedUri.replace('{loanArrangementId}', loanArrangementId);
        
        setUri(processedUri);
        
        // Set payload if required
        if (endpoint.requiresPayload && samplePayloads[value]) {
          // Update payload with current configuration values
          let updatedPayload = JSON.parse(JSON.stringify(samplePayloads[value]));
          
          // Update partyId references in payload
          if (updatedPayload.partyId) {
            updatedPayload.partyId = partyId;
          }
          if (updatedPayload.parties && updatedPayload.parties[0]) {
            updatedPayload.parties[0].partyId = partyId;
          }
          if (updatedPayload.body && updatedPayload.body.partyIds && updatedPayload.body.partyIds[0]) {
            updatedPayload.body.partyIds[0].partyId = partyId;
          }
          
          // Update account references in payload
          if (updatedPayload.accountReference) {
            updatedPayload.accountReference = accountReference;
          }
          if (updatedPayload.debitAccount) {
            updatedPayload.debitAccount = accountReference;
          }
          if (updatedPayload.creditAccount) {
            updatedPayload.creditAccount = accountReference;
          }
          if (updatedPayload.fundingAccount) {
            updatedPayload.fundingAccount = accountReference;
          }
          if (updatedPayload.payoutAccount) {
            updatedPayload.payoutAccount = accountReference;
          }
          
          // Update DDAComposable account references in loan payloads
          if (updatedPayload.body && updatedPayload.body.settlement) {
            const settlementArray = updatedPayload.body.settlement;
            settlementArray.forEach(settlement => {
              if (settlement.payout) {
                settlement.payout.forEach(payout => {
                  if (payout.property) {
                    payout.property.forEach(prop => {
                      if (prop.payoutAccount) {
                        prop.payoutAccount = `DDAComposable|GB0010001|${accountReference}`;
                      }
                    });
                  }
                });
              }
              if (settlement.assocSettlement) {
                settlement.assocSettlement.forEach(assoc => {
                  if (assoc.reference) {
                    assoc.reference.forEach(ref => {
                      if (ref.payinAccount) {
                        ref.payinAccount = `DDAComposable|GB0010001|${accountReference}`;
                      }
                    });
                  }
                });
              }
            });
          }
          
          setPayload(JSON.stringify(updatedPayload, null, 2));
        } else if (!endpoint.requiresPayload) {
          setPayload('');
        }
      }
    }
  }, [selectedService, partyId, accountReference, loanArrangementId]);

  // Handle configuration value changes and update URI/payload accordingly
  const handleConfigChange = useCallback((configType, value) => {
    switch (configType) {
      case 'partyId':
        setPartyId(value);
        break;
      case 'accountReference':
        setAccountReference(value);
        break;
      case 'loanArrangementId':
        setLoanArrangementId(value);
        break;
    }
    
    // Update URI and payload if an endpoint is selected
    if (selectedEndpoint && selectedService) {
      const endpoint = apiEndpoints[selectedService].endpoints.find(ep => ep.id === selectedEndpoint);
      if (endpoint) {
        // Update URI
        let processedUri = endpoint.uri;
        const newPartyId = configType === 'partyId' ? value : partyId;
        const newAccountRef = configType === 'accountReference' ? value : accountReference;
        const newLoanId = configType === 'loanArrangementId' ? value : loanArrangementId;
        
        processedUri = processedUri.replace('{partyId}', newPartyId);
        processedUri = processedUri.replace('{accountReference}', newAccountRef);
        processedUri = processedUri.replace('{loanArrangementId}', newLoanId);
        
        setUri(processedUri);
        
        // Update payload if it exists
        if (endpoint.requiresPayload && samplePayloads[selectedEndpoint]) {
          let updatedPayload = JSON.parse(JSON.stringify(samplePayloads[selectedEndpoint]));
          
          // Update partyId references in payload
          if (updatedPayload.partyId) {
            updatedPayload.partyId = newPartyId;
          }
          if (updatedPayload.parties && updatedPayload.parties[0]) {
            updatedPayload.parties[0].partyId = newPartyId;
          }
          if (updatedPayload.body && updatedPayload.body.partyIds && updatedPayload.body.partyIds[0]) {
            updatedPayload.body.partyIds[0].partyId = newPartyId;
          }
          
          // Update account references in payload
          if (updatedPayload.accountReference) {
            updatedPayload.accountReference = newAccountRef;
          }
          if (updatedPayload.debitAccount) {
            updatedPayload.debitAccount = newAccountRef;
          }
          if (updatedPayload.creditAccount) {
            updatedPayload.creditAccount = newAccountRef;
          }
          if (updatedPayload.fundingAccount) {
            updatedPayload.fundingAccount = newAccountRef;
          }
          if (updatedPayload.payoutAccount) {
            updatedPayload.payoutAccount = newAccountRef;
          }
          
          // Update DDAComposable account references in loan payloads
          if (updatedPayload.body && updatedPayload.body.settlement) {
            const settlementArray = updatedPayload.body.settlement;
            settlementArray.forEach(settlement => {
              if (settlement.payout) {
                settlement.payout.forEach(payout => {
                  if (payout.property) {
                    payout.property.forEach(prop => {
                      if (prop.payoutAccount) {
                        prop.payoutAccount = `DDAComposable|GB0010001|${newAccountRef}`;
                      }
                    });
                  }
                });
              }
              if (settlement.assocSettlement) {
                settlement.assocSettlement.forEach(assoc => {
                  if (assoc.reference) {
                    assoc.reference.forEach(ref => {
                      if (ref.payinAccount) {
                        ref.payinAccount = `DDAComposable|GB0010001|${newAccountRef}`;
                      }
                    });
                  }
                });
              }
            });
          }
          
          setPayload(JSON.stringify(updatedPayload, null, 2));
        }
      }
    }
  }, [selectedEndpoint, selectedService, partyId, accountReference, loanArrangementId]);

  // Validate JSON payload
  const validatePayload = useCallback((payloadText) => {
    if (!payloadText.trim() || httpMethod === 'GET' || httpMethod === 'DELETE') {
      return { valid: true, error: null };
    }
    
    try {
      JSON.parse(payloadText);
      return { valid: true, error: null };
    } catch (err) {
      return { valid: false, error: 'Invalid JSON format' };
    }
  }, [httpMethod]);

  // Copy response to clipboard
  const copyResponse = useCallback(async () => {
    if (!response) return;
    
    try {
      await navigator.clipboard.writeText(response);
      setSuccess('Response copied to clipboard!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to copy response to clipboard');
    }
  }, [response]);

  // Execute API call with real backend integration
  const executeApiCall = useCallback(async () => {
    setError(null);
    setSuccess(null);
    
    // Validate inputs
    if (!selectedService) {
      setError('Please select a service');
      return;
    }
    
    if (!selectedEndpoint) {
      setError('Please select an endpoint');
      return;
    }
    
    if (!uri.trim()) {
      setError('Please enter a URI');
      uriInputRef.current?.focus();
      return;
    }
    
    // Validate payload for POST/PUT requests
    const payloadValidation = validatePayload(payload);
    if (!payloadValidation.valid) {
      setError(payloadValidation.error);
      payloadInputRef.current?.focus();
      return;
    }
    
    setLoading(true);
    setResponse('');
    setResponseStatus('loading');
    
    try {
      // Real API call using the backend tracking endpoint
      const apiCallPayload = {
        uri: uri,
        method: httpMethod,
        payload: (httpMethod === 'POST' || httpMethod === 'PUT') && payload.trim() ? JSON.parse(payload) : null,
        domain: selectedService,
        endpoint: selectedEndpoint
      };
      
      // Call the backend tracking endpoint which handles real API calls
      const response = await fetch(`${apiConfig.backend}/api/headless/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Solution': selectedService,
          'X-Client-Type': 'api-viewer',
          'X-Endpoint': selectedEndpoint
        },
        body: JSON.stringify(apiCallPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Format the response for display
      if (result.api_call) {
        if (result.api_call.response) {
          setResponse(JSON.stringify(result.api_call.response, null, 2));
          setResponseStatus('success');
          setSuccess(`✅ ${apiEndpoints[selectedService].name} API call executed successfully!`);
        } else if (result.api_call.error) {
          setError(`API Error: ${JSON.stringify(result.api_call.error, null, 2)}`);
          setResponseStatus('error');
        } else {
          setResponse(JSON.stringify(result, null, 2));
          setResponseStatus('success');
          setSuccess(`✅ ${apiEndpoints[selectedService].name} API call completed!`);
        }
      } else {
        setResponse(JSON.stringify(result, null, 2));
        setResponseStatus('success');
        setSuccess(`✅ ${apiEndpoints[selectedService].name} API call completed!`);
      }
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (err) {
      console.error('API call failed:', err);
      setResponseStatus('error');
      if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
        setError('Invalid JSON in payload. Please check your JSON format.');
      } else {
        setError(`API call failed: ${err.message}`);
      }
      setResponse('');
    } finally {
      setLoading(false);
    }
  }, [selectedService, selectedEndpoint, httpMethod, uri, payload, validatePayload]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'Enter') {
        event.preventDefault();
        executeApiCall();
      }
    }
  }, [executeApiCall]);

  // Format response for display
  const formatResponse = (responseText) => {
    if (!responseText) return '';
    try {
      const parsed = JSON.parse(responseText);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return responseText;
    }
  };

  return (
    <div 
      className="api-viewer-container"
      data-testid="api-viewer-container"
      role="region"
      aria-label="API Testing Interface"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="api-viewer-header">
        <h2>
          <span className="header-icon" aria-hidden="true">🔧</span>
          Temenos API Viewer - Modular Banking APIs
        </h2>
        <div className="header-description">
          <p>Test and interact with Temenos modular banking APIs in real-time</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message" role="alert" aria-live="assertive">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          {error}
          <button 
            className="error-dismiss" 
            onClick={() => setError(null)}
            aria-label="Dismiss error message"
          >
            ×
          </button>
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="success-message" role="alert" aria-live="polite">
          <span className="success-icon" aria-hidden="true">✅</span>
          {success}
          <button 
            className="success-dismiss" 
            onClick={() => setSuccess(null)}
            aria-label="Dismiss success message"
          >
            ×
          </button>
        </div>
      )}

      {/* Configuration Section */}
      <div className="configuration-section">
        <h3>
          <span className="section-icon" aria-hidden="true">⚙️</span>
          Configuration Parameters
        </h3>
        
        <div className="config-grid">
          <div className="config-group">
            <label htmlFor="party-id-input" className="config-label">
              Party ID
            </label>
            <input
              id="party-id-input"
              data-testid="party-id-input"
              type="text"
              value={partyId}
              onChange={(e) => handleConfigChange('partyId', e.target.value)}
              className="config-input"
              placeholder="Enter Party ID"
              aria-label="Party ID for API calls"
            />
            <div className="config-help">Customer/Party identifier</div>
          </div>
          
          <div className="config-group">
            <label htmlFor="account-ref-input" className="config-label">
              Account Reference
            </label>
            <input
              id="account-ref-input"
              data-testid="account-ref-input"
              type="text"
              value={accountReference}
              onChange={(e) => handleConfigChange('accountReference', e.target.value)}
              className="config-input"
              placeholder="Enter Account Reference"
              aria-label="Account reference for API calls"
            />
            <div className="config-help">Account/Arrangement reference</div>
          </div>
          
          <div className="config-group">
            <label htmlFor="loan-id-input" className="config-label">
              Loan Arrangement ID
            </label>
            <input
              id="loan-id-input"
              data-testid="loan-id-input"
              type="text"
              value={loanArrangementId}
              onChange={(e) => handleConfigChange('loanArrangementId', e.target.value)}
              className="config-input"
              placeholder="Enter Loan Arrangement ID"
              aria-label="Loan arrangement ID for API calls"
            />
            <div className="config-help">Loan arrangement identifier</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="api-viewer-content">
        
        {/* Request Configuration Section */}
        <div className="request-section">
          <h3>
            <span className="section-icon" aria-hidden="true">📝</span>
            API Request Configuration
          </h3>
          
          <div className="request-form-content">
            {/* Service Selection */}
            <div className="form-group">
              <label htmlFor="service-selector" className="form-label">
                Temenos Service
              </label>
              <select
                id="service-selector"
                data-testid="service-selector"
                value={selectedService}
                onChange={handleServiceChange}
                className="form-select"
                role="combobox"
                aria-label="Select Temenos service for API testing"
                aria-required="true"
              >
                <option value="">Select a service...</option>
                {Object.entries(apiEndpoints).map(([key, service]) => (
                  <option key={key} value={key}>
                    {service.name} - {service.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Endpoint Selection */}
            {selectedService && (
              <div className="form-group">
                <label htmlFor="endpoint-selector" className="form-label">
                  API Endpoint
                </label>
                <select
                  id="endpoint-selector"
                  data-testid="endpoint-selector"
                  value={selectedEndpoint}
                  onChange={handleEndpointChange}
                  className="form-select"
                  role="combobox"
                  aria-label="Select API endpoint"
                  aria-required="true"
                >
                  <option value="">Select an endpoint...</option>
                  {apiEndpoints[selectedService].endpoints.map((endpoint) => (
                    <option key={endpoint.id} value={endpoint.id}>
                      [{endpoint.method}] {endpoint.name}
                    </option>
                  ))}
                </select>
                {selectedEndpoint && (
                  <div className="endpoint-description">
                    {apiEndpoints[selectedService].endpoints.find(ep => ep.id === selectedEndpoint)?.description}
                  </div>
                )}
              </div>
            )}

            {/* HTTP Method Display */}
            {selectedEndpoint && (
              <div className="form-group">
                <label className="form-label">HTTP Method</label>
                <div className="method-display">
                  <span className={`method-badge ${httpMethod.toLowerCase()}`}>
                    {httpMethod}
                  </span>
                </div>
              </div>
            )}

            {/* URI Display */}
            {selectedEndpoint && (
              <div className="form-group">
                <label htmlFor="uri-input" className="form-label">
                  API Endpoint URI
                </label>
                <input
                  id="uri-input"
                  ref={uriInputRef}
                  data-testid="uri-input"
                  type="text"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  className="form-input uri-input"
                  aria-label="API endpoint URI"
                  readOnly={false}
                />
              </div>
            )}

            {/* Request Payload */}
            {selectedEndpoint && apiEndpoints[selectedService].endpoints.find(ep => ep.id === selectedEndpoint)?.requiresPayload && (
              <div className="form-group">
                <label htmlFor="payload-input" className="form-label">
                  Request Payload (JSON)
                </label>
                <textarea
                  id="payload-input"
                  ref={payloadInputRef}
                  data-testid="payload-input"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  placeholder="Enter JSON payload..."
                  className="form-textarea payload-input"
                  rows="12"
                  aria-label="Enter JSON request payload"
                  spellCheck="false"
                />
                <div className="input-help">
                  <span className="help-icon" aria-hidden="true">💡</span>
                  Payload auto-updates with configuration parameters
                </div>
              </div>
            )}
          </div>

          {/* Execute Button */}
          <div className="execute-section">
            <button
              type="button"
              data-testid="execute-api-button"
              onClick={executeApiCall}
              disabled={loading || !selectedService || !selectedEndpoint || !uri.trim()}
              className={`execute-button ${loading ? 'loading' : ''}`}
              aria-label="Execute API request"
            >
              {loading ? (
                <>
                  <span className="loading-spinner" aria-hidden="true"></span>
                  Executing...
                </>
              ) : (
                <>
                  <span className="execute-icon" aria-hidden="true">🚀</span>
                  Execute {selectedService ? apiEndpoints[selectedService].name : ''} API
                </>
              )}
            </button>
            
            <div className="execute-help">
              <span className="help-text">
                Press Ctrl+Enter (Cmd+Enter on Mac) to execute
              </span>
            </div>
          </div>
        </div>

        {/* Response Section */}
        <div className="response-section">
          <div className="response-header">
            <h3>
              <span className="section-icon" aria-hidden="true">📄</span>
              API Response
              {responseStatus && (
                <span className={`response-status ${responseStatus}`}>
                  {responseStatus === 'success' && '✅ Success'}
                  {responseStatus === 'error' && '❌ Error'}
                  {responseStatus === 'loading' && '⏳ Loading'}
                </span>
              )}
            </h3>
            {response && (
              <button
                className="copy-response-btn"
                onClick={copyResponse}
                aria-label="Copy response to clipboard"
                title="Copy response to clipboard"
              >
                <span aria-hidden="true">📋</span>
                Copy
              </button>
            )}
          </div>
          
          <div 
            className="response-display"
            data-testid="response-display"
            role="region"
            aria-label="API response output"
          >
            {loading ? (
              <div className="response-content loading">
                <div className="loading-spinner-large" aria-hidden="true"></div>
                <p>Executing {selectedService ? apiEndpoints[selectedService].name : ''} API request...</p>
                <p className="help-text">Connecting to Temenos service...</p>
              </div>
            ) : response ? (
              <div className={`response-content ${responseStatus || 'success'}`}>
                {formatResponse(response)}
              </div>
            ) : (
              <div className="response-content">
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">📋</span>
                  <p>API response will appear here after execution</p>
                  <p className="help-text">Select a service and endpoint to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="api-viewer-footer">
        <p className="footer-note">
          <span className="info-icon" aria-hidden="true">ℹ️</span>
          Testing real Temenos modular banking APIs with live data
        </p>
      </div>
    </div>
  );
};

export default APIViewer; 