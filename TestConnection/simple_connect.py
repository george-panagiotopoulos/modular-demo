#!/usr/bin/env python3
"""
Simple Azure Event Hubs Connection Script

This script makes a direct connection to Azure Event Hubs using the Kafka protocol.
"""

import os
import sys
from dotenv import load_dotenv
from confluent_kafka import Consumer, KafkaException, KafkaError

# Load environment variables from .env file
load_dotenv()

# Connection details from environment variables
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
CONNECTION_STRING = os.getenv("CONNECTION_STRING")

def extract_conn_info(connection_string):
    """Extract key information from the connection string"""
    parts = connection_string.split(';')
    conn_info = {}
    
    for part in parts:
        if part:
            key, value = part.split('=', 1)
            conn_info[key] = value
    
    # Extract the shared access key and name
    sasl_username = conn_info.get("SharedAccessKeyName")
    sasl_password = conn_info.get("SharedAccessKey")
    
    return sasl_username, sasl_password

def test_kafka_connection():
    """Test connection to Event Hubs using Kafka protocol"""
    print(f"Attempting to connect to: {BOOTSTRAP_SERVERS}")
    
    # For Azure Event Hubs Kafka endpoint, the SASL username needs to be in a special format
    # The username should be "$ConnectionString" and the password is the entire connection string
    sasl_username = "$ConnectionString"
    sasl_password = CONNECTION_STRING
    
    # Configure Kafka consumer
    conf = {
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'PLAIN',
        'sasl.username': sasl_username,
        'sasl.password': sasl_password,
        'group.id': 'test-consumer-group',
        'auto.offset.reset': 'earliest',
        'client.id': 'test-client'
    }
    
    try:
        # Create a consumer
        print("Creating Kafka consumer...")
        consumer = Consumer(conf)
        
        # List topics
        print("Attempting to list topics (may take a few seconds)...")
        metadata = consumer.list_topics(timeout=10)
        
        if metadata.topics:
            print("\nAvailable topics:")
            for topic_name, topic_metadata in metadata.topics.items():
                # Filter out internal Kafka topics
                if not topic_name.startswith('__'):
                    print(f"- {topic_name}")
                    
                    # Print partitions info
                    partitions = len(topic_metadata.partitions) if topic_metadata.partitions else 0
                    print(f"  Partitions: {partitions}")
        else:
            print("No topics found (or no permission to list topics)")
        
        # Close the consumer
        consumer.close()
        print("\nKafka connection test completed successfully!")
        return True
        
    except KafkaException as e:
        print(f"Kafka error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("Azure Event Hubs Simple Connection Test (using Kafka protocol)")
    print("============================================================")
    
    # Check for confluent_kafka package
    try:
        import confluent_kafka
        print("confluent-kafka package is installed.")
    except ImportError:
        print("Error: confluent-kafka package is not installed.")
        print("Please install it with: pip install confluent-kafka")
        sys.exit(1)
    
    # Run the test
    test_kafka_connection() 