#!/bin/bash

# Script to build the two NAR files and copy them to the deployment location.
# Usage: copy-deployment.sh [--skip-build]
#   --skip-build  Skip the nested Maven build when both NAR files already exist.
#                 If one is missing, the nested build runs despite the flag. The
#                 CI lanes build only their own module and its upstream modules,
#                 not the NAR modules, so there the nested build normally runs.

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

# Build the NAR files, unless --skip-build was passed and both NAR files exist.
# The nested build covers the two NAR modules and the modules they need (-am).
if [ "$SKIP_BUILD" = true ] && \
   ls "${NAR_TARGET_DIR}"/nifi-cuioss-nar-*.nar &>/dev/null && \
   ls "${API_NAR_TARGET_DIR}"/nifi-cuioss-api-nar-*.nar &>/dev/null; then
    echo "Both NAR files already exist, skipping the nested build."
else
    echo "Building NAR files..."
    ./mvnw package -DskipTests -pl nifi-cuioss-nar,nifi-cuioss-api-nar -am
fi

# Copy the NAR files to the target directory (glob matches any version).
#
# Purge any previously-staged cuioss NARs FIRST. The deploy dir is not cleaned by a
# plain `mvn verify` (no `clean`), so across a version bump (e.g. 0.5.0-SNAPSHOT ->
# 0.6.0-SNAPSHOT) a stale NAR of the old version would linger here. NiFi then loads
# BOTH versions and may instantiate the older processor — which lacks newer properties
# and validates as INVALID, so its gateway listener never binds. Removing old NARs
# before copying guarantees exactly one version is deployed.
mkdir -p "${DEPLOY_DIR}"
echo "Removing any previously-staged cuioss NAR files..."
rm -f "${DEPLOY_DIR}"/nifi-cuioss-api-nar-*.nar "${DEPLOY_DIR}"/nifi-cuioss-nar-*.nar
echo "Copying NAR files to target directory..."
cp "${API_NAR_TARGET_DIR}"/nifi-cuioss-api-nar-*.nar "${DEPLOY_DIR}/"
cp "${NAR_TARGET_DIR}"/nifi-cuioss-nar-*.nar "${DEPLOY_DIR}/"

echo "NAR files have been copied to the deployment location."
