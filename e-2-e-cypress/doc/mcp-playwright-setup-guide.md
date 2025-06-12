# MCP Playwright Tool Setup Guide for NiFi Extensions

## Quick Setup for MCP Playwright Testing

This guide provides step-by-step instructions to configure the NiFi environment for MCP Playwright tool testing.

> **✨ Simplified**: HTTP-only setup for easy testing and development!

## Start NiFi HTTP Instance

### Step 1: Start the Environment

```bash
cd /Users/oliver/git/nifi-extensions/integration-testing/src/main/docker
./start-nifi.sh
```

This will start:
- **NiFi HTTP**: `http://localhost:9094/nifi` (perfect for MCP Playwright)
- **Keycloak HTTP**: `http://localhost:9080` (admin interface)
- **Keycloak HTTPS**: `https://localhost:9085` (secure authentication)

### Step 2: Test MCP Playwright Access

The MCP Playwright tool can now access NiFi without any issues:
- URL: `http://localhost:9094/nifi`
- No SSL warnings or certificate acceptance needed
- Full browser automation capabilities available

## How It Works

### Simplified Docker Compose Configuration

The `docker-compose.yml` now includes a single NiFi service configured for HTTP-only:

```yaml
services:
  nifi:        # HTTP-only instance on port 9094
  keycloak:    # HTTPS (9085) + HTTP admin (9080)
```

### Environment Variable Configuration

**NiFi** uses environment variables to override the `nifi.properties` file:

```bash
- NIFI_WEB_HTTP_PORT=9094
- NIFI_WEB_HTTPS_PORT=          # Empty = disabled
- NIFI_REMOTE_INPUT_SECURE=false
- NIFI_CLUSTER_PROTOCOL_IS_SECURE=false
```

**Keycloak** maintains HTTPS security:

```bash
- KC_HTTPS_CERTIFICATE_FILE=/opt/keycloak/data/import/certificates/localhost.crt
- KC_HTTPS_CERTIFICATE_KEY_FILE=/opt/keycloak/data/import/certificates/localhost.key
```

### Benefits

✅ **Simple setup** - One command starts everything  
✅ **No configuration file changes** - Environment variables handle it  
✅ **MCP Playwright ready** - HTTP NiFi works seamlessly with browser automation  
✅ **Security maintained** - Keycloak stays on HTTPS for authentication  
✅ **Fast startup** - No NiFi SSL certificate complexity  
✅ **Development friendly** - Perfect for testing and iteration

## Testing the Setup

### Verify NiFi Access
```bash
curl -f http://localhost:9094/nifi/ | head -10
```

### Verify Keycloak HTTPS Access
```bash
curl -k -I https://localhost:9085/
```

### Verify Keycloak HTTP Admin Access
```bash
curl -I http://localhost:9080/
```

### Test MCP Playwright Tool
Use the browser navigation tools to access:
- `http://localhost:9094/nifi` (should work seamlessly)
- Verify login page loads
- Test processor configuration pages

## Stop the Environment

```bash
cd /Users/oliver/git/nifi-extensions/integration-testing/src/main/docker
docker compose down
```

## Current Status

✅ **Simplified HTTP-only setup**  
✅ **MCP Playwright tool compatible**  
✅ **NiFi environment running** on HTTP port 9094  
✅ **No certificate complexity**  
✅ **One command startup**

## Use Cases

- **MCP Playwright testing**: Perfect compatibility with browser automation
- **Local development**: Simple HTTP setup for quick iteration
- **Integration testing**: Reliable environment for automated tests
- **Learning and experimentation**: No SSL complexity to worry about
- Consider firewall rules to restrict HTTP access to localhost only
