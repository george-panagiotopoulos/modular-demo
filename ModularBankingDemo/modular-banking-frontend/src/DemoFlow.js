import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import APIViewer from './components/APIViewer';
import EventStream from './components/EventStream';
import MobileApp from './components/MobileApp/MobileApp';
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
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      navigate('/');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

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

  // Tab content renderer
  const renderTabContent = () => {
    switch (activeTab) {
      case 'api-viewer':
        return <APIViewer />;
      case 'event-stream':
        return <EventStream />;
      case 'mobile-app':
        return <MobileApp />;
      case 'branch-app':
        return (
          <div className="tab-content">
            <div className="coming-soon-section">
              <div className="coming-soon-icon">🏦</div>
              <h3>Branch Application Demo</h3>
              <p>Bank employee interface simulation coming soon...</p>
            </div>
          </div>
        );
      case 'architecture':
        return (
          <div className="tab-content">
            <div className="coming-soon-section">
              <div className="coming-soon-icon">🏗️</div>
              <h3>Architecture Visualization</h3>
              <p>Dynamic PUML architecture diagrams coming soon...</p>
            </div>
          </div>
        );
      case 'assistant':
        return (
          <div className="tab-content">
            <div className="coming-soon-section">
              <div className="coming-soon-icon">🤖</div>
              <h3>AI Assistant</h3>
              <p>RAG-powered architecture assistant coming soon...</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="tab-content">
            <div className="welcome-section">
              <h2>Welcome to the Modular Banking Experience</h2>
              <p>
                This comprehensive demo showcases how our modular architecture delivers seamless customer experiences 
                while maintaining the flexibility and scalability that modern banks require.
              </p>
            </div>

            <div className="demo-features">
              <div className="feature-card">
                <div className="feature-icon">🔧</div>
                <h3>API Viewer</h3>
                <p>Interactive REST API testing interface for banking solutions with real-time request/response handling.</p>
                <button 
                  className="feature-button"
                  onClick={() => setActiveTab('api-viewer')}
                >
                  Try API Viewer
                </button>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🚀</div>
                <h3>Event Stream</h3>
                <p>Real-time component event monitoring with dynamic component selection and live event feeds.</p>
                <button 
                  className="feature-button"
                  onClick={() => setActiveTab('event-stream')}
                >
                  Try Event Stream
                </button>
              </div>

              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h3>Mobile Banking</h3>
                <p>Customer-facing <span style={{ color: 'red' }}>demo</span> mobile application with complete banking functionality.</p>
                <button 
                  className="feature-button"
                  onClick={() => setActiveTab('mobile-app')}
                >
                  Try Mobile Banking
                </button>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🏦</div>
                <h3>Branch Application</h3>
                <p>Bank employee interface for customer service and operations.</p>
                <button 
                  className="feature-button"
                  onClick={() => setActiveTab('branch-app')}
                  disabled
                >
                  Coming Soon
                </button>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🏗️</div>
                <h3>Architecture View</h3>
                <p>Dynamic PUML visualization showing real-time component interactions.</p>
                <button 
                  className="feature-button"
                  onClick={() => setActiveTab('architecture')}
                  disabled
                >
                  Coming Soon
                </button>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h3>AI Assistant</h3>
                <p>RAG-powered assistant for architecture questions and guidance.</p>
                <button 
                  className="feature-button"
                  onClick={() => setActiveTab('assistant')}
                  disabled
                >
                  Coming Soon
                </button>
              </div>
            </div>
            
            {/* Additional Demo Assets Section */}
            <div className="additional-assets-section">
              <button 
                className="additional-assets-button"
                onClick={() => navigate('/additional-demos')}
              >
                <span className="additional-assets-icon">🔧</span>
                Additional Demo Assets
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="demo-flow-container" 
      role="main"
      data-testid="demo-flow-container"
    >
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

      {/* Tab Navigation */}
      {activeTab !== 'overview' && (
        <nav className="tab-navigation" role="tablist">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            role="tab"
            aria-selected={activeTab === 'overview'}
          >
            <span className="tab-icon">🏠</span>
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'api-viewer' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-viewer')}
            role="tab"
            aria-selected={activeTab === 'api-viewer'}
          >
            <span className="tab-icon">🔧</span>
            API Viewer
          </button>
          <button
            className={`tab-button ${activeTab === 'event-stream' ? 'active' : ''}`}
            onClick={() => setActiveTab('event-stream')}
            role="tab"
            aria-selected={activeTab === 'event-stream'}
          >
            <span className="tab-icon">🚀</span>
            Event Stream
          </button>
          <button
            className={`tab-button ${activeTab === 'mobile-app' ? 'active' : ''}`}
            onClick={() => setActiveTab('mobile-app')}
            role="tab"
            aria-selected={activeTab === 'mobile-app'}
          >
            <span className="tab-icon">📱</span>
            Mobile App
          </button>
          <button
            className={`tab-button ${activeTab === 'branch-app' ? 'active' : ''}`}
            onClick={() => setActiveTab('branch-app')}
            role="tab"
            aria-selected={activeTab === 'branch-app'}
            disabled
          >
            <span className="tab-icon">🏦</span>
            Branch App
          </button>
          <button
            className={`tab-button ${activeTab === 'architecture' ? 'active' : ''}`}
            onClick={() => setActiveTab('architecture')}
            role="tab"
            aria-selected={activeTab === 'architecture'}
            disabled
          >
            <span className="tab-icon">🏗️</span>
            Architecture
          </button>
          <button
            className={`tab-button ${activeTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('assistant')}
            role="tab"
            aria-selected={activeTab === 'assistant'}
            disabled
          >
            <span className="tab-icon">🤖</span>
            Assistant
          </button>
        </nav>
      )}

      {/* Main Content */}
      <main className="demo-flow-main">
        <div className={`demo-flow-content ${activeTab === 'event-stream' ? 'event-stream-active' : ''} ${activeTab === 'api-viewer' ? 'api-viewer-active' : ''}`} role="tabpanel">
          {renderTabContent()}
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