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