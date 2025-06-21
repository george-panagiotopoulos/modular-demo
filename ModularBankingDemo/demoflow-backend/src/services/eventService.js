/**
 * Event Service
 * Manages event generation, filtering, and distribution
 */

const Component = require('../models/Component');
const EventStream = require('../models/EventStream');
const { getSessionManager } = require('./sessionManager');

class EventService {
  constructor() {
    this.eventGenerators = new Map();
    this.eventFilters = new Map();
    this.globalEventListeners = new Set();
    this.isRunning = false;
  }

  // Start the event service
  start() {
    if (this.isRunning) {
      console.log('EventService is already running');
      return;
    }

    this.isRunning = true;
    console.log('EventService started');
    
    // Start event generators for all components
    Component.getAllComponents().forEach(component => {
      this.startEventGenerator(component.key);
    });
  }

  // Stop the event service
  stop() {
    if (!this.isRunning) {
      console.log('EventService is not running');
      return;
    }

    this.isRunning = false;
    
    // Stop all event generators
    this.eventGenerators.forEach((generator, component) => {
      this.stopEventGenerator(component);
    });

    console.log('EventService stopped');
  }

  // Start event generator for a specific component
  startEventGenerator(componentKey) {
    if (this.eventGenerators.has(componentKey)) {
      console.log(`Event generator for ${componentKey} is already running`);
      return;
    }

    const component = Component.getComponent(componentKey);
    if (!component) {
      throw new Error(`Component ${componentKey} not found`);
    }

    // Create event generator with random intervals
    const generator = setInterval(() => {
      if (this.isRunning) {
        this.generateComponentEvent(componentKey);
      }
    }, this.getRandomInterval(5000, 15000)); // Random interval between 5-15 seconds

    this.eventGenerators.set(componentKey, generator);
    console.log(`Event generator started for component: ${componentKey}`);
  }

  // Stop event generator for a specific component
  stopEventGenerator(componentKey) {
    const generator = this.eventGenerators.get(componentKey);
    if (generator) {
      clearInterval(generator);
      this.eventGenerators.delete(componentKey);
      console.log(`Event generator stopped for component: ${componentKey}`);
    }
  }

  // Generate a random event for a component
  generateComponentEvent(componentKey) {
    const component = Component.getComponent(componentKey);
    if (!component) {
      return;
    }

    try {
      // Generate sample events
      const events = component.generateSampleEvents(1);
      const event = events[0];

      // Distribute event to connected sessions
      this.distributeEvent(componentKey, event);
      
      // Notify global listeners
      this.notifyGlobalListeners(event);

    } catch (error) {
      console.error(`Error generating event for ${componentKey}:`, error);
    }
  }

  // Distribute event to all connected sessions for a component
  distributeEvent(componentKey, event) {
    const sessionManager = getSessionManager();
    const activeSessions = sessionManager.getActiveSessions();

    activeSessions.forEach(sessionStatus => {
      if (sessionStatus.activeConnections.includes(componentKey)) {
        const connectionInfo = sessionManager.getConnection(sessionStatus.sessionId, componentKey);
        if (connectionInfo && connectionInfo.connection) {
          connectionInfo.connection.addEvent(event);
        }
      }
    });
  }

  // Trigger events for demo data creation
  createDemoDataEvents(sessionId) {
    const demoData = this.generateDemoData();
    const eventsTriggered = [];

    // Generate events for created data
    demoData.customers.forEach(customer => {
      const event = {
        id: `demo-${Date.now()}-${Math.random()}`,
        type: 'customer.created',
        timestamp: new Date().toISOString(),
        data: customer,
        metadata: {
          source: 'demo-data-creation',
          sessionId
        }
      };
      this.distributeEvent('party', event);
      eventsTriggered.push(event);
    });

    demoData.accounts.forEach(account => {
      const event = {
        id: `demo-${Date.now()}-${Math.random()}`,
        type: 'account.created',
        timestamp: new Date().toISOString(),
        data: account,
        metadata: {
          source: 'demo-data-creation',
          sessionId
        }
      };
      this.distributeEvent('deposits', event);
      eventsTriggered.push(event);
    });

    demoData.loans.forEach(loan => {
      const event = {
        id: `demo-${Date.now()}-${Math.random()}`,
        type: 'loan.created',
        timestamp: new Date().toISOString(),
        data: loan,
        metadata: {
          source: 'demo-data-creation',
          sessionId
        }
      };
      this.distributeEvent('lending', event);
      eventsTriggered.push(event);
    });

    // Trigger cross-component events
    const crossComponentEvents = [
      {
        component: 'eventstore',
        type: 'event.stored',
        data: { message: 'Demo data creation events stored', eventCount: eventsTriggered.length }
      },
      {
        component: 'adapter',
        type: 'integration.completed',
        data: { message: 'Demo data synchronized with external systems', recordCount: demoData.customers.length + demoData.accounts.length + demoData.loans.length }
      },
      {
        component: 'holdings',
        type: 'position.updated',
        data: { message: 'Holdings positions updated based on new accounts', accountCount: demoData.accounts.length }
      }
    ];

    crossComponentEvents.forEach(eventDef => {
      const event = {
        id: `demo-cross-${Date.now()}-${Math.random()}`,
        type: eventDef.type,
        timestamp: new Date().toISOString(),
        data: eventDef.data,
        metadata: {
          source: 'demo-data-creation',
          sessionId,
          crossComponent: true
        }
      };
      this.distributeEvent(eventDef.component, event);
      eventsTriggered.push(event);
    });

    return {
      demoData,
      eventsTriggered: eventsTriggered.length,
      affectedComponents: ['party', 'deposits', 'lending', 'eventstore', 'adapter', 'holdings']
    };
  }

  // Generate sample demo data
  generateDemoData() {
    const customers = [];
    const accounts = [];
    const loans = [];

    // Generate customers
    for (let i = 0; i < 3; i++) {
      customers.push({
        customerId: `DEMO-CUST-${Date.now()}-${i}`,
        customerName: `Demo Customer ${i + 1}`,
        email: `customer${i + 1}@demo.com`,
        phone: `+1-555-000${i + 1}`,
        status: 'ACTIVE',
        createdBy: 'DEMO_SYSTEM'
      });
    }

    // Generate accounts for each customer
    customers.forEach((customer, index) => {
      // Current account
      accounts.push({
        accountId: `DEMO-ACC-CURR-${Date.now()}-${index}`,
        customerId: customer.customerId,
        accountType: 'CURRENT',
        currency: 'USD',
        balance: Math.floor(Math.random() * 10000) + 1000,
        status: 'ACTIVE'
      });

      // Savings account
      accounts.push({
        accountId: `DEMO-ACC-SAV-${Date.now()}-${index}`,
        customerId: customer.customerId,
        accountType: 'SAVINGS',
        currency: 'USD',
        balance: Math.floor(Math.random() * 50000) + 5000,
        status: 'ACTIVE'
      });
    });

    // Generate loans for some customers
    customers.slice(0, 2).forEach((customer, index) => {
      loans.push({
        loanId: `DEMO-LOAN-${Date.now()}-${index}`,
        customerId: customer.customerId,
        loanType: 'PERSONAL',
        amount: Math.floor(Math.random() * 25000) + 5000,
        interestRate: (Math.random() * 5 + 3).toFixed(2),
        term: Math.floor(Math.random() * 36) + 12, // 12-48 months
        status: 'ACTIVE'
      });
    });

    return { customers, accounts, loans };
  }

  // Add global event listener
  addGlobalListener(listener) {
    if (typeof listener === 'function') {
      this.globalEventListeners.add(listener);
      return true;
    }
    return false;
  }

  // Remove global event listener
  removeGlobalListener(listener) {
    return this.globalEventListeners.delete(listener);
  }

  // Notify global event listeners
  notifyGlobalListeners(event) {
    this.globalEventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in global event listener:', error);
      }
    });
  }

  // Add event filter for a component
  addEventFilter(componentKey, filter) {
    if (!this.eventFilters.has(componentKey)) {
      this.eventFilters.set(componentKey, []);
    }
    this.eventFilters.get(componentKey).push(filter);
  }

  // Apply event filters
  applyFilters(componentKey, event) {
    const filters = this.eventFilters.get(componentKey) || [];
    return filters.every(filter => {
      try {
        return filter(event);
      } catch (error) {
        console.error(`Error applying filter for ${componentKey}:`, error);
        return true; // Default to allowing event if filter fails
      }
    });
  }

  // Get random interval for event generation
  getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Get service statistics
  getStats() {
    return {
      isRunning: this.isRunning,
      activeGenerators: this.eventGenerators.size,
      globalListeners: this.globalEventListeners.size,
      totalFilters: Array.from(this.eventFilters.values()).reduce((sum, filters) => sum + filters.length, 0),
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
let eventServiceInstance = null;

function getEventService() {
  if (!eventServiceInstance) {
    eventServiceInstance = new EventService();
  }
  return eventServiceInstance;
}

module.exports = {
  EventService,
  getEventService
}; 