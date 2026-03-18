#!/bin/bash

# Wait for NiFi to become healthy, then start all processors via REST API.
#
# On fresh deployments NiFi loads flow.json but does not auto-start
# processors (no prior runtime state to resume). This script ensures
# all processors with scheduledState=RUNNING actually start.
#
# Used by: start-nifi.sh, redeploy-nifi.sh

set -euo pipefail

echo "Waiting for NiFi to be ready..."
COUNTER=0
MAX_ATTEMPTS=60  # 2 minutes with 2-second intervals
INTERVAL=2
while [ $COUNTER -lt $MAX_ATTEMPTS ]; do
    if curl -k --fail --max-time 3 --silent https://localhost:9095/nifi/ > /dev/null 2>&1; then
        echo "NiFi is ready (started in $((COUNTER * INTERVAL)) seconds)"
        break
    fi
    sleep $INTERVAL
    COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -ge $MAX_ATTEMPTS ]; then
    echo "NiFi failed to start within $((MAX_ATTEMPTS * INTERVAL)) seconds"
    exit 1
fi

# Start all processors via REST API
echo "Starting all flow processors via NiFi API..."
NIFI_TOKEN=$(curl -sk -X POST https://localhost:9095/nifi-api/access/token \
    -d "username=testUser&password=drowssap" \
    -H "Content-Type: application/x-www-form-urlencoded" 2>/dev/null)
if [ -n "$NIFI_TOKEN" ]; then
    curl -sk -X PUT \
        -H "Authorization: Bearer $NIFI_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"id":"root","state":"RUNNING"}' \
        "https://localhost:9095/nifi-api/flow/process-groups/root" > /dev/null 2>&1
    echo "Flow processors started"
else
    echo "Could not obtain NiFi token — processors may need manual start"
    exit 1
fi
