#!/bin/bash

# Wait for NiFi to become healthy, then start all processors via REST API.
#
# On fresh deployments NiFi loads flow.json but does not auto-start
# processors (no prior runtime state to resume). This script ensures
# all processors with scheduledState=RUNNING actually start.
#
# Used by: start-nifi.sh, redeploy-nifi.sh
#
# Failure semantics: STRICT — any failure aborts with a non-zero exit, because
# the deploy paths that call this script must not report success on a flow that
# never came up.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Shared token-fetch / processor-start helpers; also loads test-credentials.env.
# shellcheck source=scripts/lib-start-processors.sh disable=SC1091
. "${SCRIPT_DIR}/scripts/lib-start-processors.sh"

echo "Waiting for NiFi to be ready..."
COUNTER=0
MAX_ATTEMPTS=60  # 2 minutes with 2-second intervals
INTERVAL=2
while [ $COUNTER -lt $MAX_ATTEMPTS ]; do
    if curl -k --fail --max-time 3 --silent "${NIFI_BASE_URL}/nifi/" > /dev/null 2>&1; then
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
if ! NIFI_TOKEN=$(nifi_fetch_token); then
    echo "Could not obtain a valid NiFi token — processors may need manual start"
    exit 1
fi

if ! start_code=$(nifi_start_all_processors "$NIFI_TOKEN"); then
    echo "Processor start request returned HTTP ${start_code} — processors did not start"
    exit 1
fi
echo "Flow processors started (HTTP $start_code)"

# Verify the flow pipeline actually came up on port 7777 (HandleHttpRequest).
# Starting the processors is necessary but not sufficient; the redeploy path
# previously returned success without ever confirming the listener bound.
if nifi_wait_for_flow_pipeline 120; then
    exit 0
fi

echo "Processors started but flow pipeline on port 7777 did not respond in time"
exit 1
