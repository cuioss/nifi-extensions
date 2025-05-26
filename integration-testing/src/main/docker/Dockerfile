FROM apache/nifi:2.4.0

# Set environment variables for NiFi configuration
ENV NIFI_WEB_HTTPS_PORT=9095

# Create directory for custom NARs
RUN mkdir -p /opt/nifi/nifi-current/extensions

# Add entrypoint script to correctly set credentials before NiFi starts
COPY maintenance/setup-credentials.sh /opt/nifi/scripts/setup-credentials.sh
RUN chmod +x /opt/nifi/scripts/setup-credentials.sh

# Update the entrypoint script to include our credentials setup
COPY custom-entrypoint.sh /opt/nifi/scripts/custom-entrypoint.sh
RUN chmod +x /opt/nifi/scripts/custom-entrypoint.sh
ENTRYPOINT ["/opt/nifi/scripts/custom-entrypoint.sh"]

# Expose the HTTPS port
EXPOSE 9095
