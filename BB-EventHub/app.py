from flask import Flask, render_template, jsonify, request, Response, stream_with_context
import os
import datetime
import uuid
import json
import time
import threading
from collections import deque, defaultdict
from confluent_kafka import Consumer, KafkaException, TopicPartition
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app with proper template and static folders
app = Flask(__name__, 
           template_folder='app/templates',
           static_folder='app/static')

# Event Hub configuration
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
CONNECTION_STRING = os.getenv("CONNECTION_STRING")

# Kafka/Event Hub topics - you can modify these based on your actual topics
KAFKA_TOPICS = {
    'party': 'ms-party-outbox',
    'deposits': 'deposits-event-topic', 
    'lending': 'lending-event-topic',
    'eventstore': 'ms-eventstore-inbox-topic',
    'adapter': 'ms-adapterservice-event-topic',
    'holdings': 'ms-holdings-event-topic'
}

# Thread-safe storage for active consumers per session
active_consumers = defaultdict(dict)
consumer_lock = threading.Lock()
consumer_timestamps = defaultdict(dict)

def create_kafka_consumer(session_id=None, domain=None):
    """Create and return a configured Kafka consumer for Event Hub streaming with session-based group ID"""
    sasl_username = "$ConnectionString"
    sasl_password = CONNECTION_STRING
    
    # Generate unique group ID for this session and domain
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if not domain:
        domain = "default"
    
    # Create a unique group ID combining session, domain, and timestamp for extra uniqueness
    group_id = f'bb-eventhub-{domain}-{session_id}-{int(time.time())}-{str(uuid.uuid4())[:8]}'
    
    conf = {
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'PLAIN',
        'sasl.username': sasl_username,
        'sasl.password': sasl_password,
        'group.id': group_id,
        'auto.offset.reset': 'latest',  # Start from latest for real-time events
        'client.id': f'bb-eventhub-client-{session_id}-{domain}',
        'enable.auto.commit': True,
        'auto.commit.interval.ms': 5000,
        'session.timeout.ms': 30000,
        'heartbeat.interval.ms': 10000,
        # Add additional settings for better concurrency handling
        'max.poll.interval.ms': 300000,  # 5 minutes
        'connections.max.idle.ms': 540000,  # 9 minutes
        'request.timeout.ms': 30000,
        'retry.backoff.ms': 100
    }
    
    return Consumer(conf)

def format_kafka_message_for_sse(msg):
    """Format a Kafka message for SSE streaming"""
    try:
        # Try to parse the value as JSON
        try:
            payload = json.loads(msg.value().decode('utf-8'))
        except:
            # If not JSON, just decode as string
            try:
                payload = msg.value().decode('utf-8')
            except:
                payload = f"<Binary data of length {len(msg.value())} bytes>"
        
        # Get timestamp
        if msg.timestamp()[0] != 0:
            timestamp = datetime.datetime.fromtimestamp(msg.timestamp()[1]/1000).strftime('%H:%M:%S')
        else:
            timestamp = datetime.datetime.now().strftime('%H:%M:%S')
        
        return {
            'type': 'event',
            'data': {
                'topic': msg.topic(),
                'partition': msg.partition(),
                'offset': msg.offset(),
                'timestamp': timestamp,
                'key': msg.key().decode('utf-8') if msg.key() else None,
                'payload': payload
            }
        }
    except Exception as e:
        return {
            'type': 'error',
            'message': f'Error formatting message: {str(e)}'
        }

def cleanup_consumer_for_session(session_id, domain):
    """Clean up a specific consumer for a session and domain"""
    with consumer_lock:
        if session_id in active_consumers and domain in active_consumers[session_id]:
            consumer = active_consumers[session_id][domain]
            try:
                consumer.close()
            except:
                pass
            del active_consumers[session_id][domain]
            if session_id in consumer_timestamps and domain in consumer_timestamps[session_id]:
                del consumer_timestamps[session_id][domain]
            if not active_consumers[session_id]:  # Remove session if no consumers left
                del active_consumers[session_id]
            if session_id in consumer_timestamps and not consumer_timestamps[session_id]:
                del consumer_timestamps[session_id]

def cleanup_stale_consumers():
    """Clean up consumers that have been inactive for too long"""
    current_time = time.time()
    stale_threshold = 3600  # 1 hour
    
    with consumer_lock:
        sessions_to_cleanup = []
        for session_id, domains in consumer_timestamps.items():
            domains_to_cleanup = []
            for domain, timestamp in domains.items():
                if current_time - timestamp > stale_threshold:
                    domains_to_cleanup.append(domain)
            
            for domain in domains_to_cleanup:
                if session_id in active_consumers and domain in active_consumers[session_id]:
                    try:
                        active_consumers[session_id][domain].close()
                    except:
                        pass
                    del active_consumers[session_id][domain]
                del consumer_timestamps[session_id][domain]
            
            if not consumer_timestamps[session_id]:
                sessions_to_cleanup.append(session_id)
        
        for session_id in sessions_to_cleanup:
            if session_id in active_consumers:
                del active_consumers[session_id]
            del consumer_timestamps[session_id]

# Start a background thread for periodic cleanup
def start_cleanup_thread():
    def cleanup_worker():
        while True:
            try:
                cleanup_stale_consumers()
                time.sleep(300)  # Run every 5 minutes
            except Exception as e:
                print(f"Error in cleanup worker: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    
    cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
    cleanup_thread.start()

# Start the cleanup thread when the module is loaded
start_cleanup_thread()

def stream_kafka_events(domain, session_id=None):
    """Generator function for streaming Kafka events via SSE with session-based consumers"""
    if domain not in KAFKA_TOPICS:
        yield f"data: {json.dumps({'type': 'error', 'message': f'Unknown domain: {domain}'})}\n\n"
        return
    
    # Generate session ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())
    
    topic_name = KAFKA_TOPICS[domain]
    consumer = None
    
    try:
        # Send initial connection info
        yield f"data: {json.dumps({'type': 'info', 'message': f'Connecting to {domain} events...'})}\n\n"
        
        # Clean up any existing consumer for this session/domain
        cleanup_consumer_for_session(session_id, domain)
        
        # Create new consumer with session-based group ID
        consumer = create_kafka_consumer(session_id=session_id, domain=domain)
        
        # Store consumer for cleanup
        with consumer_lock:
            active_consumers[session_id][domain] = consumer
            consumer_timestamps[session_id][domain] = time.time()
        
        # Subscribe to the topic
        consumer.subscribe([topic_name])
        
        yield f"data: {json.dumps({'type': 'info', 'message': f'Connected to topic: {topic_name}'})}\n\n"
        
        # Stream events
        while True:
            msg = consumer.poll(timeout=1.0)
            
            if msg is None:
                # Send a ping to keep connection alive
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                continue
                
            if msg.error():
                if msg.error().code() == -191:  # KafkaError.PARTITION_EOF
                    continue
                error_msg = f"Kafka error: {msg.error()}"
                yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
                break
            
            # Format and send the event
            formatted_event = format_kafka_message_for_sse(msg)
            yield f"data: {json.dumps(formatted_event)}\n\n"
            
    except Exception as e:
        error_msg = f"Error streaming {domain} events: {str(e)}"
        yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
    finally:
        # Clean up consumer
        if consumer:
            cleanup_consumer_for_session(session_id, domain)
        yield f"data: {json.dumps({'type': 'info', 'message': f'Disconnected from {domain} events'})}\n\n"

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/events/<string:domain>')
def stream_events(domain):
    """Stream Kafka events for the specified domain via Server-Sent Events"""
    # Extract session information from request headers or generate new one
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        # Try to get from query parameters as fallback
        session_id = request.args.get('session_id')
    if not session_id:
        # Generate new session ID if none provided
        session_id = str(uuid.uuid4())
    
    def event_stream():
        for event_data in stream_kafka_events(domain, session_id=session_id):
            yield event_data
    
    return Response(
        event_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Session-ID': session_id  # Return session ID to client
        }
    )

@app.route('/api/events/<string:domain>/disconnect', methods=['POST'])
def disconnect_events(domain):
    """Disconnect from Kafka events for the specified domain"""
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        session_id = request.json.get('session_id') if request.json else None
    
    if session_id:
        cleanup_consumer_for_session(session_id, domain)
        return jsonify({'status': 'success', 'message': f'Disconnected from {domain} events'})
    else:
        return jsonify({'status': 'error', 'message': 'No session ID provided'}), 400

@app.route('/api/cleanup', methods=['POST'])
def cleanup_all_events():
    """Clean up all Event Hub connections for a session"""
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        session_id = request.json.get('session_id') if request.json else None
    
    if session_id:
        with consumer_lock:
            if session_id in active_consumers:
                domains_to_cleanup = list(active_consumers[session_id].keys())
                for domain in domains_to_cleanup:
                    cleanup_consumer_for_session(session_id, domain)
        return jsonify({'status': 'success', 'message': 'All connections cleaned up'})
    else:
        return jsonify({'status': 'error', 'message': 'No session ID provided'}), 400

@app.route('/api/health', methods=['GET'])
def get_health():
    """Get health information about active Event Hub connections"""
    with consumer_lock:
        health_info = {
            'active_sessions': len(active_consumers),
            'total_consumers': sum(len(domains) for domains in active_consumers.values()),
            'sessions': {}
        }
        
        current_time = time.time()
        for session_id, domains in active_consumers.items():
            session_info = {
                'domains': list(domains.keys()),
                'consumer_count': len(domains),
                'timestamps': {}
            }
            
            if session_id in consumer_timestamps:
                for domain, timestamp in consumer_timestamps[session_id].items():
                    session_info['timestamps'][domain] = {
                        'created': timestamp,
                        'age_seconds': current_time - timestamp
                    }
            
            health_info['sessions'][session_id] = session_info
    
    return jsonify(health_info)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True) 