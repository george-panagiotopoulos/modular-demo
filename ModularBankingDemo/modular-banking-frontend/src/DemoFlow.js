import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DemoFlow.css';

// Loading component
const LoadingSpinner = () => (
  <div className="loading-spinner" role="status" aria-label="Loading">
    <div className="spinner"></div>
    <span className="sr-only">Loading demo flow content...</span>
  </div>
);

// Main DemoFlow Component
const DemoFlow = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleBackClick = () => {
    navigate('/');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      navigate('/');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="demo-flow-container">
        <div className="demo-flow-loading">
          <LoadingSpinner />
          <p>Preparing your end-to-end banking experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="demo-flow-container" 
      role="main"
      data-testid="demo-flow-container"
    >
      {/* Skip link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Error display */}
      {error && (
        <div className="error-message" role="alert" aria-live="assertive">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          {error}
          <button 
            className="error-dismiss" 
            onClick={() => setError(null)}
            aria-label="Dismiss error message"
          >
            ×
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="demo-flow-header">
        <button 
          className="back-button"
          onClick={handleBackClick}
          aria-label="Back to Dashboard"
        >
          <span className="back-arrow" aria-hidden="true">←</span>
          Back to Dashboard
        </button>
        <div className="header-content">
          <div className="header-icon" aria-hidden="true">🚀</div>
          <h1 id="main-content">End-to-end demo flow</h1>
          <p className="header-subtitle">Experience the Complete Banking Journey</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="demo-flow-main">
        <div className="demo-flow-content">
          <div className="welcome-section">
            <h2>Welcome to the Modular Banking Experience</h2>
            <p>
              This comprehensive demo will guide you through the complete banking workflow, 
              showcasing how our modular architecture delivers seamless customer experiences 
              while maintaining the flexibility and scalability that modern banks require.
            </p>
          </div>

          <div className="coming-soon-section">
            <div className="coming-soon-icon" aria-hidden="true">🔧</div>
            <h3>Coming Soon</h3>
            <p>
              We're currently preparing an interactive end-to-end demonstration that will showcase:
            </p>
            <ul className="feature-list">
              <li>Complete customer onboarding journey</li>
              <li>Account opening and management processes</li>
              <li>Loan application and approval workflow</li>
              <li>Payment processing and transfers</li>
              <li>Real-time analytics and reporting</li>
              <li>Cross-module integration capabilities</li>
            </ul>
          </div>

          <div className="placeholder-actions">
            <button 
              className="primary-action-button"
              onClick={handleBackClick}
              aria-label="Return to Dashboard to explore individual modules"
            >
              <span className="button-icon" aria-hidden="true">🏦</span>
              Explore Individual Modules
            </button>
            <button 
              className="secondary-action-button"
              onClick={() => navigate('/modular-architecture')}
              aria-label="Learn more about our modular architecture"
            >
              <span className="button-icon" aria-hidden="true">🏗️</span>
              Learn About Architecture
            </button>
          </div>
        </div>
      </main>

      {/* Temenos branding footer */}
      <footer className="demo-flow-footer" role="contentinfo">
        <p className="footer-text">
          Powered by <strong>Temenos</strong> - Leading Banking Software Solutions
        </p>
      </footer>
    </div>
  );
};

export default DemoFlow; 