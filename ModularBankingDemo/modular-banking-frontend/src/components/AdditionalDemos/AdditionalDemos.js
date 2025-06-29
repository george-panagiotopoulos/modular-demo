import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JoltMapper from '../JoltMapper';
import './AdditionalDemos.css';

const AdditionalDemos = () => {
  const [activeDemo, setActiveDemo] = useState('overview');
  const navigate = useNavigate();

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      navigate('/demo-flow');
    }
  };

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const renderContent = () => {
    switch (activeDemo) {
      case 'jolt-mapper':
        return <JoltMapper />;
      default:
        return (
          <div className="additional-demos-overview">
            <div className="additional-demos-header">
              <h2>Additional Demo Assets</h2>
              <p>Explore additional tools and utilities for the modular banking architecture</p>
            </div>
            
            <div className="additional-demos-grid">
              <div className="additional-demo-card">
                <div className="additional-demo-icon">⚡</div>
                <h3>JOLT Mapper</h3>
                <p>Data transformation and mapping utility for modular banking architecture. Transform data between different formats and structures using JOLT specifications.</p>
                <button 
                  className="additional-demo-button"
                  onClick={() => setActiveDemo('jolt-mapper')}
                >
                  Launch JOLT Mapper
                </button>
              </div>
              
              {/* Placeholder for future additional demos */}
              <div className="additional-demo-card coming-soon">
                <div className="additional-demo-icon">🔮</div>
                <h3>More Coming Soon</h3>
                <p>Additional demo assets will be added here as they become available.</p>
                <button 
                  className="additional-demo-button"
                  disabled
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="additional-demos-container">
      {/* Header with navigation */}
      <header className="additional-demos-header-nav">
        <button
          className="back-button"
          onClick={() => navigate('/demo-flow')}
        >
          <span className="back-icon">←</span>
          Back to Demo Flow
        </button>
        
        {activeDemo !== 'overview' && (
          <button
            className="overview-button"
            onClick={() => setActiveDemo('overview')}
          >
            <span className="overview-icon">🏠</span>
            Overview
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="additional-demos-main">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="additional-demos-footer">
        <p className="footer-text">
          Powered by <strong>Temenos</strong> - Leading Banking Software Solutions
        </p>
      </footer>
    </div>
  );
};

export default AdditionalDemos; 