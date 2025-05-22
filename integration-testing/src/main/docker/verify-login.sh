#!/bin/bash

# Script to verify NiFi login using a POST request

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Define credentials
USERNAME="admin"
PASSWORD="adminadminadmin"

echo "Verifying NiFi login with username: $USERNAME"

# Try a direct login to the access/token endpoint
echo "Attempting login..."
LOGIN_RESPONSE=$(curl -s -k -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$USERNAME&password=$PASSWORD" \
  https://localhost:9095/nifi-api/access/token)

echo "Login response:"
echo "$LOGIN_RESPONSE"

# Check if login was successful by looking for HTTP 200 OK specifically
if echo "$LOGIN_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
  echo "Login successful! Authentication token received."
  # Extract the token (should be in the response body)
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -v "^HTTP\|^date:\|^content-\|^strict-\|^x-" | tr -d '\r\n')
  echo "Token: $TOKEN"

  # Verify the token works by making a request to a protected endpoint
  echo "Verifying token with a request to a protected endpoint..."
  VERIFY_RESPONSE=$(curl -s -k -i -X GET \
    -H "Authorization: Bearer $TOKEN" \
    https://localhost:9095/nifi-api/flow/current-user)

  echo "Token verification response:"
  echo "$VERIFY_RESPONSE"

  if echo "$VERIFY_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
    echo "Token verification successful! Login is working correctly."
    exit 0
  else
    echo "Token verification failed. Login may not be working correctly."
    exit 1
  fi
else
  echo "Login failed. Check credentials and NiFi configuration."

  # Try with different content type
  echo "Trying with different content type..."
  LOGIN_RESPONSE=$(curl -s -k -i -X POST \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    https://localhost:9095/nifi-api/access/token)

  echo "Login response with JSON:"
  echo "$LOGIN_RESPONSE"

  if echo "$LOGIN_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
    echo "Login successful with JSON! Authentication token received."
    exit 0
  else
    echo "Login failed with both methods. Checking NiFi status..."

    # Check if NiFi is fully started
    NIFI_STATUS=$(curl -s -k -i https://localhost:9095/nifi-api/system-diagnostics)
    echo "NiFi status response:"
    echo "$NIFI_STATUS"

    exit 1
  fi
fi
