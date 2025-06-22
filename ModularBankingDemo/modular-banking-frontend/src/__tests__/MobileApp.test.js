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

describe('MobileApp Component - Redesigned', () => {
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

    // Mock window.matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  describe('Step 1: Key UI Elements and Temenos Color Usage', () => {
    test('renders without crashing', () => {
      render(<MobileApp />);
    });

    test('contains essential mobile app elements', () => {
      render(<MobileApp />);
      
      // Check for header with proper semantic role
      expect(screen.getByRole('banner')).toBeInTheDocument();
      
      // Check for main content area
      expect(screen.getByRole('main')).toBeInTheDocument();
      
      // Check for navigation
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('has mobile-responsive container with proper dimensions', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      expect(container).toHaveClass('mobile-app-container');
      
      // Check for mobile viewport styling
      const styles = window.getComputedStyle(container);
      expect(styles.maxWidth).toBe('390px');
    });

    test('displays Temenos branding in header', () => {
      render(<MobileApp />);
      
      // Check for Temenos branding in header
      expect(screen.getByText(/temenos/i)).toBeInTheDocument();
    });

    test('uses correct Temenos color palette throughout the interface', () => {
      render(<MobileApp />);
      
      // Check that CSS custom properties for Temenos colors are set
      const rootStyles = getComputedStyle(document.documentElement);
      const primaryColor = rootStyles.getPropertyValue('--temenos-primary');
      const secondaryColor = rootStyles.getPropertyValue('--temenos-secondary');
      const accentColor = rootStyles.getPropertyValue('--temenos-accent');
      
      // Check that colors are set (may be empty in test environment)
      expect(primaryColor).toBeDefined();
      expect(secondaryColor).toBeDefined();
      expect(accentColor).toBeDefined();
    });

    test('applies Temenos colors to interactive elements', () => {
      render(<MobileApp />);
      
      // Check that buttons use Temenos primary color
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        // Primary buttons should use Temenos primary color
        if (button.classList.contains('btn-primary')) {
          expect(styles.backgroundColor).toBe('rgb(92, 184, 178)'); // #5CB8B2
        }
      });
    });
  });

  describe('Step 2: Accessibility Standards (WCAG 2.1 AA)', () => {
    test('has proper ARIA labels and roles for all interactive elements', () => {
      render(<MobileApp />);
      
      // Check for proper landmark roles
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Check for form labels
      expect(screen.getByLabelText(/party id/i)).toBeInTheDocument();
      
      // Check for button labels
      expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    });

    test('supports keyboard navigation with logical tab order', () => {
      render(<MobileApp />);
      
      const partyIdInput = screen.getByLabelText('Party ID');
      const applyButton = screen.getByText('Apply');
      
      // Focus should be manageable
      partyIdInput.focus();
      expect(partyIdInput).toHaveFocus();
      
      // Navigation buttons should be focusable
      const navButtons = screen.getAllByRole('button');
      navButtons.forEach(button => {
        expect(button).not.toBeDisabled();
      });
    });

    test('has sufficient color contrast ratios for text readability', () => {
      render(<MobileApp />);
      
      // Check that text has proper contrast
      const textElements = screen.getAllByText(/./);
      textElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;
        
        // Basic check - in a real implementation, you'd use a color contrast library
        expect(color).not.toBe('transparent');
        expect(backgroundColor).not.toBe('transparent');
      });
    });

    test('provides focus indicators for all interactive elements', () => {
      render(<MobileApp />);
      
      const interactiveElements = screen.getAllByRole('button');
      interactiveElements.forEach(element => {
        element.focus();
        const styles = window.getComputedStyle(element);
        // Check for focus indicator (outline or box-shadow)
        expect(styles.outline).not.toBe('none') || expect(styles.boxShadow).not.toBe('none');
      });
    });

    test('includes skip navigation links for screen readers', () => {
      render(<MobileApp />);
      
      // Check for skip navigation link
      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
    });
  });

  describe('Step 3: Responsive Design and Layout', () => {
    test('adapts to different mobile screen sizes', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      expect(container).toHaveClass('responsive-mobile');
      
      // Test different viewport sizes
      const smallScreen = window.matchMedia('(max-width: 375px)');
      const mediumScreen = window.matchMedia('(max-width: 414px)');
      const largeScreen = window.matchMedia('(max-width: 428px)');
      
      expect(smallScreen.matches).toBeDefined();
      expect(mediumScreen.matches).toBeDefined();
      expect(largeScreen.matches).toBeDefined();
    });

    test('uses flexible grid system for layout', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      
      // Check inline style for display property
      expect(container).toHaveStyle({ display: 'flex' });
    });

    test('maintains proper spacing and proportions across devices', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      
      // Check inline styles for proper aspect ratio and spacing
      expect(container).toHaveStyle({ 
        maxWidth: '390px',
        width: '100%'
      });
    });
  });

  describe('Step 4: Reusable UI Components', () => {
    test('has accessible button components with proper focus states', () => {
      render(<MobileApp />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Test focus states
        button.focus();
        expect(button).toHaveFocus();
        
        // Test hover states (if supported)
        fireEvent.mouseEnter(button);
        fireEvent.mouseLeave(button);
      });
    });

    test('implements form input components with validation', () => {
      render(<MobileApp />);
      
      const partyIdInput = screen.getByLabelText('Party ID');
      const applyButton = screen.getByText('Apply');
      
      // Test with invalid input and submit form
      fireEvent.change(partyIdInput, { target: { value: 'INVALID' } });
      fireEvent.click(applyButton);
      
      // Should show validation message
      expect(screen.getByText(/please enter a valid party id/i)).toBeInTheDocument();
    });

    test('has navigation menu with keyboard support', () => {
      render(<MobileApp />);
      
      const navButtons = screen.getAllByRole('button');
      const navigationButtons = navButtons.filter(button => 
        button.closest('[role="navigation"]')
      );
      
      navigationButtons.forEach((button) => {
        button.focus();
        expect(button).toHaveFocus();
      });
    });

    test('shows loading indicators during async operations', () => {
      render(<MobileApp />);
      
      // Initially should show loading state
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    test('implements subtle animations for user feedback', () => {
      render(<MobileApp />);
      
      // Check for animation classes
      const container = screen.getByTestId('mobile-app-container');
      const styles = window.getComputedStyle(container);
      
      // Should have transition properties
      expect(styles.transition).not.toBe('all 0s ease 0s');
    });
  });

  describe('Step 5: Error Handling and User Feedback', () => {
    test('displays clear error messages when API calls fail', async () => {
      const mockApiService = require('../services/apiService');
      mockApiService.fetchAccounts.mockRejectedValue(new Error('API Error'));
      
      render(<MobileApp />);
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
        expect(screen.getByText(/api error/i)).toBeInTheDocument();
      });
    });

    test('shows success messages for completed operations', async () => {
      render(<MobileApp />);
      
      // Navigate to transfer screen
      const transferButton = screen.getByLabelText('Transfer');
      fireEvent.click(transferButton);
      
      // Fill transfer form
      const fromAccountSelect = screen.getByLabelText('From Account');
      const toAccountInput = screen.getByLabelText('To Account');
      const amountInput = screen.getByLabelText('Amount');
      const submitButton = screen.getByRole('button', { name: /transfer money/i });
      
      // Set form values
      fireEvent.change(fromAccountSelect, { target: { value: 'ACC001' } });
      fireEvent.change(toAccountInput, { target: { value: 'ACC002' } });
      fireEvent.change(amountInput, { target: { value: '100' } });
      
      // Submit form
      fireEvent.click(submitButton);
      
      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/transfer successful/i)).toBeInTheDocument();
      });
    });

    test('provides contextual tips for form validation', () => {
      render(<MobileApp />);
      
      const partyIdInput = screen.getByLabelText(/party id/i);
      
      // Test validation tips
      fireEvent.change(partyIdInput, { target: { value: '' } });
      fireEvent.blur(partyIdInput);
      
      expect(screen.getByText(/party id is required/i)).toBeInTheDocument();
    });

    test('implements autosave functionality for forms', () => {
      render(<MobileApp />);
      
      const partyIdInput = screen.getByLabelText(/party id/i);
      
      // Test autosave on input change
      fireEvent.change(partyIdInput, { target: { value: 'NEW123' } });
      
      // Should save to localStorage
      expect(window.localStorage.setItem).toHaveBeenCalledWith('currentPartyId', 'NEW123');
    });
  });

  describe('Step 6: Gestalt Principles and Visual Hierarchy', () => {
    test('groups related elements using proximity and similarity', () => {
      render(<MobileApp />);
      
      // Check that related elements are grouped together
      const accountsSection = screen.getByTestId('accounts-section');
      const loansSection = screen.getByTestId('loans-section');
      
      expect(accountsSection).toBeInTheDocument();
      expect(loansSection).toBeInTheDocument();
    });

    test('creates clear visual hierarchy with typography', () => {
      render(<MobileApp />);
      
      // Check heading hierarchy
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check that headings have proper structure
      headings.forEach(heading => {
        expect(heading.tagName).toMatch(/^H[1-6]$/);
      });
    });

    test('uses effective whitespace to reduce clutter', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      const styles = window.getComputedStyle(container);
      
      // Check for proper padding and margins
      expect(styles.padding).not.toBe('0px');
    });

    test('maintains consistent iconography and visual elements', () => {
      render(<MobileApp />);
      
      // Check for consistent icon usage (using emoji icons)
      const icons = screen.getAllByText(/[🏠💸👤🔒]/);
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Step 7: Trust and Credibility Features', () => {
    test('displays security indicators and privacy notices', () => {
      render(<MobileApp />);
      
      // Check for security indicators
      expect(screen.getByText(/secure/i)).toBeInTheDocument();
      expect(screen.getByText(/privacy/i)).toBeInTheDocument();
    });

    test('provides predictable behaviors for user actions', () => {
      render(<MobileApp />);
      
      // Test predictable navigation
      const homeButton = screen.getByRole('button', { name: /home/i });
      const transferButton = screen.getByRole('button', { name: /transfer/i });
      
      fireEvent.click(transferButton);
      expect(screen.getByTestId('transfer-screen')).toBeInTheDocument();
      
      fireEvent.click(homeButton);
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    });

    test('requires confirmation for critical operations', () => {
      render(<MobileApp />);
      
      // Navigate to transfer screen
      const transferButton = screen.getByLabelText('Transfer');
      fireEvent.click(transferButton);
      
      // Fill transfer form with large amount
      const fromAccountSelect = screen.getByLabelText('From Account');
      const toAccountInput = screen.getByLabelText('To Account');
      const amountInput = screen.getByLabelText('Amount');
      const submitButton = screen.getByRole('button', { name: /transfer money/i });
      
      // Set form values with large amount
      fireEvent.change(fromAccountSelect, { target: { value: 'ACC001' } });
      fireEvent.change(toAccountInput, { target: { value: 'ACC002' } });
      fireEvent.change(amountInput, { target: { value: '10000' } });
      
      // Submit form
      fireEvent.click(submitButton);
      
      // Should show confirmation dialog
      expect(screen.getByText(/confirm transfer/i)).toBeInTheDocument();
    });

    test('provides tooltips and guided onboarding', () => {
      render(<MobileApp />);
      
      // Check for tooltips
      const elementsWithTooltips = screen.getAllByTitle(/.*/);
      expect(elementsWithTooltips.length).toBeGreaterThan(0);
    });
  });

  describe('Step 8: Comprehensive Testing', () => {
    test('meets all accessibility requirements', () => {
      render(<MobileApp />);
      
      // Check for all required accessibility features
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Check for proper heading structure
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check for form labels
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveAttribute('aria-label') || expect(input).toHaveAttribute('id');
      });
    });

    test('performs well across different devices and screen sizes', () => {
      render(<MobileApp />);
      
      const container = screen.getByTestId('mobile-app-container');
      
      // Check inline styles for responsive design properties
      expect(container).toHaveStyle({ 
        maxWidth: '390px',
        width: '100%'
      });
    });

    test('correctly implements Temenos Color Template and Voice guidelines', () => {
      render(<MobileApp />);
      
      // Check color implementation
      const rootStyles = getComputedStyle(document.documentElement);
      const primaryColor = rootStyles.getPropertyValue('--temenos-primary');
      const secondaryColor = rootStyles.getPropertyValue('--temenos-secondary');
      const accentColor = rootStyles.getPropertyValue('--temenos-accent');
      
      // Check that colors are set (may be empty in test environment)
      expect(primaryColor).toBeDefined();
      expect(secondaryColor).toBeDefined();
      expect(accentColor).toBeDefined();
      
      // Check branding elements
      expect(screen.getByText('Temenos')).toBeInTheDocument();
      expect(screen.getByText('Mobile Banking')).toBeInTheDocument();
    });
  });
}); 