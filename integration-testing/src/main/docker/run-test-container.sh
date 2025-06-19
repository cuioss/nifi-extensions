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

# For HTTPS mode, check if certificates exist
if grep -q "nifi-https:" "${SCRIPT_DIR}/docker-compose.yml" && ! grep -q "# *nifi-https:" "${SCRIPT_DIR}/docker-compose.yml"; then
  if [ ! -f "${SCRIPT_DIR}/nifi/conf/keystore.p12" ] || [ ! -f "${SCRIPT_DIR}/nifi/conf/truststore.p12" ] || \
     [ ! -f "${SCRIPT_DIR}/keycloak/certificates/localhost.crt" ] || [ ! -f "${SCRIPT_DIR}/keycloak/certificates/localhost.key" ]; then
    echo "HTTPS mode detected. Generating certificates..."
    "${SCRIPT_DIR}/maintenance/generate-certificates.sh"
  fi
fi

# Use the new start script
echo "Starting NiFi environment..."
"${SCRIPT_DIR}/start-nifi.sh"
echo ""
echo "Keycloak realm: oauth_integration_tests"
echo "Test user: testUser, password: drowssap"
echo "Test client: test_client, secret: yTKslWLtf4giJcWCaoVJ20H8sy6STexM"
