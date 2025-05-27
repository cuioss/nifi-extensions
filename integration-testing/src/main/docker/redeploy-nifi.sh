#!/bin/bash

# Script to build the NAR file, copy it to the deployment location, and restart NiFi

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Call the copy-deployment.sh script to build and copy the NAR file
echo "Building and deploying NAR file..."
"${SCRIPT_DIR}/copy-deployment.sh"

# Navigate back to the docker directory
cd "${SCRIPT_DIR}"

# Restart NiFi service
echo "Restarting NiFi service..."
docker compose restart nifi

echo "NiFi service has been restarted. The new NAR file should now be loaded."
