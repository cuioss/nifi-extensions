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
    -H "Content-Type: application/x-www-form-urlencoded" 2>/dev/null || true)
# A valid NiFi access token is a JWT: three base64url segments separated by dots.
# A non-empty body alone is not proof — an HTML/JSON error page is also non-empty
# and must not be forwarded as a bearer token.
if ! printf '%s' "$NIFI_TOKEN" | grep -Eq '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'; then
    echo "Could not obtain a valid NiFi token — processors may need manual start"
    exit 1
fi

start_code=$(curl -sk -o /dev/null -w '%{http_code}' -X PUT \
    -H "Authorization: Bearer $NIFI_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"id":"root","state":"RUNNING"}' \
    "https://localhost:9095/nifi-api/flow/process-groups/root" 2>/dev/null || true)
if [ "$start_code" != "200" ]; then
    echo "Processor start request returned HTTP ${start_code:-000} — processors did not start"
    exit 1
fi
echo "Flow processors started (HTTP $start_code)"

# Verify the flow pipeline actually came up on port 7777 (HandleHttpRequest).
# Starting the processors is necessary but not sufficient; the redeploy path
# previously returned success without ever confirming the listener bound.
echo "Waiting for flow pipeline on port 7777..."
flow_timeout=120
flow_elapsed=0
while [ $flow_elapsed -lt $flow_timeout ]; do
    http_code=$(curl --max-time 10 -o /dev/null -s -w '%{http_code}' \
        http://localhost:7777 2>/dev/null || true)
    if [ "$http_code" != "000" ] && [ -n "$http_code" ]; then
        echo "Flow pipeline is ready on port 7777 (HTTP $http_code)"
        exit 0
    fi
    echo "Waiting for flow pipeline... ($flow_elapsed/${flow_timeout}s, HTTP $http_code)"
    sleep 2
    flow_elapsed=$((flow_elapsed + 2))
done

echo "Processors started but flow pipeline on port 7777 did not respond in time"
exit 1
