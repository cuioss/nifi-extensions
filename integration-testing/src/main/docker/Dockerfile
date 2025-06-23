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

# Copy custom configuration files and set proper ownership
COPY --chown=nifi:nifi nifi/conf/ /opt/nifi/nifi-current/conf/

# Create startup script to copy NAR files to lib directory
RUN echo '#!/bin/bash' > /opt/nifi/scripts/copy-custom-nars.sh && \
    echo 'echo "Copying custom NAR files to lib directory..."' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo 'if [ -d "/opt/nifi/nifi-current/nar_extensions" ]; then' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo '  for nar in /opt/nifi/nifi-current/nar_extensions/*.nar; do' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo '    if [ -f "$nar" ]; then' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo '      echo "Copying $nar to lib directory..."' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo '      cp "$nar" /opt/nifi/nifi-current/lib/' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo '    fi' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo '  done' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo 'fi' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    echo 'echo "Custom NAR files copied successfully."' >> /opt/nifi/scripts/copy-custom-nars.sh && \
    chmod +x /opt/nifi/scripts/copy-custom-nars.sh && \
    chown nifi:nifi /opt/nifi/scripts/copy-custom-nars.sh

# Expose both HTTP and HTTPS ports
EXPOSE 9094 9095

# Add health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD curl -k --fail --max-time 3 https://localhost:9095/nifi/ || exit 1

# Override entrypoint to copy NAR files before starting NiFi
ENTRYPOINT ["/bin/bash", "-c", "/opt/nifi/scripts/copy-custom-nars.sh && exec /opt/nifi/scripts/start.sh"]
