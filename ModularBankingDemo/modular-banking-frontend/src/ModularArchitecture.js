import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ModularArchitecture.css';

// Topic Button Component
const TopicButton = ({ topic, isActive, onClick, onKeyDown }) => (
  <button
    className={`topic-button ${isActive ? 'active' : ''}`}
    onClick={() => onClick(topic.id)}
    onKeyDown={onKeyDown}
    aria-pressed={isActive}
    tabIndex={0}
  >
    {topic.title}
  </button>
);

// Content Pane Component
const ContentPane = ({ selectedTopic, topics, onDemoClick }) => {
  if (!selectedTopic) {
    return (
      <div className="content-placeholder">
        <h3>Select a Topic to Learn More</h3>
        <p>Choose one of the architecture topics above to explore detailed information about our modular banking platform.</p>
      </div>
    );
  }

  const topic = topics.find(t => t.id === selectedTopic);
  if (!topic) return null;

  return (
    <div className="content-topic">
      <div className="content-header">
        <h2>{topic.title}</h2>
      </div>
      <div className="content-body">
        <p className="content-description">{topic.description}</p>
        <div className="content-details">
          <h3>Key Points</h3>
          <ul>
            {topic.keyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </div>
        <div className="content-benefits">
          <h3>Benefits</h3>
          <ul>
            {topic.benefits.map((benefit, index) => (
              <li key={index}>{benefit}</li>
            ))}
          </ul>
        </div>
        
        {/* Demo Cards for specific topics */}
        {(topic.id === 'integration-patterns' || topic.id === 'api-event-design') && (
          <div className="demo-cards-section">
            <h3>Interactive Demos</h3>
            <div className="demo-cards-container">
              <DemoCard
                title="Event-driven Architecture Demo"
                description="Explore real-time event streaming and see how events flow between banking modules in our modular architecture."
                icon="⚡"
                onClick={onDemoClick}
                className="event-stream-demo"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Demo Card Component
const DemoCard = ({ title, description, icon, onClick, className = '' }) => {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      className={`demo-card ${className}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${title} demo`}
      tabIndex={0}
    >
      <div className="demo-card-content">
        <div className="demo-card-icon" aria-hidden="true">{icon}</div>
        <div className="demo-card-text">
          <h4 className="demo-card-title">{title}</h4>
          <p className="demo-card-description">{description}</p>
        </div>
        <div className="demo-card-arrow" aria-hidden="true">→</div>
      </div>
    </button>
  );
};

// Main ModularArchitecture Component
const ModularArchitecture = () => {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const navigate = useNavigate();

  // Topic data based on the Temenos Modular Banking document - 12 original buttons
  const topics = [
    {
      id: 'why-modularity',
      title: 'Why Modularity is needed',
      description: 'Traditional monolithic banking systems face significant challenges in today\'s rapidly evolving financial landscape. Temenos has evolved from T24 to address these limitations through modular architecture.',
      keyPoints: [
        'Scalability limitations in monolithic T24 systems',
        'Difficulty in implementing new features quickly',
        'Technology stack constraints and vendor lock-in',
        'Complex deployment and maintenance processes',
        'Limited ability to scale individual components independently'
      ],
      benefits: [
        'Improved system flexibility and adaptability',
        'Faster time-to-market for new banking products',
        'Reduced operational costs and complexity',
        'Enhanced ability to meet regulatory requirements',
        'Better resource utilization and performance optimization'
      ]
    },
    {
      id: 'what-is-modularity',
      title: 'What is modularity',
      description: 'Modularity in Temenos banking systems refers to the architectural approach of decomposing the monolithic T24 Core Banking into smaller, independent, and loosely coupled components focused on specific business domains.',
      keyPoints: [
        'Decomposition of T24 monolith into focused business domains',
        'Independent deployment and scaling capabilities per module',
        'Clear separation of business concerns and responsibilities',
        'API-first design principles with REST and JSON',
        'Domain-driven design implementation with bounded contexts'
      ],
      benefits: [
        'Enhanced system maintainability and testability',
        'Improved team productivity and development autonomy',
        'Better fault isolation and system resilience',
        'Simplified integration with third-party systems',
        'Increased development velocity and innovation'
      ]
    },
    {
      id: 'temenos-domain-design',
      title: 'Temenos approach to domain design',
      description: 'Temenos employs a sophisticated domain-driven design approach that aligns the modular architecture with core banking business domains, ensuring optimal system organization and business value delivery.',
      keyPoints: [
        'Business domain identification and clear boundary definition',
        'Modular responsibility with single application owners',
        'Bounded context implementation for each banking module',
        'Domain expert collaboration in architectural design',
        'Ubiquitous language implementation across teams'
      ],
      benefits: [
        'Better alignment between business and technology teams',
        'Reduced complexity through clear domain boundaries',
        'Improved communication and collaboration across teams',
        'Enhanced system understanding and documentation',
        'Faster onboarding of new team members and stakeholders'
      ]
    },
    {
      id: 'module-independence',
      title: 'Module independence',
      description: 'Achieving true module independence is fundamental to Temenos modular architecture, enabling teams to develop, deploy, and maintain banking services without tight coupling or dependencies.',
      keyPoints: [
        'Autonomous service development and deployment cycles',
        'Database per service pattern implementation',
        'Independent technology stack selection per module',
        'Minimal inter-service dependencies and loose coupling',
        'Self-contained business logic and data management'
      ],
      benefits: [
        'Reduced system-wide impact of changes and updates',
        'Improved development team autonomy and productivity',
        'Enhanced system reliability and availability',
        'Simplified testing and quality assurance processes',
        'Better scalability and performance optimization per module'
      ]
    },
    {
      id: 'configuration-customization',
      title: 'Configuration and customization',
      description: 'Temenos modular banking systems require extensive configuration capabilities to meet diverse customer needs while maintaining system integrity through the Extensibility Framework and configuration management.',
      keyPoints: [
        'Extensibility Framework for configuration-based customizations',
        'Environment-specific configuration handling and management',
        'Python scripting for response formatting and customization',
        'Apache Camel-based adapter framework for integrations',
        'Template-driven interface development and deployment'
      ],
      benefits: [
        'Reduced customization complexity and implementation risk',
        'Improved system flexibility and customer adaptability',
        'Enhanced upgrade compatibility and maintenance',
        'Better compliance with regional banking regulations',
        'Simplified customization governance and management'
      ]
    },
    {
      id: 'devops-architecture',
      title: 'DevOps Architecture',
      description: 'DevOps architecture in Temenos modular banking emphasizes automation, continuous integration, and deployment practices through the Temenos Packager and modern CI/CD pipelines.',
      keyPoints: [
        'Temenos Packager for SDLC management and automation',
        'Data Packager for configuration management',
        'Code Packager for Java project templates and deployment',
        'CI/CD pipeline integration with Maven and source control',
        'Environment-specific deployment automation and promotion'
      ],
      benefits: [
        'Improved deployment consistency and reliability',
        'Reduced manual errors and deployment risks',
        'Enhanced collaboration and version control',
        'Faster development and release cycles',
        'Better configuration governance and tracking'
      ]
    },
    {
      id: 'integration-patterns',
      title: 'Integration patterns',
      description: 'Temenos modular solutions employ flexible integration patterns with externalized integration logic, supporting various middleware solutions and custom integration scenarios.',
      keyPoints: [
        'API and event-based communication patterns',
        'Externalized integration logic separation from business logic',
        'Support for existing middleware and iPaaS solutions',
        'Custom microservices for unique integration requirements',
        'Loose coupling between business and integration concerns'
      ],
      benefits: [
        'Enhanced system flexibility and adaptability',
        'Better leverage of existing infrastructure investments',
        'Improved maintainability and scalability',
        'Reduced integration complexity and implementation risk',
        'Faster implementation and deployment cycles'
      ]
    },
    {
      id: 'api-event-design',
      title: 'API and Event design principles',
      description: 'Temenos modular banking APIs are built with an API-first approach using REST and JSON, while events enable real-time data synchronization and loose coupling between modules.',
      keyPoints: [
        'REST architectural style with JSON data interchange',
        'Product-specific API organization and lifecycle management',
        'Business events aligned with API data structures',
        'Real-time event streaming and processing capabilities',
        'System-agnostic design for flexible integration'
      ],
      benefits: [
        'Enhanced system interoperability and integration',
        'Improved developer experience and API adoption',
        'Better system responsiveness and performance',
        'Simplified integration patterns and development',
        'Real-time business intelligence and analytics capabilities'
      ]
    },
    {
      id: 'user-experience',
      title: 'User Experience',
      description: 'Temenos modular architecture enables superior user experiences through composability, allowing single user agents to access all licensed capabilities while maintaining consistent functionality.',
      keyPoints: [
        'Single user agent for all licensed banking capabilities',
        'Unified customer view across all banking modules',
        'Consistent design system implementation across modules',
        'Seamless fund transfers between different components',
        'Graceful handling of component maintenance scenarios'
      ],
      benefits: [
        'Simplified user experience and reduced training requirements',
        'Enhanced customer service capabilities and efficiency',
        'Better cross-platform consistency and reliability',
        'Reduced integration complexity and operational costs',
        'Improved system reliability and availability'
      ]
    },
    {
      id: 'deployment-architecture',
      title: 'Deployment Architecture',
      description: 'Temenos modular banking leverages cloud-native technologies and Kubernetes for scalable, reliable, and efficient deployment of banking services with containerization.',
      keyPoints: [
        'Kubernetes clusters for container orchestration',
        'Cloud-native architecture with containerization',
        'Standard database services integration',
        'TLS encryption for secure service communication',
        'Infrastructure security managed by financial institutions'
      ],
      benefits: [
        'Improved system availability and reliability',
        'Enhanced scalability and performance optimization',
        'Reduced deployment risks and system downtime',
        'Better resource optimization and cost control',
        'Increased operational efficiency and automation'
      ]
    },
    {
      id: 'security-architecture',
      title: 'Security Architecture',
      description: 'Temenos modular banking implements comprehensive security with Keycloak-based authentication, TLS encryption, and Transparent Data Encryption (TDE) for defense-in-depth protection.',
      keyPoints: [
        'Keycloak-based identity and access management',
        'TLS encryption for data in transit (versions 1.2 and 1.3)',
        'Transparent Data Encryption (TDE) for data at rest',
        'Integration with existing Identity Providers via SAML/OpenID',
        'API-level security and third-party encryption tools'
      ],
      benefits: [
        'Enhanced protection against cyber threats and attacks',
        'Improved regulatory compliance posture and reporting',
        'Better integration with existing security infrastructure',
        'Reduced security management complexity and overhead',
        'Stronger customer trust and confidence in banking services'
      ]
    },
    {
      id: 'observability',
      title: 'Observability',
      description: 'Temenos modular banking provides comprehensive observability through Log4j logging, OpenTelemetry metrics and tracing, with integration to centralized monitoring infrastructure.',
      keyPoints: [
        'Log4j library for detailed system logging and debugging',
        'OpenTelemetry for metrics collection and distributed tracing',
        'Integration with centralized observability infrastructure',
        'Grafana-based monitoring dashboards (planned)',
        'End-to-end transaction tracking across all modules'
      ],
      benefits: [
        'Improved system reliability and uptime monitoring',
        'Faster problem identification and resolution',
        'Better capacity planning and performance optimization',
        'Enhanced compliance and audit trail capabilities',
        'Reduced mean time to recovery (MTTR) for incidents'
      ]
    }
  ];

  const handleTopicClick = (topicId) => {
    setSelectedTopic(topicId === selectedTopic ? null : topicId);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const topicId = event.target.textContent.toLowerCase().replace(/\s+/g, '-');
      const topic = topics.find(t => t.title.toLowerCase().replace(/\s+/g, '-') === topicId);
      if (topic) {
        handleTopicClick(topic.id);
      }
    }
  };

  const handleDemoClick = () => {
    navigate('/event-stream');
  };

  return (
    <div 
      className="modular-architecture-container" 
      role="main"
      data-testid="modular-architecture-container"
    >
      {/* Topic Buttons */}
      <div 
        className="topic-buttons-container"
        data-testid="topic-buttons-container"
      >
        {topics.map(topic => (
          <TopicButton
            key={topic.id}
            topic={topic}
            isActive={selectedTopic === topic.id}
            onClick={handleTopicClick}
            onKeyDown={handleKeyDown}
          />
        ))}
      </div>

      {/* Content Section */}
      <div className="content-section">
        <div 
          className="content-pane"
          aria-live="polite"
          data-testid="content-pane"
        >
          <ContentPane selectedTopic={selectedTopic} topics={topics} onDemoClick={handleDemoClick} />
        </div>
      </div>
    </div>
  );
};

export default ModularArchitecture; 