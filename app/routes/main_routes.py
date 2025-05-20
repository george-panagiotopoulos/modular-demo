from flask import render_template, jsonify, current_app, url_for, abort, request, Response, stream_with_context
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
# from app.utils import load_stub_data, save_stub_data # No longer needed

# Store last 10 API calls for headless tab
api_calls_history = deque(maxlen=10)

# API endpoints from Demoflow.py
PARTY_API_BASE_URI = "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties"
LOAN_API_BASE_URI = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/consumerLoans"
LOAN_STATUS_API_URI_TEMPLATE = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/status"
LOAN_SCHEDULES_API_URI_TEMPLATE = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/schedules"

# Additional API endpoints from Demoflow.py
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
    
    # If no response is provided and it's a headless call, try to make the actual API call
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
    # Return the actual API call history
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
    domain = data.get('domain')  # Add domain tracking
    
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

# --- Mobile App API Endpoints ---
# These will need to be connected to live backend services.
# For now, they return placeholder data.

@main_bp.route('/api/mobile/accounts')
def get_mobile_accounts():
    """Provides the list of accounts for the mobile app."""
    # Placeholder: In a real app, call a live API endpoint.
    # Example: accounts = banking_operations.get_customer_accounts(CUSTOMER_ID)
    print("WARN: /api/mobile/accounts is returning placeholder data.")
    return jsonify([]) 

@main_bp.route('/api/mobile/accounts/<string:account_id>/transactions')
def get_mobile_transactions(account_id):
    """Provides transactions for a specific account."""
    # Placeholder: In a real app, call a live API endpoint.
    # Example: transactions = banking_operations.get_account_transactions(account_id)
    print(f"WARN: /api/mobile/accounts/{account_id}/transactions is returning placeholder data.")
    return jsonify([])

@main_bp.route('/api/mobile/transfer', methods=['POST'])
def mobile_transfer():
    """Simulates a money transfer from the mobile app."""
    data = request.get_json()
    from_account = data.get('fromAccount')
    to_account = data.get('toAccount')
    amount = data.get('amount')

    # Placeholder: In a real app, call a live transfer API.
    # Example: success, message = banking_operations.transfer_funds(...)
    print(f"WARN: /api/mobile/transfer is a placeholder for {from_account} to {to_account} for {amount}.")
    
    # Simulate success for now
    # In a real scenario, generate actual events if the transfer is successful.
    simulated_event = {
        "eventId": f"EVT{uuid.uuid4().hex[:6].upper()}",
        "timestamp": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
        "eventType": "FundsTransferCompleted",
        "source": "MobileApp",
        "data": {
            "fromAccount": from_account,
            "toAccount": to_account,
            "amount": amount,
            "currency": "USD",
            "status": "SUCCESS",
            "message": "Transfer initiated successfully via Mobile App."
        }
    }
    # The mechanism to send this to the Headless tab's event viewer needs to be live (e.g., Kafka)
    # For now, this event is just created and not sent anywhere automatically.

    return jsonify({"status": "success", "message": "Transfer initiated (simulated).", "event": simulated_event})

@main_bp.route('/api/mobile/party/<string:party_id>/loans')
def get_party_loans(party_id):
    """Provides the list of loans for a specific party on the mobile app."""
    uri = f"http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v7.0.0/holdings/customers/{party_id}/arrangements"
    
    print(f"Making real API call to fetch loans for party: {party_id}")
    
    try:
        # Make the actual API call
        response = requests.get(
            uri,
            headers={"Accept": "application/json"}
        )
        
        # Process the response
        if response.status_code == 200:
            try:
                response_data = response.json()
                loans_data = []
                
                # Track the successful API call
                track_api_call(uri, "GET", response=response_data)
                
                # Extract loan data from the arrangements response
                if isinstance(response_data, dict) and 'body' in response_data:
                    for arrangement in response_data['body']:
                        product_lines = arrangement.get('productLines', [])
                        for product_line in product_lines:
                            if product_line.get('productLine') == 'Lending':
                                product_groups = product_line.get('productGroupIds', [])
                                for product_group in product_groups:
                                    arrangement_id = product_group.get('arrangementId', '')
                                    # Get additional loan details if needed
                                    loans_data.append({
                                        "loanId": arrangement_id,
                                        "displayName": product_group.get('productGroupId', 'Home Mortgage'),
                                        "productName": product_group.get('productGroupId', 'MORTGAGE.PRODUCT'),
                                        "type": "loan",
                                        "currency": "USD",
                                        "principalAmount": 225351.00,
                                        "outstandingBalance": 225351.00,
                                        "term": "109M",
                                        "maturityDate": "20340414",
                                        "nextPaymentAmount": 2450.67,
                                        "nextPaymentDate": "20250414",
                                        "interestRate": 1.75,
                                        "status": "Active"
                                    })
                
                # If no loans found in the API response or API call failed, use demo data
                if not loans_data and party_id == "2513655771":
                    loans_data = [{
                        "loanId": "AA25073599N9",
                        "displayName": "Home Mortgage",
                        "productName": "MORTGAGE.PRODUCT",
                        "type": "loan",
                        "currency": "USD",
                        "principalAmount": 225351.00,
                        "outstandingBalance": 225351.00,
                        "term": "109M",
                        "maturityDate": "20340414",
                        "nextPaymentAmount": 2450.67,
                        "nextPaymentDate": "20250414",
                        "interestRate": 1.75,
                        "status": "Active"
                    }]
                
                return jsonify(loans_data)
            
            except (ValueError, KeyError) as e:
                # Error parsing the response
                error_info = {"message": f"Error parsing API response: {str(e)}", "status": 500}
                track_api_call(uri, "GET", error=error_info)
                print(f"ERROR: {error_info['message']}")
                
                # Fall back to demo data for 2513655771
                if party_id == "2513655771":
                    return jsonify([{
                        "loanId": "AA25073599N9",
                        "displayName": "Home Mortgage",
                        "productName": "MORTGAGE.PRODUCT",
                        "type": "loan",
                        "currency": "USD",
                        "principalAmount": 225351.00,
                        "outstandingBalance": 225351.00,
                        "term": "109M",
                        "maturityDate": "20340414",
                        "nextPaymentAmount": 2450.67,
                        "nextPaymentDate": "20250414",
                        "interestRate": 1.75,
                        "status": "Active"
                    }])
                return jsonify([])
        else:
            # API call failed
            error_info = {
                "message": f"API returned non-200 status: {response.status_code}",
                "status": response.status_code,
                "response": response.text
            }
            track_api_call(uri, "GET", error=error_info)
            print(f"ERROR: {error_info['message']}")
            
            # Fall back to demo data for 2513655771
            if party_id == "2513655771":
                return jsonify([{
                    "loanId": "AA25073599N9",
                    "displayName": "Home Mortgage",
                    "productName": "MORTGAGE.PRODUCT",
                    "type": "loan",
                    "currency": "USD",
                    "principalAmount": 225351.00,
                    "outstandingBalance": 225351.00,
                    "term": "109M",
                    "maturityDate": "20340414",
                    "nextPaymentAmount": 2450.67,
                    "nextPaymentDate": "20250414",
                    "interestRate": 1.75,
                    "status": "Active"
                }])
            return jsonify([])
            
    except requests.exceptions.RequestException as e:
        # Network error, timeout, etc.
        error_info = {"message": f"Request failed: {str(e)}", "status": 500}
        track_api_call(uri, "GET", error=error_info)
        print(f"ERROR: {error_info['message']}")
        
        # Fall back to demo data for 2513655771
        if party_id == "2513655771":
            return jsonify([{
                "loanId": "AA25073599N9",
                "displayName": "Home Mortgage",
                "productName": "MORTGAGE.PRODUCT",
                "type": "loan",
                "currency": "USD",
                "principalAmount": 225351.00,
                "outstandingBalance": 225351.00,
                "term": "109M",
                "maturityDate": "20340414",
                "nextPaymentAmount": 2450.67,
                "nextPaymentDate": "20250414",
                "interestRate": 1.75,
                "status": "Active"
            }])
        return jsonify([])

@main_bp.route('/api/mobile/loans/<string:loan_id>/schedules')
def get_loan_schedules(loan_id):
    """Provides the payment schedule for a specific loan."""
    uri = LOAN_SCHEDULES_API_URI_TEMPLATE.format(loan_id=loan_id)
    
    print(f"Making real API call to fetch schedules for loan: {loan_id}")
    
    try:
        # Make the actual API call
        response = requests.get(
            uri,
            headers={"Accept": "application/json"}
        )
        
        # Process the response
        if response.status_code == 200:
            try:
                response_data = response.json()
                
                # Track the successful API call
                track_api_call(uri, "GET", response=response_data)
                
                # Extract schedule data from the response
                schedule_data = {
                    "loanId": loan_id,
                    "currency": "USD",
                    "remainingPayments": 0,
                    "nextPaymentDate": "",
                    "payments": []
                }
                
                # Check if the response has the correct structure
                if isinstance(response_data, dict) and 'body' in response_data:
                    # The body in the real API is an array, not an object
                    body = response_data['body']
                    
                    if isinstance(body, list) and body:
                        # Set loan remaining payments from header if available
                        if 'header' in response_data and 'total_size' in response_data['header']:
                            schedule_data["remainingPayments"] = response_data['header'].get('total_size', 108)
                        
                        # Find the next payment date (first FUTURE payment or earliest date)
                        future_payments = [p for p in body if p.get('scheduleType') == 'FUTURE']
                        if future_payments:
                            next_payment = min(future_payments, key=lambda p: p.get('paymentDate', '99999999'))
                            payment_date = next_payment.get('paymentDate', '')
                            # Convert from YYYY-MM-DD to YYYYMMDD format
                            if payment_date and '-' in payment_date:
                                schedule_data["nextPaymentDate"] = payment_date.replace('-', '')
                        
                        # Process each payment in the body array
                        for i, payment in enumerate(body):
                            payment_date = payment.get('paymentDate', '')
                            # Convert from YYYY-MM-DD to YYYYMMDD format
                            if payment_date and '-' in payment_date:
                                payment_date = payment_date.replace('-', '')
                            
                            schedule_data["payments"].append({
                                "paymentNumber": i + 1,
                                "dueDate": payment_date,
                                "totalAmount": float(payment.get("totalAmount", 0)),
                                "principal": float(payment.get("principalAmount", 0)),
                                "interest": float(payment.get("interestAmount", 0)),
                                "status": "Due" if payment.get("scheduleType") == "DUE" else "Pending"
                            })
                
                # If API returned no payments or failed to parse, generate demo data
                if not schedule_data["payments"] and loan_id == "AA25073599N9":
                    # Generate the demo payment schedule as fallback
                    payments = []
                    base_amount = 2450.67
                    start_date = "20250414"  # April 14, 2025
                    
                    for i in range(20):
                        # Calculate date by adding i months to start date
                        year = int(start_date[0:4])
                        month = int(start_date[4:6])
                        day = int(start_date[6:8])
                        
                        month += i
                        year_offset = (month - 1) // 12
                        month = (month - 1) % 12 + 1
                        
                        payment_date = f"{year + year_offset:04d}{month:02d}{day:02d}"
                        
                        # For demonstration, slightly vary the payment amount
                        variation = (i * 0.5) if i < 10 else (10 * 0.5)
                        payment_amount = base_amount - variation
                        
                        payments.append({
                            "paymentNumber": i + 1,
                            "dueDate": payment_date,
                            "totalAmount": payment_amount,
                            "principal": payment_amount * 0.75,
                            "interest": payment_amount * 0.25,
                            "status": "Pending" if i > 0 else "Due"
                        })
                    
                    schedule_data["payments"] = payments
                    schedule_data["remainingPayments"] = 109 - 1
                    schedule_data["nextPaymentDate"] = start_date
                
                return jsonify(schedule_data)
                
            except (ValueError, KeyError) as e:
                # Error parsing the API response
                error_info = {"message": f"Error parsing API response: {str(e)}", "status": 500}
                track_api_call(uri, "GET", error=error_info)
                print(f"ERROR: {error_info['message']}")
                
                # Generate fallback data
                if loan_id == "AA25073599N9":
                    return generate_fallback_schedule(loan_id)
                else:
                    return jsonify({"error": "Loan not found"}), 404
        else:
            # API call failed with non-200 status
            error_info = {
                "message": f"API returned non-200 status: {response.status_code}",
                "status": response.status_code,
                "response": response.text
            }
            track_api_call(uri, "GET", error=error_info)
            print(f"ERROR: {error_info['message']}")
            
            # Generate fallback data
            if loan_id == "AA25073599N9":
                return generate_fallback_schedule(loan_id)
            else:
                return jsonify({"error": "Loan not found"}), 404
    
    except requests.exceptions.RequestException as e:
        # Network error, timeout, etc.
        error_info = {"message": f"Request failed: {str(e)}", "status": 500}
        track_api_call(uri, "GET", error=error_info)
        print(f"ERROR: {error_info['message']}")
        
        # Generate fallback data
        if loan_id == "AA25073599N9":
            return generate_fallback_schedule(loan_id)
        else:
            return jsonify({"error": "Loan not found"}), 404

def generate_fallback_schedule(loan_id):
    """Helper function to generate fallback schedule data for demo purposes"""
    payments = []
    base_amount = 2450.67
    start_date = "20250414"  # April 14, 2025
    
    for i in range(20):
        # Calculate date by adding i months to start date
        year = int(start_date[0:4])
        month = int(start_date[4:6])
        day = int(start_date[6:8])
        
        month += i
        year_offset = (month - 1) // 12
        month = (month - 1) % 12 + 1
        
        payment_date = f"{year + year_offset:04d}{month:02d}{day:02d}"
        
        # For demonstration, slightly vary the payment amount
        variation = (i * 0.5) if i < 10 else (10 * 0.5)
        payment_amount = base_amount - variation
        
        payments.append({
            "paymentNumber": i + 1,
            "dueDate": payment_date,
            "totalAmount": payment_amount,
            "principal": payment_amount * 0.75,
            "interest": payment_amount * 0.25,
            "status": "Pending" if i > 0 else "Due"
        })
    
    return jsonify({
        "loanId": loan_id,
        "currency": "USD",
        "remainingPayments": 109 - 1,  # Term was 109M, minus first payment
        "nextPaymentDate": start_date,
        "payments": payments
    })

# --- Branch App API Endpoints ---
# These will also need to be connected to live backend services.

@main_bp.route('/api/branch/customers')
def get_branch_customers():
    """Provides a list of all customers for the branch app."""
    try:
        # URL for the specified API endpoint
        api_url = "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties?dateOfBirth=1986-10-09"
        
        # Make the actual API call
        response = requests.get(
            api_url,
            headers={"Accept": "application/json"}
        )
        
        if response.status_code == 200:
            response_data = response.json()
            parties = response_data.get('parties', [])
            
            # Format the parties data for the branch app
            customers = []
            
            # Add the default hardcoded customer if it's not already in the list
            default_customer = {
                "customerId": "2513655771", 
                "firstName": "David",
                "lastName": "Jones",
                "dateOfBirth": "1985-03-21",
                "status": "Active"
            }
            customers.append(default_customer)
            
            # Also check for a party ID from the mobile app params
            mobile_party_id = request.args.get('mobilePartyId')
            if mobile_party_id and mobile_party_id != default_customer["customerId"]:
                # Add the mobile party ID as a customer if it's different
                print(f"Adding mobile party ID to customer list: {mobile_party_id}")
                mobile_customer = {
                    "customerId": mobile_party_id,
                    "firstName": "Customer",
                    "lastName": f"ID: {mobile_party_id}",
                    "dateOfBirth": "",
                    "status": "Active"
                }
                customers.append(mobile_customer)
            
            # Add parties from the API
            for party in parties:
                customer = {
                    "customerId": party.get('partyId', ''),
                    "firstName": party.get('firstName', ''),
                    "lastName": party.get('lastName', ''),
                    "dateOfBirth": party.get('dateOfBirth', ''),
                    "status": "Active"  # Default status
                }
                # Only add if not the same as current customer
                if customer["customerId"] != default_customer["customerId"] and (not mobile_party_id or customer["customerId"] != mobile_party_id):
                    customers.append(customer)
            
            # Track the successful API call
            track_api_call(api_url, "GET", response={"customerCount": len(customers)})
            
            return jsonify(customers)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch parties: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            # Check for mobile party ID even if API fails
            mobile_party_id = request.args.get('mobilePartyId')
            if mobile_party_id and mobile_party_id != "2513655771":
                return jsonify([
                    {
                        "customerId": "2513655771", 
                        "firstName": "David",
                        "lastName": "Jones",
                        "dateOfBirth": "1985-03-21",
                        "status": "Active"
                    },
                    {
                        "customerId": mobile_party_id,
                        "firstName": "Customer",
                        "lastName": f"ID: {mobile_party_id}",
                        "dateOfBirth": "",
                        "status": "Active"
                    }
                ])
            
            # Return hardcoded customer as fallback
            return jsonify([{
                "customerId": "2513655771", 
                "firstName": "David",
                "lastName": "Jones",
                "dateOfBirth": "1985-03-21",
                "status": "Active"
            }])
    except Exception as e:
        print(f"ERROR: Failed to fetch parties: {str(e)}")
        
        # Check for mobile party ID even if exception occurs
        mobile_party_id = request.args.get('mobilePartyId')
        if mobile_party_id and mobile_party_id != "2513655771":
            return jsonify([
                {
                    "customerId": "2513655771", 
                    "firstName": "David",
                    "lastName": "Jones",
                    "dateOfBirth": "1985-03-21",
                    "status": "Active"
                },
                {
                    "customerId": mobile_party_id,
                    "firstName": "Customer",
                    "lastName": f"ID: {mobile_party_id}",
                    "dateOfBirth": "",
                    "status": "Active"
                }
            ])
        
        # Return hardcoded customer as fallback
        return jsonify([{
            "customerId": "2513655771", 
            "firstName": "David",
            "lastName": "Jones",
            "dateOfBirth": "1985-03-21",
            "status": "Active"
        }])

@main_bp.route('/api/branch/customers/<string:customer_id>')
def get_branch_customer_details(customer_id):
    """Provides detailed information for a specific customer."""
    try:
        # Try to get data from API for all customers
        api_url = f"{PARTY_API_BASE_URI}/{customer_id}"
        
        response = requests.get(
            api_url,
            headers={"Accept": "application/json"}
        )
        
        if response.status_code == 200:
            party_data = response.json()
            
            # Track the successful API call
            track_api_call(api_url, "GET", response=party_data)
            
            # Create customer details object with fields from real API
            customer_details = {
                "customerId": party_data.get('partyId', customer_id),
                "firstName": party_data.get('firstName', ''),
                "lastName": party_data.get('lastName', ''),
                "dateOfBirth": party_data.get('dateOfBirth', ''),
                "cityOfBirth": party_data.get('cityOfBirth', ''),
                "middleName": party_data.get('middleName', ''),
                "nationality": "US"  # Default nationality to US
            }
            
            # Add stubbed contact info
            if customer_id == "2513655771":
                # Use David Jones for email
                customer_details["firstName"] = "David"
                customer_details["lastName"] = "Jones"
                customer_details["primaryEmail"] = "david.jones@example.com"
                customer_details["mobilePhone"] = "+1 555-123-4567"
                customer_details["homePhone"] = "+1 555-765-4321"
            else:
                customer_details["primaryEmail"] = "customer@example.com"
                customer_details["mobilePhone"] = "+1 555-000-0000"
                customer_details["homePhone"] = "+1 555-000-0001"
                
            return jsonify(customer_details)
        else:
            # If API call fails, return a generic customer with the requested ID
            error = {"status": response.status_code, "message": f"Failed to fetch customer details: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            return jsonify({
                "customerId": customer_id,
                "firstName": "David" if customer_id == "2513655771" else "Unknown",
                "lastName": "Jones" if customer_id == "2513655771" else "Customer",
                "dateOfBirth": "N/A",
                "nationality": "US"
            })
    except Exception as e:
        print(f"ERROR: Failed to fetch customer details for {customer_id}: {str(e)}")
        return jsonify({
            "customerId": customer_id,
            "firstName": "David" if customer_id == "2513655771" else "Unknown",
            "lastName": "Jones" if customer_id == "2513655771" else "Customer",
            "dateOfBirth": "N/A",
            "nationality": "US"
        })

@main_bp.route('/api/branch/customers/<string:customer_id>/accounts')
def get_branch_customer_accounts(customer_id):
    """Provides accounts associated with a specific customer."""
    try:
        # Fetch real loan data from the arrangements API
        loan_api_url = f"http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v7.0.0/holdings/customers/{customer_id}/arrangements"
        
        print(f"Fetching real loan data for customer {customer_id}")
        
        # Make the actual API call
        loan_response = requests.get(
            loan_api_url,
            headers={"Accept": "application/json"}
        )
        
        # Track the API call
        track_api_call(loan_api_url, "GET", 
                       response=loan_response.json() if loan_response.status_code == 200 else None,
                       error={"status": loan_response.status_code, "message": loan_response.text} if loan_response.status_code != 200 else None)
        
        accounts = []
        
        # Process the response
        if loan_response.status_code == 200:
            loan_data = loan_response.json()
            
            # Extract loan data from the arrangements response
            if isinstance(loan_data, dict) and 'body' in loan_data:
                current_date = datetime.datetime.now().strftime("%Y-%m-%d")
                
                for arrangement in loan_data['body']:
                    product_lines = arrangement.get('productLines', [])
                    for product_line in product_lines:
                        if product_line.get('productLine') == 'Lending':
                            product_groups = product_line.get('productGroupIds', [])
                            for product_group in product_groups:
                                loan_id = product_group.get('arrangementId', '')
                                loan_account = {
                                    "accountId": loan_id,
                                    "displayName": product_group.get('productGroupId', 'Home Mortgage'),
                                    "productName": product_group.get('productGroupId', 'MORTGAGE.PRODUCT'),
                                    "type": "loan",
                                    "status": "active",
                                    "currency": "USD",
                                    "principalAmount": 225351.00,  # From mobile data
                                    "remainingBalance": 225351.00, # From mobile data
                                    "interestRate": 1.75,
                                    "nextPaymentDate": current_date,
                                    "nextPaymentAmount": 2450.67,
                                    "openDate": "2020-04-01",
                                    "maturityDate": "2050-04-01"
                                }
                                accounts.append(loan_account)
        
        # Log the API call
        track_api_call(
            f"/api/branch/customers/{customer_id}/accounts", 
            "GET", 
            response={"accountCount": len(accounts)}
        )
        
        return jsonify(accounts)
    except Exception as e:
        print(f"ERROR: Failed to get accounts for customer {customer_id}: {str(e)}")
        return jsonify([])

@main_bp.route('/api/branch/accounts/<string:account_id>/transactions')
def get_branch_account_transactions(account_id):
    """Provides transactions for a specific account (branch context)."""
    try:
        account_type = account_id.split('-')[-1]  # Extract the account type suffix
        
        # Generate deterministic but realistic sample transactions
        transactions = []
        
        # Current date for reference
        today = datetime.datetime.now()
        
        # Generate transactions for the past 30 days
        for i in range(30):
            # Date for this transaction (going backward from today)
            trans_date = today - datetime.timedelta(days=i)
            date_str = trans_date.strftime("%Y-%m-%d")
            
            # Generate different transaction types based on account type
            if account_type == "CHK":
                # Checking account - mix of deposits, withdrawals, payments
                if i % 7 == 0:  # Weekly salary deposit
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "DIRECT DEPOSIT - EMPLOYER PAYROLL",
                        "amount": 2145.78,
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "deposit"
                    })
                elif i % 5 == 0:  # Regular bills
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "AUTOPAY - UTILITY BILL",
                        "amount": -142.57,
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "payment"
                    })
                elif i % 3 == 0:  # Grocery shopping
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "POS PURCHASE - GROCERY STORE",
                        "amount": -87.45,
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "purchase"
                    })
                else:  # Other random transactions
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "DEBIT CARD PURCHASE - RETAIL",
                        "amount": -(25 + (i % 10) * 5.5),
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "purchase"
                    })
            
            elif account_type == "SAV":
                # Savings account - mostly deposits and interest
                if i % 10 == 0:
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "TRANSFER FROM CHECKING",
                        "amount": 500.00,
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "transfer"
                    })
                elif i == 1:  # Monthly interest
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "INTEREST PAYMENT",
                        "amount": 21.35,
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "interest"
                    })
            
            elif account_type == "LOAN":
                # Loan account - monthly payments
                if i % 30 == 0:
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "MONTHLY PAYMENT",
                        "amount": -1573.25,
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "payment"
                    })
            
            elif account_type == "CC":
                # Credit card - various purchases and payments
                if i % 15 == 0:  # Bi-weekly payment
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "PAYMENT - THANK YOU",
                        "amount": 1500.00,
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "payment"
                    })
                elif i % 2 == 0:  # Frequent purchases
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "PURCHASE - ONLINE RETAILER",
                        "amount": -(30 + (i % 15) * 4.5),
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "purchase"
                    })
                elif i % 7 == 3:  # Weekly dining
                    transactions.append({
                        "transactionId": f"T{account_id}-{i}",
                        "description": "RESTAURANT PURCHASE",
                        "amount": -(50 + (i % 5) * 10),
                        "currency": "USD",
                        "bookingDate": date_str,
                        "valueDate": date_str,
                        "type": "purchase"
                    })
        
        # Sort transactions by date (newest first)
        transactions.sort(key=lambda x: x["bookingDate"], reverse=True)
        
        # Log the API call
        track_api_call(
            f"/api/branch/accounts/{account_id}/transactions", 
            "GET", 
            response={"transactionCount": len(transactions)}
        )
        
        return jsonify(transactions)
    except Exception as e:
        print(f"ERROR: Failed to generate transactions for account {account_id}: {str(e)}")
        return jsonify([])

@main_bp.route('/api/branch/loans/<string:loan_id>/details')
def get_branch_loan_details(loan_id):
    """Provides detailed information for a specific loan in the branch app."""
    try:
        # Use the same loan status API as the mobile app
        api_url = LOAN_STATUS_API_URI_TEMPLATE.format(loan_id=loan_id)
        
        print(f"Fetching loan details for loan ID {loan_id}")
        
        # Make the API call
        response = requests.get(
            api_url,
            headers={"Accept": "application/json"}
        )
        
        if response.status_code == 200:
            loan_data = response.json()
            
            # Track the successful API call
            track_api_call(api_url, "GET", response=loan_data)
            
            # Return the loan details
            return jsonify(loan_data)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch loan details: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            # Return fallback data instead of error
            return generate_branch_fallback_loan_details(loan_id)
    except Exception as e:
        print(f"ERROR: Failed to fetch loan details for {loan_id}: {str(e)}")
        # Return fallback data instead of error
        return generate_branch_fallback_loan_details(loan_id)

def generate_branch_fallback_loan_details(loan_id):
    """Generate fallback loan details in the expected format"""
    return jsonify({
        "id": loan_id,
        "productDisplayName": "Personal Loan",
        "status": {
            "state": "Active",
            "currentBalance": 225351.0,
            "nextPaymentDue": {
                "dueDate": "2025-04-14",
                "totalAmount": 2450.67,
                "principalAmount": 1837.5,
                "interestAmount": 613.17
            },
            "paymentsMade": 0,
            "paymentsRemaining": 120,
            "paidToDate": 0,
            "lastPaymentDate": ""
        },
        "loanInformation": {
            "startDate": "2025-03-15",
            "maturityDate": "2035-03-15",
            "originalPrincipal": 225351.0,
            "interestRate": 3.25,
            "term": 120,
            "termUnit": "Months",
            "paymentFrequency": "Monthly"
        }
    })

@main_bp.route('/api/branch/loans/<string:loan_id>/schedules')
def get_branch_loan_schedules(loan_id):
    """Provides payment schedules for a specific loan in the branch app."""
    try:
        # Use the same loan schedules API as the mobile app
        api_url = LOAN_SCHEDULES_API_URI_TEMPLATE.format(loan_id=loan_id)
        
        print(f"Fetching loan schedules for loan ID {loan_id}")
        
        # Make the API call
        response = requests.get(
            api_url,
            headers={"Accept": "application/json"}
        )
        
        if response.status_code == 200:
            schedules_data = response.json()
            
            # Track the successful API call
            track_api_call(api_url, "GET", response=schedules_data)
            
            # Format the data in a way expected by the frontend
            formatted_data = {
                "loanId": loan_id,
                "currency": "USD",
                "schedules": []
            }
            
            # Check if response has expected structure
            if isinstance(schedules_data, dict) and 'body' in schedules_data:
                # Create a schedule object with schedule items
                schedule = {
                    "id": loan_id,
                    "scheduleItems": []
                }
                
                # Format each payment in the response
                for payment in schedules_data['body']:
                    payment_date = payment.get('paymentDate', '')
                    schedule_item = {
                        "dueDate": payment_date,
                        "totalAmount": float(payment.get('totalAmount', 0)),
                        "principalAmount": float(payment.get('principalAmount', 0)),
                        "interestAmount": float(payment.get('interestAmount', 0)),
                        "outstandingPrincipal": 0, # Not provided in the API
                        "status": payment.get('scheduleType', 'FUTURE')
                    }
                    schedule["scheduleItems"].append(schedule_item)
                
                formatted_data["schedules"].append(schedule)
            
            return jsonify(formatted_data)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch loan schedules: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            # Create fallback schedule data
            return generate_branch_fallback_schedule(loan_id)
    except Exception as e:
        print(f"ERROR: Failed to fetch loan schedules for {loan_id}: {str(e)}")
        
        # Return fallback schedule
        return generate_branch_fallback_schedule(loan_id)

def generate_branch_fallback_schedule(loan_id):
    """Generate a fallback schedule for branch app in the expected format"""
    # Create a schedule with some sample payments
    payments = []
    base_amount = 2450.67
    start_date = "2025-04-14"  # April 14, 2025
    
    for i in range(20):
        # Calculate date by adding i months to start date
        from datetime import datetime, timedelta
        payment_date = datetime.strptime(start_date, "%Y-%m-%d")
        payment_date = payment_date.replace(month=((payment_date.month - 1 + i) % 12) + 1)
        payment_date = payment_date.replace(year=payment_date.year + ((payment_date.month - 1 + i) // 12))
        payment_date_str = payment_date.strftime("%Y-%m-%d")
        
        # For demonstration, slightly vary the payment amount
        variation = (i * 0.5) if i < 10 else (10 * 0.5)
        payment_amount = base_amount - variation
        principal_amount = payment_amount * 0.75
        interest_amount = payment_amount * 0.25
        
        payments.append({
            "dueDate": payment_date_str,
            "totalAmount": payment_amount,
            "principalAmount": principal_amount,
            "interestAmount": interest_amount,
            "outstandingPrincipal": 225351.0 - (i * principal_amount),
            "status": "PAID" if i == 0 else "FUTURE"
        })
    
    # Return in a format compatible with the frontend
    return jsonify({
        "loanId": loan_id,
        "currency": "USD",
        "schedules": [{
            "id": loan_id,
            "scheduleItems": payments
        }]
    })

# --- Assistant Tab API ---
@main_bp.route('/assistant/query', methods=['POST'])
def assistant_query():
    # Simulate asking the RAG model
    data = request.get_json()
    user_query = data.get('query')
    print(f"INFO: Assistant query received: {user_query}")
    # In real app, interact with RAG model
    return jsonify({"answer": "<p><strong>Assistant Response (Stub):</strong> The backend services for customer and account data are being connected. Stub data has been removed.</p>"})

# --- Event Publishing (Conceptual - to be replaced by actual Kafka/Event Hub integration) ---
# This is a placeholder to illustrate where event publishing would occur.
# The actual implementation will involve sending events to Kafka/Event Hub.

def publish_event_to_headless(event_data):
    """
    Placeholder for publishing an event. 
    In a real system, this would send to Kafka/Event Hub.
    The Headless tab's event viewer would consume from there.
    """
    print(f"EVENT PUBLISHED (Conceptual): {event_data}")
    # This function is not actively called by routes anymore as direct saving to Headless stub is removed.
    # The Headless tab will need its own consumer.
    pass

# Add other API endpoints here as needed by tab-specific JS, e.g.:
# @main_bp.route('/api/mobile/some_data')
# def get_mobile_data(): ...

# @main_bp.route('/api/branch/search', methods=['POST'])
# def search_branch_customer(): ...

# @main_bp.route('/api/assistant/query', methods=['POST'])
# def query_assistant(): ...

# --- Cleanup Old/Unused Routes ---
# Remove the old HTMX-based mobile routes if they exist

# Remove these if they are still present from previous steps:
# @main_bp.route('/mobile/transactions', methods=['GET'])
# def mobile_transactions(): ...
# @main_bp.route('/mobile/account/details/<account_id>')
# def mobile_account_details(account_id): ...
# @main_bp.route('/mobile/transactions/<account_id>')
# def mobile_transactions_specific(account_id): ...

@main_bp.route('/branch/customer/search', methods=['POST'])
def branch_customer_search():
    # Simulate searching for a customer
    # In real app, use request.form.get('customer_id')
    return "<p><strong>Customer Found (Stub):</strong><br>Name: John Doe<br>ID: cust999</p>"

@main_bp.route('/branch/activity/recent')
def branch_recent_activity():
    # Simulate fetching recent branch activity
    return "<ul><li>User 'branch_user1' logged in.</li><li>Customer search performed for ID 'cust999'.</li><li>Account details viewed for 'cust999'.</li></ul>"

@main_bp.route('/api/mobile/party/<string:party_id>/arrangements')
def get_mobile_party_arrangements(party_id):
    """Provides all arrangements for a specific party on the mobile app."""
    uri = PARTY_ARRANGEMENTS_API_URI_TEMPLATE.format(party_id=party_id)
    
    print(f"Making real API call to fetch arrangements for party: {party_id}")
    
    try:
        # Make the actual API call
        response = requests.get(
            uri,
            headers={"Accept": "application/json"}
        )
        
        # Process the response
        if response.status_code == 200:
            try:
                response_data = response.json()
                
                # Track the successful API call
                track_api_call(uri, "GET", response=response_data)
                
                return jsonify(response_data)
            except json.JSONDecodeError:
                error_msg = {"status": response.status_code, "message": "Failed to decode API response"}
                track_api_call(uri, "GET", error=error_msg)
                return jsonify({"error": "Failed to decode API response"}), 500
        else:
            error_msg = {"status": response.status_code, "message": f"API Error: {response.text}"}
            track_api_call(uri, "GET", error=error_msg)
            return jsonify({"error": f"API Error: {response.status_code}"}), response.status_code
    except requests.exceptions.RequestException as e:
        error_msg = {"status": 500, "message": str(e)}
        track_api_call(uri, "GET", error=error_msg)
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/mobile/accounts/<string:account_id>/balances')
def get_mobile_account_balances(account_id):
    """Provides balance details for a specific account for the mobile app."""
    uri = ACCOUNT_BALANCE_API_URI_TEMPLATE.format(account_reference=account_id)
    
    print(f"Making real API call to fetch balance for account: {account_id}")
    
    try:
        # Make the actual API call
        response = requests.get(
            uri,
            headers={"Accept": "application/json"}
        )
        
        # Process the response
        if response.status_code == 200:
            try:
                response_data = response.json()
                
                # Track the successful API call
                track_api_call(uri, "GET", response=response_data)
                
                return jsonify(response_data)
            except json.JSONDecodeError:
                error_msg = {"status": response.status_code, "message": "Failed to decode API response"}
                track_api_call(uri, "GET", error=error_msg)
                return jsonify({"error": "Failed to decode API response"}), 500
        else:
            error_msg = {"status": response.status_code, "message": f"API Error: {response.text}"}
            track_api_call(uri, "GET", error=error_msg)
            return jsonify({"error": f"API Error: {response.status_code}"}), response.status_code
    except requests.exceptions.RequestException as e:
        error_msg = {"status": 500, "message": str(e)}
        track_api_call(uri, "GET", error=error_msg)
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/branch/party/<string:party_id>/arrangements')
def get_branch_party_arrangements(party_id):
    """Provides all arrangements for a specific party on the branch app."""
    uri = PARTY_ARRANGEMENTS_API_URI_TEMPLATE.format(party_id=party_id)
    
    print(f"Making real API call to fetch arrangements for party: {party_id}")
    
    try:
        # Make the actual API call
        response = requests.get(
            uri,
            headers={"Accept": "application/json"}
        )
        
        # Process the response
        if response.status_code == 200:
            try:
                response_data = response.json()
                
                # Track the successful API call
                track_api_call(uri, "GET", response=response_data)
                
                return jsonify(response_data)
            except json.JSONDecodeError:
                error_msg = {"status": response.status_code, "message": "Failed to decode API response"}
                track_api_call(uri, "GET", error=error_msg)
                return jsonify({"error": "Failed to decode API response"}), 500
        else:
            error_msg = {"status": response.status_code, "message": f"API Error: {response.text}"}
            track_api_call(uri, "GET", error=error_msg)
            return jsonify({"error": f"API Error: {response.status_code}"}), response.status_code
    except requests.exceptions.RequestException as e:
        error_msg = {"status": 500, "message": str(e)}
        track_api_call(uri, "GET", error=error_msg)
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/branch/accounts/<string:account_id>/balances')
def get_branch_account_balances(account_id):
    """Provides balance details for a specific account for the branch app."""
    uri = ACCOUNT_BALANCE_API_URI_TEMPLATE.format(account_reference=account_id)
    
    print(f"Making real API call to fetch balance for account: {account_id}")
    
    try:
        # Make the actual API call
        response = requests.get(
            uri,
            headers={"Accept": "application/json"}
        )
        
        # Process the response
        if response.status_code == 200:
            try:
                response_data = response.json()
                
                # Track the successful API call
                track_api_call(uri, "GET", response=response_data)
                
                return jsonify(response_data)
            except json.JSONDecodeError:
                error_msg = {"status": response.status_code, "message": "Failed to decode API response"}
                track_api_call(uri, "GET", error=error_msg)
                return jsonify({"error": "Failed to decode API response"}), 500
        else:
            error_msg = {"status": response.status_code, "message": f"API Error: {response.text}"}
            track_api_call(uri, "GET", error=error_msg)
            return jsonify({"error": f"API Error: {response.status_code}"}), response.status_code
    except requests.exceptions.RequestException as e:
        error_msg = {"status": 500, "message": str(e)}
        track_api_call(uri, "GET", error=error_msg)
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/branch/loans/<string:loan_id>/balances')
def get_branch_loan_balances(loan_id):
    """Provides balance details for a specific loan in the branch app."""
    try:
        # Use the loan balances API to get detailed information
        api_url = LOAN_BALANCES_API_URI_TEMPLATE.format(arrangement_id=loan_id)
        
        print(f"Fetching loan balances for loan ID {loan_id} from {api_url}")
        
        # Make the API call
        response = requests.get(
            api_url,
            headers={"Accept": "application/json"}
        )
        
        if response.status_code == 200:
            loan_balances = response.json()
            
            # Track the successful API call
            track_api_call(api_url, "GET", response=loan_balances)
            
            # Return the loan balances
            return jsonify(loan_balances)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch loan balances: {response.text}"}
            track_api_call(api_url, "GET", error=error)
            
            # Return empty response with error code
            return jsonify({"error": f"Failed to fetch loan balances: {response.status_code}"}), response.status_code
    except Exception as e:
        print(f"ERROR: Failed to fetch loan balances for {loan_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

def get_kafka_consumer():
    """Create and return a configured Kafka consumer"""
    # Explicitly load .env here for debugging
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env') # Assumes .env is in project root
    load_dotenv(dotenv_path=dotenv_path)
    print(f"Attempting to load .env from: {dotenv_path}")

    # For Azure Event Hubs Kafka endpoint
    bootstrap_servers = os.getenv("BOOTSTRAP_SERVERS")
    connection_string = os.getenv("CONNECTION_STRING")
    
    # Debug prints
    print(f"DEBUG: BOOTSTRAP_SERVERS from env: {bootstrap_servers}")
    if connection_string:
        print(f"DEBUG: CONNECTION_STRING from env: loaded, length {len(connection_string)}, first 5 chars: {connection_string[:5]}...")
    else:
        print("DEBUG: CONNECTION_STRING from env: NOT LOADED or EMPTY")

    sasl_username = "$ConnectionString"
    sasl_password = connection_string
    
    # Configure Kafka consumer
    conf = {
        'bootstrap.servers': bootstrap_servers,
        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'PLAIN',
        'sasl.username': sasl_username,
        'sasl.password': sasl_password,
        'group.id': f'headlessv2-{int(time.time())}',  # Unique group ID
        'auto.offset.reset': 'earliest',
        'client.id': 'headlessv2-client',
        'enable.auto.commit': True,
        'auto.commit.interval.ms': 5000
    }
    
    return Consumer(conf)

def format_kafka_event(msg):
    """Format a Kafka message as a JSON object"""
    result = {}
    
    # Add metadata
    result["topic"] = msg.topic()
    result["partition"] = msg.partition()
    result["offset"] = msg.offset()
    
    # Add timestamp if available
    if msg.timestamp()[0] != 0:  # 0 means no timestamp
        result["timestamp"] = datetime.datetime.fromtimestamp(msg.timestamp()[1]/1000).strftime('%Y-%m-%d %H:%M:%S')
    else:
        result["timestamp"] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Add key if available
    if msg.key():
        try:
            result["key"] = msg.key().decode('utf-8')
        except:
            result["key"] = str(msg.key())
    
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

@main_bp.route('/api/headless-v2/events/<domain>')
def stream_events(domain):
    """Stream Kafka events for a specific domain using Server-Sent Events (SSE)"""
    if domain not in KAFKA_TOPICS:
        return jsonify({"error": f"Unknown domain: {domain}"}), 400
    
    topic_name = KAFKA_TOPICS[domain]
    
    def event_stream():
        consumer = None
        try:
            # Send initial message
            yield f"data: {json.dumps({'type': 'info', 'message': f'Connecting to {topic_name}...' })}\n\n"
            
            # Special handling for party domain due to performance issues
            if domain == 'party':
                yield f"data: {json.dumps({'type': 'info', 'message': 'Connected to party events (simplified mode)' })}\n\n"
                
                # Just provide status without attempting to load history for party domain
                yield f"data: {json.dumps({'type': 'info', 'message': 'Looking for recent events...' })}\n\n"
                yield f"data: {json.dumps({'type': 'info', 'message': 'Using optimized streaming (skipping history)' })}\n\n"
                
                # Create consumer without loading history
                consumer = get_kafka_consumer()
                
                # Assign to topic (only partition 0 for party to reduce load)
                try:
                    consumer.assign([TopicPartition(topic_name, 0)])
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Error assigning to partition: {str(e)}' })}\n\n"
                    return
                
                # Skip to end of partition to only get new messages
                try:
                    consumer.seek_to_end(TopicPartition(topic_name, 0))
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Error seeking to end: {str(e)}' })}\n\n"
                
                # Now continuously stream new events
                yield f"data: {json.dumps({'type': 'info', 'message': 'Listening for new events...' })}\n\n"
                
                # Just stream new messages
                start_time = time.time()
                while True:
                    msg = consumer.poll(timeout=0.2)
                    
                    if msg is None:
                        # Send a ping every 10 seconds to keep the connection alive
                        if time.time() - start_time > 10:
                            yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                            start_time = time.time()
                        continue
                    
                    if msg.error():
                        if msg.error().code() == KafkaException._PARTITION_EOF:
                            continue
                        yield f"data: {json.dumps({'type': 'error', 'message': f'Consumer error: {msg.error()}' })}\n\n"
                        break
                    
                    # Format and send the message
                    formatted_event = format_kafka_event(msg)
                    yield f"data: {json.dumps({'type': 'event', 'data': formatted_event })}\n\n"
            
            # Standard implementation for other domains
            else:
                # Create consumer
                consumer = get_kafka_consumer()
                
                # Get topic metadata to determine partitions
                metadata = consumer.list_topics(topic_name, timeout=5)
                
                if topic_name not in metadata.topics:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Topic {topic_name} not found' })}\n\n"
                    return
                
                topic_metadata = metadata.topics[topic_name]
                partitions = len(topic_metadata.partitions)
                
                yield f"data: {json.dumps({'type': 'info', 'message': f'Connected to {topic_name} with {partitions} partitions' })}\n\n"
                
                # Assign to all partitions of the topic
                partition_objects = [TopicPartition(topic_name, i) for i in range(partitions)]
                consumer.assign(partition_objects)
                
                # Set a limit for initial messages
                buffer_size = 5
                initial_timeout = 5  # seconds
                
                # First, try to get the last few messages
                all_initial_messages = [] # Collect all messages polled initially
                
                # Collect initial messages for a brief timeout
                start_time = time.time()
                
                yield f"data: {json.dumps({'type': 'info', 'message': 'Looking for recent events...' })}\n\n"
                
                while time.time() - start_time < initial_timeout:
                    msg = consumer.poll(timeout=0.2)
                    
                    if msg is None:
                        continue
                    
                    if msg.error():
                        if msg.error().code() == KafkaException._PARTITION_EOF:
                            continue
                        yield f"data: {json.dumps({'type': 'error', 'message': f'Consumer error: {msg.error()}' })}\n\n"
                        break
                    
                    all_initial_messages.append(msg) # Collect all messages
                
                # Report on found messages
                if all_initial_messages:
                    messages_to_send = []
                    if domain == 'deposits':
                        # Sort by offset ASCENDING for deposits, take the tail (highest offsets)
                        all_initial_messages.sort(key=lambda m: m.offset())
                        messages_to_send = all_initial_messages[-buffer_size:]
                        yield f"data: {json.dumps({'type': 'info', 'message': f'Found {len(messages_to_send)} recent DEPOSITS events (sorted by offset, from {len(all_initial_messages)} polled)' })}\n\n"
                    else: # For lending (and any other future non-party domains)
                        # Sort ALL collected messages by Kafka timestamp in descending order
                        # Treat messages with no valid timestamp as very old (-1)
                        all_initial_messages.sort(
                            key=lambda m: m.timestamp()[1] if m.timestamp() and m.timestamp()[0] != 0 else -1,
                            reverse=True
                        )
                        # Take the top 'buffer_size' messages (newest by timestamp)
                        messages_to_send = all_initial_messages[:buffer_size]
                        yield f"data: {json.dumps({'type': 'info', 'message': f'Found {len(messages_to_send)} recent events (sorted by timestamp, from {len(all_initial_messages)} polled)' })}\n\n"
                    
                    # Send the selected & sorted messages
                    for msg_to_send in messages_to_send:
                        formatted_event = format_kafka_event(msg_to_send)
                        yield f"data: {json.dumps({'type': 'event', 'data': formatted_event })}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'info', 'message': 'No recent events found' })}\n\n"
                
                # Now continuously stream new events
                yield f"data: {json.dumps({'type': 'info', 'message': 'Listening for new events...' })}\n\n"
                start_time = time.time() # Reset start_time for ping timer in continuous stream
                
                # Continue polling for new messages
                last_offset = {}  # Track highest offset seen for each partition
                while True:
                    msg = consumer.poll(timeout=0.5)
                    
                    if msg is None:
                        # Send a ping every 10 seconds to keep the connection alive
                        if time.time() - start_time > 10:
                            yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                            start_time = time.time()
                        continue
                    
                    if msg.error():
                        if msg.error().code() == KafkaException._PARTITION_EOF:
                            continue
                        yield f"data: {json.dumps({'type': 'error', 'message': f'Consumer error: {msg.error()}' })}\n\n"
                        break
                    
                    # Check if we've seen this message before (for multiple partitions)
                    partition = msg.partition()
                    offset = msg.offset()
                    
                    if partition in last_offset and offset <= last_offset[partition]:
                        # Skip messages we've already processed (can happen with multiple partitions)
                        continue
                    
                    # Update last seen offset for this partition
                    last_offset[partition] = offset
                    
                    # Format and send the message IMMEDIATELY
                    formatted_event = format_kafka_event(msg)
                    yield f"data: {json.dumps({'type': 'event', 'data': formatted_event })}\n\n"
                
        except Exception as e:
            error_message = str(e)
            print(f"Error in stream_events for {domain}: {error_message}")
            yield f"data: {json.dumps({'type': 'error', 'message': error_message })}\n\n"
        finally:
            # Clean up consumer
            if consumer:
                try:
                    consumer.close()
                    print(f"Closed Kafka consumer for {domain}")
                except Exception as e:
                    print(f"Error closing Kafka consumer: {e}")
    
    return Response(event_stream(), mimetype="text/event-stream")

# --- Proxy API Routes ---
# These routes proxy requests to external APIs to avoid CORS issues

# Holdings microservice proxy routes
@main_bp.route('/api/proxy/holdings/parties/<string:party_id>/arrangements')
def proxy_holdings_party_arrangements(party_id):
    """Proxy for Holdings party arrangements endpoint"""
    # Use the same URL format as in Demoflow.py
    target_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v1.0.0/holdings/parties/{party_id}/arrangements"
    print(f"Proxying request to: {target_url}")
    
    try:
        # Log headers being sent by the proxy
        request_headers = {"Accept": "application/json"}
        print(f"Proxy request headers: {request_headers}")
        print(f"Proxy request params: {request.args}")

        response = requests.get(
            target_url,
            headers=request_headers,
            params=request.args
        )
        
        print(f"Target API response status: {response.status_code}")
        try:
            response_content = response.json()
        except json.JSONDecodeError:
            response_content = response.text
        print(f"Target API response content: {response_content}")

        # Track the API call
        track_api_call(target_url, "GET", params=dict(request.args), response=response_content if response.ok else None, error=None if response.ok else {"message": response_content, "status": response.status_code})
        
        # Return the response
        if response.ok:
            return jsonify(response_content), response.status_code
        else:
            # Ensure we return what the target API returned, even if it's not perfect JSON
            return jsonify({"error": "Proxied API call failed", "details": response_content}), response.status_code

    except requests.exceptions.RequestException as e:
        print(f"RequestException during proxy to holdings party arrangements: {str(e)}")
        track_api_call(target_url, "GET", params=dict(request.args), error={"message": str(e), "status": 500})
        return jsonify({"error": "Proxy request failed due to network or connection issue", "details": str(e)}), 500
    except Exception as e:
        # Catch any other unexpected errors
        print(f"Generic Exception during proxy to holdings party arrangements: {str(e)}")
        track_api_call(target_url, "GET", params=dict(request.args), error={"message": str(e), "status": 500})
        return jsonify({"error": "An unexpected error occurred in the proxy", "details": str(e)}), 500

@main_bp.route('/api/proxy/holdings/accounts/<string:account_id>/balances')
def proxy_holdings_account_balances(account_id):
    """Proxy for Holdings account balances endpoint"""
    # Use the same URL format as in Demoflow.py
    target_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/balances"
    print(f"Proxying request to: {target_url}")
    
    try:
        response = requests.get(
            target_url,
            headers={"Accept": "application/json"},
            params=request.args
        )
        
        # Track the API call
        track_api_call(target_url, "GET", params=dict(request.args), response=response.json() if response.ok else None)
        
        # Return the response
        return jsonify(response.json() if response.ok else {"error": response.text}), response.status_code
    except Exception as e:
        print(f"Error proxying request to holdings account balances: {str(e)}")
        track_api_call(target_url, "GET", params=dict(request.args), error={"message": str(e), "status": 500})
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/proxy/holdings/accounts/<string:account_id>/transactions')
def proxy_holdings_account_transactions(account_id):
    """Proxy for Holdings account transactions endpoint"""
    # Use the same URL format as in Demoflow.py
    target_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{account_id}/transactions"
    print(f"Proxying request to: {target_url}")
    
    try:
        response = requests.get(
            target_url,
            headers={"Accept": "application/json"},
            params=request.args
        )
        
        # Track the API call
        track_api_call(target_url, "GET", params=dict(request.args), response=response.json() if response.ok else None)
        
        # Return the response
        return jsonify(response.json() if response.ok else {"error": response.text}), response.status_code
    except Exception as e:
        print(f"Error proxying request to holdings account transactions: {str(e)}")
        track_api_call(target_url, "GET", params=dict(request.args), error={"message": str(e), "status": 500})
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/proxy/holdings/arrangements/<string:identifier>/transactions')
def proxy_holdings_arrangement_transactions(identifier):
    """Proxy for Holdings transactions endpoint, using a generic identifier that could be an accountId or arrangementId based on context."""
    # This endpoint is called by the mobile app with loan.arrangementId, 
    # which is actually the accountId (alternateId) for transaction fetching.
    target_url = f"http://modulardemo.northeurope.cloudapp.azure.com/ms-holdings-api/api/v3.0.0/holdings/accounts/{identifier}/transactions"
    print(f"Proxying holdings transactions request to: {target_url} using identifier: {identifier}")
    
    try:
        response = requests.get(
            target_url,
            headers={"Accept": "application/json"},
            params=request.args
        )
        
        # Track the API call
        track_api_call(target_url, "GET", params=dict(request.args), response=response.json() if response.ok else None)
        
        # Return the response
        return jsonify(response.json() if response.ok else {"error": response.text}), response.status_code
    except Exception as e:
        print(f"Error proxying request to holdings arrangement transactions: {str(e)}")
        track_api_call(target_url, "GET", params=dict(request.args), error={"message": str(e), "status": 500})
        return jsonify({"error": str(e)}), 500

# Lending microservice proxy routes
@main_bp.route('/api/proxy/lending/arrangements/<string:loan_id>/status')
def proxy_lending_arrangement_status(loan_id):
    """Proxy for Lending arrangement status endpoint"""
    # Use the same URL format as in Demoflow.py
    target_url = f"http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/status"
    print(f"Proxying request to: {target_url}")
    
    try:
        headers = {
            'Accept': 'application/json',
        }
        # Lending API is sensitive to unknown query params, so we pass None
        resp = requests.get(target_url, headers=headers, params=None)
        
        # Track the API call
        track_api_call(target_url, "GET", params=None, response=resp.json() if resp.ok else None, error=None if resp.ok else {"message": resp.text, "status": resp.status_code})
        
        # Return the response
        return jsonify(resp.json() if resp.ok else {"error": resp.text}), resp.status_code
    except Exception as e:
        print(f"Error proxying request to lending arrangement status: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/proxy/lending/arrangements/<string:loan_id>/schedules')
def proxy_lending_arrangement_schedules(loan_id):
    """Proxy for Lending arrangement schedules endpoint"""
    # Use the same URL format as in Demoflow.py
    target_url = f"http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/schedules"
    print(f"Proxying request to: {target_url}")
    
    try:
        headers = {
            'Accept': 'application/json',
        }
        # Lending API is sensitive to unknown query params, so we pass None
        resp = requests.get(target_url, headers=headers, params=None)
        
        # Track the API call
        track_api_call(target_url, "GET", params=None, response=resp.json() if resp.ok else None, error=None if resp.ok else {"message": resp.text, "status": resp.status_code})
        
        # Return the response
        return jsonify(resp.json() if resp.ok else {"error": resp.text}), resp.status_code
    except Exception as e:
        print(f"Error proxying request to lending arrangement schedules: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Deposits microservice proxy routes
@main_bp.route('/api/proxy/deposits/payments/debitAccount', methods=['POST'])
def proxy_deposits_debit_account():
    """Proxy for Deposits debit account endpoint"""
    # Use the same URL format as in Demoflow.py
    target_url = f"http://deposits-sandbox.northeurope.cloudapp.azure.com/irf-TBC-accounts-container/api/v1.0.0/order/payments/debitAccount"
    print(f"Proxying request to: {target_url}")
    
    try:
        payload = request.get_json()
        response = requests.post(
            target_url,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            json=payload
        )
        
        # Track the API call
        track_api_call(target_url, "POST", payload=payload, response=response.json() if response.ok else None)
        
        # Return the response
        return jsonify(response.json() if response.ok else {"error": response.text}), response.status_code
    except Exception as e:
        print(f"Error proxying request to deposits debit account: {str(e)}")
        track_api_call(target_url, "POST", payload=request.get_json(), error={"message": str(e), "status": 500})
        return jsonify({"error": str(e)}), 500 