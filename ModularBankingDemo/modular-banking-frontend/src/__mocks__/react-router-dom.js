const mockNavigate = jest.fn();

module.exports = {
  useNavigate: () => mockNavigate,
  BrowserRouter: ({ children }) => children,
  Routes: ({ children }) => children,
  Route: ({ element }) => element,
  Link: ({ children, ...props }) => children,
  __mockNavigate: mockNavigate,
}; 