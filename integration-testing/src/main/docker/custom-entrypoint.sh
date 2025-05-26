#!/bin/bash
# Custom entrypoint script for NiFi container

# Set environment variables
export NIFI_HOME=${NIFI_HOME:-/opt/nifi/nifi-current}

# Set up the credentials first
echo "Setting up NiFi credentials..."
/opt/nifi/scripts/setup-credentials.sh

# Then run NiFi
echo "Starting NiFi..."
exec /opt/nifi/nifi-current/bin/nifi.sh run
