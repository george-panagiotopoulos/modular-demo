import os
import json
import threading # Import threading for file lock

# A simple lock for file writing to prevent race conditions if the app were multi-threaded
_file_lock = threading.Lock()

def load_stub_data(subpath):
    """Loads JSON data from a file within the Stub directory."""
    # Correct path assumes utils.py is inside the 'app' directory
    stub_path = os.path.join(os.path.dirname(__file__), '..', 'Stub', subpath)
    try:
        with _file_lock: # Acquire lock for reading too, for consistency
            with open(stub_path, 'r') as f:
                return json.load(f)
    except FileNotFoundError:
        print(f"Warning: Stub data file not found at {stub_path}")
        return None
    except json.JSONDecodeError:
        print(f"Warning: Error decoding JSON from stub file {stub_path}")
        return None
    except Exception as e:
        print(f"Error loading stub data from {subpath}: {e}")
        return None

def save_stub_data(subpath, data):
    """Saves Python data structure as JSON to a file within the Stub directory."""
    stub_path = os.path.join(os.path.dirname(__file__), '..', 'Stub', subpath)
    try:
        with _file_lock: # Acquire lock before writing
            with open(stub_path, 'w') as f:
                json.dump(data, f, indent=2) # Use indent for readability
            print(f"Successfully saved stub data to {stub_path}")
            return True
    except Exception as e:
        print(f"Error saving stub data to {subpath}: {e}")
        return False 