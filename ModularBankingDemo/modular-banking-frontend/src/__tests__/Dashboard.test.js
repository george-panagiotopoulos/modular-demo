import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Dashboard from '../Dashboard';

// Mock useNavigate for testing
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('renders four rectangles in 2x2 grid layout', () => {
    render(<Dashboard />);
    
    const dashboardGrid = screen.getByTestId('dashboard-grid');
    expect(dashboardGrid).toBeInTheDocument();
    
    // Check for all four rectangles
    expect(screen.getByText('Deposits')).toBeInTheDocument();
    expect(screen.getByText('Lending')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  test('rectangles have proper styling and accessibility', () => {
    render(<Dashboard />);
    
    const depositsButton = screen.getByLabelText(/Open Deposits Interface/);
    expect(depositsButton).toHaveClass('dashboard-rectangle');
    expect(depositsButton).toHaveAttribute('role', 'button');
    expect(depositsButton).toHaveAttribute('tabIndex', '0');
  });

  test('clicking deposits opens deposits pane', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const depositsButton = screen.getByLabelText(/Open Deposits Interface/);
    await user.click(depositsButton);
    
    expect(screen.getByTestId('deposits-pane')).toBeInTheDocument();
  });

  test('Learn More button is present and functional', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    // First click the Supporting Services circular pane to open it
    const supportingServicesPane = screen.getByTestId('supporting-services-circle');
    await user.click(supportingServicesPane);
    
    // Now look for the Learn More button in the opened pane
    const learnMoreButton = screen.getByLabelText(/Navigate to detailed Supporting Services page/);
    expect(learnMoreButton).toBeInTheDocument();
    expect(learnMoreButton).toHaveClass('learn-more-button');
    
    await user.click(learnMoreButton);
    expect(mockNavigate).toHaveBeenCalledWith('/supporting-services');
  });

  test('circular panes are rendered', () => {
    render(<Dashboard />);
    
    // Check for individual circular panes instead of a container
    const modularArchitecturePane = screen.getByTestId('modular-architecture-circle');
    const supportingServicesPane = screen.getByTestId('supporting-services-circle');
    
    expect(modularArchitecturePane).toBeInTheDocument();
    expect(supportingServicesPane).toBeInTheDocument();
    
    expect(screen.getByText('Modular Architecture')).toBeInTheDocument();
    expect(screen.getByText('Supporting Services')).toBeInTheDocument();
  });

  test('footer is rendered with Temenos branding', () => {
    render(<Dashboard />);
    
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent(/Temenos/);
  });

  // New failing tests for End-to-end Demo Flow button
  test('renders End-to-end Demo Flow button in horizontal section', () => {
    render(<Dashboard />);
    
    // This should fail initially as the button doesn't exist yet
    const demoFlowButton = screen.getByTestId('demo-flow-button');
    expect(demoFlowButton).toBeInTheDocument();
    expect(demoFlowButton).toHaveTextContent('End-to-end Demo Flow');
  });

  test('Demo Flow button is positioned between rectangles and information pane', () => {
    render(<Dashboard />);
    
    // Check that the demo flow section exists and is positioned correctly
    const demoFlowSection = screen.getByTestId('demo-flow-section');
    expect(demoFlowSection).toBeInTheDocument();
    expect(demoFlowSection).toHaveClass('demo-flow-section');
  });

  test('Demo Flow button has proper styling and accessibility', () => {
    render(<Dashboard />);
    
    const demoFlowButton = screen.getByTestId('demo-flow-button');
    expect(demoFlowButton).toHaveClass('demo-flow-button');
    expect(demoFlowButton).toHaveAttribute('role', 'button');
    expect(demoFlowButton).toHaveAttribute('tabIndex', '0');
    expect(demoFlowButton).toHaveAttribute('aria-label', 'Start End-to-end Demo Flow - Experience complete banking workflow');
  });

  test('clicking Demo Flow button navigates to demo flow page', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const demoFlowButton = screen.getByTestId('demo-flow-button');
    await user.click(demoFlowButton);
    
    // Should navigate to the demo flow route
    expect(mockNavigate).toHaveBeenCalledWith('/demo-flow');
  });

  test('Demo Flow button supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const demoFlowButton = screen.getByTestId('demo-flow-button');
    demoFlowButton.focus();
    
    // Test Enter key
    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/demo-flow');
    
    mockNavigate.mockClear();
    
    // Test Space key
    await user.keyboard(' ');
    expect(mockNavigate).toHaveBeenCalledWith('/demo-flow');
  });
}); 