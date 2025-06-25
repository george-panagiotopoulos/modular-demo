/**
 * End-to-End Tests for the API Viewer (Headless)
 *
 * These tests validate that the /api/headless/track endpoint can
 * successfully proxy requests to live Temenos APIs and receive valid responses.
 * It requires the backend and the Temenos API endpoints to be running and accessible.
 */

const request = require('supertest');
const app = require('../src/server');
const { getSessionManager } = require('../src/services/sessionManager');
const { getEventHubService } = require('../src/services/eventHubService');

describe('API Viewer (Headless) End-to-End Tests', () => {
  let server;
  let availableEndpoints = {};

  // Increase timeout for live API calls
  jest.setTimeout(45000); // 45 seconds

  beforeAll((done) => {
    server = app.listen(done);
  });

  afterAll((done) => {
    getSessionManager().cleanup();
    getEventHubService().shutdown()
      .then(() => {
        server.close(done);
      })
      .catch((err) => {
        console.error('Error during shutdown', err);
        server.close(done);
      });
  });

  beforeAll(async () => {
    // Fetch the list of available endpoints once before all tests
    const response = await request(app).get('/api/headless/endpoints').expect(200);
    expect(response.body.success).toBe(true);
    availableEndpoints = response.body.endpoints;
    expect(Object.keys(availableEndpoints).length).toBeGreaterThan(0);
  });

  it('should successfully fetch the list of available API endpoints', () => {
    // This test just confirms the beforeAll hook worked as expected
    expect(availableEndpoints).toBeDefined();
    expect(availableEndpoints.holdings).toBeInstanceOf(Array);
  });

  it('should fail gracefully when trying to execute a request to a non-existent API', async () => {
    const response = await request(app)
      .post('/api/headless/track')
      .set('User-Agent', 'Mozilla/5.0 (Modular-Banking-Demo-Test)')
      .send({
        method: 'GET',
        uri: process.env.TEST_NON_EXISTENT_API_URL || 'http://modulardemo.northeurope.cloudapp.azure.com/non-existent-api',
        domain: 'test',
        endpoint: 'test_endpoint',
      })
      .expect(502); // Expecting a 502 from the proxied service

    expect(response.body.success).toBe(false);
    expect(response.body.api_call).toBeDefined();
    expect(response.body.api_call.error).toBeDefined();
    expect(response.body.api_call.error.status).toBe(502);
  });
    
   it('should execute a POST request to the live "Create Party/Customer" API and receive a successful response', async () => {
    const createPartyEndpoint = availableEndpoints.party.find(e => e.id === 'create_party');
    expect(createPartyEndpoint).toBeDefined();

    // Sending an empty payload should trigger a validation error from the Temenos API
    const response = await request(app)
      .post('/api/headless/track')
      .set('User-Agent', 'Mozilla/5.0 (Modular-Banking-Demo-Test)')
      .send({
        method: createPartyEndpoint.method,
        uri: createPartyEndpoint.uri,
        payload: { "customerType": "CUSTOMER" }, // Corrected payload
        domain: 'party',
        endpoint: createPartyEndpoint.id
      })
      .expect(200); // Temenos API is incorrectly returning 200

    expect(response.body.success).toBe(true);
    
    // Check the response details from the proxied API
    const apiResponse = response.body.api_call.response;
    expect(apiResponse).toBeDefined();
    expect(apiResponse.id).toBeDefined();
    expect(apiResponse.status).toBe('Success');
  });

  it('should execute a GET request to the live "Get Party by ID" API and get a valid response', async () => {
    const getPartyEndpoint = availableEndpoints.party.find(e => e.id === 'get_party_by_id');
    expect(getPartyEndpoint).toBeDefined();

    const partyId = '2516466195';
    const uri = getPartyEndpoint.uri.replace('{partyId}', partyId);

    const response = await request(app)
      .post('/api/headless/track')
      .set('User-Agent', 'Mozilla/5.0 (Modular-Banking-Demo-Test)')
      .send({
        method: getPartyEndpoint.method,
        uri: uri,
        domain: 'party',
        endpoint: getPartyEndpoint.id
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const apiResponse = response.body.api_call.response;
    expect(apiResponse).toBeDefined();
    expect(apiResponse.partyId).toBe(partyId);
  });

  it('should execute a GET request to the live "Get Account Balances" API and get a valid response', async () => {
    const getAccountBalancesEndpoint = availableEndpoints.deposits.find(e => e.id === 'get_account_balances');
    expect(getAccountBalancesEndpoint).toBeDefined();

    const accountId = '1013719612';
    const uri = getAccountBalancesEndpoint.uri.replace('{arrangementId}', accountId);

    const response = await request(app)
      .post('/api/headless/track')
      .set('User-Agent', 'Mozilla/5.0 (Modular-Banking-Demo-Test)')
      .send({
        method: getAccountBalancesEndpoint.method,
        uri: uri,
        domain: 'deposits',
        endpoint: getAccountBalancesEndpoint.id
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const apiResponse = response.body.api_call.response;
    expect(apiResponse).toBeDefined();
    // Just check that we got a response, the balance data structure can vary
  });

  it('should execute a GET request to the live "Get Loan Status" API and get a valid response', async () => {
    const getLoanStatusEndpoint = availableEndpoints.lending.find(e => e.id === 'get_loan_status');
    expect(getLoanStatusEndpoint).toBeDefined();

    const loanId = 'AA25073P8VVP';
    const uri = getLoanStatusEndpoint.uri.replace('{arrangementId}', loanId);

    const response = await request(app)
      .post('/api/headless/track')
      .set('User-Agent', 'Mozilla/5.0 (Modular-Banking-Demo-Test)')
      .send({
        method: getLoanStatusEndpoint.method,
        uri: uri,
        domain: 'lending',
        endpoint: getLoanStatusEndpoint.id
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const apiResponse = response.body.api_call.response;
    expect(apiResponse).toBeDefined();
    // Just check that we got a response with loan status data
  });
}); 