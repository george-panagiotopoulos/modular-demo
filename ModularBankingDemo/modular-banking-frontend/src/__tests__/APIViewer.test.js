import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import APIViewer from '../components/APIViewer';

// Clear console output to avoid noise during tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('APIViewer Component', () => {
  
  // ==========================================
  // Component Structure Tests
  // ==========================================
  
  describe('Component Structure Tests', () => {
    test('renders API Viewer container with proper heading', () => {
      render(<APIViewer />);
      
      expect(screen.getByText(/Temenos API Viewer - Modular Banking APIs/i)).toBeInTheDocument();
      expect(screen.getByText(/Test and interact with Temenos modular banking APIs in real-time/i)).toBeInTheDocument();
    });

    test('renders configuration parameters section', () => {
      render(<APIViewer />);
      
      expect(screen.getByText(/Configuration Parameters/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Party ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Account Reference/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Loan Arrangement ID/i)).toBeInTheDocument();
    });

    test('renders service selection dropdown', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      expect(serviceSelector).toBeInTheDocument();
      expect(serviceSelector).toHaveDisplayValue('Select a service...');
    });

    test('renders endpoint selection dropdown when service is selected', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      expect(screen.getByTestId('endpoint-selector')).toBeInTheDocument();
    });

    test('renders URI input field when endpoint is selected', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'get_party_by_id' } });
      
      expect(screen.getByTestId('uri-input')).toBeInTheDocument();
    });

    test('renders payload input area for POST methods', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'create_party' } });
      
      expect(screen.getByTestId('payload-input')).toBeInTheDocument();
    });

    test('renders response display area', () => {
      render(<APIViewer />);
      
      expect(screen.getByTestId('response-display')).toBeInTheDocument();
    });

    test('renders execute API button', () => {
      render(<APIViewer />);
      
      expect(screen.getByTestId('execute-api-button')).toBeInTheDocument();
    });
  });

  // ==========================================
  // Service and Endpoint Selection Tests
  // ==========================================
  
  describe('Service and Endpoint Selection Tests', () => {
    test('shows all available Temenos services', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      
      // Check if service options are available
      expect(serviceSelector).toContainHTML('Party - Customer/Party Management APIs');
      expect(serviceSelector).toContainHTML('Deposits - Account & Deposit Management APIs');
      expect(serviceSelector).toContainHTML('Lending - Loan & Credit Management APIs');
      expect(serviceSelector).toContainHTML('Holdings - Holdings & Portfolio Management APIs');
    });

    test('shows Party service endpoints when Party is selected', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      expect(endpointSelector).toContainHTML('[POST] Create Party/Customer');
      expect(endpointSelector).toContainHTML('[GET] Get Party by ID');
      expect(endpointSelector).toContainHTML('[GET] Get Party by Email');
    });

    test('shows Deposits service endpoints when Deposits is selected', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'deposits' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      expect(endpointSelector).toContainHTML('[POST] Create Current Account');
      expect(endpointSelector).toContainHTML('[GET] Get Account Balance');
      expect(endpointSelector).toContainHTML('[POST] Debit Account Transaction');
    });

    test('shows Lending service endpoints when Lending is selected', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'lending' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      expect(endpointSelector).toContainHTML('[POST] Create Mortgage Loan');
      expect(endpointSelector).toContainHTML('[POST] Create Consumer Loan');
      expect(endpointSelector).toContainHTML('[GET] Get Loan Status');
    });

    test('updates URI when endpoint is selected', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'get_party_by_id' } });
      
      const uriInput = screen.getByTestId('uri-input');
      expect(uriInput.value).toContain('ms-party-api/api/v5.0.0/party/parties/2516466195');
    });
  });

  // ==========================================
  // Configuration Parameters Tests
  // ==========================================
  
  describe('Configuration Parameters Tests', () => {
    test('has default configuration values from demooutput.txt', () => {
      render(<APIViewer />);
      
      expect(screen.getByDisplayValue('2516466195')).toBeInTheDocument(); // Party ID
      expect(screen.getByDisplayValue('1013719612')).toBeInTheDocument(); // Account Reference
      expect(screen.getByDisplayValue('AA25073P8VVP')).toBeInTheDocument(); // Loan Arrangement ID
    });

    test('updates URI when Party ID is changed', () => {
      render(<APIViewer />);
      
      // Select a service and endpoint first
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'get_party_by_id' } });
      
      // Change Party ID
      const partyIdInput = screen.getByTestId('party-id-input');
      fireEvent.change(partyIdInput, { target: { value: '1234567890' } });
      
      // Check if URI is updated
      const uriInput = screen.getByTestId('uri-input');
      expect(uriInput.value).toContain('1234567890');
    });

    test('updates URI when Account Reference is changed', () => {
      render(<APIViewer />);
      
      // Select a service and endpoint that uses account reference
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'deposits' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'get_account_balance' } });
      
      // Change Account Reference
      const accountRefInput = screen.getByTestId('account-ref-input');
      fireEvent.change(accountRefInput, { target: { value: '9876543210' } });
      
      // Check if URI is updated
      const uriInput = screen.getByTestId('uri-input');
      expect(uriInput.value).toContain('9876543210');
    });

    test('updates payload when configuration values change', () => {
      render(<APIViewer />);
      
      // Select a service and endpoint that requires payload
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'deposits' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'create_current_account' } });
      
      // Change Party ID
      const partyIdInput = screen.getByTestId('party-id-input');
      fireEvent.change(partyIdInput, { target: { value: '9999999999' } });
      
      // Check if payload is updated
      const payloadInput = screen.getByTestId('payload-input');
      expect(payloadInput.value).toContain('9999999999');
    });
  });

  // ==========================================
  // Accessibility Tests
  // ==========================================
  
  describe('Accessibility Tests', () => {
    test('has proper ARIA labels and roles', () => {
      render(<APIViewer />);
      
      expect(screen.getByRole('region', { name: /API Testing Interface/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /API response output/i })).toBeInTheDocument();
    });

    test('form inputs have appropriate labels', () => {
      render(<APIViewer />);
      
      expect(screen.getByLabelText(/Party ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Account Reference/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Loan Arrangement ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Select Temenos service/i)).toBeInTheDocument();
    });

    test('execute button has proper aria-label', () => {
      render(<APIViewer />);
      
      const executeButton = screen.getByTestId('execute-api-button');
      expect(executeButton).toHaveAttribute('aria-label', 'Execute API request');
    });
  });

  // ==========================================
  // API Execution Tests
  // ==========================================
  
  describe('API Execution Tests', () => {
    test('shows validation error when no service is selected', async () => {
      render(<APIViewer />);
      
      // Button should be disabled when no service is selected
      const executeButton = screen.getByTestId('execute-api-button');
      expect(executeButton).toBeDisabled();
      
      // The button should show the default text when no service is selected
      expect(executeButton).toHaveTextContent('🚀Execute API');
    });

    test('shows validation error when no endpoint is selected', async () => {
      render(<APIViewer />);
      
      // Select a service but no endpoint
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      // Button should still be disabled when no endpoint is selected
      const executeButton = screen.getByTestId('execute-api-button');
      expect(executeButton).toBeDisabled();
      
      // The button should show the service name but still be disabled
      expect(executeButton).toHaveTextContent('Execute Party API');
    });

    test('executes API call when all required fields are filled', async () => {
      // Mock fetch for this test
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            api_call: {
              response: { success: true, message: 'API call successful' }
            }
          }),
        })
      );

      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'get_party_by_id' } });
      
      const executeButton = screen.getByTestId('execute-api-button');
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Party API call executed successfully!/i)).toBeInTheDocument();
      });

      // Clean up
      global.fetch.mockRestore();
    });

    test('handles POST method payload correctly', async () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'create_party' } });
      
      const payloadInput = screen.getByTestId('payload-input');
      expect(payloadInput).toBeVisible();
      
      // Check if payload has valid JSON structure
      const payloadValue = payloadInput.value;
      expect(() => JSON.parse(payloadValue)).not.toThrow();
      
      // Check if payload contains expected fields from demooutput.txt
      expect(payloadValue).toContain('Ian');
      expect(payloadValue).toContain('Wilson');
      expect(payloadValue).toContain('1991-12-29');
      expect(payloadValue).toContain('ian.wilson@gmail.com');
    });

    test('shows endpoint description when endpoint is selected', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'create_party' } });
      
      expect(screen.getByText(/Create a new customer\/party in the system/i)).toBeInTheDocument();
    });

    test('displays HTTP method badge correctly', () => {
      render(<APIViewer />);
      
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'create_party' } });
      
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('POST')).toHaveClass('method-badge', 'post');
    });

    test('button is disabled when required fields are missing', () => {
      render(<APIViewer />);
      
      const executeButton = screen.getByTestId('execute-api-button');
      expect(executeButton).toBeDisabled();
      
      // Select service but not endpoint
      const serviceSelector = screen.getByTestId('service-selector');
      fireEvent.change(serviceSelector, { target: { value: 'party' } });
      
      expect(executeButton).toBeDisabled();
      
      // Select endpoint - should enable button
      const endpointSelector = screen.getByTestId('endpoint-selector');
      fireEvent.change(endpointSelector, { target: { value: 'get_party_by_id' } });
      
      expect(executeButton).not.toBeDisabled();
    });
  });
}); 