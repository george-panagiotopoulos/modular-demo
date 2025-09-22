import { validateJSON, generateJOLT, callLLM, callLLMStreaming } from '../utils/joltGenerator';

// Mock fetch globally
global.fetch = jest.fn();

// Add TextEncoder polyfill for Node.js environment
global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
global.TextDecoder = global.TextDecoder || require('util').TextDecoder;

describe('joltGenerator Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.REACT_APP_AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
    process.env.REACT_APP_AZURE_OPENAI_API_KEY = 'test-api-key';
    process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4';
  });

  describe('validateJSON', () => {
    test('should pass for valid JSON', () => {
      expect(() => validateJSON('{"test": "value"}')).not.toThrow();
      expect(() => validateJSON('[]')).not.toThrow();
      expect(() => validateJSON('null')).not.toThrow();
    });

    test('should throw error for empty string', () => {
      expect(() => validateJSON('')).toThrow('JSON input cannot be empty');
      expect(() => validateJSON('   ')).toThrow('JSON input cannot be empty');
    });

    test('should throw error for null or undefined', () => {
      expect(() => validateJSON(null)).toThrow('JSON input cannot be empty');
      expect(() => validateJSON(undefined)).toThrow('JSON input cannot be empty');
    });

    test('should throw error for invalid JSON', () => {
      expect(() => validateJSON('{"invalid": json}')).toThrow('Invalid JSON format');
      expect(() => validateJSON('not json at all')).toThrow('Invalid JSON format');
      expect(() => validateJSON('{"unclosed": "object"')).toThrow('Invalid JSON format');
    });
  });

  describe('callLLM', () => {
    test('should successfully call Azure OpenAI API', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '[{"operation": "shift", "spec": {"test": "result"}}]'
            }
          }
        ]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await callLLM('{"input": "test"}', '{"output": "test"}', 'instructions');

      expect(fetch).toHaveBeenCalledWith(
        'https://test.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': 'test-api-key'
          },
          body: expect.stringContaining('"stream":false')
        })
      );

      expect(result).toBe('[{"operation": "shift", "spec": {"test": "result"}}]');
    });

    test('should throw error when Azure OpenAI credentials are missing', async () => {
      delete process.env.REACT_APP_AZURE_OPENAI_ENDPOINT;
      delete process.env.REACT_APP_AZURE_OPENAI_API_KEY;

      await expect(callLLM('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Azure OpenAI credentials are not configured. Please check your environment variables.'
      );
    });

    test('should handle API error responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } })
      });

      await expect(callLLM('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Azure OpenAI API error: 401 - Invalid API key'
      );
    });

    test('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(callLLM('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Network error: Unable to connect to Azure OpenAI API. Please check your internet connection.'
      );
    });

    test('should handle invalid response format', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      await expect(callLLM('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Invalid response format from Azure OpenAI API'
      );
    });

    test('should handle invalid JSON in response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'invalid json response'
            }
          }
        ]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await expect(callLLM('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Generated JOLT specification is not valid JSON'
      );
    });

    test('should include instructions in prompt when provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '[{"operation": "shift"}]'
            }
          }
        ]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await callLLM('{"input": "test"}', '{"output": "test"}', 'custom instructions');

      const fetchCall = fetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.messages[1].content).toContain('Additional instructions: custom instructions');
    });
  });

  describe('generateJOLT', () => {
    test('should validate inputs and call LLM', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '[{"operation": "shift", "spec": {"test": "result"}}]'
            }
          }
        ]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateJOLT('{"input": "test"}', '{"output": "test"}', 'instructions');

      expect(result).toBe('[{"operation": "shift", "spec": {"test": "result"}}]');
    });

    test('should throw error for invalid input JSON', async () => {
      await expect(generateJOLT('invalid json', '{"output": "test"}')).rejects.toThrow(
        'Invalid JSON format'
      );
    });

    test('should throw error for invalid output JSON', async () => {
      await expect(generateJOLT('{"input": "test"}', 'invalid json')).rejects.toThrow(
        'Invalid JSON format'
      );
    });

    test('should propagate LLM errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { message: 'Server error' } })
      });

      await expect(generateJOLT('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Failed to generate JOLT specification: Azure OpenAI API error: 500 - Server error'
      );
    });
  });

  describe('callLLMStreaming', () => {
    test('should handle streaming response', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"["}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"{\\"operation\\":"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"\\"shift\\""}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"}"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"]"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[2]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[3]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[4]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[5]) })
          .mockResolvedValueOnce({ done: true })
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      const onChunk = jest.fn();
      const result = await callLLMStreaming('{"input": "test"}', '{"output": "test"}', '', onChunk);

      expect(result).toBe('[{"operation":"shift"}]');
      expect(onChunk).toHaveBeenCalledTimes(5);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"stream":true')
        })
      );
    });

    test('should handle streaming API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Rate limit exceeded' } })
      });

      await expect(callLLMStreaming('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Azure OpenAI API error: 429 - Rate limit exceeded'
      );
    });

    test('should handle invalid streaming JSON response', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"invalid json"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[1]) })
          .mockResolvedValueOnce({ done: true })
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      await expect(callLLMStreaming('{"input": "test"}', '{"output": "test"}')).rejects.toThrow(
        'Generated JOLT specification is not valid JSON'
      );
    });

    test('should skip invalid JSON chunks during streaming', async () => {
      const mockChunks = [
        'data: invalid json chunk\n\n',
        'data: {"choices":[{"delta":{"content":"["}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"]"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[2]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockChunks[3]) })
          .mockResolvedValueOnce({ done: true })
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      const onChunk = jest.fn();
      const result = await callLLMStreaming('{"input": "test"}', '{"output": "test"}', '', onChunk);

      expect(result).toBe('[]');
      expect(onChunk).toHaveBeenCalledTimes(2); // Only valid chunks should trigger callback
    });
  });
}); 