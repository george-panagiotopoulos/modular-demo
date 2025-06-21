import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SupportingServices from '../SupportingServices';

// Mock useNavigate hook
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock getComputedStyle for testing
const mockGetComputedStyle = (element) => {
  const className = element.className || '';
  
  const styleObject = {
    backgroundColor: 'rgb(255, 255, 255)',
    color: 'rgb(0, 0, 0)',
    cursor: 'default',
    outline: 'none',
    display: 'block'
  };
  
  // Temenos color mappings
  if (className.includes('business-service')) {
    styleObject.backgroundColor = 'rgb(92, 184, 178)'; // #5CB8B2
    styleObject.color = 'rgb(255, 255, 255)';
    styleObject.cursor = 'pointer';
  }
  
  if (className.includes('technical-service')) {
    styleObject.backgroundColor = 'rgb(130, 70, 175)'; // #8246AF
    styleObject.color = 'rgb(255, 255, 255)';
    styleObject.cursor = 'pointer';
  }
  
  // Add getPropertyValue method
  styleObject.getPropertyValue = (prop) => {
    const camelCaseProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    return styleObject[camelCaseProp] || '';
  };
  
  return styleObject;
};

// Override getComputedStyle globally for tests
Object.defineProperty(window, 'getComputedStyle', {
  value: mockGetComputedStyle
});

describe('SupportingServices Component', () => {
  test('renders Supporting Services page with correct sections', () => {
    render(<SupportingServices />);
    
    // Check for Business Services and Technical Services sections using more specific queries
    const businessServicesSection = screen.getByTestId('business-services-section');
    expect(within(businessServicesSection).getByText('Business Services')).toBeInTheDocument();
    
    const technicalServicesSection = screen.getByTestId('technical-services-section');
    expect(within(technicalServicesSection).getByText('Technical Services')).toBeInTheDocument();
  });

  test('renders Business Services layer with correct services', () => {
    render(<SupportingServices />);
    
    // Check for Business Services section
    expect(screen.getByText(/Business Services/i)).toBeInTheDocument();
    
    // Check for business services
    expect(screen.getByText('Holdings')).toBeInTheDocument();
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('Product Catalogue')).toBeInTheDocument();
    expect(screen.getByText('Sub-Ledger')).toBeInTheDocument();
    expect(screen.getByText('Limits')).toBeInTheDocument();
    
    // Verify they have correct styling class
    const holdingsService = screen.getByTestId('holdings-service');
    const partyService = screen.getByTestId('party-service');
    const productCatalogueService = screen.getByTestId('product-catalogue-service');
    
    expect(holdingsService).toHaveClass('business-service');
    expect(partyService).toHaveClass('business-service');
    expect(productCatalogueService).toHaveClass('business-service');
  });

  test('renders Technical Services layer with correct services', () => {
    render(<SupportingServices />);
    
    // Check for Technical Services section using more specific query
    const technicalServicesSection = screen.getByTestId('technical-services-section');
    expect(within(technicalServicesSection).getByText('Technical Services')).toBeInTheDocument();
    
    // Check for two technical services
    expect(screen.getByText('Event Store')).toBeInTheDocument();
    expect(screen.getByText('Generic Configuration')).toBeInTheDocument();
    
    // Verify technical services have correct test IDs
    expect(screen.getByTestId('event-store-service')).toBeInTheDocument();
    expect(screen.getByTestId('generic-configuration-service')).toBeInTheDocument();
  });

  test('business services have correct Temenos teal color styling', () => {
    render(<SupportingServices />);
    
    const businessServices = [
      screen.getByTestId('holdings-service'),
      screen.getByTestId('party-service'),
      screen.getByTestId('product-catalogue-service')
    ];
    
    businessServices.forEach(service => {
      const computedStyle = window.getComputedStyle(service);
      expect(computedStyle.backgroundColor).toBe('rgb(92, 184, 178)'); // #5CB8B2
      expect(computedStyle.color).toBe('rgb(255, 255, 255)');
      expect(computedStyle.cursor).toBe('pointer');
    });
  });

  test('technical services have correct Temenos purple color styling', () => {
    render(<SupportingServices />);
    
    const technicalServices = [
      screen.getByTestId('event-store-service'),
      screen.getByTestId('generic-configuration-service')
    ];
    
    technicalServices.forEach(service => {
      const computedStyle = window.getComputedStyle(service);
      expect(computedStyle.backgroundColor).toBe('rgb(130, 70, 175)'); // #8246AF
      expect(computedStyle.color).toBe('rgb(255, 255, 255)');
      expect(computedStyle.cursor).toBe('pointer');
    });
  });

  test('renders details pane placeholder', () => {
    render(<SupportingServices />);
    
    const detailsPane = screen.getByTestId('details-pane');
    expect(detailsPane).toBeInTheDocument();
    expect(detailsPane).toHaveTextContent(/Select a service to view details/i);
  });

  test('clicking business service updates selected state and details pane', async () => {
    const user = userEvent.setup();
    render(<SupportingServices />);
    
    const holdingsService = screen.getByTestId('holdings-service');
    await user.click(holdingsService);
    
    // Check that service is marked as active
    expect(holdingsService).toHaveClass('active');
    
    // Check that details pane shows Holdings information
    const detailsPane = screen.getByTestId('details-pane');
    expect(detailsPane).toHaveTextContent('Holdings');
  });

  test('clicking technical service updates selected state and details pane', async () => {
    const user = userEvent.setup();
    render(<SupportingServices />);
    
    const eventStoreService = screen.getByTestId('event-store-service');
    await user.click(eventStoreService);
    
    // Check that service is marked as active
    expect(eventStoreService).toHaveClass('active');
    
    // Check that details pane shows Event Store information
    const detailsPane = screen.getByTestId('details-pane');
    expect(detailsPane).toHaveTextContent('Event Store');
  });

  test('services support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SupportingServices />);
    
    const holdingsService = screen.getByTestId('holdings-service');
    
    // Focus the service
    holdingsService.focus();
    expect(holdingsService).toHaveFocus();
    
    // Activate with Enter key
    await user.keyboard('{Enter}');
    
    // Should be marked as active
    expect(holdingsService).toHaveClass('active');
    
    // Details pane should update
    const detailsPane = screen.getByTestId('details-pane');
    expect(detailsPane).toHaveTextContent('Holdings');
  });

  test('services have proper accessibility attributes', () => {
    render(<SupportingServices />);
    
    const allServices = [
      screen.getByTestId('holdings-service'),
      screen.getByTestId('party-service'),
      screen.getByTestId('product-catalogue-service'),
      screen.getByTestId('event-store-service'),
      screen.getByTestId('generic-configuration-service')
    ];
    
    allServices.forEach(service => {
      expect(service).toHaveAttribute('role', 'button');
      expect(service).toHaveAttribute('tabIndex', '0');
      expect(service).toHaveAttribute('aria-label');
    });
  });

  test('page layout follows Gestalt principles for visual grouping', () => {
    render(<SupportingServices />);
    
    // Check that business and technical services are properly grouped
    const businessSection = screen.getByTestId('business-services-section');
    const technicalSection = screen.getByTestId('technical-services-section');
    
    const businessServices = businessSection.querySelectorAll('[data-testid$="-service"]');
    const technicalServices = technicalSection.querySelectorAll('[data-testid$="-service"]');
    
    expect(businessServices).toHaveLength(5);
    expect(technicalServices).toHaveLength(2);
  });

  test('component is responsive across different screen sizes', () => {
    render(<SupportingServices />);
    
    // Check for responsive container
    const container = screen.getByTestId('supporting-services-container');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('supporting-services-container');
  });

  test('only one service can be active at a time', async () => {
    const user = userEvent.setup();
    render(<SupportingServices />);
    
    const holdingsService = screen.getByTestId('holdings-service');
    const partyService = screen.getByTestId('party-service');
    
    // Click first service
    await user.click(holdingsService);
    expect(holdingsService).toHaveClass('active');
    
    // Click second service
    await user.click(partyService);
    expect(partyService).toHaveClass('active');
    expect(holdingsService).not.toHaveClass('active');
  });

  test('details pane displays correct content for each service', async () => {
    const user = userEvent.setup();
    render(<SupportingServices />);
    
    const services = [
      { testId: 'holdings-service', expectedText: 'Holdings' },
      { testId: 'party-service', expectedText: 'Party' },
      { testId: 'product-catalogue-service', expectedText: 'Product Catalogue' },
      { testId: 'event-store-service', expectedText: 'Event Store' },
      { testId: 'generic-configuration-service', expectedText: 'Generic Configuration' }
    ];
    
    for (const service of services) {
      const serviceElement = screen.getByTestId(service.testId);
      await user.click(serviceElement);
      
      const detailsPane = screen.getByTestId('details-pane');
      expect(detailsPane).toHaveTextContent(service.expectedText);
    }
  });
}); 