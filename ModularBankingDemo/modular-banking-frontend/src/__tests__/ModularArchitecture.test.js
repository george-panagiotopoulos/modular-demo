import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModularArchitecture from '../ModularArchitecture';

// Use manual mock
jest.mock('react-router-dom');
const { __mockNavigate } = require('react-router-dom');

describe('ModularArchitecture Component', () => {
  beforeEach(() => {
    __mockNavigate.mockClear();
  });

  test('component exists and is testable', () => {
    expect(ModularArchitecture).toBeDefined();
    expect(typeof ModularArchitecture).toBe('function');
  });

  test('renders the component with correct content', () => {
    render(<ModularArchitecture />);
    
    // Check for topic buttons container and placeholder content
    expect(screen.getByTestId('topic-buttons-container')).toBeInTheDocument();
    expect(screen.getByText('Select a Topic to Learn More')).toBeInTheDocument();
  });

  test('renders twelve topic buttons with correct styling and accessibility', () => {
    render(<ModularArchitecture />);
    
    const buttons = screen.getAllByRole('button');
    const topicButtons = buttons.filter(button => 
      button.textContent.includes('Why Modularity is needed') ||
      button.textContent.includes('What is modularity') ||
      button.textContent.includes('Temenos approach to domain design') ||
      button.textContent.includes('Module independence') ||
      button.textContent.includes('Configuration and customization') ||
      button.textContent.includes('DevOps Architecture') ||
      button.textContent.includes('Integration patterns') ||
      button.textContent.includes('API and Event design principles') ||
      button.textContent.includes('User Experience') ||
      button.textContent.includes('Deployment Architecture') ||
      button.textContent.includes('Security Architecture') ||
      button.textContent.includes('Observability')
    );
    
    expect(topicButtons).toHaveLength(12);
    
    topicButtons.forEach(button => {
      expect(button).toHaveAttribute('aria-pressed');
      expect(button).toHaveAttribute('tabindex', '0');
    });
  });

  test('renders content pane below button group', () => {
    render(<ModularArchitecture />);
    
    const contentPane = screen.getByTestId('content-pane');
    expect(contentPane).toBeInTheDocument();
  });

  test('displays correct content when topic button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModularArchitecture />);
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('modular-architecture-container')).toBeInTheDocument();
    });
    
    // Click on the first topic button to display content
    const whyModularityButton = screen.getByText('Why Modularity is needed');
    await user.click(whyModularityButton);
    
    // Check that content is displayed after clicking
    expect(screen.getByText(/Traditional monolithic banking/)).toBeInTheDocument();
    expect(screen.getByText('Scalability limitations in monolithic T24 systems')).toBeInTheDocument();
  });

  test('only one topic button can be active at a time', async () => {
    const user = userEvent.setup();
    render(<ModularArchitecture />);
    
    const whyModularityButton = screen.getByText('Why Modularity is needed');
    const whatIsModularityButton = screen.getByText('What is modularity');
    
    await user.click(whyModularityButton);
    expect(whyModularityButton).toHaveClass('active');
    
    await user.click(whatIsModularityButton);
    expect(whatIsModularityButton).toHaveClass('active');
    expect(whyModularityButton).not.toHaveClass('active');
  });

  test('supports keyboard navigation for topic buttons', async () => {
    const user = userEvent.setup();
    render(<ModularArchitecture />);
    
    const whyModularityButton = screen.getByText('Why Modularity is needed');
    
    whyModularityButton.focus();
    expect(whyModularityButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(whyModularityButton).toHaveClass('active');
  });

  test('has proper responsive layout structure', () => {
    render(<ModularArchitecture />);
    
    const container = screen.getByTestId('modular-architecture-container');
    expect(container).toHaveClass('modular-architecture-container');
    
    const buttonContainer = screen.getByTestId('topic-buttons-container');
    expect(buttonContainer).toHaveClass('topic-buttons-container');
  });

  test('displays placeholder content when no topic is selected', () => {
    render(<ModularArchitecture />);
    
    expect(screen.getByText('Select a Topic to Learn More')).toBeInTheDocument();
    expect(screen.getByText('Choose one of the architecture topics above to explore detailed information about our modular banking platform.')).toBeInTheDocument();
  });

  test('component has appropriate ARIA attributes for accessibility', () => {
    render(<ModularArchitecture />);
    
    const container = screen.getByTestId('modular-architecture-container');
    expect(container).toHaveAttribute('role', 'main');
    
    const contentPane = screen.getByTestId('content-pane');
    expect(contentPane).toHaveAttribute('aria-live', 'polite');
  });
}); 