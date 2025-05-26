from flask import render_template, jsonify, current_app, url_for, abort, request, Response, stream_with_context, redirect
from . import main_bp
import os
import datetime
import uuid
import requests
import json
from collections import deque
from confluent_kafka import Consumer, KafkaException, TopicPartition
import time
from dotenv import load_dotenv

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
    'lending': 'lending-event-topic'
}

# Load environment variables
load_dotenv()

# Event Hub configuration for SSE streaming
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
CONNECTION_STRING = os.getenv("CONNECTION_STRING")

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
    
    # If no response is provided and error is None, try to make the actual API call
    if response is None and error is None and (uri.startswith('http://') or uri.startswith('https://')):
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
    
    # Use provided response/error if available
    elif response:
        api_call["response"] = response
        api_call["status"] = 200
    elif error:
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

@main_bp.route('/tab/architecture')
def tab_architecture():
    """Renders the architecture tab HTML fragment."""
    return render_template('architecture.html')

@main_bp.route('/tab/assistant')
def tab_assistant():
    """Renders the assistant tab HTML fragment."""
    return render_template('assistant.html')

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
        api_url = LOAN_STATUS_API_URI_TEMPLATE.format(loan_id=loan_id)
        
        print(f"Fetching loan details for loan ID {loan_id}")
        
        response = requests.get(api_url, headers={"Accept": "application/json"})
        
        if response.status_code == 200:
            loan_data = response.json()
            
            track_api_call(api_url, "GET", response=loan_data)
            
            if 'body' in loan_data and loan_data['body']:
                raw_loan = loan_data['body'][0]
                
                transformed_data = {
                    "id": loan_id,
                    "productDisplayName": raw_loan.get('productDescription', 'Loan Product'),
                    "productId": raw_loan.get('productDescription', 'LOAN_PRODUCT'),
                    "accountNumber": raw_loan.get('accountId', ''),
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

@main_bp.route('/api/loans/<string:loan_id>/schedules')
def get_loan_schedules(loan_id):
    """Provides payment schedules for a specific loan."""
    try:
        api_url = LOAN_SCHEDULES_API_URI_TEMPLATE.format(loan_id=loan_id)
        
        print(f"Fetching loan schedules for loan ID {loan_id}")
        
        response = requests.get(api_url, headers={"Accept": "application/json"})
        
        if response.status_code == 200:
            schedules_data = response.json()
            
            track_api_call(api_url, "GET", response=schedules_data)
            
            formatted_data = {
                "loanId": loan_id,
                "currency": "USD",
                "schedules": []
            }
            
            if isinstance(schedules_data, dict) and 'body' in schedules_data:
                schedule = {
                    "id": loan_id,
                    "scheduleItems": []
                }
                
                for payment in schedules_data['body']:
                    payment_date = payment.get('paymentDate', '')
                    schedule_item = {
                        "dueDate": payment_date,
                        "totalAmount": float(payment.get('totalAmount', 0)),
                        "principal": float(payment.get("principalAmount", 0)),
                        "interest": float(payment.get("interestAmount", 0)),
                        "status": "Due" if payment.get("scheduleType") == "DUE" else "Pending"
                    }
                    schedule["scheduleItems"].append(schedule_item)
                
                formatted_data["schedules"].append(schedule)
            
            return jsonify(formatted_data)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch loan schedules: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            return jsonify(error), response.status_code
    except Exception as e:
        print(f"ERROR: Failed to fetch loan schedules for {loan_id}: {str(e)}")
        return jsonify({"error": "Failed to fetch loan schedules"}), 500

# --- ACCOUNT AND LOAN CREATION ---

@main_bp.route('/api/accounts/create', methods=['POST'])
def create_account():
    """Creates a new current account via API call."""
    data = request.get_json()
    
    party_id = data.get('partyId')
    product_id = data.get('productId', 'CHECKING.ACCOUNT')
    currency = data.get('currency', 'USD')
    
    if not party_id:
        return jsonify({"error": "Party ID is required"}), 400
    
    today_str = datetime.datetime.now().strftime("%Y%m%d")
    
    payload = {
        "parties": [
            {
                "partyId": str(party_id),
                "partyRole": "OWNER"
            }
        ],
        "accountName": "current",
        "openingDate": today_str,
        "productId": product_id,
        "currency": currency,
        "branchCode": "01123",
        "quotationReference": f"QUOT{uuid.uuid4().hex[:6].upper()}"
    }
    
    uri = CURRENT_ACCOUNT_API_URI
    track_api_call(uri, "POST", payload=payload)
    
    try:
        response = requests.post(uri, json=payload, headers={'Content-Type': 'application/json'})
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        
        if response.status_code >= 200 and response.status_code < 300:
            return jsonify({
                "success": True,
                "message": f"Current account created successfully for party {party_id}",
                "data": response_data,
                "status": response.status_code
            })
        else:
            return jsonify({
                "success": False,
                "message": f"Failed to create current account for party {party_id}",
                "error": response_data,
                "status": response.status_code
            }), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "message": f"Error during API call to create current account: {str(e)}",
            "error": str(e)
        }), 500

@main_bp.route('/api/loans/create', methods=['POST'])
def create_loan():
    """Creates a new loan via API call."""
    data = request.get_json()
    
    party_id = data.get('partyId')
    product_id = data.get('productId', 'MORTGAGE.PRODUCT')
    currency = data.get('currency', 'USD')
    amount = data.get('amount')
    term_years = data.get('termYears')
    account_reference = data.get('accountReference', '123456')
    
    if not party_id:
        return jsonify({"error": "Party ID is required"}), 400
    if not amount:
        return jsonify({"error": "Amount is required"}), 400
    if not term_years:
        return jsonify({"error": "Term in years is required"}), 400
    
    term = f"{term_years}Y"
    
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
                "payout": [{"payoutSettlement": "YES", "property": [{"payoutAccount": f"DDAComposable|GB0010001|{account_reference}"}]}],
                "assocSettlement": [
                    {"payinSettlement": "YES", "reference": [{"payinAccount": f"DDAComposable|GB0010001|{account_reference}"}]},
                    {"payinSettlement": "YES", "reference": [{"payinAccount": f"DDAComposable|GB0010001|{account_reference}"}]},
                ]
            }]
        }
    }
    
    uri = LOAN_API_BASE_URI
    track_api_call(uri, "POST", payload=payload)
    
    try:
        response = requests.post(uri, json=payload, headers={'Content-Type': 'application/json'})
        
        response_data = {}
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Failed to decode JSON response", "content": response.text}
        
        if response.status_code >= 200 and response.status_code < 300:
            return jsonify({
                "success": True,
                "message": f"Loan created successfully for party {party_id}",
                "data": response_data,
                "status": response.status_code
            })
        else:
            return jsonify({
                "success": False,
                "message": f"Failed to create loan for party {party_id}",
                "error": response_data,
                "status": response.status_code
            }), response.status_code
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "message": f"Error during API call to create loan: {str(e)}",
            "error": str(e)
        }), 500

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
            
            customer = {
                "customerId": party_data.get('partyId', party_id),
                "firstName": party_data.get('firstName', ''),
                "lastName": party_data.get('lastName', ''),
                "dateOfBirth": party_data.get('dateOfBirth', ''),
                "cityOfBirth": party_data.get('cityOfBirth', ''),
                "middleName": party_data.get('middleName', ''),
                "status": "Active"
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
                                        
                                        # If systemReference is 'lending', this is a loan account
                                        if system_ref == 'lending':
                                            loan_ids.add(account_id)
                        except Exception as e:
                            print(f"Error checking balance for account {account_id}: {str(e)}")
                    
                    # Also check traditional lending arrangements
                    if (arrangement.get('productLine') == 'LENDING' and 
                        arrangement.get('systemReference') == 'lending'):
                        if account_id:
                            loan_ids.add(account_id)

            # Second pass: get all accounts from arrangements and filter out loans
            for arrangement in arrangements_data['arrangements']:
                if arrangement.get('productLine') == 'ACCOUNTS':
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
                    
                    account = {
                        "accountId": holdings_account_id,
                        "displayName": arrangement.get('arrangementName', 'Current Account'),
                        "productName": arrangement.get('productName', 'CURRENT_ACCOUNT'),
                        "type": "current",
                        "status": "active",
                        "currency": arrangement.get('currency', 'USD'),
                        "currentBalance": balance_data["balance"],
                        "availableBalance": balance_data["availableBalance"],
                        "openDate": arrangement.get('startDate', ''),
                        "contractReference": contract_ref
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
                                        
                                        # This is a loan if systemReference is 'lending'
                                        if system_ref == 'lending':
                                            is_loan = True
                                            # For loans, balance is typically negative, convert to positive outstanding
                                            raw_balance = float(balance_item.get('onlineActualBalance', 0))
                                            outstanding_balance = abs(raw_balance) if raw_balance < 0 else raw_balance
                                            print(f"Loan {account_id}: Raw balance = {raw_balance}, Outstanding = {outstanding_balance}")
                        except Exception as e:
                            print(f"Error checking balance for potential loan {account_id}: {str(e)}")
                    
                    # Also check traditional lending arrangements
                    if not is_loan and (arrangement.get('productLine') == 'LENDING' and 
                        arrangement.get('systemReference') == 'lending'):
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
    """Search for parties/customers using various criteria."""
    try:
        party_id = request.args.get('partyId', '').strip()
        last_name = request.args.get('lastName', '').strip()
        date_of_birth = request.args.get('dateOfBirth', '').strip()
        
        api_url = None
        search_type = ""
        
        if party_id:
            api_url = f"{PARTY_API_BASE_URI}/{party_id}"
            search_type = "party_id"
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
            
            if search_type == "party_id":
                customer = {
                    "customerId": response_data.get('partyId', party_id),
                    "firstName": response_data.get('firstName', ''),
                    "lastName": response_data.get('lastName', ''),
                    "dateOfBirth": response_data.get('dateOfBirth', ''),
                    "cityOfBirth": response_data.get('cityOfBirth', ''),
                    "middleName": response_data.get('middleName', ''),
                    "status": "Active"
                }
                customers.append(customer)
            else:
                party_list = response_data.get('parties', [])
                for party_data in party_list:
                    party = {
                        "customerId": party_data.get('partyId', ''),
                        "firstName": party_data.get('firstName', ''),
                        "lastName": party_data.get('lastName', ''),
                        "dateOfBirth": party_data.get('dateOfBirth', ''),
                        "cityOfBirth": party_data.get('cityOfBirth', ''),
                        "middleName": party_data.get('middleName', ''),
                        "status": "Active"
                    }
                    customers.append(party)
            
            return jsonify({
                "success": True,
                "customers": customers,
                "searchType": search_type,
                "searchParams": {
                    "partyId": party_id,
                    "lastName": last_name,
                    "dateOfBirth": date_of_birth
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

def create_kafka_consumer():
    """Create and return a configured Kafka consumer for Event Hub streaming"""
    sasl_username = "$ConnectionString"
    sasl_password = CONNECTION_STRING
    
    conf = {
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'PLAIN',
        'sasl.username': sasl_username,
        'sasl.password': sasl_password,
        'group.id': f'headless-v2-stream-{int(time.time())}',
        'auto.offset.reset': 'latest',  # Start from latest for real-time events
        'client.id': 'headless-v2-client',
        'enable.auto.commit': True,
        'auto.commit.interval.ms': 5000,
        'session.timeout.ms': 30000,
        'heartbeat.interval.ms': 10000
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

def stream_kafka_events(domain):
    """Generator function for streaming Kafka events via SSE"""
    if domain not in KAFKA_TOPICS:
        yield f"data: {json.dumps({'type': 'error', 'message': f'Unknown domain: {domain}'})}\n\n"
        return
    
    topic_name = KAFKA_TOPICS[domain]
    consumer = None
    
    try:
        # Send initial connection info
        yield f"data: {json.dumps({'type': 'info', 'message': f'Connecting to {domain} events...'})}\n\n"
        
        consumer = create_kafka_consumer()
        
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
                if msg.error().code() == KafkaException._PARTITION_EOF:
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
        if consumer:
            try:
                consumer.close()
            except:
                pass
        yield f"data: {json.dumps({'type': 'info', 'message': f'Disconnected from {domain} events'})}\n\n"

# --- HEADLESS V2 EVENT STREAMING ENDPOINTS ---

@main_bp.route('/api/headless-v2/events/<string:domain>')
def stream_headless_v2_events(domain):
    """Stream Kafka events for the specified domain via Server-Sent Events"""
    def event_stream():
        for event_data in stream_kafka_events(domain):
            yield event_data
    
    return Response(
        event_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    )