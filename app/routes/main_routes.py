from flask import render_template, jsonify, current_app, url_for, abort, request, Response, stream_with_context, redirect
from . import main_bp
import os
import datetime
import uuid
import requests
import json
import time
import subprocess
import shlex
from collections import deque, defaultdict
from confluent_kafka import Consumer, KafkaException, TopicPartition
from dotenv import load_dotenv
import urllib3
import ssl
import threading
import re

# Store last 10 API calls for headless tab
api_calls_history = deque(maxlen=10)

# API endpoints from Demoflow.py
PARTY_API_BASE_URI = "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties"
LOAN_API_BASE_URI = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/consumerLoans"
LOAN_STATUS_API_URI_TEMPLATE = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/status"
LOAN_SCHEDULES_API_URI_TEMPLATE = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/schedules"

# Additional API endpoints
CURRENT_ACCOUNT_API_URI = "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/currentAccounts"
ACCOUNT_BALANCE_API_URI_TEMPLATE = "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/{account_reference}/balances"
PARTY_ARRANGEMENTS_API_URI_TEMPLATE = "http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/holdings/parties/{party_id}/arrangements"
LOAN_BALANCES_API_URI_TEMPLATE = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/balances?arrangementId={arrangement_id}"

# Kafka/Event Hub constants and topics
KAFKA_TOPICS = {
    'party': 'ms-party-outbox',
    'deposits': 'deposits-event-topic', 
    'lending': 'lending-event-topic',
    'eventstore': 'ms-eventstore-inbox-topic',
    'adapter': 'ms-adapterservice-event-topic',
    'holdings': 'ms-holdings-event-topic'
}

# Load environment variables
load_dotenv()

# Event Hub configuration for SSE streaming
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
CONNECTION_STRING = os.getenv("CONNECTION_STRING")

# Thread-safe storage for active consumers per session
active_consumers = defaultdict(dict)
consumer_lock = threading.Lock()
consumer_timestamps = defaultdict(dict)  # Track when consumers were created

# File to store demo status persistently
DEMO_STATUS_FILE = 'demo_status.json'

def track_api_call(uri, method, params=None, payload=None, response=None, error=None):
    """Records an API call for the headless tab to display"""
    api_call = {
        "uri": uri,
        "method": method,
        "timestamp": datetime.datetime.now().isoformat(),
        "params": params or {},
    }
    
    if payload:
        api_call["payload"] = payload
    
    # Only make an actual API call if NO response and NO error are provided
    # This prevents duplicate calls when we already have the response
    if response is None and error is None and (uri.startswith('http://') or uri.startswith('https://')):
        print(f"track_api_call: Making actual API call to {uri}")
        try:
            headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
            
            if method == 'GET':
                resp = requests.get(uri, headers=headers, params=params)
            elif method == 'POST':
                resp = requests.post(uri, headers=headers, json=payload)
            elif method == 'PUT':
                resp = requests.put(uri, headers=headers, json=payload)
            elif method == 'DELETE':
                resp = requests.delete(uri, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            api_call["status"] = resp.status_code
            
            try:
                api_call["response"] = resp.json()
            except:
                api_call["response"] = {"text": resp.text, "status": resp.status_code}
        
        except Exception as e:
            api_call["error"] = {"message": str(e), "status": 500}
            api_call["status"] = 500
    
    # Use provided response/error if available (this is the normal case for create_account)
    elif response is not None:
        print(f"track_api_call: Using provided response for {uri}")
        api_call["response"] = response
        api_call["status"] = 200
    elif error is not None:
        print(f"track_api_call: Using provided error for {uri}")
        api_call["error"] = error
        api_call["status"] = error.get("status", 500)
    
    # Add to the front of the deque
    api_calls_history.appendleft(api_call)
    return api_call

# Central Dashboard Route
@main_bp.route('/')
def dashboard():
    """Renders the main dashboard shell."""
    return render_template('dashboard.html')

# Tab Content Routes
@main_bp.route('/tab/mobile')
def tab_mobile():
    """Renders the mobile app tab HTML fragment."""
    return render_template('mobile_app.html')

@main_bp.route('/tab/branch')
def tab_branch():
    """Renders the branch app tab HTML fragment."""
    return render_template('branch_app.html')

@main_bp.route('/tab/headless')
def tab_headless():
    """Renders the headless tab HTML fragment."""
    return render_template('headless.html')

@main_bp.route('/tab/headless-v2')
def tab_headless_v2():
    """Renders the headless v2 tab HTML fragment with architecture focus."""
    return render_template('headless_v2.html')

@main_bp.route('/tab/headless-v3')
def tab_headless_v3():
    """Renders the headless v3 tab HTML fragment with Event Store, Adapter, and Holdings focus."""
    return render_template('headless_v3.html')

@main_bp.route('/tab/architecture')
def tab_architecture():
    """Renders the architecture tab HTML fragment."""
    return render_template('architecture.html')

@main_bp.route('/tab/assistant')
def tab_assistant():
    """Renders the assistant tab HTML fragment."""
    return render_template('assistant.html')

@main_bp.route('/tab/configuration')
def tab_configuration():
    """Renders the configuration tab HTML fragment."""
    return render_template('configuration.html')
    return render_template('configuration.html')

# --- Headless Tab API ---
@main_bp.route('/api/headless/data', methods=['GET'])
def get_headless_data():
    """Provides API call history and events for the Headless tab."""
    return jsonify({
        "api_calls": list(api_calls_history), 
        "events": []
    })

@main_bp.route('/api/headless/track', methods=['POST'])
def track_headless_api_call():
    """Tracks an API call made directly from the headless tab."""
    data = request.get_json()
    
    uri = data.get('uri', '')
    method = data.get('method', 'GET')
    payload = data.get('payload')
    response = data.get('response')
    domain = data.get('domain')
    
    # Add detailed logging for loan creation
    if 'loans' in uri and method == 'POST':
        print("=" * 80)
        print("🏦 LOAN CREATION BUTTON CLICKED - PAYLOAD DEBUG")
        print("=" * 80)
        print(f"URI: {uri}")
        print(f"Method: {method}")
        print(f"Domain: {domain}")
        print("")
        print("📋 COMPLETE LOAN PAYLOAD:")
        print(json.dumps(payload, indent=2))
        
        # Check settlement structure specifically
        if payload and 'body' in payload and 'settlement' in payload['body']:
            print("")
            print("💰 SETTLEMENT STRUCTURE (where the money goes):")
            settlement = payload['body']['settlement']
            print(json.dumps(settlement, indent=2))
            
            # Count account references
            account_refs = []
            for s in settlement:
                if 'payout' in s:
                    for payout in s['payout']:
                        if 'property' in payout:
                            for prop in payout['property']:
                                if 'payoutAccount' in prop:
                                    account_refs.append(prop['payoutAccount'])
                
                if 'assocSettlement' in s:
                    for assoc in s['assocSettlement']:
                        if 'reference' in assoc:
                            for ref in assoc['reference']:
                                if 'payinAccount' in ref:
                                    account_refs.append(ref['payinAccount'])
            
            print(f"")
            print(f"🎯 ACCOUNT REFERENCES FOUND ({len(account_refs)} total):")
            for i, acc_ref in enumerate(account_refs, 1):
                print(f"  {i}. {acc_ref}")
        
        print("=" * 80)
    
    # Use the existing track_api_call function to record it
    api_call = track_api_call(uri, method, payload=payload, response=response)
    
    # Add domain info if provided
    if domain:
        api_call['domain'] = domain
    
    return jsonify({"status": "success", "message": "API call tracked", "api_call": api_call})

@main_bp.route('/api/architecture/diagram_path')
def get_architecture_diagram_path():
    """Provides the relative path to the generated architecture diagram."""
    image_path = current_app.config.get('ARCHITECTURE_IMAGE_PATH')
    if image_path:
        full_url_path = url_for('static', filename=image_path, _external=False)
        return jsonify({'diagram_url': full_url_path})
    else:
        return jsonify({'error': 'Architecture diagram not found or generation failed.'}), 500

# --- LOAN ENDPOINTS ---

@main_bp.route('/api/loans/<string:loan_id>/details')
def get_loan_details(loan_id):
    """Provides detailed information for a specific loan."""
    try:
        # First try the new lending container API for detailed loan information
        lending_api_url = f"http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v1.0.0/holdings/loans/{loan_id}"
        
        print(f"Fetching detailed loan information for loan ID {loan_id}")
        
        response = requests.get(lending_api_url, headers={"Accept": "application/json"})
        
        if response.status_code == 200:
            loan_data = response.json()
            
            track_api_call(lending_api_url, "GET", response=loan_data)
            
            if 'body' in loan_data and loan_data['body']:
                raw_loan = loan_data['body'][0]
                
                # Extract interest rate information
                interest_rate = "N/A"
                if 'interests' in raw_loan and raw_loan['interests']:
                    # Get the first interest rate (usually principal interest)
                    first_interest = raw_loan['interests'][0]
                    interest_rate = first_interest.get('interestRate', 'N/A')
                    # Clean up the interest rate (remove extra rates if multiple)
                    if '|' in interest_rate:
                        interest_rate = interest_rate.split('|')[0]
                
                transformed_data = {
                    "id": loan_id,
                    "loanId": loan_id,
                    "productDisplayName": raw_loan.get('productDescription', 'Loan Product'),
                    "productId": raw_loan.get('productDescription', 'LOAN_PRODUCT'),
                    "accountNumber": raw_loan.get('accountId', ''),
                    "interestRate": interest_rate,
                    "startDate": raw_loan.get('startDate', 'N/A'),
                    "term": raw_loan.get('term', 'N/A'),
                    "maturityDate": raw_loan.get('maturityDate', 'N/A'),
                    "commitmentAmount": raw_loan.get('commitmentAmount', 0),
                    "currency": raw_loan.get('currencyId', 'USD'),
                    "nextPaymentDate": raw_loan.get('nextPaymentDate', 'N/A'),
                    "totalDue": raw_loan.get('totalDue', 'N/A'),
                    "properties": {
                        "body": [{
                            "arrangementStatus": "Active",
                            "accountId": raw_loan.get('accountId', ''),
                            "customerId": raw_loan.get('customerId', ''),
                            "arrangementStartDate": raw_loan.get('startDate', ''),
                            "productDescription": raw_loan.get('productDescription', '')
                        }]
                    }
                }
                
                return jsonify(transformed_data)
            else:
                return jsonify({"error": "No loan data found"}), 404
        else:
            # Fall back to the original API if the new one fails
            print(f"Lending container API failed, falling back to original API for loan {loan_id}")
            api_url = LOAN_STATUS_API_URI_TEMPLATE.format(loan_id=loan_id)
            
            response = requests.get(api_url, headers={"Accept": "application/json"})
            
            if response.status_code == 200:
                loan_data = response.json()
                
                track_api_call(api_url, "GET", response=loan_data)
                
                if 'body' in loan_data and loan_data['body']:
                    raw_loan = loan_data['body'][0]
                    
                    transformed_data = {
                        "id": loan_id,
                        "loanId": loan_id,
                        "productDisplayName": raw_loan.get('productDescription', 'Loan Product'),
                        "productId": raw_loan.get('productDescription', 'LOAN_PRODUCT'),
                        "accountNumber": raw_loan.get('accountId', ''),
                        "interestRate": "N/A",  # Not available in fallback API
                        "startDate": raw_loan.get('arrangementStartDate', 'N/A'),
                        "term": "N/A",  # Not available in fallback API
                        "maturityDate": "N/A",  # Not available in fallback API
                        "commitmentAmount": 0,  # Not available in fallback API
                        "currency": "USD",  # Default
                        "nextPaymentDate": "N/A",  # Not available in fallback API
                        "totalDue": "N/A",  # Not available in fallback API
                        "properties": {
                            "body": [{
                                "arrangementStatus": raw_loan.get('arrangementStatus', 'Active'),
                                "accountId": raw_loan.get('accountId', ''),
                                "customerId": raw_loan.get('customerId', ''),
                                "arrangementStartDate": raw_loan.get('arrangementStartDate', ''),
                                "productDescription": raw_loan.get('productDescription', '')
                            }]
                        }
                    }
                    
                    return jsonify(transformed_data)
                else:
                    return jsonify({"error": "No loan data found"}), 404
            else:
                error = {"status": response.status_code, "message": f"Failed to fetch loan details: {response.text}"}
                track_api_call(api_url, "GET", error=error)
                print(f"ERROR: Failed to fetch loan details for {loan_id}: {error}")
                return jsonify({"error": "Failed to fetch loan details"}), 500
    except Exception as e:
        print(f"ERROR: Failed to fetch loan details for {loan_id}: {str(e)}")
        return jsonify({"error": "Failed to fetch loan details"}), 500

@main_bp.route('/api/loans/<string:loan_id>/schedule')
def get_loan_schedule_unified(loan_id):
    """Unified endpoint for loan schedules - works for both mobile and branch apps."""
    try:
        api_url = LOAN_SCHEDULES_API_URI_TEMPLATE.format(loan_id=loan_id)
        
        print(f"Fetching loan schedule for loan ID {loan_id} (unified endpoint)")
        
        response = requests.get(api_url, headers={"Accept": "application/json"})
        
        if response.status_code == 200:
            schedules_data = response.json()
            
            track_api_call(api_url, "GET", response=schedules_data)
            
            # Detect client type from User-Agent or Accept headers
            user_agent = request.headers.get('User-Agent', '').lower()
            is_mobile_app = 'mobile' in user_agent or request.headers.get('X-Client-Type') == 'mobile'
            
            if isinstance(schedules_data, dict) and 'body' in schedules_data:
                if is_mobile_app:
                    # Mobile app format: return header/body structure
                    transformed_data = {
                        "header": schedules_data.get("header", {}),
                        "body": []
                    }
                    
                    for payment in schedules_data['body']:
                        payment_item = {
                            "paymentDate": payment.get('paymentDate', ''),
                            "paymentNumber": payment.get('paymentNumber', 1),
                            "principalAmount": payment.get("principalAmount", 0),
                            "interestAmount": payment.get("interestAmount", 0),
                            "totalAmount": payment.get('totalAmount', 0),
                            "outstandingAmount": payment.get('outstandingAmount', 0)
                        }
                        transformed_data["body"].append(payment_item)
                    
                    return jsonify(transformed_data)
                else:
                    # Branch app format: return schedules array
                    formatted_data = {
                        "loanId": loan_id,
                        "currency": "USD",
                        "schedules": []
                    }
                    
                    schedule_items = []
                    for payment in schedules_data['body']:
                        schedule_item = {
                            "dueDate": payment.get('paymentDate', ''),
                            "principal": float(payment.get("principalAmount", 0)),
                            "interest": float(payment.get("interestAmount", 0)),
                            "totalAmount": float(payment.get('totalAmount', 0)),
                            "status": "Pending"
                        }
                        schedule_items.append(schedule_item)
                    
                    formatted_data["schedules"] = schedule_items
                    return jsonify(formatted_data)
            else:
                return jsonify(schedules_data)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch loan schedule: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            return jsonify(error), response.status_code
    except Exception as e:
        print(f"ERROR: Failed to fetch loan schedule for {loan_id}: {str(e)}")
        return jsonify({"error": "Failed to fetch loan schedule"}), 500

# --- ACCOUNT AND LOAN CREATION ---

@main_bp.route('/api/accounts/create', methods=['POST'])
def create_account():
    """Create a new account"""
    try:
        data = request.get_json()
        party_id = data.get('partyId')
        
        if not party_id:
            return jsonify({
                'success': False,
                'error': 'partyId is required'
            }), 400
        
        # Use external script to guarantee Kafka event generation
        result = create_account_with_external_script(party_id)
        
        # Track the API call for headless tab
        track_api_call(
            uri='/api/accounts/create',
            method='POST',
            payload=data,
            response=result
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'accountReference': result['accountReference'],
                'message': f'Account created successfully for party {party_id}',
                'status': 200,
                'method': result['method']
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error'],
                'status': 500,
                'method': result['method']
            }), 500
            
    except Exception as e:
        error_msg = f"Account creation failed: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({
            'success': False,
            'error': error_msg,
            'status': 500
        }), 500

def create_account_with_curl(party_id):
    """Create account using shell curl execution to guarantee Kafka event generation"""
    print("=== ACCOUNT CREATION DEBUG (SHELL CURL) ===")
    
    # Today's date dynamically
    today_str = datetime.datetime.now().strftime("%Y%m%d")
    
    # Generate unique quotation reference
    quotation_ref = f"QUOT{uuid.uuid4().hex[:6].upper()}"
    
    payload = {
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
        "quotationReference": quotation_ref
    }
    
    print(f"URI: {CURRENT_ACCOUNT_API_URI}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    # Convert payload to JSON string for curl
    payload_json = json.dumps(payload)
    
    # Create a temporary script file to execute curl via shell
    script_content = f'''#!/bin/bash
curl -X POST "{CURRENT_ACCOUNT_API_URI}" \\
  -H "Content-Type: application/json" \\
  -H "User-Agent: curl/8.7.1" \\
  -H "Accept: */*" \\
  -H "Host: deposits-sandbox.northeurope.cloudapp.azure.com" \\
  -d '{payload_json}' \\
  --silent --show-error --fail-with-body
'''
    
    script_path = f"/tmp/curl_account_{uuid.uuid4().hex[:8]}.sh"
    
    try:
        # Write the script file
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        # Make it executable
        os.chmod(script_path, 0o755)
        
        print(f"Executing shell script: {script_path}")
        
        # Execute via shell
        start_time = time.time()
        result = subprocess.run(
            ['/bin/bash', script_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        end_time = time.time()
        
        print(f"Shell exit code: {result.returncode}")
        print(f"Response time: {end_time - start_time:.3f} seconds")
        print(f"Stdout: {result.stdout}")
        print(f"Stderr: {result.stderr}")
        
        if result.returncode == 0:
            # Success - parse the JSON response
            try:
                response_data = json.loads(result.stdout)
                print(f"Response data: {response_data}")
                print("=== ACCOUNT CREATION SUCCESS (SHELL CURL) ===")
                
                return {
                    'success': True,
                    'accountReference': response_data.get('accountReference'),
                    'payload': payload,
                    'method': 'shell_curl',
                    'response_time': end_time - start_time
                }
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON response: {e}")
                print(f"Raw response: {result.stdout}")
                return {
                    'success': False,
                    'error': f'Invalid JSON response: {result.stdout}',
                    'method': 'shell_curl'
                }
        else:
            # Error - curl failed
            error_msg = f"Shell curl failed with exit code {result.returncode}"
            if result.stderr:
                error_msg += f": {result.stderr}"
            if result.stdout:
                error_msg += f" (Response: {result.stdout})"
            
            print(f"=== ACCOUNT CREATION FAILED (SHELL CURL) ===")
            print(f"Error: {error_msg}")
            
            return {
                'success': False,
                'error': error_msg,
                'method': 'shell_curl',
                'exit_code': result.returncode
            }
            
    except subprocess.TimeoutExpired:
        print("=== SHELL CURL TIMEOUT ===")
        return {
            'success': False,
            'error': 'Shell curl command timed out after 30 seconds',
            'method': 'shell_curl'
        }
    except Exception as e:
        print(f"=== SHELL CURL EXCEPTION ===")
        print(f"Exception: {str(e)}")
        return {
            'success': False,
            'error': f'Shell curl execution failed: {str(e)}',
            'method': 'shell_curl'
        }
    finally:
        # Clean up the temporary script file
        try:
            if os.path.exists(script_path):
                os.remove(script_path)
        except:
            pass

def create_account_with_urllib3(party_id):
    """DEPRECATED: Create account using urllib3 - DOES NOT generate Kafka events"""
    # Keep this function for reference, but mark as deprecated
    print("WARNING: urllib3 method does not generate Kafka events. Use create_account_with_curl instead.")
    return None

@main_bp.route('/api/loans/create', methods=['POST'])
def create_loan():
    """Creates a new loan via API call - CURL-BASED VERSION (GUARANTEES KAFKA EVENTS)"""
    data = request.get_json()
    
    party_id = data.get('partyId')
    product_id = data.get('productId', 'MORTGAGE.PRODUCT')
    currency = data.get('currency', 'USD')
    amount = data.get('amount')
    term_years = data.get('termYears')
    disburse_account = data.get('disburseAccount')
    
    if not party_id:
        return jsonify({"error": "Party ID is required"}), 400
    if not amount:
        return jsonify({"error": "Amount is required"}), 400
    if not term_years:
        return jsonify({"error": "Term in years is required"}), 400
    if not disburse_account:
        return jsonify({"error": "Disbursement account is required"}), 400
    
    # Use curl to guarantee Kafka event generation
    loan_response = create_loan_with_curl(party_id, amount, term_years, disburse_account, product_id, currency)
    
    if loan_response and loan_response.get('success'):
        # Track the API call for the headless tab
        track_api_call(
            uri=LOAN_API_BASE_URI,
            method="POST", 
            payload=loan_response.get('payload'),
            response=loan_response.get('response_data')
        )
        
        return jsonify({
            "success": True,
            "message": f"Loan created successfully for party {party_id} with disbursement to account {disburse_account} (with Kafka events)",
            "data": loan_response.get('response_data'),
            "status": 200,
            "method": "curl"
        })
    else:
        error_msg = loan_response.get('error', 'Unknown error') if loan_response else 'Failed to create loan'
        return jsonify({
            "success": False,
            "message": f"Failed to create loan for party {party_id}: {error_msg}",
            "error": error_msg,
            "status": 500
        }), 500

def create_loan_with_curl(party_id, amount, term_years, disburse_account, product_id='MORTGAGE.PRODUCT', currency='USD'):
    """Create loan using shell curl execution to guarantee Kafka event generation"""
    print("=== LOAN CREATION DEBUG (SHELL CURL) ===")
    
    # Format term properly (e.g., "5Y" for 5 years)
    term = f"{term_years}Y"
    
    # Format the account reference into the 3-part key format
    account_reference = f"DDAComposable|GB0010001|{disburse_account}"
    
    payload = {
        "header": {},
        "body": {
            "partyIds": [{"partyId": str(party_id), "partyRole": "OWNER"}],
            "productId": product_id,
            "currency": currency,
            "arrangementEffectiveDate": "",
            "commitment": [{"amount": str(amount), "term": term}],
            "schedule": [{"payment": [{}, {"paymentFrequency": "e0Y e1M e0W e0D e0F"}]}],
            "settlement": [{
                "payout": [{"payoutSettlement": "YES", "property": [{"payoutAccount": account_reference}]}],
                "assocSettlement": [
                    {"payinSettlement": "YES", "reference": [{"payinAccount": account_reference}]},
                    {"payinSettlement": "YES", "reference": [{"payinAccount": account_reference}]},
                ]
            }]
        }
    }
    
    print(f"URI: {LOAN_API_BASE_URI}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    # Convert payload to JSON string for curl
    payload_json = json.dumps(payload)
    
    # Create a temporary script file to execute curl via shell
    script_content = f'''#!/bin/bash
curl -X POST "{LOAN_API_BASE_URI}" \\
  -H "Content-Type: application/json" \\
  -H "User-Agent: curl/8.7.1" \\
  -H "Accept: */*" \\
  -H "Host: lendings-sandbox.northeurope.cloudapp.azure.com" \\
  -d '{payload_json}' \\
  --silent --show-error --fail-with-body
'''
    
    script_path = f"/tmp/curl_loan_{uuid.uuid4().hex[:8]}.sh"
    
    try:
        # Write the script file
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        # Make it executable
        os.chmod(script_path, 0o755)
        
        print(f"Executing shell script: {script_path}")
        
        # Execute via shell
        start_time = time.time()
        result = subprocess.run(
            ['/bin/bash', script_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        end_time = time.time()
        
        print(f"Shell exit code: {result.returncode}")
        print(f"Response time: {end_time - start_time:.3f} seconds")
        print(f"Stdout: {result.stdout}")
        print(f"Stderr: {result.stderr}")
        
        if result.returncode == 0:
            # Success - parse the JSON response
            try:
                response_data = json.loads(result.stdout)
                print(f"Response data: {response_data}")
                print("=== LOAN CREATION SUCCESS (SHELL CURL) ===")
                
                return {
                    'success': True,
                    'response_data': response_data,
                    'payload': payload,
                    'method': 'shell_curl',
                    'response_time': end_time - start_time
                }
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON response: {e}")
                print(f"Raw response: {result.stdout}")
                return {
                    'success': False,
                    'error': f'Invalid JSON response: {result.stdout}',
                    'method': 'shell_curl'
                }
        else:
            # Error - curl failed
            error_msg = f"Shell curl failed with exit code {result.returncode}"
            if result.stderr:
                error_msg += f": {result.stderr}"
            if result.stdout:
                error_msg += f" (Response: {result.stdout})"
            
            print(f"=== LOAN CREATION FAILED (SHELL CURL) ===")
            print(f"Error: {error_msg}")
            
            return {
                'success': False,
                'error': error_msg,
                'method': 'shell_curl',
                'exit_code': result.returncode
            }
            
    except subprocess.TimeoutExpired:
        print("=== SHELL CURL TIMEOUT ===")
        return {
            'success': False,
            'error': 'Shell curl command timed out after 30 seconds',
            'method': 'shell_curl'
        }
    except Exception as e:
        print(f"=== SHELL CURL EXCEPTION ===")
        print(f"Exception: {str(e)}")
        return {
            'success': False,
            'error': f'Shell curl execution failed: {str(e)}',
            'method': 'shell_curl'
        }
    finally:
        # Clean up the temporary script file
        try:
            if os.path.exists(script_path):
                os.remove(script_path)
        except:
            pass

def create_account_with_external_script(party_id):
    """Create account using external shell script to guarantee Kafka event generation"""
    print("=== ACCOUNT CREATION DEBUG (EXTERNAL SCRIPT WITH SHELL=TRUE) ===")
    
    # Generate unique quotation reference
    quotation_ref = f"QUOT{uuid.uuid4().hex[:6].upper()}"
    
    script_path = os.path.join(os.getcwd(), 'create_account_external.sh')
    
    print(f"Using external script: {script_path}")
    print(f"Party ID: {party_id}")
    print(f"Quotation Reference: {quotation_ref}")
    
    try:
        # Execute the external script with shell=True to guarantee Kafka events
        start_time = time.time()
        
        # Construct the shell command
        shell_command = f"{script_path} {party_id} {quotation_ref}"
        
        print(f"Executing shell command: {shell_command}")
        
        result = subprocess.run(
            shell_command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        end_time = time.time()
        
        print(f"Script exit code: {result.returncode}")
        print(f"Response time: {end_time - start_time:.3f} seconds")
        print(f"Stdout: {result.stdout}")
        print(f"Stderr: {result.stderr}")
        
        if result.returncode == 0:
            # Success - parse the JSON response
            try:
                response_data = json.loads(result.stdout)
                print(f"Response data: {response_data}")
                print("=== ACCOUNT CREATION SUCCESS (EXTERNAL SCRIPT WITH SHELL=TRUE) ===")
                
                return {
                    'success': True,
                    'accountReference': response_data.get('accountReference'),
                    'payload': {
                        'partyId': party_id,
                        'quotationReference': quotation_ref
                    },
                    'method': 'external_script_shell',
                    'response_time': end_time - start_time
                }
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON response: {e}")
                print(f"Raw response: {result.stdout}")
                return {
                    'success': False,
                    'error': f'Invalid JSON response: {result.stdout}',
                    'method': 'external_script_shell'
                }
        else:
            # Error - script failed
            error_msg = f"External script failed with exit code {result.returncode}"
            if result.stderr:
                error_msg += f": {result.stderr}"
            if result.stdout:
                error_msg += f" (Response: {result.stdout})"
            
            print(f"=== ACCOUNT CREATION FAILED (EXTERNAL SCRIPT WITH SHELL=TRUE) ===")
            print(f"Error: {error_msg}")
            
            return {
                'success': False,
                'error': error_msg,
                'method': 'external_script_shell',
                'exit_code': result.returncode
            }
            
    except subprocess.TimeoutExpired:
        print("=== EXTERNAL SCRIPT TIMEOUT ===")
        return {
            'success': False,
            'error': 'External script timed out after 30 seconds',
            'method': 'external_script_shell'
        }
    except Exception as e:
        print(f"=== EXTERNAL SCRIPT EXCEPTION ===")
        print(f"Exception: {str(e)}")
        return {
            'success': False,
            'error': f'External script execution failed: {str(e)}',
            'method': 'external_script_shell'
        }

# --- UNIFIED API ENDPOINTS THAT FRONTEND EXPECTS ---

@main_bp.route('/api/parties/<string:party_id>')
def get_party_details(party_id):
    """Unified endpoint for getting party details - used by both mobile and branch frontends."""
    try:
        api_url = f"{PARTY_API_BASE_URI}/{party_id}"
        
        print(f"Fetching party details for ID: {party_id}")
        
        response = requests.get(api_url, headers={"Accept": "application/json"})
        
        if response.status_code == 200:
            party_data = response.json()
            
            track_api_call(api_url, "GET", response=party_data)
            
            # Extract nationality from nationalities array
            nationality = ""
            if party_data.get('nationalities') and len(party_data['nationalities']) > 0:
                nationality = party_data['nationalities'][0].get('country', '')
            
            # Extract contact information from addresses array (actual API structure)
            primary_email = ""
            mobile_phone = ""
            address = ""
            
            addresses = party_data.get('addresses', [])
            if addresses and len(addresses) > 0:
                first_address = addresses[0]
                mobile_phone = first_address.get('phoneNo', '')
                primary_email = first_address.get('electronicAddress', '')
                address_lines = first_address.get('addressFreeFormat', [])
                if address_lines and len(address_lines) > 0:
                    address = address_lines[0].get('addressLine', '')
            
            # Also check contactReferences as fallback (in case some responses use this structure)
            if not primary_email or not mobile_phone:
                for contact in party_data.get('contactReferences', []):
                    contact_type = contact.get('contactType', '').upper()
                    contact_value = contact.get('contactValue', '')
                    contact_subtype = contact.get('contactSubType', '').upper()
                    
                    if contact_type == 'EMAIL' and not primary_email:
                        primary_email = contact_value
                    elif contact_type == 'PHONE':
                        if contact_subtype == 'MOBILE' and not mobile_phone:
                            mobile_phone = contact_value
                        elif not mobile_phone:  # Fallback if no subtype specified
                            mobile_phone = contact_value
            
            customer = {
                "customerId": party_data.get('partyId', party_id),
                "partyId": party_data.get('partyId', party_id),  # Add for mobile app compatibility
                "firstName": party_data.get('firstName', ''),
                "lastName": party_data.get('lastName', ''),
                "dateOfBirth": party_data.get('dateOfBirth', ''),
                "cityOfBirth": party_data.get('cityOfBirth', ''),
                "middleName": party_data.get('middleName', ''),
                "nationality": nationality,
                "primaryEmail": primary_email,
                "email": primary_email,  # Add for mobile app compatibility
                "mobilePhone": mobile_phone,
                "phone": mobile_phone,  # Add for mobile app compatibility
                "homePhone": "",
                "address": address,
                "status": "Active",
                # Include the full addresses and nationalities arrays for mobile app
                "addresses": party_data.get('addresses', []),
                "nationalities": party_data.get('nationalities', [])
            }
            
            return jsonify(customer)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch party details: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            print(f"ERROR: Failed to fetch party details for {party_id}: {error}")
            return jsonify({"error": "Failed to fetch party details"}), 500
    except Exception as e:
        print(f"ERROR: Failed to fetch party details for {party_id}: {str(e)}")
        return jsonify({"error": "Failed to fetch party details"}), 500

@main_bp.route('/api/parties/<string:party_id>/accounts')
def get_party_accounts(party_id):
    """Unified endpoint for getting party accounts - used by both mobile and branch frontends."""
    try:
        # Get arrangements to determine what are accounts vs loans
        arrangements_uri = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v1.0.0/holdings/parties/{party_id}/arrangements"
        arrangements_response = requests.get(arrangements_uri, headers={"Accept": "application/json"})
        
        accounts = []
        loan_ids = set()  # Track loan account IDs to exclude from accounts
        
        if arrangements_response.ok:
            arrangements_data = arrangements_response.json()
            
            # First pass: identify all loan accounts
            if 'arrangements' in arrangements_data and isinstance(arrangements_data['arrangements'], list):
                for arrangement in arrangements_data['arrangements']:
                    # EXPLICITLY EXCLUDE DEPOSITS from loan detection
                    if (arrangement.get('productLine') == 'DEPOSITS' or 
                        arrangement.get('systemReference') == 'deposits'):
                        print(f"Skipping deposit arrangement in loan detection: {arrangement.get('arrangementId')}")
                        continue
                    
                    # Get the account ID for balance checking
                    account_id = None
                    contract_ref = arrangement.get('contractReference', '')
                    
                    if 'alternateReferences' in arrangement:
                        for ref in arrangement['alternateReferences']:
                            if ref.get('alternateType') == 'ACCOUNT':
                                account_id = ref.get('alternateId')
                                break
                    
                    # Check if this is a loan by checking the balance API systemReference
                    if account_id:
                        try:
                            balance_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/balances"
                            balance_response = requests.get(balance_url, headers={"Accept": "application/json"})
                            
                            if balance_response.status_code == 200:
                                balance_json = balance_response.json()
                                if isinstance(balance_json, dict) and 'items' in balance_json:
                                    balance_items = balance_json['items']
                                    if balance_items and len(balance_items) > 0:
                                        balance_item = balance_items[0]
                                        system_ref = balance_item.get('systemReference', '')
                                        
                                        # If systemReference is 'lending' AND NOT 'deposits', this is a loan account
                                        if system_ref == 'lending' and system_ref != 'deposits':
                                            loan_ids.add(account_id)
                                            print(f"Identified loan account: {account_id}")
                                        elif system_ref == 'deposits':
                                            print(f"Confirmed deposit account (not loan): {account_id}")
                        except Exception as e:
                            print(f"Error checking balance for account {account_id}: {str(e)}")
                    
                    # Also check traditional lending arrangements (but exclude deposits)
                    if (arrangement.get('productLine') == 'LENDING' and 
                        arrangement.get('systemReference') == 'lending' and
                        arrangement.get('productLine') != 'DEPOSITS'):
                        if account_id:
                            loan_ids.add(account_id)
                            print(f"Identified traditional lending arrangement: {account_id}")

            # Second pass: get all accounts from arrangements and filter out loans
            for arrangement in arrangements_data['arrangements']:
                # Include both ACCOUNTS and DEPOSITS productLines
                if arrangement.get('productLine') in ['ACCOUNTS', 'DEPOSITS']:
                    contract_ref = arrangement.get('contractReference', '')
                    
                    # Get the Holdings account ID
                    holdings_account_id = contract_ref
                    if 'alternateReferences' in arrangement:
                        for ref in arrangement['alternateReferences']:
                            if ref.get('alternateType') == 'ACCOUNT':
                                holdings_account_id = ref.get('alternateId', contract_ref)
                                break
                    
                    # Skip if this account ID is identified as a loan
                    if holdings_account_id in loan_ids:
                        print(f"Skipping loan account {holdings_account_id} from accounts list")
                        continue
                    
                    # Get balance data
                    balance_data = {"balance": 0.0, "availableBalance": 0.0}
                    try:
                        balance_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{holdings_account_id}/balances"
                        balance_response = requests.get(balance_url, headers={"Accept": "application/json"})
                        
                        if balance_response.status_code == 200:
                            balance_json = balance_response.json()
                            track_api_call(balance_url, "GET", response=balance_json)
                            
                            if isinstance(balance_json, dict) and 'items' in balance_json:
                                balance_items = balance_json['items']
                                if balance_items and len(balance_items) > 0:
                                    balance_item = balance_items[0]
                                    balance_data["balance"] = float(balance_item.get('onlineActualBalance', 0))
                                    balance_data["availableBalance"] = float(balance_item.get('availableBalance', 0))
                        else:
                            track_api_call(balance_url, "GET", error={"status": balance_response.status_code})
                    except Exception as balance_error:
                        print(f"Error fetching balance for account {holdings_account_id}: {str(balance_error)}")
                    
                    # Determine account type based on productLine
                    account_type = "deposit" if arrangement.get('productLine') == 'DEPOSITS' else "current"
                    display_name = arrangement.get('arrangementName', 'Term Deposit' if account_type == "deposit" else 'Current Account')
                    product_name = arrangement.get('productName', 'TERM_DEPOSIT' if account_type == "deposit" else 'CURRENT_ACCOUNT')
                    
                    account = {
                        "accountId": holdings_account_id,
                        "displayName": display_name,
                        "productName": product_name,
                        "type": account_type,
                        "status": "active",
                        "currency": arrangement.get('currency', 'USD'),
                        "currentBalance": balance_data["balance"],
                        "availableBalance": balance_data["availableBalance"],
                        "openDate": arrangement.get('startDate', ''),
                        "contractReference": contract_ref,
                        "productLine": arrangement.get('productLine', 'ACCOUNTS')  # Include productLine for frontend logic
                    }
                    accounts.append(account)
        
        track_api_call(arrangements_uri, "GET", response={"accountCount": len(accounts), "loanAccountsExcluded": list(loan_ids)})
        print(f"Unified API: Found {len(accounts)} current accounts for party {party_id}")
        print(f"Loan account IDs excluded: {list(loan_ids)}")
        return jsonify(accounts)
        
    except Exception as e:
        print(f"ERROR: Failed to get accounts for party {party_id}: {str(e)}")
        return jsonify([])

@main_bp.route('/api/parties/<string:party_id>/loans')
def get_party_loans(party_id):
    """Unified endpoint for getting party loans - used by both mobile and branch frontends."""
    try:
        # Get arrangements to find loans
        arrangements_uri = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v1.0.0/holdings/parties/{party_id}/arrangements"
        arrangements_response = requests.get(arrangements_uri, headers={"Accept": "application/json"})
        
        loans = []
        
        if arrangements_response.ok:
            arrangements_data = arrangements_response.json()
            
            if 'arrangements' in arrangements_data and isinstance(arrangements_data['arrangements'], list):
                for arrangement in arrangements_data['arrangements']:
                    # EXPLICITLY EXCLUDE DEPOSITS - Skip if this is a deposit arrangement
                    if (arrangement.get('productLine') == 'DEPOSITS' or 
                        arrangement.get('systemReference') == 'deposits'):
                        print(f"Skipping deposit arrangement: {arrangement.get('arrangementId')}")
                        continue
                    
                    # Check both lending arrangements and accounts with lending systemReference
                    account_id = None
                    if 'alternateReferences' in arrangement:
                        for ref in arrangement['alternateReferences']:
                            if ref.get('alternateType') == 'ACCOUNT':
                                account_id = ref.get('alternateId')
                                break
                    
                    # Check if this is a loan based on balance API systemReference
                    is_loan = False
                    outstanding_balance = 0.0
                    currency = arrangement.get('currency', 'USD')
                    
                    if account_id:
                        try:
                            balance_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/balances"
                            balance_response = requests.get(balance_url, headers={"Accept": "application/json"})
                            
                            if balance_response.status_code == 200:
                                balance_json = balance_response.json()
                                if isinstance(balance_json, dict) and 'items' in balance_json:
                                    balance_items = balance_json['items']
                                    if balance_items and len(balance_items) > 0:
                                        balance_item = balance_items[0]
                                        system_ref = balance_item.get('systemReference', '')
                                        
                                        # This is a loan ONLY if systemReference is 'lending' AND NOT 'deposits'
                                        if system_ref == 'lending':
                                            is_loan = True
                                            # For loans, balance is typically negative, convert to positive outstanding
                                            raw_balance = float(balance_item.get('onlineActualBalance', 0))
                                            outstanding_balance = abs(raw_balance) if raw_balance < 0 else raw_balance
                                            print(f"Loan {account_id}: Raw balance = {raw_balance}, Outstanding = {outstanding_balance}")
                                        elif system_ref == 'deposits':
                                            # Explicitly skip deposits even if they somehow got this far
                                            print(f"Skipping deposit account in loan check: {account_id}")
                                            continue
                        except Exception as e:
                            print(f"Error checking balance for potential loan {account_id}: {str(e)}")
                    
                    # Also check traditional lending arrangements (but exclude deposits)
                    if not is_loan and (arrangement.get('productLine') == 'LENDING' and 
                        arrangement.get('systemReference') == 'lending' and
                        arrangement.get('productLine') != 'DEPOSITS'):
                        is_loan = True
                        # For traditional lending arrangements, try to get balance if we have account_id
                        if account_id:
                            try:
                                balance_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/balances"
                                balance_response = requests.get(balance_url, headers={"Accept": "application/json"})
                                
                                if balance_response.status_code == 200:
                                    balance_json = balance_response.json()
                                    if isinstance(balance_json, dict) and 'items' in balance_json:
                                        balance_items = balance_json['items']
                                        if balance_items and len(balance_items) > 0:
                                            balance_item = balance_items[0]
                                            raw_balance = float(balance_item.get('onlineActualBalance', 0))
                                            outstanding_balance = abs(raw_balance) if raw_balance < 0 else raw_balance
                            except Exception as e:
                                print(f"Error fetching balance for lending arrangement {account_id}: {str(e)}")
                    
                    if is_loan:
                        # Extract loan ID from contract reference or arrangement ID
                        loan_id = arrangement.get('contractReference', arrangement.get('arrangementId', ''))
                        
                        # If we don't have balance from the balance API, try to get it from loan schedules
                        if outstanding_balance == 0.0 and loan_id:
                            try:
                                schedules_url = f"http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/schedules"
                                schedules_response = requests.get(schedules_url, headers={"Accept": "application/json"})
                                
                                if schedules_response.status_code == 200:
                                    schedules_json = schedules_response.json()
                                    if isinstance(schedules_json, dict) and 'body' in schedules_json:
                                        schedule_items = schedules_json['body']
                                        if schedule_items and len(schedule_items) > 0:
                                            # Get the outstanding amount from the first schedule item
                                            first_payment = schedule_items[0]
                                            raw_outstanding = float(first_payment.get('outstandingAmount', 0))
                                            # Convert negative outstanding amount to positive
                                            outstanding_balance = abs(raw_outstanding) if raw_outstanding < 0 else raw_outstanding
                                            print(f"Loan {loan_id}: Got outstanding balance from schedules API = {outstanding_balance}")
                            except Exception as e:
                                print(f"Error fetching loan schedules for balance {loan_id}: {str(e)}")
                        
                        loan = {
                            "loanId": loan_id,
                            "displayName": arrangement.get('productDescription', arrangement.get('productGroup', 'Loan')),
                            "productName": arrangement.get('productGroup', 'LOAN'),
                            "type": "loan",
                            "status": arrangement.get('arrangementStatus', 'Active'),
                            "currency": currency,
                            "outstandingBalance": outstanding_balance,
                            "principalAmount": outstanding_balance,  # For now, same as outstanding
                            "contractReference": arrangement.get('contractReference', ''),
                            "arrangementId": arrangement.get('arrangementId', ''),
                            "startDate": arrangement.get('startDate', ''),
                            "accountIdForTransactions": account_id  # Include account ID for transaction lookup
                        }
                        loans.append(loan)
        
        track_api_call(arrangements_uri, "GET", response={"loanCount": len(loans)})
        print(f"Unified API: Found {len(loans)} loans for party {party_id}")
        return jsonify(loans)
        
    except Exception as e:
        print(f"ERROR: Failed to fetch loans: {str(e)}")
        return jsonify([])

@main_bp.route('/api/accounts/<string:account_id>/transactions')
def get_account_transactions(account_id):
    """Unified endpoint for getting account transactions - used by both mobile and branch frontends."""
    try:
        party_id = request.args.get('partyId', '')
        
        # Try different transaction APIs based on account type
        transaction_urls = [
            f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/transactions",
            f"http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v2.0.0/holdings/accounts/{account_id}/transactions"
        ]
        
        for api_url in transaction_urls:
            try:
                print(f"Trying transactions API: {api_url}")
                
                response = requests.get(api_url, headers={"Accept": "application/json"})
                
                if response.status_code == 200:
                    transactions_data = response.json()
                    
                    track_api_call(api_url, "GET", response=transactions_data)
                    
                    transactions = []
                    
                    # Handle the real API response format which has "items" field
                    transaction_items = []
                    if isinstance(transactions_data, dict) and 'items' in transactions_data:
                        transaction_items = transactions_data['items']
                    elif isinstance(transactions_data, list):
                        transaction_items = transactions_data
                    
                    # Extract transaction data from the Holdings API response
                    for item in transaction_items:
                        if not isinstance(item, dict):
                            continue
                            
                        # Use the narrative and processingDate fields from the Holdings API
                        # Try narrative first, fall back to other fields if narrative is null/empty
                        narrative = item.get('narrative')
                        if narrative and narrative.strip():
                            description = narrative
                        else:
                            # Fall back to transactionReference if narrative is null/empty
                            description = item.get('transactionReference', item.get('customerReference', 'Transaction'))
                        
                        # Use the processingDate field for the transaction date
                        transaction_date = item.get('processingDate', item.get('bookingDate', 'N/A'))
                        
                        # Determine transaction type and amount
                        payment_indicator = item.get('paymentIndicator', 'Debit')
                        amount = item.get('transactionAmount', item.get('amountInAccountCurrency', 0))
                        
                        transaction = {
                            'id': item.get('id', f"tx-{len(transactions)}"),
                            'date': transaction_date,
                            'amount': amount,
                            'currency': item.get('currency', 'USD'),
                            'description': description,
                            'type': payment_indicator.lower() if payment_indicator else 'debit',
                            'bookingDate': item.get('bookingDate'),
                            'icon': 'arrow-down' if payment_indicator == 'Credit' else 'arrow-up',
                            'status': 'Completed'
                        }
                        transactions.append(transaction)
                    
                    print(f"Successfully fetched {len(transactions)} transactions for account {account_id}")
                    return jsonify(transactions)
                
                elif response.status_code == 404:
                    print(f"404 from {api_url}, trying next URL...")
                    continue
                    
                else:
                    print(f"Error {response.status_code} from {api_url}: {response.text}")
                    continue
                    
            except Exception as e:
                print(f"Exception with {api_url}: {str(e)}")
                continue
        
        # If all APIs failed, return empty transactions list
        print(f"All transaction APIs failed for account {account_id}, returning empty list")
        track_api_call(transaction_urls[0], "GET", error={"status": 404, "message": "No transaction data found"})
        return jsonify([])
        
    except Exception as e:
        print(f"ERROR: Failed to fetch transactions for account {account_id}: {str(e)}")
        return jsonify({"error": "Failed to fetch transactions"}), 500

# --- PARTY/CUSTOMER ENDPOINTS ---

@main_bp.route('/api/parties/search')
def search_parties():
    """Search for parties using various criteria."""
    try:
        party_id = request.args.get('partyId', '').strip()
        last_name = request.args.get('lastName', '').strip()
        date_of_birth = request.args.get('dateOfBirth', '').strip()
        phone_number = request.args.get('phoneNumber', '').strip()
        email = request.args.get('email', '').strip()
        
        api_url = None
        search_type = ""
        
        if party_id:
            api_url = f"{PARTY_API_BASE_URI}/{party_id}"
            search_type = "party_id"
        elif phone_number:
            api_url = f"{PARTY_API_BASE_URI}?contactNumber={phone_number}"
            search_type = "phone_number"
        elif email:
            api_url = f"{PARTY_API_BASE_URI}?emailId={email}"
            search_type = "email"
        elif last_name and date_of_birth:
            api_url = f"{PARTY_API_BASE_URI}?lastName={last_name}&dateOfBirth={date_of_birth}"
            search_type = "last_name_and_dob"
        elif last_name:
            api_url = f"{PARTY_API_BASE_URI}?lastName={last_name}"
            search_type = "last_name"
        elif date_of_birth:
            api_url = f"{PARTY_API_BASE_URI}?dateOfBirth={date_of_birth}"
            search_type = "date_of_birth"
        else:
            return jsonify({"error": "At least one search parameter is required"}), 400
        
        print(f"Searching parties using {search_type}: {api_url}")
        
        response = requests.get(api_url, headers={"Accept": "application/json"})
        
        if response.status_code == 200:
            response_data = response.json()
            
            track_api_call(api_url, "GET", response=response_data)
            
            customers = []
            
            def extract_customer_data(party_data):
                """Extract customer data including new enhanced fields."""
                # Extract phone and email from addresses
                phone = ""
                email_addr = ""
                nationality = ""
                address = ""
                
                addresses = party_data.get('addresses', [])
                if addresses and len(addresses) > 0:
                    first_address = addresses[0]
                    phone = first_address.get('phoneNo', '')
                    email_addr = first_address.get('electronicAddress', '')
                    address_lines = first_address.get('addressFreeFormat', [])
                    if address_lines and len(address_lines) > 0:
                        address = address_lines[0].get('addressLine', '')
                
                nationalities = party_data.get('nationalities', [])
                if nationalities and len(nationalities) > 0:
                    nationality = nationalities[0].get('country', '')
                
                return {
                    "customerId": party_data.get('partyId', ''),
                    "firstName": party_data.get('firstName', ''),
                    "lastName": party_data.get('lastName', ''),
                    "dateOfBirth": party_data.get('dateOfBirth', ''),
                    "cityOfBirth": party_data.get('cityOfBirth', ''),
                    "middleName": party_data.get('middleName', ''),
                    "phone": phone,
                    "email": email_addr,
                    "primaryEmail": email_addr,  # Add for compatibility with branch app
                    "mobilePhone": phone,        # Add for compatibility with branch app
                    "homePhone": "",             # Add for compatibility with branch app
                    "nationality": nationality,
                    "address": address,
                    "status": "Active"
                }
            
            if search_type == "party_id":
                customer = extract_customer_data(response_data)
                customers.append(customer)
            else:
                party_list = response_data.get('parties', [])
                for party_data in party_list:
                    customer = extract_customer_data(party_data)
                    customers.append(customer)
            
            return jsonify({
                "success": True,
                "customers": customers,
                "searchType": search_type,
                "searchParams": {
                    "partyId": party_id,
                    "lastName": last_name,
                    "dateOfBirth": date_of_birth,
                    "phoneNumber": phone_number,
                    "email": email
                }
            })
        else:
            error = {"status": response.status_code, "message": f"Search failed: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            return jsonify({
                "success": False,
                "error": f"API call failed with status {response.status_code}",
                "customers": [],
                "searchType": search_type
            }), response.status_code
            
    except Exception as e:
        print(f"ERROR: Failed to search parties: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}",
            "customers": [],
            "searchType": "unknown"
        }), 500

@main_bp.route('/api/parties')
def get_parties():
    """Provides a list of all parties/customers."""
    try:
        api_url = "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties?dateOfBirth=1986-10-09"
        
        response = requests.get(api_url, headers={"Accept": "application/json"})
        
        if response.status_code == 200:
            response_data = response.json()
            parties = response_data.get('parties', [])
            
            customers = []
            
            mobile_party_id = request.args.get('mobilePartyId')
            if mobile_party_id:
                print(f"Adding mobile party ID to customer list: {mobile_party_id}")
                mobile_customer = {
                    "customerId": mobile_party_id,
                    "firstName": "Customer",
                    "lastName": f"ID: {mobile_party_id}",
                    "dateOfBirth": "",
                    "status": "Active"
                }
                customers.append(mobile_customer)
            
            for party in parties:
                customer = {
                    "customerId": party.get('partyId', ''),
                    "firstName": party.get('firstName', ''),
                    "lastName": party.get('lastName', ''),
                    "dateOfBirth": party.get('dateOfBirth', ''),
                    "status": "Active"
                }
                if not mobile_party_id or customer["customerId"] != mobile_party_id:
                    customers.append(customer)
            
            track_api_call(api_url, "GET", response={"customerCount": len(customers)})
            return jsonify(customers)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch parties: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            mobile_party_id = request.args.get('mobilePartyId')
            if mobile_party_id:
                return jsonify([{
                    "customerId": mobile_party_id,
                    "firstName": "Customer",
                    "lastName": f"ID: {mobile_party_id}",
                    "dateOfBirth": "",
                    "status": "Active"
                }])
            
            return jsonify([])
    except Exception as e:
        print(f"ERROR: Failed to fetch parties: {str(e)}")
        
        mobile_party_id = request.args.get('mobilePartyId')
        if mobile_party_id:
            return jsonify([{
                "customerId": mobile_party_id,
                "firstName": "Customer",
                "lastName": f"ID: {mobile_party_id}",
                "dateOfBirth": "",
                "status": "Active"
            }])
        
        return jsonify([])

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
    group_id = f'headless-{domain}-{session_id}-{int(time.time())}-{str(uuid.uuid4())[:8]}'
    
    conf = {
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'PLAIN',
        'sasl.username': sasl_username,
        'sasl.password': sasl_password,
        'group.id': group_id,
        'auto.offset.reset': 'latest',  # Start from latest for real-time events
        'client.id': f'headless-client-{session_id}-{domain}',
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

# --- HEADLESS V2 EVENT STREAMING ENDPOINTS ---

@main_bp.route('/api/headless-v2/events/<string:domain>')
def stream_headless_v2_events(domain):
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

@main_bp.route('/api/headless-v2/events/<string:domain>/disconnect', methods=['POST'])
def disconnect_headless_v2_events(domain):
    """Disconnect from Kafka events for the specified domain"""
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        session_id = request.json.get('session_id') if request.json else None
    
    if session_id:
        cleanup_consumer_for_session(session_id, domain)
        return jsonify({'status': 'success', 'message': f'Disconnected from {domain} events'})
    else:
        return jsonify({'status': 'error', 'message': 'No session ID provided'}), 400

@main_bp.route('/api/headless-v2/cleanup', methods=['POST'])
def cleanup_all_headless_v2_events():
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

@main_bp.route('/api/headless-v2/health', methods=['GET'])
def get_headless_v2_health():
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

# --- Configuration API ---
@main_bp.route('/api/configuration/endpoints', methods=['GET'])
def get_configuration_endpoints():
    """Get current API endpoint configuration from environment variables."""
    import os
    
    endpoints = {
        'PARTY_API_BASE_URI': os.getenv('PARTY_API_BASE_URI', ''),
        'CURRENT_ACCOUNT_API_URI': os.getenv('CURRENT_ACCOUNT_API_URI', ''),
        'ACCOUNT_BALANCE_API_URI_TEMPLATE': os.getenv('ACCOUNT_BALANCE_API_URI_TEMPLATE', ''),
        'LOAN_API_BASE_URI': os.getenv('LOAN_API_BASE_URI', ''),
        'LOAN_STATUS_API_URI_TEMPLATE': os.getenv('LOAN_STATUS_API_URI_TEMPLATE', ''),
        'LOAN_SCHEDULES_API_URI_TEMPLATE': os.getenv('LOAN_SCHEDULES_API_URI_TEMPLATE', ''),
        'LOAN_DISBURSEMENT_API_URI_TEMPLATE': os.getenv('LOAN_DISBURSEMENT_API_URI_TEMPLATE', ''),
        'CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE': os.getenv('CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE', ''),
        'TERM_DEPOSIT_API_URI': os.getenv('TERM_DEPOSIT_API_URI', ''),
        'DEBIT_ACCOUNT_API_URI': os.getenv('DEBIT_ACCOUNT_API_URI', ''),
        'CREDIT_ACCOUNT_API_URI': os.getenv('CREDIT_ACCOUNT_API_URI', ''),
        'HOLDINGS_PARTY_ARRANGEMENTS_API_URI_TEMPLATE': os.getenv('HOLDINGS_PARTY_ARRANGEMENTS_API_URI_TEMPLATE', ''),
        'HOLDINGS_ACCOUNT_BALANCES_API_URI_TEMPLATE': os.getenv('HOLDINGS_ACCOUNT_BALANCES_API_URI_TEMPLATE', ''),
        'HOLDINGS_ACCOUNT_TRANSACTIONS_API_URI_TEMPLATE': os.getenv('HOLDINGS_ACCOUNT_TRANSACTIONS_API_URI_TEMPLATE', '')
    }
    
    return jsonify(endpoints)

@main_bp.route('/api/configuration/endpoints', methods=['POST'])
def update_configuration_endpoints():
    """Update API endpoint configuration in .env file."""
    import os
    from pathlib import Path
    
    try:
        data = request.get_json()
        
        # Read current .env file
        env_path = Path('.env')
        env_lines = []
        
        if env_path.exists():
            with open(env_path, 'r') as f:
                env_lines = f.readlines()
        
        # Update or add new values
        updated_keys = set()
        for i, line in enumerate(env_lines):
            if '=' in line and not line.strip().startswith('#'):
                key = line.split('=')[0].strip()
                if key in data:
                    env_lines[i] = f"{key}={data[key]}\n"
                    updated_keys.add(key)
        
        # Add new keys that weren't found
        for key, value in data.items():
            if key not in updated_keys:
                env_lines.append(f"{key}={value}\n")
        
        # Write back to .env file
        with open(env_path, 'w') as f:
            f.writelines(env_lines)
        
        return jsonify({"status": "success", "message": "Configuration updated successfully"})
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@main_bp.route('/api/configuration/demo-config', methods=['GET'])
def get_demo_configuration():
    """Get current demo configuration from Demoflow.py."""
    import re
    
    try:
        with open('Demoflow.py', 'r') as f:
            content = f.read()
        
        # Extract configuration values using regex
        config = {}
        patterns = {
            'CREATE_CURRENT_ACCOUNT': r'CREATE_CURRENT_ACCOUNT\s*=\s*(True|False)',
            'CREATE_MORTGAGE': r'CREATE_MORTGAGE\s*=\s*(True|False)',
            'CREATE_CONSUMER_LOAN': r'CREATE_CONSUMER_LOAN\s*=\s*(True|False)',
            'CREATE_TERM_DEPOSIT': r'CREATE_TERM_DEPOSIT\s*=\s*(True|False)'
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, content)
            if match:
                config[key] = match.group(1) == 'True'
            else:
                config[key] = False
        
        return jsonify(config)
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@main_bp.route('/api/configuration/demo-config', methods=['POST'])
def update_demo_configuration():
    """Update demo configuration in Demoflow.py."""
    import re
    
    try:
        data = request.get_json()
        
        # Validate that current account is selected if other products are selected
        if not data.get('CREATE_CURRENT_ACCOUNT', False):
            if (data.get('CREATE_MORTGAGE', False) or 
                data.get('CREATE_CONSUMER_LOAN', False) or 
                data.get('CREATE_TERM_DEPOSIT', False)):
                return jsonify({
                    "status": "error", 
                    "message": "Current Account must be selected when other products are enabled"
                }), 400
        
        # Read current Demoflow.py
        with open('Demoflow.py', 'r') as f:
            content = f.read()
        
        # Update configuration values
        patterns = {
            'CREATE_CURRENT_ACCOUNT': r'(CREATE_CURRENT_ACCOUNT\s*=\s*)(True|False)',
            'CREATE_MORTGAGE': r'(CREATE_MORTGAGE\s*=\s*)(True|False)',
            'CREATE_CONSUMER_LOAN': r'(CREATE_CONSUMER_LOAN\s*=\s*)(True|False)',
            'CREATE_TERM_DEPOSIT': r'(CREATE_TERM_DEPOSIT\s*=\s*)(True|False)'
        }
        
        for key, pattern in patterns.items():
            if key in data:
                new_value = 'True' if data[key] else 'False'
                content = re.sub(pattern, f'\\g<1>{new_value}', content)
        
        # Write back to Demoflow.py
        with open('Demoflow.py', 'w') as f:
            f.write(content)
        
        return jsonify({"status": "success", "message": "Demo configuration updated successfully"})
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@main_bp.route('/api/configuration/create-demo-data', methods=['POST'])
def create_demo_data():
    """Run Demoflow.py to create demo user and products."""
    import subprocess
    import threading
    import time
    import re
    import os
    
    # Capture the app instance for the thread
    app = current_app._get_current_object()
    
    def run_demoflow():
        with app.app_context():
            try:
                # Set initial progress
                save_demo_status('running', {}, '', 'Initializing Demoflow script...')
                app.logger.info("Starting demo data creation process")
                app.logger.info(f"Initial status set to: {app.config.get('DEMO_CREATION_STATUS')}")
                
                # Get the correct working directory (where the Flask app is running from)
                import os
                app_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                demoflow_path = os.path.join(app_root, 'Demoflow.py')
                
                app.logger.info(f"App root directory: {app_root}")
                app.logger.info(f"Looking for Demoflow.py at: {demoflow_path}")
                
                # Check if Demoflow.py exists
                if not os.path.exists(demoflow_path):
                    raise FileNotFoundError(f"Demoflow.py script not found at {demoflow_path}")
                
                # Update progress
                save_demo_status('running', {}, '', 'Starting Demoflow execution...')
                app.logger.info("About to execute Demoflow.py with python3")
                
                # Run Demoflow.py with non-blocking approach
                import subprocess
                import os
                
                # Get current environment variables to pass to subprocess
                env = os.environ.copy()
                
                process = subprocess.Popen(
                    ['python3', 'Demoflow.py'], 
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=app_root,
                    env=env,  # Pass environment variables
                    bufsize=1,
                    universal_newlines=True
                )
                
                save_demo_status('running', {}, '', 'Demoflow script is running...')
                app.logger.info("Demoflow.py process started")
                app.logger.info(f"Status during execution: {app.config.get('DEMO_CREATION_STATUS')}")
                
                # Wait for completion with timeout
                try:
                    stdout, stderr = process.communicate(timeout=300)  # 5 minute timeout
                    returncode = process.returncode
                except subprocess.TimeoutExpired:
                    process.kill()
                    stdout, stderr = process.communicate()
                    raise subprocess.TimeoutExpired(['python3', 'Demoflow.py'], 300)
                
                app.logger.info(f"Demoflow.py completed with return code: {returncode}")
                if stdout:
                    app.logger.info(f"Demoflow stdout: {stdout[:500]}...")  # Log first 500 chars
                if stderr:
                    app.logger.error(f"Demoflow stderr: {stderr}")
                
                # Update progress
                save_demo_status('running', {}, '', 'Processing Demoflow output...')
                app.logger.info(f"Status before parsing: {app.config.get('DEMO_CREATION_STATUS')}")
                
                # Check if the subprocess completed successfully
                if returncode != 0:
                    error_msg = f"Demoflow.py failed with return code {returncode}"
                    if stderr:
                        error_msg += f": {stderr}"
                    raise RuntimeError(error_msg)
                
                # Parse the output file for results
                try:
                    save_demo_status('running', {}, '', 'Parsing results...')
                    
                    output_file_path = os.path.join(app_root, 'demooutput.txt')
                    if not os.path.exists(output_file_path):
                        raise FileNotFoundError(f"demooutput.txt not found at {output_file_path}")
                    
                    with open(output_file_path, 'r') as f:
                        output_content = f.read()
                    
                    if not output_content.strip():
                        raise ValueError("demooutput.txt is empty")
                    
                    # Extract IDs from the output
                    results = {}
                    
                    # Extract Party ID from the first party creation response
                    party_match = re.search(r'"id":\s*"(\d+)"', output_content)
                    if party_match:
                        results['party_id'] = party_match.group(1)
                        app.logger.info(f"Extracted party_id: {results['party_id']}")
                    
                    # Extract Account Reference from current account creation
                    account_match = re.search(r'"accountReference":\s*"(\d+)"', output_content)
                    if account_match:
                        results['account_id'] = account_match.group(1)
                        app.logger.info(f"Extracted account_id: {results['account_id']}")
                    
                    # Extract Loan IDs from loan creation responses (look for arrangementId in loan responses)
                    loan_ids = []
                    
                    # Look for loan IDs in the response - they start with exactly "AA" followed by alphanumeric characters
                    # This regex specifically looks for "AA" followed by exactly 10 more characters (not AAA...)
                    loan_matches = re.findall(r'"id":\s*"(AA[A-Z0-9]{10})"', output_content)
                    if loan_matches:
                        # Remove duplicates while preserving order
                        seen = set()
                        for loan_id in loan_matches:
                            if loan_id not in seen:
                                loan_ids.append(loan_id)
                                seen.add(loan_id)
                        app.logger.info(f"Extracted loan_ids: {loan_ids}")
                    
                    if loan_ids:
                        results['loan_ids'] = loan_ids
                    
                    # Extract Term Deposit ID from term deposit creation
                    term_deposit_match = re.search(r'holdings/deposits/termDeposits.*?"accountReference":\s*"(\d+)"', output_content, re.DOTALL)
                    if term_deposit_match:
                        results['term_deposit_id'] = term_deposit_match.group(1)
                        app.logger.info(f"Extracted term_deposit_id: {results['term_deposit_id']}")
                    
                    # Store results and mark as completed
                    save_demo_status('completed', results, '', 'Completed successfully!')
                    
                    # Log successful completion with detailed info
                    app.logger.info(f"Demo data creation completed successfully!")
                    app.logger.info(f"Final status: {app.config.get('DEMO_CREATION_STATUS')}")
                    app.logger.info(f"Final results: {results}")
                    app.logger.info(f"Results stored in config: {app.config.get('DEMO_CREATION_RESULTS')}")
                    
                except Exception as e:
                    app.logger.error(f"Error parsing demo output: {str(e)}")
                    save_demo_status('error', {}, f"Error parsing results: {str(e)}", '')
                    
            except subprocess.TimeoutExpired:
                app.logger.error("Demo data creation timed out after 5 minutes")
                save_demo_status('error', {}, "Demo creation timed out after 5 minutes", '')
            except Exception as e:
                app.logger.error(f"Error in demo data creation: {str(e)}")
                save_demo_status('error', {}, str(e), '')
    
    # Check if demo creation is already running
    current_status = app.config.get('DEMO_CREATION_STATUS', 'idle')
    if current_status == 'running':
        return jsonify({"status": "error", "message": "Demo data creation is already in progress"}), 400
    
    # Set status to running and clear previous results
    save_demo_status('running', {}, '', 'Starting...')
    
    # Run in background thread
    thread = threading.Thread(target=run_demoflow)
    thread.daemon = True
    thread.start()
    
    app.logger.info("Demo data creation started in background thread")
    
    return jsonify({"status": "success", "message": "Demo data creation started"})

@main_bp.route('/api/configuration/demo-status', methods=['GET'])
def get_demo_status():
    """Get the status of demo data creation."""
    # Load status from persistent file
    status_data = load_demo_status()
    
    return jsonify({
        "status": status_data['status'],
        "results": status_data['results'],
        "error": status_data['error'],
        "progress": status_data['progress']
    })

def save_demo_status(status, results=None, error='', progress=''):
    """Save demo status to a persistent file."""
    try:
        status_data = {
            'status': status,
            'results': results or {},
            'error': error,
            'progress': progress,
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        # Get the app root directory (where the Flask app is running from)
        app_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        status_file_path = os.path.join(app_root, DEMO_STATUS_FILE)
        
        with open(status_file_path, 'w') as f:
            json.dump(status_data, f, indent=2)
        
        # Try to update Flask config if we have an app context, but don't fail if we don't
        try:
            current_app.config['DEMO_CREATION_STATUS'] = status
            current_app.config['DEMO_CREATION_RESULTS'] = results or {}
            current_app.config['DEMO_CREATION_ERROR'] = error
            current_app.config['DEMO_CREATION_PROGRESS'] = progress
            current_app.logger.info(f"Demo status saved to file: {status}")
        except RuntimeError:
            # No application context available (running in thread), just log to stdout
            print(f"Demo status saved to file: {status}")
        
    except Exception as e:
        try:
            current_app.logger.error(f"Error saving demo status: {str(e)}")
        except RuntimeError:
            print(f"Error saving demo status: {str(e)}")

def load_demo_status():
    """Load demo status from persistent file."""
    try:
        # Get the app root directory
        app_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        status_file_path = os.path.join(app_root, DEMO_STATUS_FILE)
        
        if not os.path.exists(status_file_path):
            return {
                'status': 'idle',
                'results': {},
                'error': '',
                'progress': ''
            }
        
        with open(status_file_path, 'r') as f:
            status_data = json.load(f)
        
        # Update Flask config with loaded data
        current_app.config['DEMO_CREATION_STATUS'] = status_data.get('status', 'idle')
        current_app.config['DEMO_CREATION_RESULTS'] = status_data.get('results', {})
        current_app.config['DEMO_CREATION_ERROR'] = status_data.get('error', '')
        current_app.config['DEMO_CREATION_PROGRESS'] = status_data.get('progress', '')
        
        return {
            'status': status_data.get('status', 'idle'),
            'results': status_data.get('results', {}),
            'error': status_data.get('error', ''),
            'progress': status_data.get('progress', '')
        }
        
    except Exception as e:
        current_app.logger.error(f"Error loading demo status: {str(e)}")
        return {
            'status': 'idle',
            'results': {},
            'error': '',
            'progress': ''
        }