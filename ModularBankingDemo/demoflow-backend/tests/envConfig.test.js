/**
 * Environment Configuration Tests
 * Tests for reading API endpoints from .env file
 */

const temenosConfig = require('../src/config/temenosConfig');

describe('Environment Configuration Tests', () => {
  describe('API Endpoints from .env file', () => {
    test('should read TEMENOS_BASE_URL from environment variables', () => {
      // This test should fail initially as we haven't set up dotenv yet
      expect(process.env.TEMENOS_BASE_URL).toBeDefined();
      expect(process.env.TEMENOS_BASE_URL).toBe('http://modulardemo.northeurope.cloudapp.azure.com');
    });

    test('should read TEMENOS_PARTY_BASE_URL from environment variables', () => {
      expect(process.env.TEMENOS_PARTY_BASE_URL).toBeDefined();
      expect(process.env.TEMENOS_PARTY_BASE_URL).toBe('http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api');
    });

    test('should read TEMENOS_DEPOSITS_BASE_URL from environment variables', () => {
      expect(process.env.TEMENOS_DEPOSITS_BASE_URL).toBeDefined();
      expect(process.env.TEMENOS_DEPOSITS_BASE_URL).toBe('http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api');
    });

    test('should read TEMENOS_LENDING_BASE_URL from environment variables', () => {
      expect(process.env.TEMENOS_LENDING_BASE_URL).toBeDefined();
      expect(process.env.TEMENOS_LENDING_BASE_URL).toBe('http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api');
    });

    test('should read TEMENOS_HOLDINGS_BASE_URL from environment variables', () => {
      expect(process.env.TEMENOS_HOLDINGS_BASE_URL).toBeDefined();
      expect(process.env.TEMENOS_HOLDINGS_BASE_URL).toBe('http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api');
    });
  });

  describe('Temenos Config Integration', () => {
    test('should use environment variables for base URLs', () => {
      expect(temenosConfig.baseUrl).toBe(process.env.TEMENOS_BASE_URL);
      expect(temenosConfig.components.party.baseUrl).toBe(process.env.TEMENOS_PARTY_BASE_URL);
      expect(temenosConfig.components.deposits.baseUrl).toBe(process.env.TEMENOS_DEPOSITS_BASE_URL);
      expect(temenosConfig.components.lending.baseUrl).toBe(process.env.TEMENOS_LENDING_BASE_URL);
      expect(temenosConfig.components.holdings.baseUrl).toBe(process.env.TEMENOS_HOLDINGS_BASE_URL);
    });

    test('should build URLs using environment variables', () => {
      const partyUrl = temenosConfig.buildUrl('party', 'getById', { partyId: '123' });
      const expectedUrl = `${process.env.TEMENOS_PARTY_BASE_URL}${process.env.TEMENOS_PARTY_GET_BY_ID_ENDPOINT}`.replace('{partyId}', '123');
      expect(partyUrl).toBe(expectedUrl);
    });
  });
}); 