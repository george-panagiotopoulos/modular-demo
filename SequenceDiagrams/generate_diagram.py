#!/usr/bin/env python3
"""
Generate PNG diagram from PlantUML file

Usage:
  python generate_diagram.py [puml_file]

If no puml_file is provided, it defaults to demoflow_sequence.puml
"""

import os
import sys
import subprocess
from pathlib import Path

# Configuration
PLANTUML_JAR = "/Users/gpanagiotopoulos/ModularDemo/PUML/plantuml-mit-1.2025.1.jar"
DEFAULT_PUML = "demoflow_sequence.puml"

def generate_diagram(puml_file):
    """Generate a PNG diagram from a PlantUML file using the JAR"""
    # Get absolute paths
    puml_path = Path(puml_file).resolve()
    output_dir = puml_path.parent
    
    # Verify the PUML file exists
    if not puml_path.exists():
        print(f"Error: PUML file not found: {puml_path}")
        return False
    
    # Verify the PlantUML JAR exists
    plantuml_jar_path = Path(PLANTUML_JAR).resolve()
    if not plantuml_jar_path.exists():
        print(f"Error: PlantUML JAR not found: {plantuml_jar_path}")
        return False
    
    # Build the command
    cmd = ["java", "-jar", str(plantuml_jar_path), str(puml_path)]
    
    # Run the command
    print(f"Generating diagram from {puml_path.name}...")
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        # Get the expected output file path (same name with .png extension)
        png_path = output_dir / f"{puml_path.stem}.png"
        
        if png_path.exists():
            print(f"Success! Diagram generated: {png_path}")
            return True
        else:
            print("Error: PNG file was not generated.")
            print(f"Command output: {result.stdout}")
            print(f"Command error: {result.stderr}")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"Error running PlantUML: {e}")
        print(f"Command output: {e.stdout}")
        print(f"Command error: {e.stderr}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

def main():
    """Main function"""
    # Get the PUML file from command line args or use default
    if len(sys.argv) > 1:
        puml_file = sys.argv[1]
    else:
        # Use the default PUML file in the current directory
        script_dir = Path(__file__).parent
        puml_file = script_dir / DEFAULT_PUML
    
    # Generate the diagram
    success = generate_diagram(puml_file)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 