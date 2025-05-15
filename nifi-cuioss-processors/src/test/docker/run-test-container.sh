#!/bin/bash

# Script to build the NAR file and run the NiFi test container

# Exit on error
set -e

# Navigate to the project root
cd "$(dirname "$0")/../../../.."

# Build the NAR file
echo "Building NAR file..."
./mvnw clean package -DskipTests

# Navigate to the Docker directory
cd nifi-cuioss-processors/src/test/docker

# Start the Docker container
echo "Starting NiFi test container..."
docker-compose up --build -d

# Wait for NiFi to start
echo "Waiting for NiFi to start (this may take a few minutes)..."
until $(curl --output /dev/null --silent --head --fail -k https://localhost:8443/nifi/); do
    printf '.'
    sleep 5
done

echo ""
echo "NiFi test container is running!"
echo "Access the NiFi UI at: https://localhost:8443/nifi/"
echo "Login with username: admin, password: ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB"