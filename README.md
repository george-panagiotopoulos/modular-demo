# Modular Banking Demo User Agent

This project is a demonstration user agent (UA) for a modular banking architecture. It aims to showcase business functionality while illustrating the underlying technical architecture changes from a monolith to microservices.

## Features

The application provides a tabbed interface:

1.  **Mobile App Tab:** Simulates the customer-facing mobile banking experience (using Tailwind CSS).
    *   Displays accounts (Current, Savings, Mortgage).
    *   Allows viewing transactions for selected accounts.
    *   Includes a basic money transfer simulation.
2.  **Branch App Tab:** Simulates the desktop interface used by bank employees (using Tailwind CSS).
    *   Allows searching/selecting customers.
    *   Displays detailed customer information.
    *   Displays accounts and transactions for the selected customer.
    *   Includes a sidebar menu for potential branch operations.
3.  **Headless Tab:** Provides a technical view of backend interactions (using Tailwind CSS with a Teal theme).
    *   **API Viewer:** Shows details (method, URI, request/response payload) of the most recent API call triggered by actions in other tabs. (Currently under review as stub data is removed)
    *   **Event Viewer:** Displays platform events. This will be configured to connect to an Azure Event Hub.
4.  **Architecture Tab:** Displays a system sequence diagram generated from a PlantUML file (`SequenceDiagrams/DemoFlow.puml`).
5.  **Assistant Tab:** A stub placeholder for a future RAG model to answer questions about the architecture.

## Technology Stack

*   **Backend:** Python (Flask)
*   **Frontend:** HTML, CSS (Tailwind CSS via CDN), JavaScript
*   **Architecture Diagram:** PlantUML (requires Java to generate PNG from `SequenceDiagrams/DemoFlow.puml`)
*   **Event Streaming:** Apache Kafka (via Azure Event Hubs)

## Setup and Running

1.  **Prerequisites:**
    *   Python 3.x
    *   Java Runtime Environment (JRE) (for PlantUML generation)
2.  **Clone the repository:**
    ```bash
    git clone https://github.com/george-panagiotopoulos/modular-demo.git
    cd modular-demo
    ```
3.  **(Recommended) Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```
4.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
5.  **Place PlantUML Jar:** Ensure `plantuml-mit-1.2025.1.jar` (or the version specified in `app/__init__.py`) is located at `/Users/gpanagiotopoulos/ModularDemo/PUML/plantuml-mit-1.2025.1.jar`. Adjust the path in `app/__init__.py` if necessary.
6.  **Run the application:**
    ```bash
    python run.py
    ```
    The application will be available at `http://localhost:5001` (or `http://0.0.0.0:5001`). The first run will generate the architecture diagram image (`app/static/images/DemoFlow.png`).

## Data Persistence & Backend Interactions

*   Account balances and customer data are intended to be managed by live backend services. The test scripts in the `TestConnection` folder can be used to interact with these services.
*   API call history for the Headless tab is currently under review.
*   Event viewing in the Headless tab will connect to Azure Event Hubs.

# Modular Banking Demo Flow

This script (`Demoflow.py`) demonstrates a sequence of operations within a modular banking system. It simulates creating customers, opening accounts, processing loans, and interacting with various banking microservices. The script logs all API calls and Kafka events to an output file (`demooutput.txt`).

## Functionality

The script performs the following key actions:

1.  **Customer Creation**: Generates random customer data and creates a new customer via an API.
2.  **Party Retrieval**: Demonstrates various API calls to retrieve party (customer) information using different criteria like date of birth, last name, and party ID.
3.  **Current Account Creation**: Creates a current account for the newly created customer.
4.  **Account Balance Check**: Retrieves and logs the balance of the newly created current account.
5.  **Party Arrangements Retrieval**: Fetches all financial arrangements (like accounts, loans) associated with the customer.
6.  **Balances for All Arrangements**: Iterates through the customer's arrangements and retrieves the balance for each.
7.  **Loan Creation**: Initiates a new loan for the customer, linked to their current account.
8.  **Kafka Event Capture**: Captures and logs events from a Kafka topic (`lending-event-topic`) after loan creation.
9.  **Loan Status and Schedules**: Retrieves and logs the status and repayment schedules for the created loan.
10. **Account Transactions**: Performs a series of debit and credit transactions on the customer's current account.
11. **Holdings Microservice Interaction**:
    *   Retrieves a consolidated view of the customer's arrangements from the Holdings microservice.
    *   Fetches account balances and transaction history using account identifiers obtained from the Holdings service. This demonstrates how the Holdings service acts as an aggregator.
12. **Final Customer Arrangements Check**: Retrieves all customer arrangements again to show the final state.

Throughout the process, the script logs detailed information about each API call (URI, method, payload, response status, response body) and captured Kafka events to `demooutput.txt`.

## Setup and Installation

### Prerequisites

*   Python 3.x
*   Access to the required banking API endpoints.
*   Access to the Kafka cluster and the specified topic (`lending-event-topic`).

### Installation

1.  **Clone the repository (if applicable) or download `Demoflow.py`.**

2.  **Create a virtual environment (recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    Create a `requirements.txt` file in the same directory as `Demoflow.py` with the following content:
    ```
    requests
    python-dotenv
    confluent-kafka
    ```
    Then, install the libraries:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the same directory as `Demoflow.py`. This file will store the necessary API base URIs and Kafka connection details. Add the following variables to your `.env` file, replacing the placeholder values with your actual service endpoints:

    ```env
    PARTY_API_BASE_URI="YOUR_PARTY_API_BASE_URI"
    CURRENT_ACCOUNT_API_URI="YOUR_CURRENT_ACCOUNT_API_URI"
    ACCOUNT_BALANCE_API_URI_TEMPLATE="YOUR_ACCOUNT_BALANCE_API_URI_TEMPLATE" # e.g., http://example.com/accounts/{account_reference}/balance
    LOAN_API_BASE_URI="YOUR_LOAN_API_BASE_URI"
    LOAN_STATUS_API_URI_TEMPLATE="YOUR_LOAN_STATUS_API_URI_TEMPLATE" # e.g., http://example.com/loans/{loan_id}/status
    LOAN_SCHEDULES_API_URI_TEMPLATE="YOUR_LOAN_SCHEDULES_API_URI_TEMPLATE" # e.g., http://example.com/loans/{loan_id}/schedules
    LOAN_DISBURSEMENT_API_URI_TEMPLATE="YOUR_LOAN_DISBURSEMENT_API_URI_TEMPLATE" # e.g., http://example.com/loans/{loan_id}/disburse
    CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE="YOUR_CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE" # e.g., http://example.com/customers/{customer_id}/arrangements

    # Kafka connection details
    BOOTSTRAP_SERVERS="YOUR_KAFKA_BOOTSTRAP_SERVERS" # e.g., yourserver.servicebus.windows.net:9093
    CONNECTION_STRING="YOUR_EVENTHUB_CONNECTION_STRING_OR_SASL_PASSWORD" # For Azure Event Hubs, this is the full connection string.
    ```

    **Note on API URI Templates**:
    *   `ACCOUNT_BALANCE_API_URI_TEMPLATE` should contain `{account_reference}` where the script will substitute the actual account reference.
    *   `LOAN_STATUS_API_URI_TEMPLATE`, `LOAN_SCHEDULES_API_URI_TEMPLATE`, and `LOAN_DISBURSEMENT_API_URI_TEMPLATE` should contain `{loan_id}`.
    *   `CUSTOMER_ARRANGEMENTS_API_URI_TEMPLATE` should contain `{customer_id}`.

    The script also uses hardcoded URIs for Debit/Credit transactions and Holdings microservice interactions. Ensure these are correct or modify the script if needed:
    *   `DEBIT_ACCOUNT_API_URI`
    *   `CREDIT_ACCOUNT_API_URI`
    *   `HOLDINGS_PARTY_ARRANGEMENTS_API_URI_TEMPLATE`
    *   `HOLDINGS_ACCOUNT_BALANCES_API_URI_TEMPLATE`
    *   `HOLDINGS_ACCOUNT_TRANSACTIONS_API_URI_TEMPLATE`

## How to Run

1.  Ensure all prerequisites are met, dependencies are installed, and the `.env` file is correctly configured.
2.  Navigate to the directory containing `Demoflow.py`.
3.  Run the script from your terminal:
    ```bash
    python Demoflow.py
    ```
4.  The script will print progress messages to the console.
5.  Upon completion, a file named `demooutput.txt` will be created (or overwritten) in the same directory, containing detailed logs of API calls and Kafka events.

## Output

The primary output is the `demooutput.txt` file, which logs:
*   Each API call made:
    *   HTTP Method and URI
    *   Request Payload (for POST/PUT requests)
    *   Response Status Code
    *   Response Body
*   Captured Kafka events from the `lending-event-topic`:
    *   Topic, partition, offset
    *   Key (if present)
    *   Timestamp
    *   Payload (parsed as JSON if possible, otherwise as a string)

This log file is crucial for understanding the flow of operations and for debugging purposes. 