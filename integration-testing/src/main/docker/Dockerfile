FROM apache/nifi:2.10.0@sha256:362d7a7caa27f246f2fd8797f906cb216ae71546e15abee5c6b579187c42e28e

# Set environment variables for faster startup and HTTPS configuration.
# NiFi 2.x is HTTPS-only: setting both NIFI_WEB_HTTP_PORT and NIFI_WEB_HTTPS_PORT
# makes NiFi reject the configuration and refuse to start, so only the HTTPS
# port is configured here. docker-compose overrides NIFI_WEB_HTTPS_PORT to 8443
# and supplies its own healthcheck; a standalone `docker run` serves HTTPS on
# 9095 and the baked healthcheck below matches that port.
ENV NIFI_WEB_HTTPS_PORT=9095
ENV NIFI_JVM_HEAP_INIT=512m
ENV NIFI_JVM_HEAP_MAX=1g
ENV NIFI_BOOTSTRAP_JVM_MIN=512m
ENV NIFI_BOOTSTRAP_JVM_MAX=1g

# Copy custom configuration files and set proper ownership
# NOTE: NiFi 2.x requires flow.json.gz (gzipped). If you update flow.json,
# regenerate it: gzip -c flow.json > flow.json.gz
COPY --chown=nifi:nifi nifi/conf/ /opt/nifi/nifi-current/conf/

# Expose HTTPS, flow pipeline, and REST API gateway ports
EXPOSE 9095 7777 9443

# Add health check (matches the standalone HTTPS port; compose overrides it)
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD ["sh", "-c", "curl -k --fail --max-time 3 https://localhost:9095/nifi/ || exit 1"]
