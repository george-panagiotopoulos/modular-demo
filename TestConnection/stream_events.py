#!/usr/bin/env python3
"""
Azure Event Hubs Stream Events Script

This script connects to Azure Event Hubs using the Kafka protocol,
displays a list of available topics, and lets the user select one to stream events from.
"""

import os
import sys
import json
import time
from datetime import datetime
from dotenv import load_dotenv
from confluent_kafka import Consumer, KafkaException, TopicPartition

# Load environment variables from .env file
load_dotenv()

# Connection details from environment variables
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
CONNECTION_STRING = os.getenv("CONNECTION_STRING")

# Number of past events to show
HISTORY_COUNT = 5

def get_consumer():
    """Create and return a configured Kafka consumer"""
    # For Azure Event Hubs Kafka endpoint
    sasl_username = "$ConnectionString"
    sasl_password = CONNECTION_STRING
    
    # Configure Kafka consumer
    conf = {
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'PLAIN',
        'sasl.username': sasl_username,
        'sasl.password': sasl_password,
        'group.id': f'stream-events-{int(time.time())}',  # Unique group ID
        'auto.offset.reset': 'earliest',
        'client.id': 'stream-client',
        'enable.auto.commit': True,
        'auto.commit.interval.ms': 5000
    }
    
    return Consumer(conf)

def get_available_topics():
    """Get list of available topics"""
    topics = []
    
    try:
        consumer = get_consumer()
        
        print("Fetching available topics...")
        metadata = consumer.list_topics(timeout=10)
        
        # Filter out internal Kafka topics
        for topic_name, topic_metadata in metadata.topics.items():
            if not topic_name.startswith('__'):
                partitions = len(topic_metadata.partitions) if topic_metadata.partitions else 0
                topics.append((topic_name, partitions))
                
        consumer.close()
        
    except Exception as e:
        print(f"Error fetching topics: {e}")
        sys.exit(1)
        
    return topics

def format_message(msg):
    """Format a Kafka message for display"""
    # Try to parse the value as JSON
    try:
        value = json.loads(msg.value().decode('utf-8'))
        formatted_value = json.dumps(value, indent=2)
    except:
        # If not JSON, just decode as string
        try:
            formatted_value = msg.value().decode('utf-8')
        except:
            formatted_value = f"<Binary data of length {len(msg.value())} bytes>"
    
    # Get timestamp if available
    if msg.timestamp()[0] != 0:  # 0 means no timestamp
        ts = datetime.fromtimestamp(msg.timestamp()[1]/1000).strftime('%Y-%m-%d %H:%M:%S')
    else:
        ts = "N/A"
    
    # Format the output
    output = (
        f"\n{'=' * 60}\n"
        f"Topic: {msg.topic()}, Partition: {msg.partition()}, Offset: {msg.offset()}\n"
        f"Timestamp: {ts}, Key: {msg.key() or 'None'}\n"
        f"{'=' * 60}\n"
        f"{formatted_value}\n"
    )
    
    return output

def stream_events(topic_name, partition_count):
    """Stream events from the specified topic"""
    try:
        consumer = get_consumer()
        
        # Assign to all partitions of the topic
        partitions = [TopicPartition(topic_name, i) for i in range(partition_count)]
        consumer.assign(partitions)
        
        # Instead of seeking to specific offsets (which can cause errors),
        # we'll just start from the beginning and track how many messages we've shown
        print(f"Starting consumer to retrieve events...")
        
        # Tracking variables
        shown_messages = 0
        buffered_messages = []
        buffer_size = HISTORY_COUNT
        
        print(f"\nStreaming messages from topic '{topic_name}'")
        print(f"Will display the last {buffer_size} messages and then stream new ones.")
        print("Press Ctrl+C to exit.")
        print(f"{'=' * 60}")
        
        # First, collect a buffer of messages
        print("Collecting messages...")
        buffering_start_time = time.time()
        buffering_timeout = 10  # seconds to try collecting messages
        
        while time.time() - buffering_start_time < buffering_timeout:
            msg = consumer.poll(timeout=0.5)
            
            if msg is None:
                continue
                
            if msg.error():
                if msg.error().code() == KafkaException._PARTITION_EOF:
                    # End of partition, not an error
                    continue
                print(f"Consumer error: {msg.error()}")
                break
            
            # Add to our circular buffer
            buffered_messages.append(msg)
            # Keep only the last buffer_size messages
            if len(buffered_messages) > buffer_size:
                buffered_messages.pop(0)
        
        # Display the buffered messages (last N messages)
        if buffered_messages:
            print(f"\nShowing last {len(buffered_messages)} messages:")
            for msg in buffered_messages:
                print(format_message(msg))
            shown_messages = len(buffered_messages)
        else:
            print("\nNo historical messages found within timeout period.")
        
        # Now continue streaming new messages
        print("\nNow streaming new messages in real-time:")
        
        while True:
            # Poll for messages
            msg = consumer.poll(timeout=1.0)
            
            if msg is None:
                # No message received
                sys.stdout.write(".")
                sys.stdout.flush()
                continue
                
            if msg.error():
                if msg.error().code() == KafkaException._PARTITION_EOF:
                    # End of partition, not an error
                    continue
                print(f"Consumer error: {msg.error()}")
                break
            
            # Process the message
            print(format_message(msg))
            shown_messages += 1
            
            # Reset the "waiting" dots
            print("", end="\r")
    
    except KeyboardInterrupt:
        print("\nStopping event stream...")
    except Exception as e:
        print(f"Error streaming events: {e}")
    finally:
        if 'consumer' in locals():
            consumer.close()
        print("Stream ended.")

def main():
    """Main function to run the script"""
    print("Azure Event Hubs Stream Events")
    print("=============================")
    
    # Check for confluent_kafka package
    try:
        import confluent_kafka
    except ImportError:
        print("Error: confluent-kafka package is not installed.")
        print("Please install it with: pip install confluent-kafka")
        sys.exit(1)
    
    # Get available topics
    topics = get_available_topics()
    
    if not topics:
        print("No topics found. Please check your permissions or create a topic first.")
        sys.exit(1)
    
    # Display topic selection menu
    print("\nAvailable topics:")
    for i, (topic, partitions) in enumerate(topics, 1):
        print(f"{i}. {topic} ({partitions} partitions)")
    
    # Get user selection
    while True:
        try:
            selection = input("\nSelect a topic number to stream (or 'q' to quit): ")
            
            if selection.lower() == 'q':
                print("Exiting...")
                sys.exit(0)
                
            selection_idx = int(selection) - 1
            if 0 <= selection_idx < len(topics):
                selected_topic, partition_count = topics[selection_idx]
                break
            else:
                print(f"Invalid selection. Please enter a number between 1 and {len(topics)}.")
        except ValueError:
            print("Invalid input. Please enter a number or 'q'.")
    
    # Stream events from the selected topic
    stream_events(selected_topic, partition_count)

if __name__ == "__main__":
    main() 