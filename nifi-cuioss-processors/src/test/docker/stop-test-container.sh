#!/bin/bash

# Script to stop the NiFi test container

# Navigate to the Docker directory
cd "$(dirname "$0")"

# Stop the Docker container
echo "Stopping NiFi test container..."
docker-compose down

echo "NiFi test container stopped."