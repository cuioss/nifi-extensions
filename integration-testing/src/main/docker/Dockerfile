FROM apache/nifi:2.4.0

# Set environment variables for NiFi configuration
ENV NIFI_WEB_HTTPS_PORT=9095

# Create directory for custom NARs
RUN mkdir -p /opt/nifi/nifi-current/extensions

# Copy the built NAR file to the extensions directory
# This will be handled by the docker-compose.yml file with a volume mount

# Expose the HTTPS port
EXPOSE 9095
