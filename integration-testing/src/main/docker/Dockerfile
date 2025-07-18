FROM apache/nifi:2.4.0

# Set environment variables for faster startup and better HTTP configuration
ENV NIFI_WEB_HTTPS_PORT=9095
ENV NIFI_WEB_HTTP_PORT=9094
ENV NIFI_WEB_HTTP_HOST=0.0.0.0
ENV NIFI_JVM_HEAP_INIT=512m
ENV NIFI_JVM_HEAP_MAX=1g
ENV NIFI_BOOTSTRAP_JVM_MIN=512m
ENV NIFI_BOOTSTRAP_JVM_MAX=1g

# Copy custom configuration files and set proper ownership
COPY --chown=nifi:nifi nifi/conf/ /opt/nifi/nifi-current/conf/

# Expose both HTTP and HTTPS ports
EXPOSE 9094 9095

# Add health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD ["sh", "-c", "curl -k --fail --max-time 3 https://localhost:9095/nifi/ || exit 1"]
