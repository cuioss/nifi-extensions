#!/bin/bash

# Wait for Docker containers (Keycloak + NiFi) to become healthy.
# Extracted from the inline CDATA health-check in integration-testing/pom.xml.
#
# Failure semantics: LENIENT for the processor start — a token/start failure only
# warns, and the flow-pipeline wait in Stage 3 decides the exit code. This differs
# deliberately from wait-and-start-processors.sh, which aborts on any failure.
#
# Exit codes:
#   0 — all containers healthy, NiFi API ready, flow pipeline ready
#   1 — timeout or readiness failure (diagnostics printed to stdout)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/.."

# Shared token-fetch / processor-start helpers; also loads test-credentials.env.
# shellcheck source=lib-start-processors.sh disable=SC1091
. "${SCRIPT_DIR}/lib-start-processors.sh"

cd "${DOCKER_DIR}"

# ---------------------------------------------------------------------------
# Stage 1: Wait for containers to be running (Keycloak + NiFi)
# ---------------------------------------------------------------------------
echo "Waiting for containers to start..."
container_timeout=120
elapsed=0
while [ $elapsed -lt $container_timeout ]; do
    if docker compose ps --filter "status=running" | grep -q "nifi" && \
       docker compose ps --filter "status=running" | grep -q "keycloak"; then
        echo "Both containers are running."
        break
    fi
    echo "Waiting for containers... ($elapsed/${container_timeout}s)"
    sleep 5
    elapsed=$((elapsed + 5))
done

if [ $elapsed -ge $container_timeout ]; then
    echo "Timeout waiting for containers to start"
    docker compose ps
    exit 1
fi

# ---------------------------------------------------------------------------
# Stage 2: Wait for NiFi API to be ready (not just splash screen)
#
# The splash screen serves /nifi/ with HTTP 200 long before the REST API
# and login system are initialized. We check /nifi-api/access/config which
# only returns valid JSON once the framework is fully ready.
# ---------------------------------------------------------------------------
echo "Waiting for NiFi API to become ready..."
api_timeout=300
api_elapsed=0
while [ $api_elapsed -lt $api_timeout ]; do
    # /nifi-api/access/config returns 200 or 401 once the REST framework and
    # login system are initialized. During the splash screen phase it returns
    # 000 (connection reset) or 503. We accept 200 and 401 as "API ready".
    http_code=$(curl -k --max-time 10 -o /dev/null -s -w '%{http_code}' \
        "${NIFI_BASE_URL}/nifi-api/access/config" 2>/dev/null || true)

    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
        echo "NiFi API is ready (HTTP $http_code after ${api_elapsed}s)."
        break
    fi

    echo "NiFi API not ready ($api_elapsed/${api_timeout}s, HTTP $http_code)"
    sleep 5
    api_elapsed=$((api_elapsed + 5))
done

if [ $api_elapsed -ge $api_timeout ]; then
    echo "Timeout waiting for NiFi API to become ready"
    echo "Last HTTP status from /nifi-api/access/config: $http_code"
    docker compose logs --tail=50 nifi
    exit 1
fi

# ---------------------------------------------------------------------------
# Stage 2b: Start all processors via NiFi REST API
#
# On fresh deployments NiFi loads flow.json but does not auto-start
# processors (no prior runtime state to resume). The API call ensures
# all processors with scheduledState=RUNNING actually start.
# ---------------------------------------------------------------------------
echo "Starting all flow processors via NiFi API..."
if NIFI_TOKEN=$(nifi_fetch_token); then
    if start_code=$(nifi_start_all_processors "$NIFI_TOKEN"); then
        echo "Flow processors started (HTTP $start_code)."
    else
        echo "WARNING: processor start request returned HTTP ${start_code} — processors may not be running"
    fi
else
    echo "WARNING: Could not obtain a valid NiFi token — processors may need manual start"
fi

# ---------------------------------------------------------------------------
# Stage 3: Wait for HandleHttpRequest processor (flow pipeline on port 7777)
# ---------------------------------------------------------------------------
if nifi_wait_for_flow_pipeline 120; then
    exit 0
fi

echo "NiFi API is up but flow pipeline on port 7777 did not respond in time"
docker compose logs --tail=30 nifi
exit 1
