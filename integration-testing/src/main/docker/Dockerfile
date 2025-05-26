FROM apache/nifi:2.4.0

# Set environment variables for NiFi configuration
ENV NIFI_WEB_HTTPS_PORT=9095

# Create directory for custom NARs
RUN mkdir -p /opt/nifi/nifi-current/extensions

# Expose the HTTPS port
EXPOSE 9095
