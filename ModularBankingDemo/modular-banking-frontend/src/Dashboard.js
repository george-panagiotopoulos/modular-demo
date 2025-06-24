import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

// Loading component
const LoadingSpinner = () => (
  <div className="loading-spinner" role="status" aria-label="Loading">
    <div className="spinner"></div>
    <span className="sr-only">Loading dashboard content...</span>
  </div>
);

// Circular pane component for modular architecture visualization
const CircularPane = ({ title, subtitle, onClick, isActive, ariaLabel, loading, className, testId }) => {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      className={`circular-pane ${className} ${isActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      tabIndex={0}
      role="button"
      disabled={loading}
      data-testid={testId}
    >
      <div className="circular-pane-title">{title}</div>
      {subtitle && <div className="circular-pane-subtitle">{subtitle}</div>}
    </button>
  );
};

// Individual rectangle components with enhanced UX
const DashboardRectangle = ({ title, onClick, isActive, ariaLabel, icon, loading }) => {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      className={`dashboard-rectangle ${isActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      aria-describedby={`${title.toLowerCase().replace(/\s+/g, '-')}-description`}
      tabIndex={0}
      role="button"
      disabled={loading}
    >
      {icon && <span className="rectangle-icon" aria-hidden="true">{icon}</span>}
      <span className="rectangle-title">{title}</span>
      {loading && <LoadingSpinner />}
      <div 
        id={`${title.toLowerCase().replace(/\s+/g, '-')}-description`} 
        className="sr-only"
      >
        {ariaLabel}
      </div>
    </button>
  );
};

// Modular Architecture information pane
const ModularArchitecturePane = () => {
  const navigate = useNavigate();
  
  const handleLearnMore = () => {
    navigate('/modular-architecture');
  };

  return (
    <div data-testid="modular-architecture-info-pane" className="dashboard-pane">
      <h2>
        <span className="pane-icon" aria-hidden="true">🏗️</span>
        Modular Architecture
      </h2>
      <p>
        Modular banking is a progressive modernization approach to a balanced distribtued architectrure.
      </p>
      <div className="pane-features">
        <h3>Core Principles:</h3>
        <ul>
          <li>API-first design with REST and JSON</li>
          <li>Event-driven architecture for real-time processing</li>
          <li>CQRS pattern for optimized performance</li>
          <li>Modular responsibility with clear domain boundaries</li>
          <li>Cloud-native containerized deployment</li>
          <li>Extensibility framework for customizations</li>
        </ul>
      </div>
      <div className="pane-features">
        <h3>Key Benefits:</h3>
        <ul>
          <li>Independent service deployment and scaling</li>
          <li>Technology stack flexibility per module</li>
          <li>Enhanced fault tolerance and resilience</li>
          <li>Faster development and time-to-market</li>
          <li>Simplified maintenance and upgrades</li>
        </ul>
      </div>
      <div className="pane-action">
        <button 
          className="learn-more-button learn-more-button-teal"
          onClick={handleLearnMore}
          aria-label="Navigate to detailed Modular Architecture page"
        >
          <span className="button-icon" aria-hidden="true">🏗️</span>
          Explore Architecture in Detail
        </button>
      </div>
    </div>
  );
};

// Supporting Services information pane with navigation
const SupportingServicesPane = () => {
  const navigate = useNavigate();
  
  const handleLearnMore = () => {
    navigate('/supporting-services');
  };

  return (
    <div data-testid="supporting-services-info-pane" className="dashboard-pane">
      <h2>
        <span className="pane-icon" aria-hidden="true">⚙️</span>
        Supporting Services
      </h2>
      <p>
        Essential business and technical services that enable the modular banking platform 
        to operate efficiently. These services provide cross-cutting concerns, data management, 
        and foundational capabilities across all banking modules.
      </p>
      <div className="pane-features">
        <h3>Business Services:</h3>
        <ul>
          <li>Holdings - Account and position management</li>
          <li>Party - Customer and counterparty data</li>
          <li>Product Catalogue - Product definitions</li>
          <li>Sub-Ledger - Accounting and general ledger</li>
          <li>Limits - Credit limit and exposure management</li>
        </ul>
      </div>
      <div className="pane-features">
        <h3>Technical Services:</h3>
        <ul>
          <li>Event Store - Central event hub, immutable event storage, audit trail, and event replay for all modules</li>
          <li>Generic Configuration - Dynamic configuration management</li>
        </ul>
      </div>
      <div className="pane-action">
        <button 
          className="learn-more-button learn-more-button-purple"
          onClick={handleLearnMore}
          aria-label="Navigate to detailed Supporting Services page"
        >
          <span className="button-icon" aria-hidden="true">🔍</span>
          Explore Services in Detail
        </button>
      </div>
    </div>
  );
};

// Enhanced pane components with banking-specific content based on Temenos document
const DepositsPane = () => (
  <div data-testid="deposits-pane" className="dashboard-pane">
    <h2>
      <span className="pane-icon" aria-hidden="true">🏦</span>
      Deposits
    </h2>
    <p>
      Comprehensive retail and corporate deposit management covering all types of deposit accounts. 
      Built on modern microservices architecture with API-first design and event-driven capabilities.
    </p>
    <div className="pane-features">
      <h3>Supported Products:</h3>
      <ul>
        <li>Current Accounts with overdraft facilities</li>
        <li>Savings Accounts with flexible interest structures</li>
        <li>Term Deposits with various maturity options</li>
        <li>Multi-currency account support</li>
        <li>Corporate and retail variants</li>
      </ul>
    </div>
    <div className="pane-features">
      <h3>Key Capabilities:</h3>
      <ul>
        <li>Real-time balance updates and transaction processing</li>
        <li>Automated interest calculation and posting</li>
        <li>Close of Business (CoB) operations</li>
        <li>Multi-company and multi-branch support</li>
        <li>Transaction recycling and error handling</li>
      </ul>
    </div>
  </div>
);

const LendingPane = () => (
  <div data-testid="lending-pane" className="dashboard-pane">
    <h2>
      <span className="pane-icon" aria-hidden="true">💰</span>
      Lending
    </h2>
    <p>
      Modern retail lending platform supporting personal loans, mortgages, and consumer credit products. 
      Features automated workflows, risk assessment, and comprehensive loan lifecycle management.
    </p>
    <div className="pane-features">
      <h3>Supported Products:</h3>
      <ul>
        <li>Personal Loans with flexible terms</li>
        <li>Mortgages and secured lending</li>
        <li>Consumer credit facilities</li>
        <li>Revolving credit products</li>
        <li>Auto loans and equipment financing</li>
      </ul>
    </div>
    <div className="pane-features">
      <h3>Key Capabilities:</h3>
      <ul>
        <li>Real-time balance updates and transaction processing</li>
        <li>Automated interest calculation and posting</li>
        <li>Close of Business (CoB) operations</li>
        <li>Multi-company and multi-branch support</li>
        <li>Transaction recycling and error handling</li>
      </ul>
    </div>
    <div className="pane-features">
      <h3>Note:</h3>
      <ul>
        <li>Limits and Collateral functionality externalized</li>
      </ul>
    </div>
  </div>
);

const PricingPane = () => (
  <div data-testid="pricing-pane" className="dashboard-pane">
    <h2>
      <span className="pane-icon" aria-hidden="true">📊</span>
      Pricing
    </h2>
    <p>
      Comprehensive pricing engine that enables dynamic, real-time pricing across all banking products. 
      Supports complex pricing strategies, customer segmentation, and market-responsive pricing models.
    </p>
    <div className="pane-features">
      <h3>Pricing Capabilities:</h3>
      <ul>
        <li>Real-time market data integration and processing</li>
        <li>Customer-specific and segment-based pricing</li>
        <li>Risk-adjusted pricing models</li>
        <li>Campaign and promotional pricing management</li>
        <li>Competitive pricing intelligence and analysis</li>
        <li>Profitability analysis and optimization</li>
      </ul>
    </div>
    <div className="pane-features">
      <h3>Integration Features:</h3>
      <ul>
        <li>Seamless integration with Deposits module</li>
        <li>Advanced pricing for Lending products</li>
        <li>Cross-product pricing strategies</li>
        <li>API-first architecture for external integrations</li>
        <li>Event-driven pricing updates</li>
      </ul>
    </div>
  </div>
);

const PaymentsPane = () => (
  <div data-testid="payments-pane" className="dashboard-pane">
    <h2>
      <span className="pane-icon" aria-hidden="true">💳</span>
      Payments
    </h2>
    <p>
      Modern payments processing leveraging Temenos Payments Hub for payment initiation and execution. 
      Designed for banks with existing payments infrastructure or requiring standalone payments capabilities.
    </p>
    <div className="pane-features">
      <h3>Current Implementation:</h3>
      <ul>
        <li>Payments Hub for initiation and execution</li>
        <li>Real-time interfacing capabilities</li>
        <li>Integration with existing payment systems</li>
        <li>Support for multiple payment rails</li>
        <li>Cross-border payment processing</li>
      </ul>
    </div>
    <div className="pane-features">
      <h3>Architecture Notes:</h3>
      <ul>
        <li>Expected prerequisite for modular banking deployments</li>
        <li>Compatible with any payments solution with real-time interfaces</li>
        <li>Future refactoring planned for full modular architecture alignment</li>
        <li>API-first design for seamless integration</li>
      </ul>
    </div>
  </div>
);

// Main Dashboard component with enhanced features and circular panes
const Dashboard = () => {
  const [activePane, setActivePane] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const rectangles = [
    {
      id: 'deposits',
      title: 'Deposits',
      icon: '🏦',
      ariaLabel: 'Open Deposits Interface - Comprehensive deposit management system',
      pane: <DepositsPane />
    },
    {
      id: 'lending',
      title: 'Lending',
      icon: '💰',
      ariaLabel: 'Open Lending Interface - Modern retail lending platform and loan management',
      pane: <LendingPane />
    },
    {
      id: 'pricing',
      title: 'Pricing',
      icon: '📊',
      ariaLabel: 'Open Pricing Interface - Comprehensive pricing engine and market intelligence',
      pane: <PricingPane />
    },
    {
      id: 'payments',
      title: 'Payments',
      icon: '💳',
      ariaLabel: 'Open Payments Interface - Modern payments processing platform',
      pane: <PaymentsPane />
    }
  ];

  const circularPanes = [
    {
      id: 'modular-architecture',
      title: 'Modular Architecture',
      subtitle: 'A Blueprint for Progressive Renovation',
      className: 'left-circular-pane',
      ariaLabel: 'Open Modular Architecture Information - Learn about our microservices design principles',
      testId: 'modular-architecture-circle',
      pane: <ModularArchitecturePane />
    },
    {
      id: 'supporting-services',
      title: 'Supporting Services',
      subtitle: 'Microservices Design',
      className: 'right-circular-pane',
      ariaLabel: 'Open Supporting Services Information - Discover our infrastructure and security services',
      testId: 'supporting-services-circle',
      pane: <SupportingServicesPane />
    }
  ];

  const handleRectangleClick = async (rectangleId, pane) => {
    try {
      setError(null);
      setLoading(true);
      
      setActivePane(activePane?.id === rectangleId ? null : { id: rectangleId, component: pane });
    } catch (err) {
      setError('Failed to load interface. Please try again.');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCircularPaneClick = async (paneId, pane) => {
    try {
      setError(null);
      setLoading(true);
      
      setActivePane(activePane?.id === paneId ? null : { id: paneId, component: pane });
    } catch (err) {
      setError('Failed to load information. Please try again.');
      console.error('Circular pane error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFlowClick = async () => {
    try {
      setError(null);
      setLoading(true);
      navigate('/demo-flow');
    } catch (err) {
      setError('Failed to navigate to demo flow. Please try again.');
      console.error('Demo flow navigation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFlowKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDemoFlowClick();
    }
  };

  // Keyboard navigation enhancement
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.key === 'Escape' && activePane) {
        setActivePane(null);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activePane]);

  return (
    <div className="dashboard-container">
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

      {/* Enhanced dashboard layout with circular panes */}
      <div className="dashboard-main-layout">
        {/* Left circular pane - Modular Architecture */}
        <CircularPane
          title={circularPanes[0].title}
          subtitle={circularPanes[0].subtitle}
          onClick={() => handleCircularPaneClick(circularPanes[0].id, circularPanes[0].pane)}
          isActive={activePane?.id === circularPanes[0].id}
          ariaLabel={circularPanes[0].ariaLabel}
          loading={loading && activePane?.id === circularPanes[0].id}
          className={circularPanes[0].className}
          testId={circularPanes[0].testId}
        />

        {/* Main dashboard grid */}
        <div 
          className="dashboard-grid" 
          data-testid="dashboard-grid"
          role="grid"
          aria-label="Banking application dashboard - Choose an interface to explore"
        >
          {rectangles.map((rectangle) => (
            <DashboardRectangle
              key={rectangle.id}
              title={rectangle.title}
              icon={rectangle.icon}
              onClick={() => handleRectangleClick(rectangle.id, rectangle.pane)}
              isActive={activePane?.id === rectangle.id}
              ariaLabel={rectangle.ariaLabel}
              loading={loading && activePane?.id === rectangle.id}
            />
          ))}
        </div>

        {/* Right circular pane - Supporting Services */}
        <CircularPane
          title={circularPanes[1].title}
          subtitle={circularPanes[1].subtitle}
          onClick={() => handleCircularPaneClick(circularPanes[1].id, circularPanes[1].pane)}
          isActive={activePane?.id === circularPanes[1].id}
          ariaLabel={circularPanes[1].ariaLabel}
          loading={loading && activePane?.id === circularPanes[1].id}
          className={circularPanes[1].className}
          testId={circularPanes[1].testId}
        />
      </div>

      {/* Demo Flow Section - Horizontal lane between main layout and information pane */}
      <div className="demo-flow-section" data-testid="demo-flow-section">
        <button
          className="demo-flow-button"
          data-testid="demo-flow-button"
          onClick={handleDemoFlowClick}
          onKeyDown={handleDemoFlowKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Start End-to-end Demo Flow - Experience complete banking workflow"
          disabled={loading}
        >
          <span className="demo-flow-icon" aria-hidden="true">🚀</span>
          <span className="demo-flow-title">End-to-end Demo Flow</span>
          <span className="demo-flow-subtitle">Experience the Complete Banking Journey</span>
          {loading && <LoadingSpinner />}
        </button>
      </div>
      
      {/* Active pane display */}
      {activePane && (
        <div 
          className="pane-container" 
          role="region" 
          aria-live="polite"
          aria-label={`${
            [...rectangles, ...circularPanes].find(item => item.id === activePane.id)?.title || 'Information'
          } interface details`}
        >
          <button
            className="pane-close"
            onClick={() => setActivePane(null)}
            aria-label={`Close ${
              [...rectangles, ...circularPanes].find(item => item.id === activePane.id)?.title?.toLowerCase() || 'information'
            } details`}
          >
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close</span>
          </button>
          {activePane.component}
        </div>
      )}
      
      {/* Temenos branding footer */}
      <footer className="dashboard-footer" role="contentinfo">
        <p className="footer-text">
          Powered by <strong>Temenos</strong> - Leading Banking Forward
        </p>
      </footer>
    </div>
  );
};

export default Dashboard; 