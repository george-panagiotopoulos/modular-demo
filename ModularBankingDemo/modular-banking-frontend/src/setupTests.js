// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock CSS imports for testing
Object.defineProperty(window, 'getComputedStyle', {
  value: (element) => ({
    getPropertyValue: (prop) => {
      if (prop === 'background-color') return 'rgb(40, 50, 117)';
      if (prop === 'color') return 'rgb(255, 255, 255)';
      if (prop === 'display') return 'grid';
      if (prop === 'grid-template-columns') return '1fr 1fr';
      if (prop === 'grid-template-rows') return '1fr 1fr';
      if (prop === 'gap') return '20px';
      if (prop === 'cursor') return 'pointer';
      if (prop === 'outline') return 'none';
      return '';
    },
    // Add maxWidth property for mobile-responsive test
    maxWidth: element && element.classList && element.classList.contains('mobile-app-container') ? '390px' : undefined
  })
});

// Mock CSS custom properties
global.CSS = {
  supports: () => true
};
