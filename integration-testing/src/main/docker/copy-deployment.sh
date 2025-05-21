#!/bin/bash

# Script to build the NAR file and copy it to the deployment location

# Exit on error
set -e

# Navigate to the project root
cd "$(dirname "$0")/../../../.."

# Build the NAR file
echo "Building NAR file..."
./mvnw package -DskipTests

# Navigate to the Docker directory
cd integration-testing/src/main/docker

# Ensure the NiFi NAR extensions directory exists in the parent project
if [ ! -d "../../../../nifi-cuioss-nar/target" ]; then
  echo "Creating NiFi NAR extensions directory..."
  mkdir -p ../../../../nifi-cuioss-nar/target
fi

# Ensure the target directory for the NAR file exists
if [ ! -d "../../../target/nifi-deploy" ]; then
  echo "Creating target directory for NAR file..."
  mkdir -p ../../../target/nifi-deploy
fi

# Copy the NAR file to the target directory
echo "Copying NAR file to target directory..."
cp ../../../../nifi-cuioss-nar/target/nifi-cuioss-nar-1.0-SNAPSHOT.nar ../../../target/nifi-deploy/

echo "NAR file has been built and copied to the deployment location."