#!/bin/bash

# BB EventHub Monitor Startup Script

echo "Starting BB EventHub Monitor..."
echo "==============================="

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "app.py" ]; then
    echo "Error: app.py not found. Please run this script from the BB-EventHub directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found. Please ensure the environment configuration is present"
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "Installing dependencies..."
    python3 -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "Warning: Failed to install some dependencies. The application may not work correctly."
    fi
fi

echo ""
echo "Starting Flask application on http://localhost:5002"
echo "Press Ctrl+C to stop the application"
echo ""

# Start the application
python3 app.py 