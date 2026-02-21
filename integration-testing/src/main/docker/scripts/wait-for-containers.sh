#!/bin/bash

# Wait for Docker containers (Keycloak + NiFi) to become healthy.
# Extracted from the inline CDATA health-check in integration-testing/pom.xml.
#
# Exit codes:
#   0 — all containers healthy, NiFi API ready, flow pipeline ready
#   1 — timeout or readiness failure (diagnostics printed to stdout)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/.."

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
        https://localhost:9095/nifi-api/access/config 2>/dev/null || true)

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
# Stage 3: Wait for HandleHttpRequest processor (flow pipeline on port 7777)
# ---------------------------------------------------------------------------
echo "Waiting for flow pipeline on port 7777..."
flow_timeout=120
flow_elapsed=0
while [ $flow_elapsed -lt $flow_timeout ]; do
    http_code=$(curl --max-time 10 -o /dev/null -s -w '%{http_code}' \
        http://localhost:7777 2>/dev/null || true)
    if [ "$http_code" != "000" ] && [ "$http_code" != "" ]; then
        echo "Flow pipeline is ready on port 7777 (HTTP $http_code)!"
        exit 0
    fi
    echo "Waiting for flow pipeline... ($flow_elapsed/${flow_timeout}s, HTTP $http_code)"
    sleep 2
    flow_elapsed=$((flow_elapsed + 2))
done

echo "NiFi API is up but flow pipeline on port 7777 did not respond in time"
docker compose logs --tail=30 nifi
exit 1
