FROM apache/nifi:2.4.0

# Set environment variables for faster startup and better HTTP configuration
ENV NIFI_WEB_HTTPS_PORT=9095
ENV NIFI_WEB_HTTP_PORT=9094
ENV NIFI_WEB_HTTP_HOST=0.0.0.0
ENV NIFI_JVM_HEAP_INIT=512m
ENV NIFI_JVM_HEAP_MAX=1g
ENV NIFI_BOOTSTRAP_JVM_MIN=512m
ENV NIFI_BOOTSTRAP_JVM_MAX=1g

# Create directory for custom NARs and set permissions
RUN mkdir -p /opt/nifi/nifi-current/extensions && \
    mkdir -p /opt/nifi/nifi-current/nar_extensions && \
    chown -R nifi:nifi /opt/nifi/nifi-current/extensions && \
    chown -R nifi:nifi /opt/nifi/nifi-current/nar_extensions

# Expose both HTTP and HTTPS ports
EXPOSE 9094 9095

# Add health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD curl --fail --max-time 3 http://localhost:9094/nifi/ || exit 1
