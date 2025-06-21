// Jest setup file
beforeEach(() => {
  // Clear any existing timers
  jest.clearAllTimers();
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000); 