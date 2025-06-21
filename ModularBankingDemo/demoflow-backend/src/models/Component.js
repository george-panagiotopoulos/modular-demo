/**
 * Component Model
 * Defines the structure and configuration for headless_v3 components
 */

class Component {
  constructor(key, name, description, domain, version, config = {}) {
    this.key = key;
    this.name = name;
    this.description = description;
    this.domain = domain;
    this.version = version;
    this.config = config;
    this.createdAt = new Date().toISOString();
  }

  // Static method to create component configurations
  static getComponentConfigurations() {
    return {
      party: new Component(
        'party',
        'Party/Customer - R24 (proxy microservice)',
        'Customer management and party services proxy microservice',
        'party',
        'R24',
        {
          eventTypes: ['customer.created', 'customer.updated', 'customer.deleted'],
          color: '#5CB8B2', // Temenos Teal
          priority: 1
        }
      ),
      deposits: new Component(
        'deposits',
        'Deposits/Accounts Module R25',
        'Deposit accounts and account management services',
        'deposits',
        'R25',
        {
          eventTypes: ['account.created', 'account.updated', 'transaction.posted', 'balance.updated'],
          color: '#8246AF', // Temenos Purple
          priority: 2
        }
      ),
      lending: new Component(
        'lending',
        'Lending Module R24',
        'Loan products and lending services',
        'lending',
        'R24',
        {
          eventTypes: ['loan.created', 'loan.approved', 'loan.disbursed', 'payment.received'],
          color: '#283275', // Temenos Navy
          priority: 3
        }
      ),
      eventstore: new Component(
        'eventstore',
        'Event Store (R24)',
        'Central event storage and event sourcing capabilities',
        'eventstore',
        'R24',
        {
          eventTypes: ['event.stored', 'snapshot.created', 'stream.created'],
          color: '#5CB8B2', // Temenos Teal
          priority: 4,
          isDefault: true
        }
      ),
      adapter: new Component(
        'adapter',
        'Adapter (R24)',
        'Integration adapter for external systems and services',
        'adapter',
        'R24',
        {
          eventTypes: ['adapter.connected', 'message.transformed', 'integration.completed'],
          color: '#8246AF', // Temenos Purple
          priority: 5,
          isDefault: true
        }
      ),
      holdings: new Component(
        'holdings',
        'Holdings (R25)',
        'Portfolio and holdings management services',
        'holdings',
        'R25',
        {
          eventTypes: ['holding.created', 'position.updated', 'valuation.calculated'],
          color: '#283275', // Temenos Navy
          priority: 6,
          isDefault: true
        }
      )
    };
  }

  // Static method to get all components as array
  static getAllComponents() {
    const configs = Component.getComponentConfigurations();
    return Object.values(configs);
  }

  // Static method to get component by key
  static getComponent(key) {
    const configs = Component.getComponentConfigurations();
    return configs[key] || null;
  }

  // Static method to validate component key
  static isValidComponent(key) {
    const configs = Component.getComponentConfigurations();
    return configs.hasOwnProperty(key);
  }

  // Static method to get default components for initial selection
  static getDefaultComponents() {
    return Component.getAllComponents()
      .filter(component => component.config.isDefault)
      .sort((a, b) => a.config.priority - b.config.priority);
  }

  // Instance method to generate sample events
  generateSampleEvents(count = 5) {
    const events = [];
    const eventTypes = this.config.eventTypes || ['generic.event'];
    
    for (let i = 0; i < count; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      events.push({
        id: `${this.key}-${Date.now()}-${i}`,
        type: eventType,
        component: this.key,
        timestamp: new Date().toISOString(),
        data: this.generateSampleEventData(eventType),
        metadata: {
          version: this.version,
          domain: this.domain,
          source: 'demo-generator'
        }
      });
    }
    
    return events;
  }

  // Helper method to generate sample event data based on event type
  generateSampleEventData(eventType) {
    const sampleData = {
      // Party/Customer events
      'customer.created': {
        customerId: `CUST-${Math.floor(Math.random() * 100000)}`,
        customerName: `Customer ${Math.floor(Math.random() * 1000)}`,
        status: 'ACTIVE',
        createdBy: 'SYSTEM'
      },
      'customer.updated': {
        customerId: `CUST-${Math.floor(Math.random() * 100000)}`,
        fieldUpdated: 'ADDRESS',
        previousValue: 'Old Address',
        newValue: 'New Address'
      },
      
      // Deposits/Accounts events
      'account.created': {
        accountId: `ACC-${Math.floor(Math.random() * 100000)}`,
        accountType: 'CURRENT',
        currency: 'USD',
        balance: Math.floor(Math.random() * 10000)
      },
      'transaction.posted': {
        transactionId: `TXN-${Math.floor(Math.random() * 100000)}`,
        accountId: `ACC-${Math.floor(Math.random() * 100000)}`,
        amount: Math.floor(Math.random() * 1000),
        type: Math.random() > 0.5 ? 'CREDIT' : 'DEBIT'
      },
      
      // Lending events
      'loan.created': {
        loanId: `LOAN-${Math.floor(Math.random() * 100000)}`,
        customerId: `CUST-${Math.floor(Math.random() * 100000)}`,
        amount: Math.floor(Math.random() * 50000) + 1000,
        interestRate: (Math.random() * 10 + 1).toFixed(2)
      },
      
      // Event Store events
      'event.stored': {
        eventId: `EVT-${Math.floor(Math.random() * 100000)}`,
        streamId: `stream-${Math.floor(Math.random() * 1000)}`,
        eventNumber: Math.floor(Math.random() * 100) + 1
      },
      
      // Adapter events
      'adapter.connected': {
        adapterId: `ADAPTER-${Math.floor(Math.random() * 100)}`,
        externalSystem: 'EXTERNAL_BANK',
        connectionStatus: 'CONNECTED'
      },
      
      // Holdings events
      'holding.created': {
        holdingId: `HOLD-${Math.floor(Math.random() * 100000)}`,
        portfolioId: `PORT-${Math.floor(Math.random() * 1000)}`,
        instrument: 'STOCK',
        quantity: Math.floor(Math.random() * 1000) + 1
      }
    };

    return sampleData[eventType] || {
      message: `Sample ${eventType} event`,
      timestamp: new Date().toISOString(),
      randomValue: Math.floor(Math.random() * 1000)
    };
  }

  // Convert to JSON representation
  toJSON() {
    return {
      key: this.key,
      name: this.name,
      description: this.description,
      domain: this.domain,
      version: this.version,
      config: this.config,
      createdAt: this.createdAt
    };
  }
}

module.exports = Component; 