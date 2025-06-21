import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HeadlessV3 from '../components/HeadlessV3';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock EventSource for SSE connections
global.EventSource = jest.fn(() => ({
  addEventListener: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  onmessage: null,
  onerror: null
}));

describe('HeadlessV3 Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    fetch.mockClear();
    EventSource.mockClear();
    
    // Mock successful API responses
    fetch.mockImplementation((url) => {
      if (url.includes('/components')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                key: 'deposits',
                name: 'Deposits/Accounts Module R25',
                version: 'R25',
                description: 'Account creation and deposit operations',
                config: { kafkaTopic: 'deposits-event-topic' }
              },
              {
                key: 'lending',
                name: 'Lending Module R24',
                version: 'R24',
                description: 'Loan applications and processing',
                config: { kafkaTopic: 'lending-event-topic' }
              },
              {
                key: 'party',
                name: 'Party/Customer - R24',
                version: 'R24',
                description: 'Customer data and profile management',
                config: { kafkaTopic: 'ms-party-outbox' }
              }
            ]
          })
        });
      }
      
      if (url.includes('/stats')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: { sessions: { active: 2 }, connections: { total: 5 } }
          })
        });
      }
      
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Step 1: Demo Area Width Tests', () => {
    test('demo area container should have 90% width of browser viewport', async () => {
      // Arrange: Set up viewport dimensions
      const mockViewportWidth = 1200;
      const expectedContainerWidth = mockViewportWidth * 0.9; // 90% of viewport
      
      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: mockViewportWidth,
      });

      // Act: Render the component
      render(<HeadlessV3 />);
      
      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/HeadlessV3 - Real-time Event Hub Streaming/)).toBeInTheDocument();
      });

      // Assert: Check if container has 90% width
      const demoAreaContainer = screen.getByText(/HeadlessV3 - Real-time Event Hub Streaming/).closest('.headless-v3-container');
      expect(demoAreaContainer).toBeInTheDocument();
      
      // Get computed styles
      const containerStyles = window.getComputedStyle(demoAreaContainer);
      const containerWidth = parseInt(containerStyles.width);
      
      // This test should initially FAIL as current implementation doesn't use 90% width
      expect(containerWidth).toBe(expectedContainerWidth);
    });

    test('demo area container should maintain 90% width on window resize', async () => {
      // Arrange: Initial viewport
      const initialViewportWidth = 1200;
      const resizedViewportWidth = 800;
      
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: initialViewportWidth,
      });

      // Act: Render component
      render(<HeadlessV3 />);
      
      await waitFor(() => {
        expect(screen.getByText(/HeadlessV3 - Real-time Event Hub Streaming/)).toBeInTheDocument();
      });

      // Simulate window resize
      window.innerWidth = resizedViewportWidth;
      fireEvent(window, new Event('resize'));

      // Assert: Container should maintain 90% width after resize
      const demoAreaContainer = screen.getByText(/HeadlessV3 - Real-time Event Hub Streaming/).closest('.headless-v3-container');
      const containerStyles = window.getComputedStyle(demoAreaContainer);
      const containerWidth = parseInt(containerStyles.width);
      const expectedWidth = resizedViewportWidth * 0.9;
      
      // This test should initially FAIL
      expect(containerWidth).toBe(expectedWidth);
    });
  });

  describe('Step 3: Three Topics Per Row Layout Tests', () => {
    test('topics should be displayed in a 3-column grid layout', async () => {
      // Act: Render the component
      render(<HeadlessV3 />);
      
      // Wait for components to load
      await waitFor(() => {
        expect(screen.getByText('Deposits/Accounts Module R25')).toBeInTheDocument();
        expect(screen.getByText('Lending Module R24')).toBeInTheDocument();
        expect(screen.getByText('Party/Customer - R24')).toBeInTheDocument();
      });

      // Assert: Check grid layout has 3 columns
      const componentsGrid = document.querySelector('.components-grid');
      expect(componentsGrid).toBeInTheDocument();
      
      const gridStyles = window.getComputedStyle(componentsGrid);
      const gridTemplateColumns = gridStyles.gridTemplateColumns;
      
      // Should have 3 columns - this test should initially FAIL
      // Current implementation likely has 2 columns or auto-fit
      const columnCount = gridTemplateColumns.split(' ').length;
      expect(columnCount).toBe(3);
    });

    test('topics should maintain 3-column layout with proper spacing', async () => {
      // Act: Render the component
      render(<HeadlessV3 />);
      
      await waitFor(() => {
        expect(screen.getByText('Deposits/Accounts Module R25')).toBeInTheDocument();
      });

      // Assert: Check that grid gap is maintained
      const componentsGrid = document.querySelector('.components-grid');
      const gridStyles = window.getComputedStyle(componentsGrid);
      
      // Verify grid gap exists for proper spacing
      expect(gridStyles.gap || gridStyles.gridGap).toBeTruthy();
      
      // Verify 3-column layout is maintained
      const gridTemplateColumns = gridStyles.gridTemplateColumns;
      expect(gridTemplateColumns).toContain('repeat(3');
    });
  });

  describe('Step 5: Drag and Drop Functionality Tests', () => {
    test('should allow dragging deposits component to different position', async () => {
      // Act: Render the component
      render(<HeadlessV3 />);
      
      await waitFor(() => {
        expect(screen.getByText('Deposits/Accounts Module R25')).toBeInTheDocument();
        expect(screen.getByText('Lending Module R24')).toBeInTheDocument();
      });

      // Get initial order of components
      const componentsGrid = document.querySelector('.components-grid');
      const initialComponents = Array.from(componentsGrid.children);
      const initialOrder = initialComponents.map(component => 
        component.querySelector('h3').textContent
      );

      // Assert: Initial order should be as expected
      expect(initialOrder).toContain('Deposits/Accounts Module R25');
      expect(initialOrder).toContain('Lending Module R24');

      // This test should initially FAIL as drag-and-drop is not implemented
      // We'll simulate drag and drop once implemented
      const depositsComponent = screen.getByText('Deposits/Accounts Module R25').closest('.component-card');
      
      // Check if component has draggable attributes (should fail initially)
      expect(depositsComponent).toHaveAttribute('draggable', 'true');
    });

    test('should maintain new order after drag and drop operation', async () => {
      // Act: Render the component
      render(<HeadlessV3 />);
      
      await waitFor(() => {
        expect(screen.getByText('Deposits/Accounts Module R25')).toBeInTheDocument();
        expect(screen.getByText('Lending Module R24')).toBeInTheDocument();
      });

      // This test should initially FAIL as drag-and-drop is not implemented
      // We'll implement the actual drag and drop simulation once the functionality is added
      
      // For now, check that components exist and are in initial order
      const depositsComponent = screen.getByText('Deposits/Accounts Module R25');
      const lendingComponent = screen.getByText('Lending Module R24');
      
      expect(depositsComponent).toBeInTheDocument();
      expect(lendingComponent).toBeInTheDocument();
      
      // This assertion should fail initially - we expect drag-drop data attributes
      const depositsCard = depositsComponent.closest('.component-card');
      expect(depositsCard).toHaveAttribute('data-rbd-draggable-id');
    });
  });

  describe('Component Rendering and Basic Functionality', () => {
    test('should render HeadlessV3 component with header', async () => {
      // Act: Render the component
      render(<HeadlessV3 />);
      
      // Assert: Check if main elements are rendered
      await waitFor(() => {
        expect(screen.getByText(/HeadlessV3 - Real-time Event Hub Streaming/)).toBeInTheDocument();
      });
    });

    test('should display component cards after loading', async () => {
      // Act: Render the component
      render(<HeadlessV3 />);
      
      // Assert: Check if component cards are displayed
      await waitFor(() => {
        expect(screen.getByText('Deposits/Accounts Module R25')).toBeInTheDocument();
        expect(screen.getByText('Lending Module R24')).toBeInTheDocument();
        expect(screen.getByText('Party/Customer - R24')).toBeInTheDocument();
      });
    });

    test('should display connect buttons for each component', async () => {
      // Act: Render the component
      render(<HeadlessV3 />);
      
      // Assert: Check if connect buttons are present
      await waitFor(() => {
        const connectButtons = screen.getAllByText(/Connect to Event Hub/);
        expect(connectButtons).toHaveLength(3); // Should have 3 connect buttons
      });
    });
  });
}); 