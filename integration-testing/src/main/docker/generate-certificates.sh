#!/bin/bash

# Script to generate a local certificate private/key pair for localhost
# that can be used by both NiFi and Keycloak

# Exit on error
set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/certificates"

# Create certificates directory if it doesn't exist
if [ ! -d "${CERT_DIR}" ]; then
  echo "Creating certificates directory..."
  mkdir -p "${CERT_DIR}"
fi

# Define passwords - using simple passwords for compatibility
KEYSTORE_PASSWORD="password"
TRUSTSTORE_PASSWORD="password"
KEY_PASSWORD="password"

# Define certificate details
CERT_DNAME="CN=localhost, OU=Integration Testing, O=CUI, L=Berlin, ST=Berlin, C=DE"
CERT_VALIDITY=365

# Remove existing keystore and truststore files if they exist
if [ -f "${CERT_DIR}/keystore.p12" ]; then
  echo "Removing existing keystore file..."
  rm "${CERT_DIR}/keystore.p12"
fi
if [ -f "${CERT_DIR}/truststore.p12" ]; then
  echo "Removing existing truststore file..."
  rm "${CERT_DIR}/truststore.p12"
fi
if [ -f "${CERT_DIR}/localhost.cer" ]; then
  echo "Removing existing certificate file..."
  rm "${CERT_DIR}/localhost.cer"
fi
if [ -f "${CERT_DIR}/localhost.crt" ]; then
  echo "Removing existing certificate file..."
  rm "${CERT_DIR}/localhost.crt"
fi
if [ -f "${CERT_DIR}/localhost.key" ]; then
  echo "Removing existing key file..."
  rm "${CERT_DIR}/localhost.key"
fi

# Generate keystore with private key and self-signed certificate
echo "Generating keystore with private key and self-signed certificate..."
keytool -genkeypair \
  -alias localhost \
  -keyalg RSA \
  -keysize 2048 \
  -validity ${CERT_VALIDITY} \
  -dname "${CERT_DNAME}" \
  -ext san=dns:localhost,ip:127.0.0.1 \
  -keystore "${CERT_DIR}/keystore.p12" \
  -storetype PKCS12 \
  -storepass "${KEYSTORE_PASSWORD}" \
  -keypass "${KEY_PASSWORD}"

# Export the certificate
echo "Exporting certificate..."
keytool -exportcert \
  -alias localhost \
  -file "${CERT_DIR}/localhost.cer" \
  -keystore "${CERT_DIR}/keystore.p12" \
  -storetype PKCS12 \
  -storepass "${KEYSTORE_PASSWORD}"

# Create truststore and import the certificate
echo "Creating truststore and importing certificate..."
keytool -importcert \
  -alias localhost \
  -file "${CERT_DIR}/localhost.cer" \
  -keystore "${CERT_DIR}/truststore.p12" \
  -storetype PKCS12 \
  -storepass "${TRUSTSTORE_PASSWORD}" \
  -noprompt

# Remove existing keystore and truststore files in NiFi conf directory if they exist
if [ -f "${SCRIPT_DIR}/nifi/conf/keystore.p12" ]; then
  echo "Removing existing keystore file from NiFi conf directory..."
  rm "${SCRIPT_DIR}/nifi/conf/keystore.p12"
fi
if [ -f "${SCRIPT_DIR}/nifi/conf/truststore.p12" ]; then
  echo "Removing existing truststore file from NiFi conf directory..."
  rm "${SCRIPT_DIR}/nifi/conf/truststore.p12"
fi

# Copy keystore and truststore to NiFi conf directory
echo "Copying keystore and truststore to NiFi conf directory..."
cp "${CERT_DIR}/keystore.p12" "${SCRIPT_DIR}/nifi/conf/"
cp "${CERT_DIR}/truststore.p12" "${SCRIPT_DIR}/nifi/conf/"

# Update NiFi properties file with plain text passwords
echo "Updating NiFi properties file with plain text passwords..."
sed -i "s/nifi.security.keystorePasswd=.*/nifi.security.keystorePasswd=${KEYSTORE_PASSWORD}/" "${SCRIPT_DIR}/nifi/conf/nifi.properties"
sed -i "s/nifi.security.keyPasswd=.*/nifi.security.keyPasswd=${KEY_PASSWORD}/" "${SCRIPT_DIR}/nifi/conf/nifi.properties"
sed -i "s/nifi.security.truststorePasswd=.*/nifi.security.truststorePasswd=${TRUSTSTORE_PASSWORD}/" "${SCRIPT_DIR}/nifi/conf/nifi.properties"

# Create Keycloak certificate directory if it doesn't exist
KEYCLOAK_CERT_DIR="${SCRIPT_DIR}/keycloak/certificates"
if [ ! -d "${KEYCLOAK_CERT_DIR}" ]; then
  echo "Creating Keycloak certificates directory..."
  mkdir -p "${KEYCLOAK_CERT_DIR}"
fi

# Export certificate and private key in PEM format for Keycloak
echo "Exporting certificate and private key in PEM format for Keycloak..."
# Export certificate in PEM format
keytool -exportcert \
  -alias localhost \
  -file "${CERT_DIR}/localhost.crt" \
  -keystore "${CERT_DIR}/keystore.p12" \
  -storetype PKCS12 \
  -storepass "${KEYSTORE_PASSWORD}" \
  -rfc

# Export private key in PEM format (requires OpenSSL)
# First, export the key and certificate to a PKCS12 file
keytool -importkeystore \
  -srckeystore "${CERT_DIR}/keystore.p12" \
  -srcstoretype PKCS12 \
  -srcstorepass "${KEYSTORE_PASSWORD}" \
  -srcalias localhost \
  -destkeystore "${CERT_DIR}/temp.p12" \
  -deststoretype PKCS12 \
  -deststorepass "${KEYSTORE_PASSWORD}" \
  -destalias localhost

# Then, use OpenSSL to extract the private key
openssl pkcs12 \
  -in "${CERT_DIR}/temp.p12" \
  -nodes \
  -nocerts \
  -out "${CERT_DIR}/localhost.key" \
  -password pass:${KEYSTORE_PASSWORD}

# Remove the temporary file
rm "${CERT_DIR}/temp.p12"

# Remove existing certificate files in Keycloak directory if they exist
if [ -f "${KEYCLOAK_CERT_DIR}/localhost.crt" ]; then
  echo "Removing existing certificate file from Keycloak directory..."
  rm "${KEYCLOAK_CERT_DIR}/localhost.crt"
fi
if [ -f "${KEYCLOAK_CERT_DIR}/localhost.key" ]; then
  echo "Removing existing key file from Keycloak directory..."
  rm "${KEYCLOAK_CERT_DIR}/localhost.key"
fi

# Copy certificates to Keycloak directory
echo "Copying certificates to Keycloak directory..."
cp "${CERT_DIR}/localhost.crt" "${KEYCLOAK_CERT_DIR}/"
cp "${CERT_DIR}/localhost.key" "${KEYCLOAK_CERT_DIR}/"

echo "Certificate generation complete."
echo "Keystore password: ${KEYSTORE_PASSWORD}"
echo "Truststore password: ${TRUSTSTORE_PASSWORD}"
echo "Key password: ${KEY_PASSWORD}"
