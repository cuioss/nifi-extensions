#!/bin/bash

# Script to build the NAR file and copy it to the deployment location.
# Usage: copy-deployment.sh [--skip-build]
#   --skip-build  Skip Maven build (use when Maven reactor already built the NARs)

# Exit on error
set -e

SKIP_BUILD=false
if [ "${1:-}" = "--skip-build" ]; then
    SKIP_BUILD=true
fi

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
NAR_TARGET_DIR="${PROJECT_ROOT}/nifi-cuioss-nar/target"
API_NAR_TARGET_DIR="${PROJECT_ROOT}/nifi-cuioss-api-nar/target"
DEPLOY_DIR="${PROJECT_ROOT}/target/nifi-deploy"

# Navigate to the project root to run Maven
cd "${PROJECT_ROOT}"

# Build the NAR files unless --skip-build was passed (Maven reactor already built them)
if [ "$SKIP_BUILD" = true ] && \
   ls "${NAR_TARGET_DIR}"/nifi-cuioss-nar-*.nar &>/dev/null && \
   ls "${API_NAR_TARGET_DIR}"/nifi-cuioss-api-nar-*.nar &>/dev/null; then
    echo "NAR files already built by Maven reactor, skipping redundant build."
else
    echo "Building NAR files..."
    ./mvnw package -DskipTests -pl '!e-2-e-playwright'
fi

# Copy the NAR files to the target directory (glob matches any version)
mkdir -p "${DEPLOY_DIR}"
echo "Copying NAR files to target directory..."
cp "${API_NAR_TARGET_DIR}"/nifi-cuioss-api-nar-*.nar "${DEPLOY_DIR}/"
cp "${NAR_TARGET_DIR}"/nifi-cuioss-nar-*.nar "${DEPLOY_DIR}/"

echo "NAR files have been built and copied to the deployment location."
