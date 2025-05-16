#!/bin/bash
#
# Generate PNG diagram from PlantUML file
#
# Usage:
#   ./generate_diagram.sh [puml_file]
#
# If no puml_file is provided, it defaults to demoflow_sequence.puml

# Configuration
PLANTUML_JAR="/Users/gpanagiotopoulos/ModularDemo/PUML/plantuml-mit-1.2025.1.jar"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PUML="${SCRIPT_DIR}/demoflow_sequence.puml"

# Set the PUML file path
if [ $# -gt 0 ]; then
    PUML_FILE="$1"
else
    PUML_FILE="${DEFAULT_PUML}"
fi

# Check if the PUML file exists
if [ ! -f "${PUML_FILE}" ]; then
    echo "Error: PUML file not found: ${PUML_FILE}"
    exit 1
fi

# Check if the PlantUML JAR exists
if [ ! -f "${PLANTUML_JAR}" ]; then
    echo "Error: PlantUML JAR not found: ${PLANTUML_JAR}"
    exit 1
fi

# Run PlantUML to generate the diagram
echo "Generating diagram from $(basename "${PUML_FILE}")..."
java -jar "${PLANTUML_JAR}" "${PUML_FILE}"

# Get the expected output file path (same name with .png extension)
PNG_FILE="${PUML_FILE%.*}.png"

# Check if the PNG file was generated
if [ -f "${PNG_FILE}" ]; then
    echo "Success! Diagram generated: ${PNG_FILE}"
    exit 0
else
    echo "Error: PNG file was not generated."
    exit 1
fi 