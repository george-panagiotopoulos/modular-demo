import requests
import json
import random
from datetime import datetime, timedelta
import sys
import time
import os
from dotenv import load_dotenv
from confluent_kafka import Consumer, KafkaException, TopicPartition
import uuid

# Load environment variables from .env file
load_dotenv()

OUTPUT_FILE = "demooutput.txt"
# Load API endpoints from environment variables
PARTY_API_BASE_URI = os.getenv("PARTY_API_BASE_URI")
CURRENT_ACCOUNT_API_URI = os.getenv("CURRENT_ACCOUNT_API_URI")
ACCOUNT_BALANCE_API_URI_TEMPLATE = os.getenv("ACCOUNT_BALANCE_API_URI_TEMPLATE")
LOAN_API_BASE_URI = os.getenv("LOAN_API_BASE_URI")
LOAN_STATUS_API_URI_TEMPLATE = os.getenv("LOAN_STATUS_API_URI_TEMPLATE")
LOAN_SCHEDULES_API_URI_TEMPLATE = os.getenv("LOAN_SCHEDULES_API_URI_TEMPLATE")
LOAN_DISBURSEMENT_API_URI_TEMPLATE = os.getenv("LOAN_DISBURSEMENT_API_URI_TEMPLATE")
CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE = os.getenv("CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE")

# Add new constant for party arrangements API
PARTY_ARRANGEMENTS_API_URI_TEMPLATE = "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/holdings/parties/{party_id}/arrangements"

# New API Endpoints for Debit/Credit Transactions
DEBIT_ACCOUNT_API_URI = "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/order/payments/debitAccount"
CREDIT_ACCOUNT_API_URI = "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/order/payments/creditAccount"

# New API Endpoints for Holdings Microservice
HOLDINGS_PARTY_ARRANGEMENTS_API_URI_TEMPLATE = "http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v1.0.0/holdings/parties/{party_id}/arrangements"
HOLDINGS_ACCOUNT_BALANCES_API_URI_TEMPLATE = "http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/balances"
HOLDINGS_ACCOUNT_TRANSACTIONS_API_URI_TEMPLATE = "http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/transactions"

# Kafka Event Processing Constants
STREAM_EVENTS_SCRIPT_PATH = "/Users/gpanagiotopoulos/ModularDemo/TestConnection/stream_events.py"
KAFKA_LENDING_TOPIC = "lending-event-topic"
# KAFKA_PAYOUT_EVENT_TYPE = "paymentRequests.createOrder.requestInternalPayOut" # Not used in this simplified version
KAFKA_CONSUMER_TIMEOUT = 30 # Increased timeout for capturing more events

# Kafka connection details from environment variables
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
CONNECTION_STRING = os.getenv("CONNECTION_STRING")
HISTORY_COUNT = 13  # Increased to get more Kafka events

# Sample data for randomization
first_names = ["Alice", "Bob", "Charlie", "David", "Eve", "Fiona", "George", "Hannah", "Ian", "Julia"]
last_names = ["Smith", "Jones", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson"]
cities = ["New York", "London", "Paris", "Tokyo", "Berlin", "Moscow", "Rome", "Madrid", "Sydney", "Cairo"]
suffixes = ["Jr.", "Sr.", "B.A.", "M.Sc.", "Ph.D.", "M.D."]

# Reasons for transactions
DEBIT_REASONS = ["Utility Bill Payment", "Online Shopping", "Subscription Renewal", "Cash Withdrawal", "Outgoing Fund Transfer"]
CREDIT_REASONS = ["Salary Deposit", "Incoming Fund Transfer", "Refund Processed", "Interest Earned", "Stock Dividend"]

# Helper function to generate transaction reference
def generate_transaction_reference(reason_text, type_prefix="TXN"):
    reason_code = "".join(filter(str.isalnum, reason_text.upper()))[:10] # UTILITYBIL
    timestamp_ms = int(time.time() * 1000)
    random_suffix = random.randint(100, 999)
    return f"{type_prefix}_{reason_code}_{timestamp_ms}_{random_suffix}"

# Kafka functions (adapted from stream_events.py)
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
        'group.id': f'demoflow-{int(time.time())}',  # Unique group ID
        'auto.offset.reset': 'earliest',
        'client.id': 'demoflow-client',
        'enable.auto.commit': True,
        'auto.commit.interval.ms': 5000
    }
    
    return Consumer(conf)

def format_kafka_message(msg):
    """Format a Kafka message as a JSON object"""
    result = {}
    
    # Add metadata
    result["topic"] = msg.topic()
    result["partition"] = msg.partition()
    result["offset"] = msg.offset()
    
    # Add key if available
    if msg.key():
        try:
            result["key"] = msg.key().decode('utf-8')
        except:
            result["key"] = str(msg.key())
    
    # Add timestamp if available
    if msg.timestamp()[0] != 0:  # 0 means no timestamp
        result["timestamp"] = datetime.fromtimestamp(msg.timestamp()[1]/1000).strftime('%Y-%m-%d %H:%M:%S')
    
    # Add value/payload
    try:
        # Try to parse as JSON
        result["payload"] = json.loads(msg.value().decode('utf-8'))
    except:
        # If not JSON, just add as string
        try:
            result["payload"] = msg.value().decode('utf-8')
        except:
            result["payload"] = f"<Binary data of length {len(msg.value())} bytes>"
    
    return result

def capture_kafka_events(topic_name, num_events=HISTORY_COUNT):
    """Capture the last num_events from a Kafka topic"""
    print(f"Capturing the last {num_events} events from Kafka topic '{topic_name}'...")
    
    try:
        consumer = get_consumer()
        
        # Get topic partitions
        cluster_metadata = consumer.list_topics(topic_name, timeout=10)
        if topic_name not in cluster_metadata.topics:
            raise ValueError(f"Topic '{topic_name}' not found")
            
        topic_metadata = cluster_metadata.topics[topic_name]
        partitions = len(topic_metadata.partitions)
        
        # Assign to all partitions of the topic
        partition_objects = [TopicPartition(topic_name, i) for i in range(partitions)]
        consumer.assign(partition_objects)
        
        # Buffer to store the messages
        buffered_messages = []
        buffer_size = num_events
        
        # Collect messages for a specific timeout
        start_time = time.time()
        print("Collecting messages from Kafka...")
        
        while time.time() - start_time < KAFKA_CONSUMER_TIMEOUT:
            msg = consumer.poll(timeout=0.5)
            
            if msg is None:
                continue
                
            if msg.error():
                if msg.error().code() == KafkaException._PARTITION_EOF:
                    # End of partition, not an error
                    continue
                print(f"Consumer error: {msg.error()}")
                break
            
            # Add to our buffer
            buffered_messages.append(msg)
            # Keep only the last buffer_size messages
            if len(buffered_messages) > buffer_size:
                buffered_messages.pop(0)
        
        # Process and return the buffered messages
        formatted_messages = []
        if buffered_messages:
            print(f"Captured {len(buffered_messages)} messages from Kafka.")
            for msg in buffered_messages:
                formatted_messages.append(format_kafka_message(msg))
            log_last_kafka_events(topic_name, formatted_messages)
            return formatted_messages
        else:
            print("No messages captured from Kafka within the timeout period.")
            log_last_kafka_events(topic_name, [{"info": "No messages found in Kafka topic."}])
            return None
    
    except Exception as e:
        error_msg = f"Error capturing Kafka events: {str(e)}"
        print(f"Error: {error_msg}")
        log_last_kafka_events(topic_name, [{"error": "Exception while capturing Kafka events", "details": error_msg}])
        return None
    finally:
        if 'consumer' in locals():
            consumer.close()
            print("Kafka consumer closed.")

def get_random_date_of_birth():
    """Generates a random date of birth between 18 and 70 years ago."""
    today = datetime.today()
    start_date = today - timedelta(days=70*365)
    end_date = today - timedelta(days=18*365)
    time_between_dates = end_date - start_date
    days_between_dates = time_between_dates.days
    random_number_of_days = random.randrange(days_between_dates)
    random_date = start_date + timedelta(days=random_number_of_days)
    return random_date.strftime("%Y-%m-%d")

def generate_customer_payload():
    """Generates a randomized customer payload."""
    first_name = random.choice(first_names)
    last_name = random.choice(last_names)
    middle_name_initial = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    
    return {
        "dateOfBirth": get_random_date_of_birth(),
        "cityOfBirth": random.choice(cities),
        "firstName": first_name,
        "middleName": middle_name_initial,
        "lastName": last_name,
        "nickName": first_name,
        "suffix": random.choice(suffixes),
        "alias": first_name,
    }

def log_api_call(uri, method, payload, response_status_code, response_body):
    """Logs the API call details to the output file."""
    with open(OUTPUT_FILE, "a") as f:
        f.write(f"API Call: {method} {uri}\n")
        if payload is not None:
            f.write("Request Payload:\n")
            f.write(json.dumps(payload, indent=2) + "\n")
        else:
            f.write("Request Payload: None (GET request)\n")
        f.write(f"Response Status Code: {response_status_code}\n")
        f.write("Response Body:\n")
        f.write(json.dumps(response_body, indent=2) + "\n")
        f.write("-" * 50 + "\n\n")
    print(f"Logged details for {method} {uri} to {OUTPUT_FILE}")

def log_last_kafka_events(topic_name, events_or_lines):
    """Logs the last few captured Kafka events/lines to the output file."""
    with open(OUTPUT_FILE, "a") as f:
        f.write(f"Last {len(events_or_lines)} Captured Lines/Events from Kafka Topic: {topic_name}\n")
        for i, item in enumerate(events_or_lines):
            f.write(f"  --- Event/Line {i+1} ---\n")
            if isinstance(item, dict): # It was successfully parsed as JSON
                f.write(json.dumps(item, indent=2) + "\n")
            else: # It's a raw string (JSON parse failed or not attempted)
                f.write(str(item) + "\n")
        f.write("-" * 50 + "\n\n")
    print(f"Logged last {len(events_or_lines)} captured Kafka lines/events from {topic_name} to {OUTPUT_FILE}")

def create_customer():
    """Creates a new customer via API call."""
    uri = PARTY_API_BASE_URI
    payload = generate_customer_payload()
    print(f"Attempting to create customer...")
    try:
        start_time = time.time()
        response = requests.post(uri, json=payload, headers={'Content-Type': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "POST", payload, response.status_code, response_data)
        if response.status_code >= 200 and response.status_code < 300:
            print(f"Customer created successfully. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to create customer. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to create customer: {e}")
        log_api_call(uri, "POST", payload, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_party_by_date_of_birth(date_of_birth):
    """Gets parties by date of birth via API call."""
    uri = f"{PARTY_API_BASE_URI}?dateOfBirth={date_of_birth}"
    print(f"Attempting to get parties by date of birth {date_of_birth} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched parties by date of birth {date_of_birth}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch parties by date of birth {date_of_birth}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get parties by date of birth: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_party_by_last_name(last_name):
    """Gets parties by last name via API call."""
    uri = f"{PARTY_API_BASE_URI}?lastName={last_name}"
    print(f"Attempting to get parties by last name {last_name} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched parties by last name {last_name}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch parties by last name {last_name}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get parties by last name: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_party_by_last_name_and_date_of_birth(last_name, date_of_birth):
    """Gets parties by last name and date of birth via API call."""
    uri = f"{PARTY_API_BASE_URI}?lastName={last_name}&dateOfBirth={date_of_birth}"
    print(f"Attempting to get parties by last name {last_name} and date of birth {date_of_birth} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched parties by last name {last_name} and date of birth {date_of_birth}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch parties by last name {last_name} and date of birth {date_of_birth}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get parties by last name and date of birth: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_party_by_id(party_id):
    """Gets a specific party by party ID via API call."""
    uri = f"{PARTY_API_BASE_URI}/{party_id}"
    print(f"Attempting to get party by ID {party_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched party by ID {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch party by ID {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get party by ID: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def generate_loan_term():
    """Generates a random loan term between 6 months and 10 years."""
    total_months = random.randint(6, 120)
    if total_months % 12 == 0:
        years = total_months // 12
        if years == 0:
            return f"{total_months}M"
        return f"{years}Y"
    else:
        return f"{total_months}M"

def generate_loan_payload(party_id, account_reference="123456"):
    """Generates a randomized loan payload."""
    amount = str(random.randint(30000, 300000))
    term = generate_loan_term()
    return {
        "header": {},
        "body": {
            "partyIds": [{"partyId": str(party_id), "partyRole": "OWNER"}],
            "productId": "MORTGAGE.PRODUCT",
            "currency": "USD",
            "arrangementEffectiveDate": "",
            "commitment": [{"amount": amount, "term": term}],
            "schedule": [{"payment": [{}, {"paymentFrequency": "e0Y e1M e0W e0D e0F"}]}],
            "settlement": [{
                "payout": [{"payoutSettlement": "YES", "property": [{"payoutAccount": f"DDAComposable|GB0010001|{account_reference}"}]}],
                "assocSettlement": [
                    {"payinSettlement": "YES", "reference": [{"payinAccount": f"DDAComposable|GB0010001|{account_reference}"}]},
                    {"payinSettlement": "YES", "reference": [{"payinAccount": f"DDAComposable|GB0010001|{account_reference}"}]},
                ]
            }]
        }
    }

def create_loan(party_id, account_reference="123456"):
    """Creates a new loan for the given partyId via API call."""
    uri = LOAN_API_BASE_URI
    payload = generate_loan_payload(party_id, account_reference)
    print(f"Attempting to create loan for partyId {party_id} with account reference {account_reference}...")
    try:
        start_time = time.time()
        response = requests.post(uri, json=payload, headers={'Content-Type': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "POST", payload, response.status_code, response_data)
        if response.status_code >= 200 and response.status_code < 300:
            print(f"Loan created successfully for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to create loan for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to create loan: {e}")
        log_api_call(uri, "POST", payload, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_loan_status(loan_id):
    """Gets the status for a given loan_id via API call."""
    uri = LOAN_STATUS_API_URI_TEMPLATE.format(loan_id=loan_id)
    print(f"Attempting to get loan status for loanId {loan_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched loan status for loanId {loan_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch loan status for loanId {loan_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get loan status: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_loan_schedules(loan_id):
    """Gets the schedules for a given loan_id via API call."""
    uri = LOAN_SCHEDULES_API_URI_TEMPLATE.format(loan_id=loan_id)
    print(f"Attempting to get loan schedules for loanId {loan_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched loan schedules for loanId {loan_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch loan schedules for loanId {loan_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get loan schedules: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_customer_arrangements(customer_id):
    """Gets all arrangements for a given customer_id via API call."""
    uri = CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE.format(customer_id=customer_id)
    print(f"Attempting to get customer arrangements for customerId {customer_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched customer arrangements for customerId {customer_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch customer arrangements for customerId {customer_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get customer arrangements: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def disburse_loan(loan_id, original_amount):
    """Disburses a loan with 80% of the original amount."""
    uri = LOAN_DISBURSEMENT_API_URI_TEMPLATE.format(loan_id=loan_id)
    
    # Calculate 80% of the original amount
    disbursement_amount = int(float(original_amount) * 0.8)
    
    # Format today's date as YYYYMMDD
    today_str = datetime.today().strftime("%Y%m%d")
    
    payload = {
        "body": {
            "currencyId": "USD",
            "effectiveDate": today_str,
            "transactionAmount": disbursement_amount
        }
    }
    
    print(f"Attempting to disburse loan {loan_id} with amount {disbursement_amount} USD...")
    
    try:
        start_time = time.time()
        response = requests.put(uri, json=payload, headers={'Content-Type': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        
        log_api_call(uri, "PUT", payload, response.status_code, response_data)
        
        if response.status_code >= 200 and response.status_code < 300:
            print(f"Loan disbursement successful for loan {loan_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to disburse loan {loan_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to disburse loan: {e}")
        log_api_call(uri, "PUT", payload, "N/A (Request Failed)", {"error": str(e)})
        return None

def generate_current_account_payload(party_id):
    """Generates a payload for creating a current account."""
    # Format today's date as YYYYMMDD dynamically
    today_str = datetime.today().strftime("%Y%m%d")
    
    # Generate unique quotation reference
    quotation_ref = f"QUOT{uuid.uuid4().hex[:6].upper()}"
    
    return {
        "parties": [
            {
                "partyId": str(party_id),
                "partyRole": "OWNER"
            }
        ],
        "accountName": "current",
        "openingDate": "20250314",
        "productId": "CHECKING.ACCOUNT",
        "currency": "USD",
        "branchCode": "01123",
        "quotationReference": quotation_ref
    }

def create_current_account(party_id):
    """Creates a new current account for the given partyId via API call."""
    uri = CURRENT_ACCOUNT_API_URI
    payload = generate_current_account_payload(party_id)
    print(f"Attempting to create current account for partyId {party_id}...")
    try:
        start_time = time.time()
        response = requests.post(uri, json=payload, headers={'Content-Type': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "POST", payload, response.status_code, response_data)
        if response.status_code >= 200 and response.status_code < 300:
            print(f"Current account created successfully for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to create current account for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to create current account: {e}")
        log_api_call(uri, "POST", payload, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_account_balance(account_reference):
    """Gets the balance details for a given account_reference via API call."""
    uri = ACCOUNT_BALANCE_API_URI_TEMPLATE.format(account_reference=account_reference)
    print(f"Attempting to get account balance for account reference {account_reference} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched account balance for account reference {account_reference}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch account balance for account reference {account_reference}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get account balance: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_party_arrangements(party_id):
    """Gets all arrangements for a given party_id via API call."""
    uri = PARTY_ARRANGEMENTS_API_URI_TEMPLATE.format(party_id=party_id)
    print(f"Attempting to get party arrangements for partyId {party_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched party arrangements for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch party arrangements for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get party arrangements: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_arrangement_balance(arrangement_id):
    """Gets the balance details for a given arrangement_id via API call."""
    # Using the same endpoint format as account_reference but with arrangementId
    uri = ACCOUNT_BALANCE_API_URI_TEMPLATE.format(account_reference=arrangement_id)
    print(f"Attempting to get balance for arrangementId {arrangement_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched balance for arrangementId {arrangement_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch balance for arrangementId {arrangement_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get arrangement balance: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

#--- Holdings Microservice API Functions ---
def get_holdings_party_arrangements(party_id):
    """
    Gets all arrangements for a given party_id across deposits and lending from the Holdings microservice.
    
    The Holdings microservice provides a consolidated view of all arrangements for a party,
    regardless of which product line (ACCOUNTS, LENDING, etc.) they belong to.
    
    Example party_id: 2514040984
    Example response:
    {
        "arrangements": [
            {
                "arrangementId": "ARR25140YSLA5HCRJN",  # Unique identifier in Holdings
                "extArrangementId": "GB0010001-AA25073FPYFY",  # External ID in format [legalEntityId]-[contractReference]
                "productGroup": "MORTGAGE.PRODUCT",
                "productLine": "LENDING",  # Indicates this is a lending product
                "systemReference": "lending",
                "contractReference": "AA25073FPYFY",  # This corresponds to the arrangementId in the lending system
                "alternateReferences": [
                    {
                        "alternateType": "ACCOUNT",
                        "alternateId": "GB0010001-1013716125"  # Format: [legalEntityId]-[account_reference]
                    }
                ]
            },
            {
                "arrangementId": "ARR25140JJV71PY4I1",  # Different arrangement (deposit account)
                "productLine": "ACCOUNTS",  # Indicates this is a deposit account
                "systemReference": "deposits",
                "contractReference": "AA250731T5YN",  # This corresponds to the arrangementId in the deposits system
                "alternateReferences": [
                    {
                        "alternateType": "ACCOUNT",
                        "alternateId": "GB0010001-1013715536"  # The account_reference from create_account API
                    }
                ]
            }
        ]
    }
    """
    uri = HOLDINGS_PARTY_ARRANGEMENTS_API_URI_TEMPLATE.format(party_id=party_id)
    print(f"Attempting to get holdings party arrangements for partyId {party_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched holdings party arrangements for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch holdings party arrangements for partyId {party_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get holdings party arrangements: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_holdings_account_balances(account_id):
    """
    Gets balance details for an account using the Holdings microservice.
    
    The account_id here is the alternateId from a party arrangement response,
    typically in the format [legalEntityId]-[account_reference] (e.g., GB0010001-1013715536).
    This endpoint returns a list of balance items under the "items" key.
    
    Example account_id: GB0010001-1013715536
    Example response:
    {
        "items": [
            {
                "companyReference": "GB0010001",
                "systemReference": "deposits",
                "contractReference": "AA250731T5YN",  # Corresponds to arrangementId in deposits
                "accountId": "GB0010001-1013715536",
                "availableBalance": 1500,
                "workingBalance": 1500,
                "onlineActualBalance": 1500,
                "currencyId": "USD",
                "customerId": "2514040984"  # Party ID of the account owner
            }
        ]
    }
    """
    uri = HOLDINGS_ACCOUNT_BALANCES_API_URI_TEMPLATE.format(account_id=account_id)
    print(f"Attempting to get holdings account balances for accountId {account_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched holdings account balances for accountId {account_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch holdings account balances for accountId {account_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get holdings account balances: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

def get_holdings_account_transactions(account_id):
    """
    Gets transaction details for an account using the Holdings microservice.
    
    The account_id here is the alternateId from a party arrangement response,
    typically in the format [legalEntityId]-[account_reference] (e.g., GB0010001-1013715536).
    This endpoint returns a list of transaction items under the "items" key.
    
    Example account_id: GB0010001-1013715536
    Example response:
    {
        "items": [
            {
                "companyReference": "GB0010001",
                "systemReference": "deposits",
                "contractReference": "AA250731T5YN",
                "id": "209603907542576.020001",
                "accountId": "GB0010001-1013715536",
                "valueDate": "2025-03-14",
                "bookingDate": "2025-03-14",
                "amountInAccountCurrency": 1500,
                "transactionAmount": 1500,
                "currency": "USD",
                "narrative": "Account Parameter",
                "paymentIndicator": "Credit",
                "customerId": "2514040984"
            }
        ]
    }
    """
    uri = HOLDINGS_ACCOUNT_TRANSACTIONS_API_URI_TEMPLATE.format(account_id=account_id)
    print(f"Attempting to get holdings account transactions for accountId {account_id} from {uri}")
    try:
        start_time = time.time()
        response = requests.get(uri, headers={'Accept': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(uri, "GET", None, response.status_code, response_data)
        if response.status_code == 200:
            print(f"Successfully fetched holdings account transactions for accountId {account_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to fetch holdings account transactions for accountId {account_id}. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to get holdings account transactions: {e}")
        log_api_call(uri, "GET", None, "N/A (Request Failed)", {"error": str(e)})
        return None

# --- Functions for Debit/Credit Transactions ---
def generate_debit_payload(account_reference):
    """Generates a randomized payload for a debit transaction."""
    reason = random.choice(DEBIT_REASONS)
    txn_ref = generate_transaction_reference(reason, "DEBIT")
    amount = str(random.randint(10, 1000))
    return {
        "paymentTransactionReference": txn_ref,
        "paymentReservationReference": txn_ref, # Using same as txn_ref as per example
        "paymentValueDate": "20250415",
        "debitAccount": account_reference,
        "debitCurrency": "USD",
        "paymentAmount": amount,
        "paymentDescription": reason
    }

def generate_credit_payload(account_reference):
    """Generates a randomized payload for a credit transaction."""
    reason = random.choice(CREDIT_REASONS)
    txn_ref = generate_transaction_reference(reason, "CREDIT")
    amount = str(random.randint(10, 1000))
    return {
        "paymentTransactionReference": txn_ref,
        "paymentReservationReference": txn_ref,
        "paymentValueDate": "20250415",
        "creditAccount": account_reference, # Assuming API uses 'creditAccount'
        "creditCurrency": "USD",
        "paymentAmount": amount,
        "paymentDescription": reason
    }

def perform_account_transaction(api_uri, payload, transaction_type):
    """Performs an account transaction (debit or credit) via API call."""
    print(f"Attempting to perform {transaction_type} transaction...")
    try:
        start_time = time.time()
        response = requests.post(api_uri, json=payload, headers={'Content-Type': 'application/json'})
        end_time = time.time()
        response_time = end_time - start_time
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        log_api_call(api_uri, "POST", payload, response.status_code, response_data)
        if response.status_code >= 200 and response.status_code < 300:
            print(f"{transaction_type.capitalize()} transaction successful. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            return response_data
        else:
            print(f"Failed to perform {transaction_type} transaction. Status: {response.status_code}, Response time: {response_time:.3f} seconds")
            print(f"Response body: {json.dumps(response_data, indent=2)}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error during API call for {transaction_type} transaction: {e}")
        log_api_call(api_uri, "POST", payload, "N/A (Request Failed)", {"error": str(e)})
        return None

if __name__ == "__main__":
    with open(OUTPUT_FILE, "w") as f:
        f.write("Demo Flow Output Log\n")
        f.write("=" * 50 + "\n\n")
        
    print("Starting demo flow...")
    print("\n--- Step 1: Create Customer ---")
    created_customer_response = create_customer()
    
    if created_customer_response:
        print("Customer creation step completed.")
        customer_id = created_customer_response.get("id") 
        if not customer_id and isinstance(created_customer_response.get("body"), dict):
            customer_id = created_customer_response.get("body", {}).get("id")

        if customer_id:
            print(f"Successfully created customer with ID: {customer_id}")
            
            # Add new step to demonstrate party retrieval APIs
            print("\n--- Step 1.5: Demonstrate Party Retrieval APIs ---")
            print("# Testing various ways to retrieve party data using the newly created customer")
            
            # Extract customer data for testing retrieval APIs
            customer_data = created_customer_response
            if isinstance(created_customer_response.get("body"), dict):
                customer_data = created_customer_response.get("body")
            
            # Get the customer's details for testing
            date_of_birth = customer_data.get("dateOfBirth")
            last_name = customer_data.get("lastName")
            
            if date_of_birth:
                print(f"\n--- Testing: Get Party by Date of Birth ({date_of_birth}) ---")
                get_party_by_date_of_birth(date_of_birth)
            
            if last_name:
                print(f"\n--- Testing: Get Party by Last Name ({last_name}) ---")
                get_party_by_last_name(last_name)
            
            if date_of_birth and last_name:
                print(f"\n--- Testing: Get Party by Last Name and Date of Birth ({last_name}, {date_of_birth}) ---")
                get_party_by_last_name_and_date_of_birth(last_name, date_of_birth)
            
            if customer_id:
                print(f"\n--- Testing: Get Party by ID ({customer_id}) ---")
                get_party_by_id(customer_id)
            
            # Add new step for current account creation
            print("\n--- Step 2: Create Current Account ---")
            created_account_response = create_current_account(customer_id)
            
            if created_account_response:
                print("Current account creation step completed.")
                account_reference = None
                
                # Extract account reference from response
                if isinstance(created_account_response, dict):
                    body = created_account_response.get("body")
                    if isinstance(body, dict):
                        account_reference = body.get("accountReference")
                    if not account_reference:
                        account_reference = created_account_response.get("accountReference")
                
                if account_reference:
                    print(f"Successfully created current account with reference: {account_reference}")
                    
                    # Add step to get account balance
                    print("\n--- Step 3: Get Account Balance ---")
                    get_account_balance(account_reference)
                    
                    # Add step to get party arrangements
                    print("\n--- Step 4: Get Party Arrangements ---")
                    arrangements_response = get_party_arrangements(customer_id)
                    
                    # Process arrangements and get balances for each
                    if arrangements_response and isinstance(arrangements_response, dict):
                        # Extract the arrangements array from the response
                        arrangements = arrangements_response.get('arrangements', [])
                        if arrangements and len(arrangements) > 0:
                            print(f"Found {len(arrangements)} arrangements for partyId {customer_id}")
                            
                            print("\n--- Step 5: Get Balances for All Arrangements ---")
                            # Iterate through arrangements and get balance for each arrangement ID
                            for idx, arrangement in enumerate(arrangements):
                                if isinstance(arrangement, dict) and 'arrangementId' in arrangement:
                                    arrangement_id = arrangement.get('arrangementId')
                                    print(f"Processing arrangement {idx+1}/{len(arrangements)}: {arrangement_id}")
                                    
                                    # Call the balance API using the arrangementId as alternative key
                                    # Note: The same balance API can fetch balance using either account_reference or arrangementId
                                    get_arrangement_balance(arrangement_id)
                                else:
                                    print(f"Skipping arrangement {idx+1}/{len(arrangements)}: Invalid format")
                        else:
                            print("No arrangements found in the response for partyId. Skipping balances step.")
                    else:
                        print("Invalid response format or no response. Skipping balances step.")
                else:
                    print("Could not extract account reference from account creation response.")
                    account_reference = "123456"  # Use default if we couldn't get the real reference
            else:
                print("Current account creation step failed.")
                account_reference = "123456"  # Use default if current account creation failed
            
            # Continue with loan creation (now step 6)
            print("\n--- Step 6: Create Loan ---")
            created_loan_response = create_loan(customer_id, account_reference)
            
            if created_loan_response:
                print("Loan creation step completed.")
                loan_id = None
                aaa_id = None # Still try to extract aaa_id in case it's needed later or for other logging

                if isinstance(created_loan_response, dict):
                    header = created_loan_response.get("header")
                    if isinstance(header, dict):
                        loan_id = header.get("id") 
                        aaa_id = header.get("aaaId") 

                    if not loan_id:
                        loan_id = created_loan_response.get("arrangementId")
                    if not loan_id:
                        loan_id = created_loan_response.get("id")
                    if not loan_id:
                        body_for_loan_id_fallback = created_loan_response.get("body")
                        if isinstance(body_for_loan_id_fallback, dict):
                            loan_id = body_for_loan_id_fallback.get("arrangementId")
                            if not loan_id:
                                loan_id = body_for_loan_id_fallback.get("id")
                        elif isinstance(body_for_loan_id_fallback, list) and body_for_loan_id_fallback:
                            if isinstance(body_for_loan_id_fallback[0], dict):
                                loan_id = body_for_loan_id_fallback[0].get("arrangementId")
                                if not loan_id:
                                    loan_id = body_for_loan_id_fallback[0].get("id")

                # Renumber subsequent steps
                print(f"\n--- Step 7: Capture 5 Kafka Events After Loan Creation ---")
                initial_kafka_events = capture_kafka_events(KAFKA_LENDING_TOPIC, 5)  # Use 5 instead of HISTORY_COUNT
                
                if initial_kafka_events:
                    print(f"Successfully captured {len(initial_kafka_events)} events from Kafka topic {KAFKA_LENDING_TOPIC} after loan creation.")
                else:
                    print(f"Failed to capture events from Kafka topic {KAFKA_LENDING_TOPIC} after loan creation.")

                # Get the original amount used in loan creation for disbursement
                original_amount = None
                try:
                    if isinstance(created_loan_response.get("body"), dict) and created_loan_response.get("body").get("commitment"):
                        commitment = created_loan_response.get("body").get("commitment")
                        if isinstance(commitment, list) and len(commitment) > 0:
                            original_amount = commitment[0].get("amount")
                    
                    # If we couldn't extract it from the response, use a default value
                    if not original_amount:
                        original_amount = "100000"  # Default to 100,000 if not found
                except Exception as e:
                    print(f"Error extracting original loan amount: {e}")
                    original_amount = "100000"  # Default to 100,000 on error
                
                print(f"\n--- Step 8: Get Loan Status ---")
                get_loan_status(loan_id)
                
                print(f"\n--- Step 9: Get Loan Schedules ---")
                get_loan_schedules(loan_id)

                print(f"\n--- Step 10: Get Account Balance (after loan disbursement) ---")
                if account_reference:
                    get_account_balance(account_reference)
                else:
                    print("Skipping account balance check as account_reference is not available.")
                
                # REMOVED Step 10: Disburse Loan and subsequent Kafka capture

                # aaa_id is not directly used by capture_kafka_events, but good to know if it was found
                if aaa_id:
                    print(f"(Extracted aaaId from loan response for reference: {aaa_id})")
                else:
                    print("(Could not extract aaaId from loan response for reference)")

                if loan_id:
                    print(f"Successfully identified loanId for API calls: {loan_id}")
            else:
                print("Loan creation step failed. Skipping subsequent loan-related steps.")

            # --- New Debit/Credit Transaction Steps ---
            if account_reference: # Only proceed if we have an account reference
                print(f"\n--- Step 12: Perform Debit Transaction ---")
                debit_payload = generate_debit_payload(account_reference)
                perform_account_transaction(DEBIT_ACCOUNT_API_URI, debit_payload, "debit")

                print(f"\n--- Step 13: Perform First Credit Transaction ---")
                credit_payload1 = generate_credit_payload(account_reference)
                perform_account_transaction(CREDIT_ACCOUNT_API_URI, credit_payload1, "credit")

                print(f"\n--- Step 14: Perform Second Credit Transaction ---")
                credit_payload2 = generate_credit_payload(account_reference)
                perform_account_transaction(CREDIT_ACCOUNT_API_URI, credit_payload2, "credit")

                print(f"\n--- Step 15: Get Account Balance (after transactions) ---")
                get_account_balance(account_reference)
            else:
                print("Skipping debit/credit transactions and final balance check as account_reference is not available.")
            # --- End of New Debit/Credit Transaction Steps ---

            # --- Add Holdings Microservice API calls ---
            print("\n--- Step 16: Get Holdings Party Arrangements ---")
            print("# The Holdings microservice provides a consolidated view of arrangements across all product lines")
            print("# It acts as an aggregator, connecting party IDs with their arrangements in different systems")
            holdings_arrangements = get_holdings_party_arrangements(customer_id)
            
            # Process Holdings arrangements
            if holdings_arrangements and isinstance(holdings_arrangements, dict):
                arrangements = holdings_arrangements.get('arrangements', [])
                if arrangements and len(arrangements) > 0:
                    # Extract the first account's alternateId for balance and transaction calls
                    account_id = None
                    
                    print("\n--- Party ID to Arrangement ID Relationships ---")
                    print("# Each arrangement has these key identifiers:")
                    print("# 1. arrangementId: A unique identifier in the Holdings system (e.g., ARR25140JJV71PY4I1)")
                    print("# 2. contractReference: Maps to the arrangementId in source systems (e.g., AA250731T5YN)")
                    print("# 3. alternateId: Contains the account_reference with format legalEntityId-accountRef (e.g., GB0010001-1013715536)")
                    
                    # Iterate through arrangements to find a suitable account_id for balance check
                    for arrangement in arrangements:
                        if isinstance(arrangement, dict):
                            # Print mapping information for each arrangement
                            print(f"\nArrangement: {arrangement.get('arrangementId')}")
                            print(f"  Product Line: {arrangement.get('productLine', 'Unknown')}")
                            print(f"  System Reference: {arrangement.get('systemReference', 'Unknown')}")
                            print(f"  Contract Reference: {arrangement.get('contractReference', 'Unknown')}")
                            
                            # Look for alternateReferences with type ACCOUNT 
                            alt_refs = arrangement.get('alternateReferences', [])
                            for alt_ref in alt_refs:
                                if isinstance(alt_ref, dict) and alt_ref.get('alternateType') == 'ACCOUNT':
                                    alt_id = alt_ref.get('alternateId')
                                    print(f"  Account Alternate ID: {alt_id}")
                                    
                                    # Use the first account ID we find for subsequent API calls
                                    if not account_id:
                                        account_id = alt_id
                    
                    # If we found an account_id, use it for balance and transaction calls
                    if account_id:
                        print(f"\n--- Step 17: Get Holdings Account Balances ---")
                        print(f"# Using account_id {account_id} from Holdings arrangement")
                        get_holdings_account_balances(account_id)
                        
                        print(f"\n--- Step 18: Get Holdings Account Transactions ---")
                        print(f"# Using account_id {account_id} from Holdings arrangement")
                        get_holdings_account_transactions(account_id)
                    else:
                        print("\nNo suitable account ID found in Holdings arrangements. Skipping balance and transaction steps.")
                else:
                    print("No arrangements found in Holdings response. Skipping additional Holdings API calls.")
            else:
                print("Failed to retrieve Holdings arrangements. Skipping additional Holdings API calls.")
            # --- End of Holdings Microservice API calls ---

            print("\n--- Step 19: Get Customer Arrangements ---")
            get_customer_arrangements(customer_id)
        else:
            print("Could not extract customer ID from customer creation response. Skipping subsequent steps.")
            print(f"Customer creation response was: {json.dumps(created_customer_response, indent=2)}")
    else:
        print("Customer creation step failed. Skipping all subsequent steps.")
    
    print(f"\nDemo flow finished. Check {OUTPUT_FILE} for details.") 