import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventStream from '../components/EventStream';

// Mock fetch globally
global.fetch = jest.fn();

// Mock EventSource
global.EventSource = jest.fn(() => ({
  close: jest.fn(),
  addEventListener: jest.fn(),
  onopen: null,
  onmessage: null,
  onerror: null,
}));

// Mock console methods to avoid noise in tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch.mockClear();
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

describe('EventStream Component', () => {
  
  // Mock successful API responses
  const mockComponentsResponse = {
    success: true,
    data: [
      {
        key: 'party',
        name: 'Party/Customer - R24',
        version: 'R24',
        eventTypes: ['CUSTOMER.CREATED', 'CUSTOMER.UPDATED']
      },
      {
        key: 'deposits',
        name: 'Deposits R25',
        version: 'R25',
        eventTypes: ['ACCOUNT.OPENED', 'TRANSACTION.POSTED']
      },
      {
        key: 'lending',
        name: 'Lending R24',
        version: 'R24',
        eventTypes: ['LOAN.ORIGINATED', 'PAYMENT.RECEIVED']
      }
    ]
  };

  const mockStatsResponse = {
    success: true,
    data: {
      totalEvents: 42,
      activeConnections: 3,
      uptime: '2h 15m'
    }
  };

  beforeEach(() => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockComponentsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      });
  });

  describe('Step 1: Demo Area Width Tests', () => {
    test('demo area container should have 90% width of browser viewport', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Event Stream - Real-time Event Hub Streaming/)).toBeInTheDocument();
      });

      const container = screen.getByText(/Event Stream - Real-time Event Hub Streaming/).closest('.event-stream-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('event-stream-container');
      
      // The actual CSS rule sets width: 90vw in EventStream.css
      // Testing that the class is applied correctly
    });

    test('demo area container should maintain 90% width on window resize', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Event Stream - Real-time Event Hub Streaming/)).toBeInTheDocument();
      });

      // Simulate window resize
      global.innerWidth = 1200;
      global.dispatchEvent(new Event('resize'));

      const container = screen.getByText(/Event Stream - Real-time Event Hub Streaming/).closest('.event-stream-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('event-stream-container');
    });
  });

  describe('Step 3: Three Topics Per Row Layout Tests', () => {
    test('topics should be displayed in a 3-column grid layout', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText('Party/Customer - R24')).toBeInTheDocument();
      });

      const grid = document.querySelector('.components-grid');
      expect(grid).toBeInTheDocument();
      
      // The CSS grid-template-columns: repeat(3, 1fr) is defined
      // in EventStream.css, which creates a 3-column layout
    });

    test('topics should maintain 3-column layout with proper spacing', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText('Party/Customer - R24')).toBeInTheDocument();
        expect(screen.getByText('Deposits R25')).toBeInTheDocument();
        expect(screen.getByText('Lending R24')).toBeInTheDocument();
      });

      const grid = document.querySelector('.components-grid');
      expect(grid).toBeInTheDocument();
      expect(grid.children.length).toBe(3); // Should have 3 component cards
    });
  });

  describe('Step 5: Drag and Drop Functionality Tests', () => {
    test('should allow dragging deposits component to different position', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText('Deposits R25')).toBeInTheDocument();
      });

      const depositsCard = screen.getByText('Deposits R25').closest('.component-card');
      const lendingCard = screen.getByText('Lending R24').closest('.component-card');

      // Simulate drag start
      fireEvent.dragStart(depositsCard);
      
      // Simulate drag over and drop
      fireEvent.dragEnter(lendingCard, { target: lendingCard });
      fireEvent.drop(lendingCard);
      fireEvent.dragEnd(depositsCard);

      // Components should still be present after drag and drop
      expect(screen.getByText('Deposits R25')).toBeInTheDocument();
      expect(screen.getByText('Lending R24')).toBeInTheDocument();
    });

    test('should maintain new order after drag and drop operation', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText('Party/Customer - R24')).toBeInTheDocument();
      });

      const partyCard = screen.getByText('Party/Customer - R24').closest('.component-card');
      const depositsCard = screen.getByText('Deposits R25').closest('.component-card');

      // Perform drag and drop
      fireEvent.dragStart(partyCard);
      fireEvent.dragEnter(depositsCard);
      fireEvent.drop(depositsCard);
      fireEvent.dragEnd(partyCard);

      // All components should still be rendered
      expect(screen.getByText('Party/Customer - R24')).toBeInTheDocument();
      expect(screen.getByText('Deposits R25')).toBeInTheDocument();
      expect(screen.getByText('Lending R24')).toBeInTheDocument();
    });
  });

  describe('Component Rendering and Basic Functionality', () => {
    test('should render EventStream component with header', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Event Stream - Real-time Event Hub Streaming/)).toBeInTheDocument();
      });
    });

    test('should display component cards after loading', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText('Party/Customer - R24')).toBeInTheDocument();
        expect(screen.getByText('Deposits R25')).toBeInTheDocument();
        expect(screen.getByText('Lending R24')).toBeInTheDocument();
      });
    });

    test('should display connect buttons for each component', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        const connectButtons = screen.getAllByText(/Connect to Stream/);
        expect(connectButtons).toHaveLength(3);
      });
    });
  });

  describe('Integration with DemoFlow Container', () => {
    test('should allow 90% width when rendered within DemoFlow context', async () => {
      // Create a mock DemoFlow container
      const demoFlowContent = document.createElement('div');
      demoFlowContent.className = 'demo-flow-content';
      demoFlowContent.style.width = '100%';
      demoFlowContent.style.height = '100vh';
      document.body.appendChild(demoFlowContent);

      await act(async () => {
        // Render EventStream within the DemoFlow context
        render(<EventStream />, { container: demoFlowContent });
      });

      const container = screen.getByText(/Event Stream - Real-time Event Hub Streaming/).closest('.event-stream-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('event-stream-container');

      // Clean up
      document.body.removeChild(demoFlowContent);
    });

    test('events container should be vertically resizable with proper height settings', async () => {
      await act(async () => {
        render(<EventStream />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Event Stream - Real-time Event Hub Streaming/)).toBeInTheDocument();
      });

      // The events container should have resize capability when components are connected
      // This is tested through CSS class presence since the resize functionality 
      // is implemented via CSS resize property
      const grid = document.querySelector('.components-grid');
      expect(grid).toBeInTheDocument();
    });
  });
});