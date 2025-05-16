import requests
import json
import random
from datetime import datetime, timedelta
import sys
import time
import os
from dotenv import load_dotenv
from confluent_kafka import Consumer, KafkaException, TopicPartition

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

# Add new constants for current account APIs
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
    # Format today's date as YYYYMMDD
    today_str = datetime.today().strftime("%Y%m%d")
    
    return {
        "parties": [
            {
                "partyId": str(party_id),
                "partyRole": "OWNER"
            }
        ],
        "accountName": "current",
        "openingDate": today_str,
        "productId": "CHECKING.ACCOUNT",
        "currency": "USD",
        "branchCode": "01123",
        "quotationReference": "QUOT246813"
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
                else:
                    print("Could not extract account reference from account creation response.")
                    account_reference = "123456"  # Use default if we couldn't get the real reference
            else:
                print("Current account creation step failed.")
                account_reference = "123456"  # Use default if current account creation failed
            
            # Continue with loan creation (now step 4)
            print("\n--- Step 4: Create Loan ---")
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
                print(f"\n--- Step 5: Capture 5 Kafka Events After Loan Creation ---")
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
                
                print(f"\n--- Step 6: Get Loan Status ---")
                get_loan_status(loan_id)
                
                print(f"\n--- Step 7: Get Loan Schedules ---")
                get_loan_schedules(loan_id)
                
                print(f"\n--- Step 8: Disburse Loan ---")
                disburse_result = disburse_loan(loan_id, original_amount)
                
                if disburse_result:
                    print("Loan disbursement step completed successfully.")
                    
                    # Capture Kafka events after disbursement (13 events)
                    print(f"\n--- Step 9: Capture Last {HISTORY_COUNT} Kafka Events After Disbursement ---")
                    captured_kafka_events = capture_kafka_events(KAFKA_LENDING_TOPIC, HISTORY_COUNT)  # Keep 13 for disbursement
                    
                    if captured_kafka_events:
                        print(f"Successfully captured {len(captured_kafka_events)} events from Kafka topic {KAFKA_LENDING_TOPIC} after disbursement.")
                    else:
                        print(f"Failed to capture events from Kafka topic {KAFKA_LENDING_TOPIC} after disbursement.")
                else:
                    print("Loan disbursement step failed.")

                # aaa_id is not directly used by capture_kafka_events, but good to know if it was found
                if aaa_id:
                    print(f"(Extracted aaaId from loan response for reference: {aaa_id})")
                else:
                    print("(Could not extract aaaId from loan response for reference)")

                if loan_id:
                    print(f"Successfully identified loanId for API calls: {loan_id}")
            else:
                print("Loan creation step failed. Skipping subsequent loan-related and Kafka steps.")

            print("\n--- Step 10: Get Customer Arrangements ---")
            get_customer_arrangements(customer_id)
        else:
            print("Could not extract customer ID from customer creation response. Skipping subsequent steps.")
            print(f"Customer creation response was: {json.dumps(created_customer_response, indent=2)}")
    else:
        print("Customer creation step failed. Skipping all subsequent steps.")
    
    print(f"\nDemo flow finished. Check {OUTPUT_FILE} for details.") 