from flask import render_template, jsonify, current_app, url_for, abort, request
from . import main_bp
import os
import datetime
import uuid
import requests
import json
from collections import deque
# from app.utils import load_stub_data, save_stub_data # No longer needed

# Store last 10 API calls for headless tab
api_calls_history = deque(maxlen=10)

# API endpoints from Demoflow.py
PARTY_API_BASE_URI = "http://modulardemo.northeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0/party/parties"
LOAN_API_BASE_URI = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/consumerLoans"
LOAN_STATUS_API_URI_TEMPLATE = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/status"
LOAN_SCHEDULES_API_URI_TEMPLATE = "http://lendings-sandbox.northeurope.cloudapp.azure.com/irf-TBC-lending-container/api/v8.0.0/holdings/loans/{loan_id}/schedules"

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
        
    if response:
        api_call["response"] = response
        api_call["status"] = 200
    
    if error:
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
    
    # Use the existing track_api_call function to record it
    api_call = track_api_call(uri, method, payload=payload, response=response)
    
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
            
            # Add the current hardcoded customer if it's not already in the list
            current_customer = {
                "customerId": "2513655771", 
                "firstName": "David",
                "lastName": "Jones",
                "dateOfBirth": "1985-03-21",
                "status": "Active"
            }
            customers.append(current_customer)
            
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
                if customer["customerId"] != current_customer["customerId"]:
                    customers.append(customer)
            
            # Track the successful API call
            track_api_call(api_url, "GET", response={"customerCount": len(customers)})
            
            return jsonify(customers)
        else:
            error = {"status": response.status_code, "message": f"Failed to fetch parties: {response.text}"}
            track_api_call(api_url, "GET", error=error)
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