from flask import render_template, jsonify, current_app, url_for, abort, request
from . import main_bp
import os
import datetime
import uuid
# Import the helper functions directly
# Import the helper function directly if needed within routes
from app.utils import load_stub_data, save_stub_data

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


# API Endpoints for Tab-Specific Data

@main_bp.route('/api/headless/data')
def get_headless_data():
    """Provides stub data for the Headless tab by reading the file."""
    # Read the file fresh on each request
    headless_data = load_stub_data('Headless/data.json') or {}
    api_calls = headless_data.get('api_calls', [])
    events = headless_data.get('events', [])
    # No longer using current_app.stub_data['headless_...'] here
    # api_calls = current_app.stub_data.get('headless_api_calls', [])
    # events = current_app.stub_data.get('headless_events', [])
    return jsonify({
        'api_calls': api_calls,
        'events': events
    })

@main_bp.route('/api/architecture/diagram_path')
def get_architecture_diagram_path():
    """Provides the relative path to the generated architecture diagram."""
    image_path = current_app.config.get('ARCHITECTURE_IMAGE_PATH')
    if image_path:
        # Generate the full URL path using url_for
        full_url_path = url_for('static', filename=image_path, _external=False)
        return jsonify({'diagram_url': full_url_path})
    else:
        # Return an error if the image wasn't generated
        return jsonify({'error': 'Architecture diagram not found or generation failed.'}), 500

# Add other API endpoints here as needed by tab-specific JS, e.g.:
# @main_bp.route('/api/mobile/some_data')
# def get_mobile_data(): ...

# @main_bp.route('/api/branch/search', methods=['POST'])
# def search_branch_customer(): ...

# @main_bp.route('/api/assistant/query', methods=['POST'])
# def query_assistant(): ...

# --- Mobile App API Endpoints ---

@main_bp.route('/api/mobile/accounts')
def get_mobile_accounts():
    """Provides the list of accounts for the mobile app, reading from Branch data."""
    # mobile_data = current_app.stub_data.get('mobile_data', {})
    # accounts = mobile_data.get('accounts', [])
    # return jsonify(accounts)

    # Read Branch data as the source of truth
    branch_data = load_stub_data('BranchApp/data.json') or { "accounts": {} }
    all_branch_accounts = branch_data.get('accounts', {})
    
    # For the stub, let's return accounts belonging to the first customer (CUST1001)
    # In a real app, you'd filter based on the logged-in user
    mobile_user_accounts = [
        acc for acc in all_branch_accounts.values() 
        if acc.get('customerId') == 'CUST1001'
    ]
    
    # Ensure the structure matches what the mobile JS expects
    # (Current BranchApp structure seems compatible)

    # --- Record API Call --- 
    try:
        headless_data = load_stub_data('Headless/data.json') or { "api_calls": [], "events": [] }
        api_call_record = {
            "callId": f"API{uuid.uuid4().hex[:6].upper()}",
            "timestamp": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
            "sourceTab": "MobileApp",
            "method": "GET",
            "uri": "/api/mobile/accounts",
            "requestPayload": None,
            "responsePayload": mobile_user_accounts # Record the data returned
        }
        headless_data['api_calls'].insert(0, api_call_record) 
        save_stub_data('Headless/data.json', headless_data)
    except Exception as e:
        print(f"Error recording API call in get_mobile_accounts: {e}")
    # --- End Record API Call ---

    return jsonify(mobile_user_accounts)

@main_bp.route('/api/mobile/accounts/<string:account_id>/transactions')
def get_mobile_transactions(account_id):
    """Provides transactions for a specific account, reading from Branch data."""
    # mobile_data = current_app.stub_data.get('mobile_data', {})
    # account_transactions = mobile_data.get('transactions', {}).get(account_id)
    # if account_transactions is None:
    #     accounts = mobile_data.get('accounts', [])
    #     if any(acc['accountId'] == account_id for acc in accounts):
    #          return jsonify([])
    #     else:
    #          abort(404, description=f"Account {account_id} not found.")
    # return jsonify(account_transactions)

    # Read Branch data as the source of truth
    branch_data = load_stub_data('BranchApp/data.json') or { "accounts": {}, "transactions": {} }
    all_branch_transactions = branch_data.get('transactions', {})
    account_transactions = all_branch_transactions.get(account_id)

    if account_transactions is None:
        # Check if account exists in branch data to differentiate no transactions vs bad account ID
        if account_id in branch_data.get('accounts', {}):
            return jsonify([]) # Account valid, no transactions found
        else:
            abort(404, description=f"Account {account_id} not found.")
    
    # --- Record API Call --- 
    try:
        headless_data = load_stub_data('Headless/data.json') or { "api_calls": [], "events": [] }
        api_call_record = {
            "callId": f"API{uuid.uuid4().hex[:6].upper()}",
            "timestamp": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
            "sourceTab": "MobileApp",
            "method": "GET",
            "uri": f"/api/mobile/accounts/{account_id}/transactions",
            "requestPayload": None,
            "responsePayload": account_transactions # Record the data returned
        }
        headless_data['api_calls'].insert(0, api_call_record) 
        save_stub_data('Headless/data.json', headless_data)
    except Exception as e:
        print(f"Error recording API call in get_mobile_transactions: {e}")
    # --- End Record API Call ---

    return jsonify(account_transactions)

@main_bp.route('/api/mobile/transfer', methods=['POST'])
def mobile_transfer():
    """Simulates processing a money transfer, updating balances and generating events."""
    transfer_request = request.json
    if not transfer_request or not all(k in transfer_request for k in ('from_account', 'to_account', 'amount')):
        abort(400, description="Missing required transfer data (from_account, to_account, amount).")

    from_account_id = transfer_request['from_account']
    to_account_id = transfer_request['to_account'] # Target account existence/update not simulated here
    amount = float(transfer_request['amount'])

    if amount <= 0:
        abort(400, description="Transfer amount must be positive.")

    # --- Load current state --- 
    # Use branch data as the 'source of truth' for account balances
    branch_data = load_stub_data('BranchApp/data.json') or { "customers": [], "accounts": {}, "transactions": {} }
    headless_data = load_stub_data('Headless/data.json') or { "api_calls": [], "events": [] }

    # Find the account in branch data
    account_to_debit = branch_data.get('accounts', {}).get(from_account_id)

    if not account_to_debit:
        abort(404, description=f"From account {from_account_id} not found.")

    if account_to_debit.get('type') != 'deposit':
         abort(400, description="Transfers only allowed from deposit accounts.")

    # Check sufficient funds (using available balance)
    current_available_balance = float(account_to_debit.get('availableBalance', 0))
    if current_available_balance < amount:
        abort(400, description="Insufficient available funds.")

    # --- Simulate Transaction --- 
    timestamp_iso = datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'
    transfer_id = f"TRF{uuid.uuid4().hex[:8].upper()}"

    # Calculate new balances
    previous_balance = float(account_to_debit.get('currentBalance', 0))
    new_balance = previous_balance - amount
    new_available_balance = current_available_balance - amount

    # --- Update Account Balance --- 
    account_to_debit['currentBalance'] = round(new_balance, 2)
    account_to_debit['availableBalance'] = round(new_available_balance, 2)
    # Note: branch_data dictionary is modified in place here

    # --- Generate API Call Record --- 
    api_call_record = {
        "callId": f"API{uuid.uuid4().hex[:6].upper()}",
        "timestamp": timestamp_iso,
        "sourceTab": "MobileApp", # Assuming originated from mobile
        "method": "POST",
        "uri": "/api/mobile/transfer",
        "requestPayload": transfer_request,
        "responsePayload": { # Create response structure
             "transferId": transfer_id,
             "status": "Completed", # Simulate immediate completion
             "message": "Transfer processed successfully (Stub)."
         }
    }
    # Prepend to keep latest calls at the top (optional)
    headless_data['api_calls'].insert(0, api_call_record) 

    # --- Generate Events --- 
    events_to_add = []
    event_time_base = datetime.datetime.utcnow()

    # 1. TransferInitiated
    events_to_add.append({
        "eventId": f"EVT-{transfer_id}-01",
        "timestamp": (event_time_base + datetime.timedelta(seconds=1)).isoformat(timespec='seconds') + 'Z',
        "eventType": "TransferInitiated",
        "sourceService": "PaymentsOrchestrator",
        "payload": {
            "transferId": transfer_id,
            "fromAccountId": from_account_id,
            "toAccountId": to_account_id,
            "amount": amount,
            "currency": account_to_debit.get('currency', 'USD'),
            "status": "Pending"
        }
    })

    # 2. AccountDebited
    events_to_add.append({
        "eventId": f"EVT-{transfer_id}-02",
        "timestamp": (event_time_base + datetime.timedelta(seconds=2)).isoformat(timespec='seconds') + 'Z',
        "eventType": "AccountDebited",
        "sourceService": "HoldingsService",
        "payload": {
            "accountId": from_account_id,
            "transferId": transfer_id,
            "amountDebited": -amount, # The change amount
            "currency": account_to_debit.get('currency', 'USD'),
            "previousBalance": round(previous_balance, 2),
            "newBalance": round(new_balance, 2)
        }
    })
    
    # 3. TransferCompleted (Simulate immediate completion)
    events_to_add.append({
        "eventId": f"EVT-{transfer_id}-03",
        "timestamp": (event_time_base + datetime.timedelta(seconds=3)).isoformat(timespec='seconds') + 'Z',
        "eventType": "TransferCompleted",
        "sourceService": "PaymentsOrchestrator",
        "payload": {
            "transferId": transfer_id,
            "status": "Completed",
            "completionTimestamp": (event_time_base + datetime.timedelta(seconds=3)).isoformat(timespec='seconds') + 'Z'
        }
    })

    # Prepend events to keep latest at the top
    headless_data['events'] = events_to_add + headless_data['events']

    # --- Save updated data --- 
    save_success_branch = save_stub_data('BranchApp/data.json', branch_data)
    save_success_headless = save_stub_data('Headless/data.json', headless_data)

    if not save_success_branch or not save_success_headless:
        # Handle save error - maybe log, but still return success to user for stub?
        print("Warning: Failed to save updated stub data after transfer.")

    # --- Return Response --- 
    return jsonify(api_call_record["responsePayload"])


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

@main_bp.route('/assistant/query', methods=['POST'])
def assistant_query():
    # Simulate asking the RAG model
    # In real app, use request.form.get('query') and interact with model
    return "<p><strong>Assistant Response (Stub):</strong> The Holdings Service is responsible for managing account balances and transaction history.</p>"

@main_bp.route('/branch/activity/recent')
def branch_recent_activity():
    # Simulate fetching recent branch activity
    return "<ul><li>User 'branch_user1' logged in.</li><li>Customer search performed for ID 'cust999'.</li><li>Account details viewed for 'cust999'.</li></ul>"

# --- Branch App API Endpoints ---

@main_bp.route('/api/branch/customers')
def get_branch_customers():
    """Provides a list of all customers for the branch app."""
    branch_data = current_app.stub_data.get('branch_data', {})
    customers = branch_data.get('customers', [])
    # Return only basic info for the list
    customer_list = [{
        "customerId": c.get("customerId"),
        "firstName": c.get("firstName"),
        "lastName": c.get("lastName"),
        "email": c.get("primaryEmail")
    } for c in customers]
    return jsonify(customer_list)

@main_bp.route('/api/branch/customers/<string:customer_id>')
def get_branch_customer_details(customer_id):
    """Provides detailed information for a specific customer."""
    branch_data = current_app.stub_data.get('branch_data', {})
    customers = branch_data.get('customers', [])
    customer = next((c for c in customers if c.get('customerId') == customer_id), None)
    if customer is None:
        abort(404, description=f"Customer {customer_id} not found.")

    # --- Record API Call --- 
    try:
        headless_data = load_stub_data('Headless/data.json') or { "api_calls": [], "events": [] }
        api_call_record = {
            "callId": f"API{uuid.uuid4().hex[:6].upper()}",
            "timestamp": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
            "sourceTab": "BranchApp",
            "method": "GET",
            "uri": f"/api/branch/customers/{customer_id}",
            "requestPayload": None,
            "responsePayload": customer # Record the data returned
        }
        headless_data['api_calls'].insert(0, api_call_record) 
        save_stub_data('Headless/data.json', headless_data)
    except Exception as e:
        print(f"Error recording API call in get_branch_customer_details: {e}")
    # --- End Record API Call ---

    return jsonify(customer)

@main_bp.route('/api/branch/customers/<string:customer_id>/accounts')
def get_branch_customer_accounts(customer_id):
    """Provides accounts associated with a specific customer."""
    branch_data = current_app.stub_data.get('branch_data', {})
    customers = branch_data.get('customers', [])
    customer = next((c for c in customers if c.get('customerId') == customer_id), None)
    if customer is None:
        abort(404, description=f"Customer {customer_id} not found.")
    
    customer_account_ids = customer.get('accountIds', [])
    all_accounts = branch_data.get('accounts', {})
    customer_accounts = [all_accounts[acc_id] for acc_id in customer_account_ids if acc_id in all_accounts]
    
    # --- Record API Call --- 
    try:
        headless_data = load_stub_data('Headless/data.json') or { "api_calls": [], "events": [] }
        api_call_record = {
            "callId": f"API{uuid.uuid4().hex[:6].upper()}",
            "timestamp": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
            "sourceTab": "BranchApp",
            "method": "GET",
            "uri": f"/api/branch/customers/{customer_id}/accounts",
            "requestPayload": None,
            "responsePayload": customer_accounts # Record the data returned
        }
        headless_data['api_calls'].insert(0, api_call_record) 
        save_stub_data('Headless/data.json', headless_data)
    except Exception as e:
        print(f"Error recording API call in get_branch_customer_accounts: {e}")
    # --- End Record API Call ---

    return jsonify(customer_accounts)

@main_bp.route('/api/branch/accounts/<string:account_id>/transactions')
def get_branch_account_transactions(account_id):
    """Provides transactions for a specific account (branch context)."""
    branch_data = current_app.stub_data.get('branch_data', {})
    account_transactions = branch_data.get('transactions', {}).get(account_id)
    if account_transactions is None:
         # Check if account exists at all in branch data
        if account_id in branch_data.get('accounts', {}):
             return jsonify([]) # Account valid, no transactions
        else:
             abort(404, description=f"Account {account_id} not found.")

    # --- Record API Call --- 
    try:
        headless_data = load_stub_data('Headless/data.json') or { "api_calls": [], "events": [] }
        api_call_record = {
            "callId": f"API{uuid.uuid4().hex[:6].upper()}",
            "timestamp": datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
            "sourceTab": "BranchApp",
            "method": "GET",
            "uri": f"/api/branch/accounts/{account_id}/transactions",
            "requestPayload": None,
            "responsePayload": account_transactions # Record the data returned
        }
        headless_data['api_calls'].insert(0, api_call_record) 
        save_stub_data('Headless/data.json', headless_data)
    except Exception as e:
        print(f"Error recording API call in get_branch_account_transactions: {e}")
    # --- End Record API Call ---

    return jsonify(account_transactions) 