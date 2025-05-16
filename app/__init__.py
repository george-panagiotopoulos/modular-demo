from flask import Flask
from config import Config
# Import blueprints later when they are created
from .routes import main_bp
# from .utils import load_stub_data # No longer needed
import os
import subprocess
import json

# --- Helper Functions for Stubs ---

def generate_puml_image(puml_subpath, output_dir):
    """Generates a PNG image from a PlantUML file.
    
    The file can be located either in:
    - Root directory for paths starting with 'SequenceDiagrams/' 
    - Stub directory for all other paths (this part is now obsolete)
    """
    jar_path = "/Users/gpanagiotopoulos/ModularDemo/PUML/plantuml-mit-1.2025.1.jar" 
    
    # Path is now always relative to the project root for SequenceDiagrams
    if puml_subpath.startswith('SequenceDiagrams/'):
        puml_file_path = os.path.join(os.path.dirname(__file__), '..', puml_subpath)
    else:
        # This case should ideally not be hit anymore as Stub is removed
        logger.warning(f"PUML generation attempted for non-SequenceDiagram path: {puml_subpath}. This might fail.")
        puml_file_path = os.path.join(os.path.dirname(__file__), '..', puml_subpath) # Fallback, but likely wrong
    
    output_filename = os.path.splitext(os.path.basename(puml_subpath))[0] + '.png'
    static_images_dir = os.path.join(os.path.dirname(__file__), 'static', 'images')

    os.makedirs(static_images_dir, exist_ok=True)
    target_image_path = os.path.join(static_images_dir, output_filename)

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
         return 'images/' + output_filename

    if not os.path.exists(jar_path):
        print(f"Error: PlantUML jar not found at {jar_path}")
        return None

    command = [
        'java',
        '-jar',
        jar_path,
        '-tpng',
        '-o', static_images_dir,
        puml_file_path
    ]

    try:
        print(f"Generating diagram from {puml_file_path} to {static_images_dir}")
        result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=30)
        print(f"Successfully generated {target_image_path}")
        return 'images/' + output_filename
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
    # Ensure this points to the correct sequence diagram location
    generated_image_rel_path = generate_puml_image('SequenceDiagrams/DemoFlow.puml', app.static_folder)
    app.config['ARCHITECTURE_IMAGE_PATH'] = generated_image_rel_path

    app.register_blueprint(main_bp)

    # app.stub_data is no longer used

    @app.context_processor
    def inject_stub_config():
        return {}

    print("Flask app created.")
    if app.config.get('ARCHITECTURE_IMAGE_PATH'):
        print(f"Architecture image path: {app.config.get('ARCHITECTURE_IMAGE_PATH')}")
    else:
        print("Warning: Architecture image path not set. Diagram may not display.")

    return app 