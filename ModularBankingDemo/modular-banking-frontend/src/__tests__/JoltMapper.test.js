import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import JoltMapper from '../components/JoltMapper/JoltMapper';

// Mock fetch for API calls
global.fetch = jest.fn();

const renderJoltMapper = () => {
  return render(
    <BrowserRouter>
      <JoltMapper />
    </BrowserRouter>
  );
};

describe('JoltMapper Component', () => {
  beforeEach(() => {
    fetch.mockClear();
    // Mock successful fetch responses for sample data
    fetch.mockImplementation((url) => {
      if (url.includes('simple-input.json')) {
        return Promise.resolve({
          json: () => Promise.resolve({ users: { Alex: "alex@email.com", Peter: "peter@email.com" } })
        });
      }
      if (url.includes('simple-jolt-spec.json')) {
        return Promise.resolve({
          json: () => Promise.resolve([{ operation: "shift", spec: { users: { "*": { "$": "users[#2].firstName", "@": "users[#2].userId" } } } }])
        });
      }
      if (url.includes('simple-output.json')) {
        return Promise.resolve({
          json: () => Promise.resolve({ users: [{ firstName: "Alex", userId: "alex@email.com" }, { firstName: "Peter", userId: "peter@email.com" }] })
        });
      }
      // Mock other sample files
      return Promise.resolve({
        json: () => Promise.resolve({})
      });
    });
  });

  describe('Basic Functionality', () => {
    test('renders JoltMapper component', async () => {
      renderJoltMapper();
      await waitFor(() => {
        expect(screen.getByText('JOLT Mapper')).toBeInTheDocument();
      });
    });

    test('renders left navigation menu', async () => {
      renderJoltMapper();
      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Transformer')).toBeInTheDocument();
      });
    });
  });

  describe('JOLT Spec Generator Feature (Failing Tests)', () => {
    test('should display JOLT spec generator button in left menu below transformer button', async () => {
      renderJoltMapper();
      
      await waitFor(() => {
        expect(screen.getByText('Transformer')).toBeInTheDocument();
      });

      // This test should fail initially - the button doesn't exist yet
      expect(screen.getByText('JOLT Spec Generator')).toBeInTheDocument();
      
      // Verify positioning - JOLT Spec Generator should be after Transformer
      const navButtons = screen.getAllByRole('button');
      const transformerIndex = navButtons.findIndex(button => button.textContent.includes('Transformer'));
      const generatorIndex = navButtons.findIndex(button => button.textContent.includes('JOLT Spec Generator'));
      
      expect(generatorIndex).toBeGreaterThan(transformerIndex);
    });

    test('should display JOLT specification generator section when button is clicked', async () => {
      renderJoltMapper();
      
      await waitFor(() => {
        expect(screen.getByText('JOLT Spec Generator')).toBeInTheDocument();
      });

      // Click the JOLT Spec Generator button
      const generatorButton = screen.getByText('JOLT Spec Generator');
      fireEvent.click(generatorButton);

      // This test should fail initially - the section doesn't exist yet
      expect(screen.getByText('JOLT specification generator')).toBeInTheDocument();
    });

    test('should display user instructions in JOLT spec generator section', async () => {
      renderJoltMapper();
      
      await waitFor(() => {
        expect(screen.getByText('JOLT Spec Generator')).toBeInTheDocument();
      });

      const generatorButton = screen.getByText('JOLT Spec Generator');
      fireEvent.click(generatorButton);

      // This test should fail initially - the instructions don't exist yet
      expect(screen.getByText('Provide input JSON and target output JSON then press Generate JOLT')).toBeInTheDocument();
    });

    test('should display Generate JOLT button in the generator section', async () => {
      renderJoltMapper();
      
      await waitFor(() => {
        expect(screen.getByText('JOLT Spec Generator')).toBeInTheDocument();
      });

      const generatorButton = screen.getByText('JOLT Spec Generator');
      fireEvent.click(generatorButton);

      // This test should fail initially - the Generate JOLT button doesn't exist yet
      expect(screen.getByText('Generate JOLT')).toBeInTheDocument();
    });

    test('should have proper navigation state management', async () => {
      renderJoltMapper();
      
      await waitFor(() => {
        expect(screen.getByText('JOLT Spec Generator')).toBeInTheDocument();
      });

      // Click JOLT Spec Generator button
      const generatorButton = screen.getByText('JOLT Spec Generator');
      fireEvent.click(generatorButton);

      // This test should fail initially - active state styling doesn't exist yet
      expect(generatorButton).toHaveClass('active');

      // Click back to Overview
      const overviewButton = screen.getByText('Overview');
      fireEvent.click(overviewButton);

      expect(generatorButton).not.toHaveClass('active');
      expect(overviewButton).toHaveClass('active');
    });
  });

  describe('Existing Transformer Functionality', () => {
    test('should still work with transformer section', async () => {
      renderJoltMapper();
      
      await waitFor(() => {
        expect(screen.getByText('Transformer')).toBeInTheDocument();
      });

      const transformerButton = screen.getByText('Transformer');
      fireEvent.click(transformerButton);

      await waitFor(() => {
        expect(screen.getByText('Simple Transformation')).toBeInTheDocument();
      });
    });
  });
}); 