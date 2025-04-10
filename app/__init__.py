from flask import Flask
from config import Config
# Import blueprints later when they are created
from .routes import main_bp
from .utils import load_stub_data # Import from utils
import os
import subprocess
import json

# --- Helper Functions for Stubs ---

def generate_puml_image(puml_subpath, output_dir):
    """Generates a PNG image from a PlantUML file within the Stub directory."""
    jar_path = "/Users/gpanagiotopoulos/ModularDemo/PUML/plantuml-mit-1.2025.1.jar" # Keep absolute path for simplicity for now
    puml_file_path = os.path.join(os.path.dirname(__file__), '..', 'Stub', puml_subpath)
    output_filename = os.path.splitext(os.path.basename(puml_subpath))[0] + '.png'
    static_images_dir = os.path.join(os.path.dirname(__file__), 'static', 'images')

    # Ensure the static/images directory exists
    os.makedirs(static_images_dir, exist_ok=True)

    # Target path within static/images
    target_image_path = os.path.join(static_images_dir, output_filename)

    # Check if the image already exists and if the puml file hasn't changed
    puml_mtime = 0
    try:
        if os.path.exists(puml_file_path):
            puml_mtime = os.path.getmtime(puml_file_path)
        else:
             print(f"Error: PUML file not found at {puml_file_path}")
             return None
    except Exception as e:
        print(f"Error accessing PUML file {puml_file_path}: {e}")
        return None
        
    img_mtime = os.path.getmtime(target_image_path) if os.path.exists(target_image_path) else 0

    if os.path.exists(target_image_path) and img_mtime >= puml_mtime:
         print(f"Skipping PUML generation, image already exists and is up-to-date: {target_image_path}")
         return 'images/' + output_filename # Return relative path for url_for

    if not os.path.exists(jar_path):
        print(f"Error: PlantUML jar not found at {jar_path}")
        return None

    command = [
        'java',
        '-jar',
        jar_path,
        '-tpng', # Output format PNG
        '-o', static_images_dir, # Specify output directory
        puml_file_path
    ]

    try:
        print(f"Generating diagram from {puml_file_path} to {static_images_dir}")
        result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=30) # Added timeout
        print(f"Successfully generated {target_image_path}")
        return 'images/' + output_filename # Return relative path for url_for
    except subprocess.CalledProcessError as e:
        print(f"Error generating PlantUML diagram:")
        print(f"Command: {' '.join(e.cmd)}")
        print(f"Return code: {e.returncode}")
        print(f"Stderr: {e.stderr}")
        print(f"Stdout: {e.stdout}")
        return None
    except subprocess.TimeoutExpired:
        print(f"Error: PlantUML generation timed out.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during PlantUML generation: {e}")
        return None

# --- Application Factory ---

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Generate static diagram on startup if needed
    generated_image_rel_path = generate_puml_image('Architecture/architecture.puml', app.static_folder)
    app.config['ARCHITECTURE_IMAGE_PATH'] = generated_image_rel_path # Store relative path for url_for

    # Register blueprints
    app.register_blueprint(main_bp)
    # Register other blueprints (mobile_bp, branch_bp, etc.) here later

    # Load stub data - REMOVE mobile_data from here
    # Backend routes will load data as needed using load_stub_data
    app.stub_data = {
        # 'mobile_data': load_stub_data('MobileApp/data.json') or { ... }, # REMOVED
        'branch_data': load_stub_data('BranchApp/data.json') or { "customers": [], "accounts": {}, "transactions": {} }
        # Headless data is not pre-loaded, fetched directly by its API route
    }

    @app.context_processor
    def inject_stub_config():
        # Inject config needed directly by base templates (like dashboard.html)
        # Specific stub data should be fetched via APIs by tab-specific JS
        return {} # Nothing needed globally for now

    print("Flask app created.")
    # Update print statements if necessary
    # print(f"Mobile Data Accounts loaded: ...") # REMOVED
    print(f"Branch Data Customers loaded: {len(app.stub_data.get('branch_data', {}).get('customers', []))}")
    print(f"Architecture image path: {app.config.get('ARCHITECTURE_IMAGE_PATH')}")

    return app 