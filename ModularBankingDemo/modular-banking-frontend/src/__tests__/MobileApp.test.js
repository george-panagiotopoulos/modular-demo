import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileApp from '../components/MobileApp/MobileApp';

// Mock API service
jest.mock('../services/apiService', () => ({
  fetchAccounts: jest.fn(),
  fetchLoans: jest.fn(),
  fetchProfile: jest.fn(),
  fetchTransactions: jest.fn(),
  fetchLoanDetails: jest.fn(),
  fetchLoanSchedule: jest.fn(),
  submitTransfer: jest.fn(),
}));

describe('MobileApp Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'TEST123'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      render(<MobileApp />);
    });

    test('contains essential mobile app elements', () => {
      render(<MobileApp />);
      
      // Check for header
      expect(screen.getByRole('banner')).toBeInTheDocument();
      
      // Check for main content area
      expect(screen.getByRole('main')).toBeInTheDocument();
      
      // Check for navigation
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('has mobile-responsive container', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      expect(container).toHaveClass('mobile-app-container');
      
      // Check for mobile viewport styling
      const styles = window.getComputedStyle(container);
      expect(styles.maxWidth).toBe('390px');
    });

    test('displays Temenos branding', () => {
      render(<MobileApp />);
      
      // Check for Temenos branding in header
      expect(screen.getByText(/temenos/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('contains navigation tabs for Home, Transfer, Profile', () => {
      render(<MobileApp />);
      
      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    });

    test('switches between screens when navigation buttons are clicked', async () => {
      render(<MobileApp />);
      
      const profileButton = screen.getByRole('button', { name: /profile/i });
      fireEvent.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
      });
    });

    test('highlights active navigation tab', () => {
      render(<MobileApp />);
      
      const homeButton = screen.getByRole('button', { name: /home/i });
      expect(homeButton).toHaveClass('active');
    });
  });

  describe('Home Screen', () => {
    test('displays party ID input', () => {
      render(<MobileApp />);
      
      expect(screen.getByLabelText(/party id/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
    });

    test('displays accounts section', () => {
      render(<MobileApp />);
      
      expect(screen.getByTestId('accounts-section')).toBeInTheDocument();
    });

    test('displays loans section', () => {
      render(<MobileApp />);
      
      expect(screen.getByTestId('loans-section')).toBeInTheDocument();
    });
  });

  describe('Profile Screen', () => {
    test('displays profile information when profile tab is active', async () => {
      render(<MobileApp />);
      
      const profileButton = screen.getByRole('button', { name: /profile/i });
      fireEvent.click(profileButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
      });
    });
  });

  describe('Transfer Screen', () => {
    test('displays transfer form when transfer tab is active', async () => {
      render(<MobileApp />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('transfer-screen')).toBeInTheDocument();
        expect(screen.getByLabelText(/from account/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/to account/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      });
    });
  });

  describe('Temenos Branding', () => {
    test('uses correct Temenos color palette', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      const styles = window.getComputedStyle(container);
      
      // The component should use CSS custom properties for Temenos colors
      expect(document.documentElement.style.getPropertyValue('--temenos-primary')).toBe('#5CB8B2');
      expect(document.documentElement.style.getPropertyValue('--temenos-secondary')).toBe('#8246AF');
      expect(document.documentElement.style.getPropertyValue('--temenos-accent')).toBe('#283275');
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(<MobileApp />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('supports keyboard navigation', () => {
      render(<MobileApp />);
      
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      transferButton.focus();
      
      expect(transferButton).toHaveFocus();
      
      // Test tab navigation
      fireEvent.keyDown(transferButton, { key: 'Tab' });
    });
  });

  describe('Party ID Management', () => {
    test('updates party ID when apply button is clicked', async () => {
      render(<MobileApp />);
      
      const partyIdInput = screen.getByLabelText(/party id/i);
      const applyButton = screen.getByRole('button', { name: /apply/i });
      
      fireEvent.change(partyIdInput, { target: { value: 'NEW123' } });
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith('currentPartyId', 'NEW123');
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message when API calls fail', async () => {
      const mockApiService = require('../services/apiService');
      mockApiService.fetchAccounts.mockRejectedValue(new Error('API Error'));
      
      render(<MobileApp />);
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading spinner while fetching data', () => {
      render(<MobileApp />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('adapts to different mobile screen sizes', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      expect(container).toHaveClass('responsive-mobile');
    });
  });
}); 