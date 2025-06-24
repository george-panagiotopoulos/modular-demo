import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SupportingServices.css';

// Service Component for Business and Technical Services
const ServiceComponent = ({ 
  id, 
  title, 
  type, 
  isActive, 
  onClick, 
  ariaLabel 
}) => {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      data-testid={`${id}-service`}
      className={`service-item ${type}-service ${isActive ? 'active' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      <div className="service-title">{title}</div>
    </button>
  );
};

// Details Pane Component
const DetailsPane = ({ selectedService }) => {
  if (!selectedService) {
    return (
      <div data-testid="details-pane" className="details-pane">
        <div className="details-placeholder">
          <h3>Select a service to view details</h3>
          <p>Choose from Business or Technical Services to learn more about each component.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="details-pane" className="details-pane">
      <div className="details-content">
        <h2>{selectedService.title}</h2>
        <div className="service-category">
          {selectedService.type === 'business' ? 'Business Service' : 'Technical Service'}
        </div>
        <p>{selectedService.description}</p>
        <div className="service-features">
          <h3>Key Features:</h3>
          <ul>
            {selectedService.features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Main Supporting Services Component
const SupportingServices = () => {
  const [selectedService, setSelectedService] = useState(null);

  // Business Services Data - Updated based on Temenos document
  const businessServices = [
    {
      id: 'holdings',
      title: 'Holdings',
      type: 'business',
      ariaLabel: 'Select Holdings business service to view details',
      description: 'Comprehensive account and position management service that maintains customer balances, positions, and account-related data across all banking products in the modular architecture.',
      features: [
        'Real-time balance tracking and management',
        'Multi-currency position aggregation',
        'Account hierarchy and relationship management',
        'Historical balance and transaction data',
        'Automated reconciliation and data integrity',
        'Cross-product position consolidation'
      ]
    },
    {
      id: 'party',
      title: 'Party',
      type: 'business',
      ariaLabel: 'Select Party business service to view details',
      description: 'Acts as a proxy for static customer data required by other modular components, used when the bank does not support real-time and performant read API access to the master customer system.',
      features: [
        'Provides cached/static customer data to other modules',
        'Ensures modular components can function without direct master data access',
        'Supports scenarios where real-time master data APIs are unavailable or slow',
        'Simplifies integration for banks with legacy or restricted customer systems',
        'Improves reliability for customer data access in distributed deployments'
      ]
    },
    {
      id: 'product-catalogue',
      title: 'Product Catalogue',
      type: 'business',
      ariaLabel: 'Select Product Catalogue business service to view details',
      description: 'Centralized product definition and configuration service managing all banking product parameters, pricing structures, and business rules across the modular banking platform.',
      features: [
        'Product definition and parameter management',
        'Pricing configuration and rule engines',
        'Feature toggles and product variants',
        'Product lifecycle and versioning management',
        'Regulatory compliance and product controls',
        'Cross-module product consistency'
      ]
    },
    {
      id: 'sub-ledger',
      title: 'Sub-Ledger',
      type: 'business',
      ariaLabel: 'Select Sub-Ledger business service to view details',
      description: 'Standalone accounting capability managing all financial accounting requirements across Temenos modular solutions, providing comprehensive general ledger functionality.',
      features: [
        'General ledger management and posting',
        'Chart of accounts configuration',
        'Multi-company accounting support',
        'Automated journal entry generation',
        'Financial reporting and reconciliation',
        'Audit trails and compliance reporting'
      ]
    },
    {
      id: 'limits',
      title: 'Limits',
      type: 'business',
      ariaLabel: 'Select Limits business service to view details',
      description: 'Standalone limits management capability providing credit limit controls, exposure monitoring, and risk management across all lending and credit products.',
      features: [
        'Credit limit definition and management',
        'Real-time exposure monitoring',
        'Multi-dimensional limit structures',
        'Automated limit checking and controls',
        'Collateral management integration',
        'Risk-based limit adjustments'
      ]
    }
  ];

  // Technical Services Data - Updated based on Temenos document
  const technicalServices = [
    {
      id: 'event-store',
      title: 'Event Store',
      type: 'technical',
      ariaLabel: 'Select Event Store technical service to view details',
      description: 'Central hub for recording, storing, and routing events across all microservices. Provides immutable storage, audit trail, and event replay for compliance, debugging, and historical analysis. Not an event sourcing system, but a backbone for event-driven communication.',
      features: [
        'Centralized event recording and routing',
        'Immutable event storage for audit and compliance',
        'Supports various event types (Command, Business, etc.)',
        'Event replay for missed events and system recovery',
        'Structured event ID conventions for traceability',
        'API-based integration with all microservices'
      ]
    },
    {
      id: 'generic-configuration',
      title: 'Generic Configuration',
      type: 'technical',
      ariaLabel: 'Select Generic Configuration technical service to view details',
      description: 'Centralized configuration management service providing dynamic configuration capabilities, feature flags, and environment-specific settings for all modular banking components.',
      features: [
        'Dynamic configuration updates without restarts',
        'Environment-specific configuration management',
        'Feature flag and toggle management',
        'Configuration versioning and rollback',
        'Hot reloading and real-time updates',
        'Cross-module configuration consistency'
      ]
    }
  ];

  const handleServiceClick = (service) => {
    setSelectedService(selectedService?.id === service.id ? null : service);
  };

  // Keyboard navigation for Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (selectedService) {
          setSelectedService(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedService]);

  return (
    <div data-testid="supporting-services-container" className="supporting-services-container">
      {/* Main Content */}
      <main className="supporting-services-main">
        {/* Services Grid */}
        <div className="services-grid">
          {/* Business Services Section */}
          <section data-testid="business-services-section" className="services-section business-services-section">
            <h2 className="section-title">Business Services</h2>
            <div className="services-grid-container">
              {businessServices.map((service) => (
                <ServiceComponent
                  key={service.id}
                  id={service.id}
                  title={service.title}
                  type={service.type}
                  isActive={selectedService?.id === service.id}
                  onClick={() => handleServiceClick(service)}
                  ariaLabel={service.ariaLabel}
                />
              ))}
            </div>
          </section>

          {/* Technical Services Section */}
          <section data-testid="technical-services-section" className="services-section technical-services-section">
            <h2 className="section-title">Technical Services</h2>
            <div className="services-grid-container">
              {technicalServices.map((service) => (
                <ServiceComponent
                  key={service.id}
                  id={service.id}
                  title={service.title}
                  type={service.type}
                  isActive={selectedService?.id === service.id}
                  onClick={() => handleServiceClick(service)}
                  ariaLabel={service.ariaLabel}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Details Pane */}
        <DetailsPane selectedService={selectedService} />
      </main>
    </div>
  );
};

export default SupportingServices; 