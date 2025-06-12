# MCP Playwright Tool Integration Guide

## Overview

The MCP Playwright tool provides browser automation and local application understanding capabilities for the NiFi extensions project. This guide covers setup, configuration, and usage patterns for effective development and testing workflows.

## ✅ Verification Status: COMPLETE

**MCP Playwright tool successfully verified and operational** for local NiFi application analysis and testing.

## Quick Setup

### Prerequisites
- VS Code with MCP extension configured
- Docker running locally
- NiFi integration testing environment

### Start NiFi Environment

```bash
cd integration-testing/src/main/docker
./start-nifi.sh
```

This starts:
- **NiFi HTTP**: `http://localhost:9094/nifi` (MCP-compatible)
- **Keycloak HTTP**: `http://localhost:9080` (admin interface)
- **Keycloak HTTPS**: `https://localhost:9085` (secure authentication)

### Access Points
- **NiFi UI**: http://localhost:9094/nifi (admin/adminadminadmin)
- **Keycloak Admin**: http://localhost:9080/admin (admin/admin)

## MCP Playwright Configuration

### VS Code Settings
```json
{
  "playwright": {
    "command": "docker",
    "args": [
      "run",
      "-i", 
      "--rm",
      "mcp/playwright"
    ]
  }
}
```

### Docker Container
- **Image**: `mcp/playwright`
- **Status**: Verified operational
- **Capabilities**: Full browser automation, page analysis, content extraction

## Usage Patterns

### Local Application Understanding
The MCP Playwright tool can analyze and interact with the local NiFi application:

1. **Page Navigation**: Direct access to NiFi UI components
2. **Content Analysis**: Extract processor configurations and UI state
3. **Test Automation**: Generate Playwright test scripts
4. **UI Verification**: Validate UI behavior and responsiveness

### Integration with Development Workflow

#### For Testing Development
- **Test Generation**: Use MCP to create Playwright tests for new features
- **UI Analysis**: Understand component behavior before writing tests
- **Debugging**: Analyze failing tests by examining actual UI state

#### For Documentation
- **Screenshot Generation**: Automated documentation screenshots
- **UI Flow Documentation**: Generate workflow diagrams from actual usage
- **Feature Verification**: Validate documented features work as described

## Technical Details

### HTTP vs HTTPS Configuration

**Current Setup**: HTTP-only for MCP compatibility
- **Benefit**: No SSL certificate issues with MCP tool
- **Security**: Authentication still secured via Keycloak HTTPS
- **Development**: Simplified local development and testing

**Previous HTTPS Issues Resolved**:
- Self-signed certificates caused SSL verification failures
- MCP tool couldn't access local HTTPS applications
- Solution: HTTP configuration maintains functionality while enabling MCP access

### Docker Integration

The MCP Playwright tool runs in a Docker container with these capabilities:
- Browser automation (Chromium, Firefox, Safari)
- Page content extraction and analysis
- Screenshot and PDF generation
- Network request monitoring
- JavaScript execution in browser context

## Best Practices

### Development Workflow
1. **Start Environment**: Use `./start-nifi.sh` for HTTP setup
2. **Verify Access**: Ensure NiFi loads at http://localhost:9094/nifi
3. **Use MCP Tool**: Analyze pages and generate tests as needed
4. **Integration**: Incorporate findings into Cypress test suite

### Security Considerations
- HTTP used only for local development and testing
- Production deployments should use HTTPS
- Keycloak authentication remains HTTPS-secured
- Local network access only (not exposed externally)

### Performance Tips
- Use HTTP setup for faster development cycles
- Switch to HTTPS for security testing when needed
- Docker container starts quickly for on-demand usage
- Combine with existing Cypress tests for comprehensive coverage

## Troubleshooting

### Common Issues

**MCP Tool Not Responding**
```bash
# Verify Docker container
docker ps | grep playwright
# Restart if needed
docker restart <container-id>
```

**Cannot Access NiFi**
```bash
# Check NiFi is running on HTTP
curl http://localhost:9094/nifi
# Restart environment if needed
./start-nifi.sh
```

**SSL Certificate Errors**
- Ensure using HTTP URLs (port 9094) not HTTPS (port 9095)
- For HTTPS testing, configure docker-compose.yml for HTTPS variant but expect MCP limitations

### Container Issues
```bash
# Pull latest MCP Playwright image
docker pull mcp/playwright

# Check container logs
docker logs <container-id>

# Manual container test
docker run -it --rm mcp/playwright
```

## Integration with Existing Tests

### Cypress Compatibility
- MCP findings can inform Cypress test improvements
- Use MCP for initial UI exploration, Cypress for automated testing
- Both tools can use the same HTTP environment setup

### CI/CD Considerations
- MCP tool primarily for development and analysis
- Cypress tests handle automated CI/CD testing
- HTTP setup works for both development (MCP) and CI (Cypress)

## Next Steps

1. **Enhanced Analysis**: Use MCP to identify UI test improvement opportunities
2. **Test Generation**: Generate additional Playwright tests for complex scenarios
3. **Documentation**: Create automated documentation from MCP analysis
4. **Workflow Integration**: Incorporate MCP insights into regular development process

---

*For technical support or questions about MCP Playwright integration, refer to the main project documentation or create an issue in the project repository.*
