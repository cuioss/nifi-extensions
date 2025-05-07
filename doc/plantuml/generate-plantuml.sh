#!/bin/bash

# Script to generate PNG images from PlantUML files using locally installed PlantUML or downloaded JAR
# This script replaces the Maven build process for PlantUML diagrams

# Set the directory containing the PlantUML files
PLANTUML_DIR="../../doc/plantuml"

# Check if PlantUML is installed
if ! command -v plantuml &> /dev/null; then
    echo "PlantUML is not installed or not in the PATH. Checking for plantuml.jar..."

    # Check if plantuml.jar exists, if not download it
    PLANTUML_JAR="plantuml.jar"
    if [ ! -f "$PLANTUML_JAR" ]; then
        echo "PlantUML JAR not found. Downloading..."
        curl -sSL https://sourceforge.net/projects/plantuml/files/plantuml.jar/download -o "$PLANTUML_JAR"
    fi

    # Use the downloaded JAR to generate PNG files
    echo "Generating PNG images from PlantUML files in $PLANTUML_DIR using plantuml.jar"
    echo ""
    echo "Processing PlantUML files:"
    find "$PLANTUML_DIR" -name "*.puml" | while read -r puml_file; do
        echo "  - $puml_file"
        # Generate PNG image in the same directory as the source file
        java -jar "$PLANTUML_JAR" "$puml_file"
        
        # Check if the PNG was generated successfully
        png_file="${puml_file%.puml}.png"
        if [ -f "$png_file" ]; then
            echo "    ✓ Generated $png_file"
        else
            echo "    ✗ Failed to generate $png_file"
        fi
    done
else
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
fi

echo ""
echo "PlantUML generation complete"