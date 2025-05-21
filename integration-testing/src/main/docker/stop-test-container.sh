#!/bin/bash

# Script to stop the NiFi and Keycloak test containers

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Navigate to the Docker directory
cd "${SCRIPT_DIR}"

# Stop the Docker containers
echo "Stopping NiFi and Keycloak test containers..."
docker compose down

echo "NiFi and Keycloak test containers stopped."
