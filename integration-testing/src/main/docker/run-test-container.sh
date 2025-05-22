#!/bin/bash

# Script to build the NAR file and run the NiFi and Keycloak test containers

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

# Call the copy-deployment.sh script to build and copy the NAR file
echo "Calling copy-deployment.sh to build and copy the NAR file..."
"${SCRIPT_DIR}/copy-deployment.sh"

# Check if certificates exist
if [ ! -f "${SCRIPT_DIR}/nifi/conf/keystore.p12" ] || [ ! -f "${SCRIPT_DIR}/nifi/conf/truststore.p12" ] || \
   [ ! -f "${SCRIPT_DIR}/keycloak/certificates/localhost.crt" ] || [ ! -f "${SCRIPT_DIR}/keycloak/certificates/localhost.key" ]; then
  echo "Error: Required certificates are missing. Please run generate-certificates.sh manually before starting the containers."
  echo "Command: ${SCRIPT_DIR}/generate-certificates.sh"
  exit 1
fi

# Change to the Docker directory
cd "${SCRIPT_DIR}"

# Ensure the necessary directories exist
echo "Ensuring necessary directories exist..."
# Ensure the NiFi configuration directory exists
if [ ! -d "${SCRIPT_DIR}/nifi/conf" ]; then
  echo "Creating NiFi configuration directory..."
  mkdir -p "${SCRIPT_DIR}/nifi/conf"
fi

# Ensure the Keycloak import directory exists
if [ ! -d "${SCRIPT_DIR}/keycloak" ]; then
  echo "Creating Keycloak import directory..."
  mkdir -p "${SCRIPT_DIR}/keycloak"
fi

# Ensure the NiFi NAR extensions directory exists in the parent project
NAR_TARGET_DIR="${PROJECT_ROOT}/nifi-cuioss-nar/target"
if [ ! -d "${NAR_TARGET_DIR}" ]; then
  echo "Creating NiFi NAR extensions directory..."
  mkdir -p "${NAR_TARGET_DIR}"
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
echo "Login with username: admin, password: adminadminadmin"
echo ""
echo "Access the Keycloak Admin Console at: http://localhost:9080/admin/"
echo "Login with username: admin, password: admin"
echo ""
echo "Keycloak realm: oauth_integration_tests"
echo "Test user: testUser, password: drowssap"
echo "Test client: test_client, secret: yTKslWLtf4giJcWCaoVJ20H8sy6STexM"
