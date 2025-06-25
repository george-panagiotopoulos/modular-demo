#!/usr/bin/env node

/**
 * Simple Azure Event Hub Connection Test
 * Tests basic connectivity to the Event Hub endpoint
 */

const axios = require('axios');
const { EventHubProducerClient } = require('@azure/event-hubs');
const { ContainerClient } = require('@azure/storage-blob');
const path = require('path');

// Load environment variables from the main .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dns = require('dns').promises;
const net = require('net');

async function testConnection() {
  const BOOTSTRAP_SERVERS = process.env.BOOTSTRAP_SERVERS;
  const CONNECTION_STRING = process.env.CONNECTION_STRING;
  
  if (!BOOTSTRAP_SERVERS || !CONNECTION_STRING) {
    console.error('❌ Missing environment variables:');
    console.error('   BOOTSTRAP_SERVERS:', BOOTSTRAP_SERVERS ? '✅ Set' : '❌ Missing');
    console.error('   CONNECTION_STRING:', CONNECTION_STRING ? '✅ Set' : '❌ Missing');
    process.exit(1);
  }
  
  const hostname = BOOTSTRAP_SERVERS.split(':')[0];
  const port = BOOTSTRAP_SERVERS.split(':')[1];
  
  console.log('🔍 Azure Event Hub Connection Test');
  console.log('==================================');
  console.log(`Target: ${hostname}:${port}`);
  console.log('');
  
  try {
    // Test 1: DNS Resolution
    console.log('1. Testing DNS resolution...');
    const addresses = await dns.resolve4(hostname);
    console.log(`   ✅ DNS resolution successful: ${addresses.join(', ')}`);
    
    // Test 2: Basic TCP connectivity
    console.log('2. Testing TCP connectivity...');
    const socket = new net.Socket();
    
    const connectPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('TCP connection timeout'));
      }, 15000);
      
      socket.connect(port, hostname, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve();
      });
      
      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    
    await connectPromise;
    console.log('   ✅ TCP connectivity successful');
    
    // Test 3: Kafka connection (if TCP works)
    console.log('3. Testing Kafka connection...');
    const { Kafka } = require('kafkajs');
    
    const kafka = new Kafka({
      clientId: 'connection-test',
      brokers: [BOOTSTRAP_SERVERS],
      ssl: {
        rejectUnauthorized: false,
        servername: hostname,
      },
      sasl: {
        mechanism: 'plain',
        username: '$ConnectionString',
        password: CONNECTION_STRING,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
    });
    
    const consumer = kafka.consumer({ 
      groupId: 'test-connection',
      sessionTimeout: 30000,
    });
    
    await consumer.connect();
    console.log('   ✅ Kafka connection successful');
    await consumer.disconnect();
    
    console.log('');
    console.log('🎉 All tests passed! Event Hub connection should work.');
    
  } catch (error) {
    console.error('');
    console.error('❌ Connection test failed:', error.message);
    console.error('');
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('💡 DNS resolution failed. This suggests:');
      console.error('   - Network connectivity issues');
      console.error('   - DNS server problems');
      console.error('   - Corporate network restrictions');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Connection refused. This suggests:');
      console.error('   - Port 9093 is blocked by firewall');
      console.error('   - Azure Event Hub endpoint is down');
      console.error('   - Corporate proxy not configured for Kafka');
    } else if (error.message.includes('timeout')) {
      console.error('💡 Connection timeout. This suggests:');
      console.error('   - Corporate firewall blocking the connection');
      console.error('   - Network latency issues');
      console.error('   - Azure Event Hub not accessible from your network');
    } else if (error.message.includes('SASL')) {
      console.error('💡 SASL authentication failed. This suggests:');
      console.error('   - Invalid connection string');
      console.error('   - Expired or invalid credentials');
      console.error('   - Wrong authentication mechanism');
    }
    
    console.error('');
    console.error('🔧 Troubleshooting steps:');
    console.error('1. Try connecting from outside corporate network');
    console.error('2. Check with network administrator about port 9093 access');
    console.error('3. Verify Azure Event Hub connection string is correct');
    console.error('4. Check if corporate proxy supports Kafka protocol');
    
    process.exit(1);
  }
}

// Run the test
testConnection().catch(console.error); 