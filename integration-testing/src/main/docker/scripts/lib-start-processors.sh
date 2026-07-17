#!/bin/bash

# Shared NiFi processor-start helpers.
#
# Sourced by:
#   - ../wait-and-start-processors.sh   (strict: any failure aborts the deploy)
#   - ./wait-for-containers.sh          (lenient: failures warn, the pipeline
#                                        wait still decides the outcome)
#
# This file is meant to be SOURCED, not executed. It defines functions and
# loads the shared test credentials; it performs no work on its own.
#
# The two callers deliberately keep DIFFERENT failure semantics, so these
# helpers only report success/failure and never exit on the caller's behalf.

# Resolve this library's own directory so the credential file is found
# regardless of the caller's working directory.
LIB_START_PROCESSORS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Single definition site for the credentials (see ../test-credentials.env).
# shellcheck source=../test-credentials.env disable=SC1091
. "${LIB_START_PROCESSORS_DIR}/../test-credentials.env"

NIFI_BASE_URL="${NIFI_BASE_URL:-https://localhost:9095}"
FLOW_PIPELINE_URL="${FLOW_PIPELINE_URL:-http://localhost:7777}"

# Keycloak token endpoint (realm oauth_integration_tests) and public client used by the
# integration tests. Kept in agreement with IntegrationTestSupport.java.
KEYCLOAK_TOKEN_URL="${KEYCLOAK_TOKEN_URL:-https://localhost:9085/realms/oauth_integration_tests/protocol/openid-connect/token}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-test_client}"

# Fetch a NiFi access token using the shared test credentials.
#
# Echoes the token on stdout when one is obtained.
# Returns 0 when the response is a syntactically valid JWT, 1 otherwise.
nifi_fetch_token() {
    local token
    token=$(curl -sk -X POST "${NIFI_BASE_URL}/nifi-api/access/token" \
        -d "username=${TEST_USER_NAME}&password=${TEST_USER_PASSWORD}" \
        -H "Content-Type: application/x-www-form-urlencoded" 2>/dev/null || true)

    # A valid NiFi access token is a JWT: three base64url segments separated by dots.
    # A non-empty body alone is not proof — an HTML/JSON error page is also non-empty
    # and must not be forwarded as a bearer token.
    if ! printf '%s' "$token" | grep -Eq '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'; then
        return 1
    fi

    printf '%s' "$token"
}

# Start every processor in the root process group.
#
# $1 — a bearer token obtained from nifi_fetch_token.
# Echoes the HTTP status code (000 when the request could not be made).
# Returns 0 on HTTP 200, 1 otherwise.
nifi_start_all_processors() {
    local token="$1"
    local start_code
    start_code=$(curl -sk -o /dev/null -w '%{http_code}' -X PUT \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d '{"id":"root","state":"RUNNING"}' \
        "${NIFI_BASE_URL}/nifi-api/flow/process-groups/root" 2>/dev/null || true)

    printf '%s' "${start_code:-000}"
    [ "$start_code" = "200" ]
}

# Wait for the flow pipeline (HandleHttpRequest) to accept connections.
#
# Starting the processors is necessary but not sufficient; the redeploy path
# previously returned success without ever confirming the listener bound.
#
# $1 — timeout in seconds (default 120).
# Returns 0 once the pipeline responds, 1 on timeout.
nifi_wait_for_flow_pipeline() {
    local timeout="${1:-120}"
    local elapsed=0
    local http_code

    echo "Waiting for flow pipeline on ${FLOW_PIPELINE_URL}..."
    while [ "$elapsed" -lt "$timeout" ]; do
        http_code=$(curl --max-time 10 -o /dev/null -s -w '%{http_code}' \
            "${FLOW_PIPELINE_URL}" 2>/dev/null || true)
        if [ -n "$http_code" ] && [ "$http_code" != "000" ]; then
            echo "Flow pipeline is ready on ${FLOW_PIPELINE_URL} (HTTP $http_code)"
            return 0
        fi
        echo "Waiting for flow pipeline... ($elapsed/${timeout}s, HTTP $http_code)"
        sleep 2
        elapsed=$((elapsed + 2))
    done

    return 1
}

# Wait for the JWT issuer configuration to become healthy.
#
# A bound flow-pipeline listener is necessary but not sufficient: token-sheriff (0.9.2+)
# loads each issuer's JWKS ASYNCHRONOUSLY in a background thread, so the gateway answers
# 401 to every request BEFORE the issuer finishes loading and becomes healthy. Integration
# tests firing in that window spuriously observe 401 instead of the expected 200/202.
#
# Poll the flow pipeline with a VALID Keycloak token until it stops returning 401. The
# flow pipeline (7777) and the RestApiGateway (9443) share ONE JwtIssuerConfigService
# controller service, so a healthy result here means the issuer JWKS is loaded for every
# processor.
#
# $1 — timeout in seconds (default 120).
# Returns 0 once a valid token is accepted (non-401), 1 on timeout.
nifi_wait_for_healthy_issuer() {
    local timeout="${1:-120}"
    local elapsed=0
    local token auth_code

    echo "Waiting for JWT issuer to become healthy via ${FLOW_PIPELINE_URL}..."
    while [ "$elapsed" -lt "$timeout" ]; do
        token=$(curl -sk --max-time 10 -X POST "${KEYCLOAK_TOKEN_URL}" \
            -d "grant_type=password" -d "client_id=${KEYCLOAK_CLIENT_ID}" \
            -d "username=${TEST_USER_NAME}" -d "password=${TEST_USER_PASSWORD}" \
            -d "scope=openid" 2>/dev/null \
            | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || true)
        if [ -n "$token" ]; then
            auth_code=$(curl -sk --max-time 10 -o /dev/null -w '%{http_code}' \
                -H "Authorization: Bearer ${token}" "${FLOW_PIPELINE_URL}" 2>/dev/null || true)
            if [ -n "$auth_code" ] && [ "$auth_code" != "401" ] && [ "$auth_code" != "000" ]; then
                echo "JWT issuer is healthy (HTTP $auth_code for a valid token)"
                return 0
            fi
        else
            auth_code="no-token"
        fi
        echo "Waiting for issuer health... ($elapsed/${timeout}s, HTTP ${auth_code:-000})"
        sleep 2
        elapsed=$((elapsed + 2))
    done

    return 1
}
