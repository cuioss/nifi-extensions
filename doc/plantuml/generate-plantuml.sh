#!/bin/bash

# Script to generate PNG images from PlantUML files using locally installed PlantUML
# This script replaces the Maven build process for PlantUML diagrams

# Set the directory containing the PlantUML files
PLANTUML_DIR="doc/plantuml"

# Check if PlantUML is installed
if ! command -v plantuml &> /dev/null; then
    echo "Error: PlantUML is not installed or not in the PATH"
    echo "Please install PlantUML and make sure it's available in your PATH"
    exit 1
fi

# Print information about what we're doing
echo "Generating PNG images from PlantUML files in $PLANTUML_DIR"
echo "Using locally installed PlantUML: $(which plantuml)"
echo ""

# Find all .puml files and process them
echo "Processing PlantUML files:"
find "$PLANTUML_DIR" -name "*.puml" | while read -r puml_file; do
    echo "  - $puml_file"
    # Generate PNG image in the same directory as the source file
    plantuml -tpng "$puml_file"
    
    # Check if the PNG was generated successfully
    png_file="${puml_file%.puml}.png"
    if [ -f "$png_file" ]; then
        echo "    ✓ Generated $png_file"
    else
        echo "    ✗ Failed to generate $png_file"
    fi
done

echo ""
echo "PlantUML generation complete"