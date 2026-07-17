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
listener_bound=0
while [ $flow_elapsed -lt $flow_timeout ]; do
    http_code=$(curl --max-time 10 -o /dev/null -s -w '%{http_code}' \
        http://localhost:7777 2>/dev/null || true)
    if [ "$http_code" != "000" ] && [ -n "$http_code" ]; then
        echo "Flow pipeline listener is bound on port 7777 (HTTP $http_code)"
        listener_bound=1
        break
    fi
    echo "Waiting for flow pipeline... ($flow_elapsed/${flow_timeout}s, HTTP $http_code)"
    sleep 2
    flow_elapsed=$((flow_elapsed + 2))
done

if [ $listener_bound -ne 1 ]; then
    echo "Processors started but flow pipeline on port 7777 did not respond in time"
    exit 1
fi

# A bound listener is still not sufficient. token-sheriff loads each issuer's JWKS
# asynchronously in a background thread, so the gateway answers 401 to every request
# until the issuer configuration finishes loading and becomes healthy. If integration
# tests fire during that startup window they spuriously observe 401 instead of the
# expected 200/202. Wait until a request bearing a VALID Keycloak token is accepted
# (any non-401 response) on both gateway listeners before declaring readiness.
KC_TOKEN_ENDPOINT="https://localhost:9085/realms/oauth_integration_tests/protocol/openid-connect/token"

# Poll a gateway URL with a valid bearer token until it stops returning 401.
# Args: <url> <label>. Returns 0 on success, 1 on timeout.
wait_for_healthy_issuer() {
    local url="$1" label="$2"
    local timeout=120 elapsed=0 token auth_code
    echo "Waiting for JWT issuer to become healthy via $label ($url)..."
    while [ $elapsed -lt $timeout ]; do
        token=$(curl -sk --max-time 10 -X POST "$KC_TOKEN_ENDPOINT" \
            -d "grant_type=password" -d "client_id=test_client" \
            -d "username=testUser" -d "password=drowssap" -d "scope=openid" 2>/dev/null \
            | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || true)
        if [ -n "$token" ]; then
            auth_code=$(curl -sk --max-time 10 -o /dev/null -w '%{http_code}' \
                -H "Authorization: Bearer $token" "$url" 2>/dev/null || true)
            if [ -n "$auth_code" ] && [ "$auth_code" != "401" ] && [ "$auth_code" != "000" ]; then
                echo "  $label issuer is healthy (HTTP $auth_code for a valid token)"
                return 0
            fi
        else
            auth_code="no-token"
        fi
        echo "  Waiting for $label issuer health... ($elapsed/${timeout}s, HTTP ${auth_code:-000})"
        sleep 2
        elapsed=$((elapsed + 2))
    done
    echo "  $label issuer did not become healthy within ${timeout}s (kept returning 401)"
    return 1
}

# The flow pipeline (HandleHttpRequest → MultiIssuerJWTTokenAuthenticator, port 7777) and
# the RestApiGateway (port 9443) both reference the SAME shared JwtIssuerConfigService
# controller service, so a healthy issuer observed on 7777 means the issuer JWKS is loaded
# for every processor. Each IT still waits for its own listener to bind (waitForEndpoint);
# the wait here only closes the asynchronous issuer-loading window.
if ! wait_for_healthy_issuer "http://localhost:7777" "flow pipeline (7777)"; then
    exit 1
fi

echo "Flow pipeline is ready on port 7777 and JWT issuer is healthy"
exit 0
