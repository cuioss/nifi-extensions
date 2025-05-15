FROM apache/nifi:latest

# Set environment variables for NiFi configuration
ENV NIFI_WEB_HTTPS_PORT=8443
ENV SINGLE_USER_CREDENTIALS_USERNAME=admin
ENV SINGLE_USER_CREDENTIALS_PASSWORD=ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB

# Create directory for custom NARs
RUN mkdir -p /opt/nifi/nifi-current/extensions

# Copy the built NAR file to the extensions directory
# This will be handled by the docker-compose.yml file with a volume mount

# Expose the HTTPS port
EXPOSE 8443
