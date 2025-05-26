FROM apache/nifi:2.4.0

# Set environment variables for NiFi configuration
ENV NIFI_WEB_HTTPS_PORT=9095

# Create directory for custom NARs
RUN mkdir -p /opt/nifi/nifi-current/extensions

# Add scripts for credentials and entrypoint
COPY --chmod=755 maintenance/setup-credentials.sh /opt/nifi/scripts/setup-credentials.sh
COPY --chmod=755 custom-entrypoint.sh /opt/nifi/scripts/custom-entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/opt/nifi/scripts/custom-entrypoint.sh"]

# Expose the HTTPS port
EXPOSE 9095
