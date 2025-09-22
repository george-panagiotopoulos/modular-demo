import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import JoltMapper from '../components/JoltMapper/JoltMapper';
import * as joltGenerator from '../utils/joltGenerator';

// Mock the utility functions
jest.mock('../utils/joltGenerator', () => ({
  validateJSON: jest.fn(),
  generateJOLT: jest.fn(),
  callLLMStreaming: jest.fn()
}));

// Mock the joltService
jest.mock('../services/joltService', () => ({
  fetchTransformations: jest.fn(() => Promise.resolve([])),
  saveTransformation: jest.fn(() => Promise.resolve({})),
  deleteTransformation: jest.fn(() => Promise.resolve())
}));

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
    jest.clearAllMocks();
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

  test('renders JoltMapper component', () => {
    renderJoltMapper();
    expect(screen.getByText('JOLT Mapper')).toBeInTheDocument();
  });

  test('renders navigation menu with all tabs', () => {
    renderJoltMapper();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Transformer')).toBeInTheDocument();
    expect(screen.getByText('JOLT Spec Generator')).toBeInTheDocument();
  });

  test('displays JOLT Spec Generator button', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    expect(generatorButton).toBeInTheDocument();
  });

  test('shows generator section when JOLT Spec Generator button is clicked', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    expect(screen.getByText('Generate JOLT specifications using AI by providing input and desired output JSON structures.')).toBeInTheDocument();
  });

  test('displays input and output textareas in generator section', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    expect(screen.getByPlaceholderText('Enter your input JSON structure here...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your desired output JSON structure here...')).toBeInTheDocument();
  });

  test('displays instructions textarea in generator section', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    expect(screen.getByPlaceholderText('Enter any additional instructions or requirements for the JOLT transformation...')).toBeInTheDocument();
  });

  test('shows generate button in generator section', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    expect(screen.getByText('Generate JOLT Specification')).toBeInTheDocument();
  });

  test('generate button is disabled when inputs are empty', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const generateButton = screen.getByText('Generate JOLT Specification');
    expect(generateButton).toBeDisabled();
  });

  test('generate button is enabled when both inputs have content', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const inputTextarea = screen.getByPlaceholderText('Enter your input JSON structure here...');
    const outputTextarea = screen.getByPlaceholderText('Enter your desired output JSON structure here...');
    
    fireEvent.change(inputTextarea, { target: { value: '{"test": "input"}' } });
    fireEvent.change(outputTextarea, { target: { value: '{"test": "output"}' } });
    
    const generateButton = screen.getByText('Generate JOLT Specification');
    expect(generateButton).not.toBeDisabled();
  });

  test('displays help section in generator', () => {
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    expect(screen.getByText('How to use:')).toBeInTheDocument();
    expect(screen.getByText('Paste your input JSON structure in the first textarea')).toBeInTheDocument();
  });

  test('calls validateJSON when generating JOLT specification', async () => {
    joltGenerator.validateJSON.mockImplementation(() => true);
    joltGenerator.callLLMStreaming.mockResolvedValue('{"operation": "shift"}');
    
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const inputTextarea = screen.getByPlaceholderText('Enter your input JSON structure here...');
    const outputTextarea = screen.getByPlaceholderText('Enter your desired output JSON structure here...');
    const generateButton = screen.getByText('Generate JOLT Specification');
    
    fireEvent.change(inputTextarea, { target: { value: '{"test": "input"}' } });
    fireEvent.change(outputTextarea, { target: { value: '{"test": "output"}' } });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(joltGenerator.validateJSON).toHaveBeenCalledWith('{"test": "input"}');
      expect(joltGenerator.validateJSON).toHaveBeenCalledWith('{"test": "output"}');
    });
  });

  test('calls callLLMStreaming when generating JOLT specification', async () => {
    joltGenerator.validateJSON.mockImplementation(() => true);
    joltGenerator.callLLMStreaming.mockResolvedValue('{"operation": "shift"}');
    
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const inputTextarea = screen.getByPlaceholderText('Enter your input JSON structure here...');
    const outputTextarea = screen.getByPlaceholderText('Enter your desired output JSON structure here...');
    const instructionsTextarea = screen.getByPlaceholderText('Enter any additional instructions or requirements for the JOLT transformation...');
    const generateButton = screen.getByText('Generate JOLT Specification');
    
    fireEvent.change(inputTextarea, { target: { value: '{"test": "input"}' } });
    fireEvent.change(outputTextarea, { target: { value: '{"test": "output"}' } });
    fireEvent.change(instructionsTextarea, { target: { value: 'Test instructions' } });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(joltGenerator.callLLMStreaming).toHaveBeenCalledWith(
        '{"test": "input"}',
        '{"test": "output"}',
        'Test instructions',
        expect.any(Function)
      );
    });
  });

  test('displays generated JOLT specification', async () => {
    joltGenerator.validateJSON.mockImplementation(() => true);
    joltGenerator.callLLMStreaming.mockResolvedValue('[{"operation": "shift", "spec": {"test": "result"}}]');
    
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const inputTextarea = screen.getByPlaceholderText('Enter your input JSON structure here...');
    const outputTextarea = screen.getByPlaceholderText('Enter your desired output JSON structure here...');
    const generateButton = screen.getByText('Generate JOLT Specification');
    
    fireEvent.change(inputTextarea, { target: { value: '{"test": "input"}' } });
    fireEvent.change(outputTextarea, { target: { value: '{"test": "output"}' } });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText('Generated JOLT Specification')).toBeInTheDocument();
      expect(screen.getByText('[{"operation": "shift", "spec": {"test": "result"}}]')).toBeInTheDocument();
    });
  });

  test('shows copy button when JOLT specification is generated', async () => {
    joltGenerator.validateJSON.mockImplementation(() => true);
    joltGenerator.callLLMStreaming.mockResolvedValue('[{"operation": "shift"}]');
    
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const inputTextarea = screen.getByPlaceholderText('Enter your input JSON structure here...');
    const outputTextarea = screen.getByPlaceholderText('Enter your desired output JSON structure here...');
    const generateButton = screen.getByText('Generate JOLT Specification');
    
    fireEvent.change(inputTextarea, { target: { value: '{"test": "input"}' } });
    fireEvent.change(outputTextarea, { target: { value: '{"test": "output"}' } });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
    });
  });

  test('displays error message when validation fails', async () => {
    joltGenerator.validateJSON.mockImplementation(() => {
      throw new Error('Invalid JSON format');
    });
    
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const inputTextarea = screen.getByPlaceholderText('Enter your input JSON structure here...');
    const outputTextarea = screen.getByPlaceholderText('Enter your desired output JSON structure here...');
    const generateButton = screen.getByText('Generate JOLT Specification');
    
    fireEvent.change(inputTextarea, { target: { value: 'invalid json' } });
    fireEvent.change(outputTextarea, { target: { value: '{"test": "output"}' } });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      const errorMessages = screen.getAllByText('Invalid JSON format');
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  test('shows generating state during JOLT generation', async () => {
    joltGenerator.validateJSON.mockImplementation(() => true);
    joltGenerator.callLLMStreaming.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('[{"operation": "shift"}]'), 100))
    );
    
    renderJoltMapper();
    const generatorButton = screen.getByText('JOLT Spec Generator');
    fireEvent.click(generatorButton);
    
    const inputTextarea = screen.getByPlaceholderText('Enter your input JSON structure here...');
    const outputTextarea = screen.getByPlaceholderText('Enter your desired output JSON structure here...');
    const generateButton = screen.getByText('Generate JOLT Specification');
    
    fireEvent.change(inputTextarea, { target: { value: '{"test": "input"}' } });
    fireEvent.change(outputTextarea, { target: { value: '{"test": "output"}' } });
    fireEvent.click(generateButton);
    
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Generate JOLT Specification')).toBeInTheDocument();
    });
  });
}); 