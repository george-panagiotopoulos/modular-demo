import sys
import os

# Add the project root directory to the Python path
project_root = os.path.abspath(os.path.dirname(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app import create_app

app = create_app()

if __name__ == '__main__':
    # Set debug=True for development, it enables auto-reloading
    # Use host='0.0.0.0' to make it accessible on the network
    app.run(debug=True, host='0.0.0.0', port=5001) # Use a port other than default 5000 if needed 