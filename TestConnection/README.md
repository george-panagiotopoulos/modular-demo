# Azure Event Hubs Test Connection

This folder contains scripts to test connectivity to Azure Event Hubs and interact with the service.

## Setup

1. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

2. The connection string is already configured in the scripts, but you can update it if needed.

## Scripts

### simple_connect.py (Recommended)

This script uses the Kafka protocol to connect to Azure Event Hubs and list available topics (event hubs).

```bash
python simple_connect.py
```

This approach:
- Uses the confluent-kafka library
- Connects to Event Hubs using the Kafka protocol (port 9093)
- Authenticates using the SASL PLAIN mechanism with the shared access key
- Lists available topics and their partitions

### list_event_hubs.py

This script uses the Azure SDKs to connect to Event Hubs and list available event hubs.

```bash
python list_event_hubs.py
```

The script uses multiple approaches to try to list event hubs:

1. First, it uses the `ServiceBusAdministrationClient` to directly connect using the connection string
2. If that fails, it tries using the Azure Management API (requires Azure credentials)
3. Finally, it provides information about connecting to specific event hubs

## Troubleshooting

If you encounter issues:

1. Make sure all dependencies are installed with `pip install -r requirements.txt`
2. Try the Kafka protocol approach (`simple_connect.py`) which works with many network configurations
3. Check if your network blocks the required ports (9093 for Kafka, 443 for HTTPS)
4. Verify your credentials and connection string are correct and not expired 