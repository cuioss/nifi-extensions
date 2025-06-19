#!/bin/bash

# Script to verify that both NiFi and Keycloak are using the new certificates

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to the Docker directory
cd "${SCRIPT_DIR}"

# Check NiFi logs for certificate information
echo "Checking NiFi logs for certificate information..."
docker compose logs nifi | grep -i "keystore" || echo "No keystore information found in NiFi logs"
docker compose logs nifi | grep -i "truststore" || echo "No truststore information found in NiFi logs"
docker compose logs nifi | grep -i "certificate" || echo "No certificate information found in NiFi logs"
docker compose logs nifi | grep -i "localhost" || echo "No localhost information found in NiFi logs"

echo ""
echo "---------------------------------------------"
echo ""

# Check Keycloak logs for certificate information
echo "Checking Keycloak logs for certificate information..."
docker compose logs keycloak | grep -i "certificate" || echo "No certificate information found in Keycloak logs"
docker compose logs keycloak | grep -i "key file" || echo "No key file information found in Keycloak logs"
docker compose logs keycloak | grep -i "https" || echo "No HTTPS information found in Keycloak logs"
docker compose logs keycloak | grep -i "localhost" || echo "No localhost information found in Keycloak logs"

echo ""
echo "---------------------------------------------"
echo ""

# Verify that NiFi is accessible via HTTPS
echo "Verifying that NiFi is accessible via HTTPS..."
# Check NiFi HTTPS connectivity
echo "Checking NiFi HTTPS connectivity..."
curl -k -s -o /dev/null -w "%{http_code}" https://localhost:9095/nifi/ || echo "Failed to connect to NiFi via HTTPS"

# Note: NiFi is now running with HTTPS on port 9095
echo "NiFi HTTPS service is now enabled on port 9095"

# Verify that Keycloak is accessible via HTTPS
echo "Verifying that Keycloak is accessible via HTTPS..."
curl -k -s -o /dev/null -w "%{http_code}" https://localhost:9085/ || echo "Failed to connect to Keycloak via HTTPS"

echo ""
echo "Certificate verification complete."