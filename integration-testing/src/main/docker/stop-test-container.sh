#!/bin/bash

# Script to stop the NiFi and Keycloak test containers

# Navigate to the Docker directory
cd "$(dirname "$0")"

# Stop the Docker containers
echo "Stopping NiFi and Keycloak test containers..."
docker compose down

echo "NiFi and Keycloak test containers stopped."
