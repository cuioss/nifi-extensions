#!/bin/bash

# Script to build the NAR file and copy it to the deployment location

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
NAR_TARGET_DIR="${PROJECT_ROOT}/nifi-cuioss-nar/target"
DEPLOY_DIR="${PROJECT_ROOT}/target/nifi-deploy"

# Navigate to the project root to run Maven
cd "${PROJECT_ROOT}"

# Build the NAR file (excluding e-2-e-cypress to avoid circular dependency)
echo "Building NAR file..."
./mvnw package -DskipTests -pl '!e-2-e-cypress'

# Ensure the NiFi NAR extensions directory exists in the parent project
if [ ! -d "${NAR_TARGET_DIR}" ]; then
  echo "Creating NiFi NAR extensions directory..."
  mkdir -p "${NAR_TARGET_DIR}"
fi

# Ensure the target directory for the NAR file exists
if [ ! -d "${DEPLOY_DIR}" ]; then
  echo "Creating target directory for NAR file..."
  mkdir -p "${DEPLOY_DIR}"
fi

# Copy the NAR file to the target directory
echo "Copying NAR file to target directory..."
cp "${NAR_TARGET_DIR}/nifi-cuioss-nar-1.0-SNAPSHOT.nar" "${DEPLOY_DIR}/"

echo "NAR file has been built and copied to the deployment location."
