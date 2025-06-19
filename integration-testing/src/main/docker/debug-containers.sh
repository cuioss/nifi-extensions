#!/bin/bash

# Debug script for container startup issues
echo "=== Docker Container Diagnostics ==="
echo "Timestamp: $(date)"
echo ""

echo "=== Docker System Information ==="
docker version --format 'Docker version: {{.Server.Version}}'
docker system df
echo ""

echo "=== Available System Resources ==="
echo "Memory:"
free -h || echo "free command not available"
echo "Disk space:"
df -h . || echo "df command not available"
echo ""

echo "=== Container Status ==="
docker compose ps
echo ""

echo "=== Container Resource Usage ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" || echo "Stats not available"
echo ""

echo "=== Network Information ==="
docker network ls
echo ""

echo "=== Volume Information ==="
docker volume ls
echo ""

echo "=== Recent NiFi Logs (last 30 lines) ==="
docker compose logs --tail=30 nifi 2>/dev/null || echo "NiFi container not found or not running"
echo ""

echo "=== Recent Keycloak Logs (last 15 lines) ==="
docker compose logs --tail=15 keycloak 2>/dev/null || echo "Keycloak container not found or not running"
echo ""

echo "=== Port Checks ==="
echo "Checking port 9094 (NiFi HTTP):"
if curl --fail --max-time 3 --silent http://localhost:9094/nifi/ > /dev/null 2>&1; then
    echo "✅ NiFi HTTP (9094) is accessible"
else
    echo "❌ NiFi HTTP (9094) is not accessible"
fi

echo "Checking port 9085 (Keycloak HTTPS):"
if curl --fail --max-time 3 --silent -k https://localhost:9085/realms/nifi > /dev/null 2>&1; then
    echo "✅ Keycloak HTTPS (9085) is accessible"
else
    echo "❌ Keycloak HTTPS (9085) is not accessible"
fi

echo "Checking port 9080 (Keycloak HTTP):"
if curl --fail --max-time 3 --silent http://localhost:9080/ > /dev/null 2>&1; then
    echo "✅ Keycloak HTTP (9080) is accessible"
else
    echo "❌ Keycloak HTTP (9080) is not accessible"
fi

echo ""
echo "=== End of Diagnostics ==="
