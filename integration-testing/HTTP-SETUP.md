# Integration Testing Environment - HTTP Setup

## Overview

The NiFi integration testing environment has been updated to use HTTP by default for optimal testing and development experience, while maintaining HTTPS capability as an option.

## Current Configuration

### Default Setup (HTTP)
- **NiFi**: HTTP on port 9094 (`http://localhost:9094/nifi`)
- **Keycloak HTTPS**: Port 9085 (`https://localhost:9085`)
- **Keycloak HTTP Admin**: Port 9080 (`http://localhost:9080`)

### Benefits
- ✅ Perfect for MCP Playwright testing (no SSL issues)
- ✅ Fast startup (no certificate complexity)
- ✅ Simple development workflow
- ✅ Secure authentication maintained via Keycloak HTTPS

## Quick Start

```bash
cd integration-testing/src/main/docker
./start-nifi.sh
```

Access:
- NiFi UI: http://localhost:9094/nifi (admin/adminadminadmin)
- Keycloak Admin: http://localhost:9080/admin (admin/admin)
- Keycloak HTTPS: https://localhost:9085/admin (admin/admin)

## HTTPS Option

To use HTTPS NiFi (for production-like testing):

1. Edit `docker-compose.yml`:
   - Comment out the `nifi` service (HTTP)
   - Uncomment the `nifi-https` service

2. Access NiFi via: https://localhost:9095/nifi

## Files Updated

### Docker Configuration
- `docker-compose.yml` - Added commented HTTPS variant
- `start-nifi.sh` - New simplified startup script

### Documentation
- `README.adoc` - Updated to reflect HTTP default with HTTPS instructions
- Scripts updated to use HTTP endpoints

### Maintenance Scripts
- `verify-login.sh` - Updated for HTTP
- `verify-certificates.sh` - Updated for HTTP
- `run-test-container.sh` - Uses new startup approach

## Testing Configuration

For processor testing, use appropriate JWKS URLs:
- **HTTP NiFi**: `http://keycloak:9080/realms/oauth_integration_tests/protocol/openid-connect/certs`
- **HTTPS NiFi**: `https://keycloak:9085/realms/oauth_integration_tests/protocol/openid-connect/certs`

## Migration Notes

- No breaking changes for existing workflows
- Old scripts still work but route through new startup mechanism
- Certificate generation only occurs when HTTPS mode is enabled
- All existing NAR deployment and development workflows preserved
