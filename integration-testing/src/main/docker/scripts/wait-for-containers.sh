#!/bin/bash

# Wait for Docker containers (Keycloak + NiFi) to become healthy.
# Extracted from the inline CDATA health-check in integration-testing/pom.xml.
#
# Exit codes:
#   0 — all containers healthy, NiFi UI reachable, flow pipeline ready
#   1 — timeout or readiness failure (diagnostics printed to stdout)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/.."

cd "${DOCKER_DIR}"

# ---------------------------------------------------------------------------
# Stage 1: Wait for containers to be running (Keycloak + NiFi)
# ---------------------------------------------------------------------------
echo "Waiting for containers to start..."
timeout=600
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker compose ps --filter "status=running" | grep -q "nifi\|keycloak"; then
        echo "Containers are running, checking NiFi UI..."

        # -------------------------------------------------------------------
        # Stage 2: Wait for NiFi UI to respond
        # -------------------------------------------------------------------
        if curl -k --fail --max-time 10 https://localhost:9095/nifi/ > /dev/null 2>&1; then
            echo "NiFi UI is accessible, waiting for flow pipeline on port 7777..."

            # ---------------------------------------------------------------
            # Stage 3: Wait for HandleHttpRequest processor (flow pipeline)
            # ---------------------------------------------------------------
            flow_timeout=180
            flow_elapsed=0
            while [ $flow_elapsed -lt $flow_timeout ]; do
                http_code=$(curl --max-time 10 -o /dev/null -s -w '%{http_code}' http://localhost:7777 2>/dev/null || true)
                if [ "$http_code" != "000" ] && [ "$http_code" != "" ]; then
                    echo "Flow pipeline is ready on port 7777 (HTTP $http_code)!"
                    exit 0
                fi
                echo "Waiting for flow pipeline... ($flow_elapsed/$flow_timeout seconds, last status: $http_code)"
                sleep 2
                flow_elapsed=$((flow_elapsed + 2))
            done

            echo "NiFi UI is up but flow pipeline on port 7777 did not respond in time"
            exit 1
        fi
    fi
    echo "Waiting for containers... ($elapsed/$timeout seconds)"
    sleep 5
    elapsed=$((elapsed + 5))
done

echo "Timeout waiting for containers to be ready"
exit 1
