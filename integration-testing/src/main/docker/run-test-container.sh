#!/bin/bash

# Script to build the NAR file and run the NiFi and Keycloak test containers

# Exit on error
set -e

# Navigate to the project root
cd "$(dirname "$0")/../../../.."

# Build the NAR file
echo "Building NAR file..."
./mvnw package -DskipTests

# Navigate to the Docker directory
cd integration-testing/src/main/docker

# Ensure the necessary directories exist
echo "Ensuring necessary directories exist..."
# Ensure the NiFi configuration directory exists
if [ ! -d "./nifi/conf" ]; then
  echo "Creating NiFi configuration directory..."
  mkdir -p ./nifi/conf
fi

# Ensure the Keycloak import directory exists
if [ ! -d "./keycloak" ]; then
  echo "Creating Keycloak import directory..."
  mkdir -p ./keycloak
fi

# Ensure the NiFi NAR extensions directory exists in the parent project
if [ ! -d "../../../nifi-cuioss-nar/target" ]; then
  echo "Creating NiFi NAR extensions directory..."
  mkdir -p ../../../nifi-cuioss-nar/target
fi

# Start the Docker containers
echo "Starting NiFi and Keycloak test containers..."
docker compose up --build -d
echo ""
# Give containers a moment to initialize
echo "Waiting for containers to initialize..."
sleep 10
echo ""
echo "Assuming containers are up and running"
echo ""
echo "Access the logs if necessary"
echo "docker compose logs nifi"
echo "docker compose logs keycloak"
echo ""
echo ""
echo "NiFi and Keycloak test containers are running!"
echo "Access the NiFi UI at: https://localhost:9095/nifi/"
echo "Login with username: admin, password: ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB"
echo ""
echo "Access the Keycloak Admin Console at: http://localhost:9080/admin/"
echo "Login with username: admin, password: admin"
echo ""
echo "Keycloak realm: oauth_integration_tests"
echo "Test user: testUser, password: drowssap"
echo "Test client: test_client, secret: yTKslWLtf4giJcWCaoVJ20H8sy6STexM"
