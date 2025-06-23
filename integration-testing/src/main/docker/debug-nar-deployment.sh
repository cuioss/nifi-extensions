#!/bin/bash

# Debug script to check NAR deployment status

echo "=== NAR Deployment Debug Information ==="
echo "Timestamp: $(date)"
echo ""

# Check if the NAR file exists in the host deploy directory
HOST_DEPLOY_DIR="../../../target/nifi-deploy"
echo "=== Host Deploy Directory: $HOST_DEPLOY_DIR ==="
if [ -d "$HOST_DEPLOY_DIR" ]; then
    echo "Contents:"
    ls -la "$HOST_DEPLOY_DIR"
    echo ""
    
    # Check NAR file details
    NAR_FILE="$HOST_DEPLOY_DIR/nifi-cuioss-nar-1.0-SNAPSHOT.nar"
    if [ -f "$NAR_FILE" ]; then
        echo "NAR file exists: $NAR_FILE"
        echo "Size: $(stat -f%z "$NAR_FILE" 2>/dev/null || stat -c%s "$NAR_FILE" 2>/dev/null || echo "unknown")"
        echo "Modified: $(stat -f%m "$NAR_FILE" 2>/dev/null || stat -c%y "$NAR_FILE" 2>/dev/null || echo "unknown")"
        
        # Check NAR file contents
        echo ""
        echo "NAR file contents:"
        jar -tf "$NAR_FILE" | head -20
        echo "(showing first 20 entries...)"
        echo ""
        
        # Look for processor classes specifically
        echo "Looking for processor classes in NAR:"
        jar -tf "$NAR_FILE" | grep -i processor | grep -i class || echo "No processor classes found"
        echo ""
        
        # Look for service definitions
        echo "Looking for service definitions in NAR:"
        jar -tf "$NAR_FILE" | grep -i "services" || echo "No service directories found"
        echo ""
        
    else
        echo "❌ NAR file not found: $NAR_FILE"
    fi
else
    echo "❌ Host deploy directory not found: $HOST_DEPLOY_DIR"
fi

echo ""
echo "=== Docker Container NAR Directory ==="
# Check if containers are running
if docker compose ps | grep -q "nifi.*Up"; then
    echo "Checking NAR extensions directory in NiFi container..."
    docker compose exec nifi ls -la /opt/nifi/nifi-current/nar_extensions/ || echo "❌ Could not access nar_extensions directory"
    echo ""
    
    echo "Checking standard lib directory in NiFi container..."
    docker compose exec nifi ls -la /opt/nifi/nifi-current/lib/ | grep -i cuioss || echo "No cuioss NAR found in lib directory"
    echo ""
    
    echo "Checking if NiFi recognizes the processors..."
    # Check NiFi logs for processor loading
    echo "=== Recent NiFi logs related to processors ==="
    docker compose logs nifi | grep -i processor | tail -10 || echo "No processor-related logs found"
    echo ""
    
    echo "=== Recent NiFi logs related to NAR loading ==="
    docker compose logs nifi | grep -i nar | tail -10 || echo "No NAR-related logs found"
    echo ""
    
    echo "=== Checking NiFi API for available processor types ==="
    # Try to get processor types from NiFi API
    if curl -k --fail --max-time 5 --silent "https://localhost:9095/nifi-api/flow/processor-types" > /tmp/processor-types.json 2>/dev/null; then
        echo "Successfully retrieved processor types from API"
        if grep -i "MultiIssuerJWTTokenAuthenticator\|JWTTokenAuthenticator" /tmp/processor-types.json > /dev/null; then
            echo "✅ JWT processors found in API response!"
            grep -i "MultiIssuerJWTTokenAuthenticator\|JWTTokenAuthenticator" /tmp/processor-types.json
        else
            echo "❌ JWT processors NOT found in API response"
            echo "Total processor types found: $(jq '.processorTypes | length' /tmp/processor-types.json 2>/dev/null || echo "Could not count")"
            echo ""
            echo "Looking for any cuioss-related processors:"
            grep -i cuioss /tmp/processor-types.json || echo "No cuioss processors found"
        fi
        rm -f /tmp/processor-types.json
    else
        echo "❌ Could not retrieve processor types from NiFi API"
    fi
    
else
    echo "❌ NiFi container is not running"
fi

echo ""
echo "=== Docker Volume Mount Analysis ==="
echo "Checking docker-compose volume configuration..."
docker compose config | grep -A5 -B5 "nar_extensions" || echo "No nar_extensions volume configuration found"

echo ""
echo "=== End of NAR Deployment Debug ==="
