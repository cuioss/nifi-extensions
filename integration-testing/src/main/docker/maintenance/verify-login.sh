#!/bin/bash

# Script to verify NiFi login using HTTP

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Use static credentials from login-identity-providers.xml
echo "Using static credentials from login-identity-providers.xml..."
USERNAME="admin"
PASSWORD="adminadminadmin"

echo "Username: $USERNAME"
echo "Password: $PASSWORD"

echo "Verifying NiFi login with username: $USERNAME"

# Try a direct login to the access/token endpoint
echo "Attempting login to /nifi-api/access/token..."
# Generate a random request token
REQUEST_TOKEN=$(uuidgen || cat /proc/sys/kernel/random/uuid)
echo "Using Request-Token: $REQUEST_TOKEN"
LOGIN_RESPONSE=$(curl -s -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded;charset=UTF-8" \
  -H "Request-Token: $REQUEST_TOKEN" \
  --data-urlencode "username=$USERNAME" \
  --data-urlencode "password=$PASSWORD" \
  http://localhost:9094/nifi-api/access/token)

echo "Login response:"
echo "$LOGIN_RESPONSE"

# Check if login was successful by looking for HTTP 200 OK or 201 Created
if echo "$LOGIN_RESPONSE" | grep -q "HTTP/[0-9.]* 20[01]"; then
  echo "Login successful! Authentication token received."
  # Extract the token (should be in the response body, after all headers)
  TOKEN=$(echo "$LOGIN_RESPONSE" | awk 'BEGIN{RS="\r\n\r\n"} NR==2' | tr -d '\r\n')
  echo "Token: $TOKEN"

  # Verify the token works by making a request to a protected endpoint
  echo "Verifying token with a request to a protected endpoint..."
  VERIFY_RESPONSE=$(curl -s -i -X GET \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:9094/nifi-api/flow/current-user)

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
  LOGIN_RESPONSE=$(curl -s -i -X POST \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    http://localhost:9094/nifi-api/access/token/login)

  echo "Login response with JSON:"
  echo "$LOGIN_RESPONSE"

  if echo "$LOGIN_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
    echo "Login successful with JSON! Authentication token received."
    exit 0
  else
    echo "Trying UI token endpoint..."
    LOGIN_RESPONSE=$(curl -s -i -X POST \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "username=$USERNAME&password=$PASSWORD" \
      http://localhost:9094/nifi-api/access/token/ui)

    echo "Login response from UI token endpoint:"
    echo "$LOGIN_RESPONSE"

    if echo "$LOGIN_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
      echo "Login successful with UI token endpoint! Authentication token received."
      exit 0
    else
      echo "Login failed with all methods. Checking NiFi status..."

      # Check if NiFi is fully started
      NIFI_STATUS=$(curl -s -i http://localhost:9094/nifi-api/system-diagnostics)
      echo "NiFi status response:"
      echo "$NIFI_STATUS"

      exit 1
    fi
  fi
fi
