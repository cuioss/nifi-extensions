#!/bin/bash

# Script to build the NAR file and run the NiFi and Keycloak test containers

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

# Single definition site for the test credentials this script reports.
# shellcheck source=test-credentials.env disable=SC1091
. "${SCRIPT_DIR}/test-credentials.env"

# Call the copy-deployment.sh script to build and copy the NAR file
echo "Calling copy-deployment.sh to build and copy the NAR file..."
"${SCRIPT_DIR}/copy-deployment.sh"

# For HTTPS mode, check if certificates exist.
# All certificates (keystore/truststore + Keycloak's localhost cert/key) live
# under docker/certificates/ — the directory docker-compose mounts into both
# containers. Earlier revisions probed nifi/conf/ and keycloak/certificates/,
# which are not the generation targets, so the guard never regenerated.
if grep -q "nifi-https:" "${SCRIPT_DIR}/docker-compose.yml" && ! grep -q "# *nifi-https:" "${SCRIPT_DIR}/docker-compose.yml"; then
  if [ ! -f "${SCRIPT_DIR}/certificates/keystore.p12" ] || [ ! -f "${SCRIPT_DIR}/certificates/truststore.p12" ] || \
     [ ! -f "${SCRIPT_DIR}/certificates/localhost.crt" ] || [ ! -f "${SCRIPT_DIR}/certificates/localhost.key" ]; then
    echo "HTTPS mode detected. Generating certificates..."
    "${SCRIPT_DIR}/maintenance/generate-certificates.sh"
  fi
fi

# Use the new start script
echo "Starting NiFi environment..."
"${SCRIPT_DIR}/start-nifi.sh"
echo ""
echo "Keycloak realm: oauth_integration_tests"
echo "Test user: ${TEST_USER_NAME}, password: ${TEST_USER_PASSWORD}"
echo "Test client: test_client (public client, no secret)"
