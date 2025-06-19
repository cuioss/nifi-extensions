# MCP Playwright Integration

This guide covers MCP Playwright tool setup and integration for enhanced development workflows with the NiFi testing environment.

## Overview

The MCP Playwright tool provides browser automation and application analysis capabilities that enhance the development and testing process. It enables:

- **Application Analysis**: Deep inspection of NiFi UI components
- **Element Discovery**: Identification of robust selectors for testing
- **Workflow Automation**: Enhanced development task automation
- **Testing Support**: Integration with existing Cypress test workflows

## Setup and Configuration

### Prerequisites
- VS Code with MCP extension
- Docker running locally
- NiFi integration testing environment active

### Environment Setup
```bash
# Start NiFi testing environment
cd integration-testing
./run-test-container.sh

# Verify services are running
docker ps | grep -E "(nifi|keycloak)"
```

### Access Points
- **NiFi UI**: `https://localhost:9095/nifi/`
- **NiFi API**: `https://localhost:9095/nifi-api/`
- **Keycloak**: `http://localhost:9080/`

## MCP Playwright Configuration

### VS Code Settings
```json
{
  "mcp.playwright": {
    "enabled": true,
    "baseUrl": "https://localhost:9095",
    "timeout": 30000,
    "headless": false
  }
}
```

### Tool Configuration
The MCP Playwright tool can be configured to work with the NiFi environment:

```javascript
// MCP Playwright configuration
const config = {
  baseURL: 'https://localhost:9095/nifi/',
  timeout: 30000,
  viewport: { width: 1280, height: 720 },
  ignoreHTTPSErrors: true,
  
  // NiFi-specific settings
  waitForLoadState: 'networkidle',
  screenshots: true,
  trace: 'retain-on-failure'
};
```

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

## Simplified Usage Patterns

### For MCP Playwright Tool

**Direct Access Pattern** (No authentication required):
```javascript
// Simplified NiFi access for MCP Playwright
async function accessNiFi(page) {
  // Navigate directly to NiFi - no authentication required
  await page.goto('https://localhost:9095/nifi');
  
  // Wait for Angular app to load
  await page.waitForSelector('nifi', { timeout: 30000 });
  
  // Wait for app to be fully initialized
  await page.waitForLoadState('networkidle');
  
  // Optional: Wait for specific UI elements to ensure full load
  await page.waitForTimeout(2000);
}

// Verify NiFi is accessible
async function verifyNiFiAccess(page) {
  const nifiElement = page.locator('nifi');
  await expect(nifiElement).toBeVisible();
  
  // Verify we're on the right page
  expect(page.url()).toContain('/nifi');
}

// Example usage for MCP Playwright tool analysis
async function analyzeNiFiUI(page) {
  await accessNiFi(page);
  
  // Now you can analyze the UI, extract elements, etc.
  const pageTitle = await page.title();
  const mainContent = await page.locator('nifi').textContent();
  
  return {
    title: pageTitle,
    hasNiFiApp: await page.locator('nifi').isVisible(),
    url: page.url()
  };
}
```

### For Cypress Testing

**Simplified Login Command** (Updated):
```javascript
// New simplified approach - verified working
cy.nifiLogin(); // Takes ~3 seconds instead of 7-8 seconds
cy.verifyLoggedIn();

// Continue with testing
```

### Integration Benefits

#### For Testing Development
- **Faster Test Execution**: ~3 seconds vs 7-8 seconds for authentication
- **Higher Reliability**: No authentication state management
- **Simpler Debugging**: Fewer authentication-related failures

#### For MCP Analysis
- **Immediate Access**: No waiting for login processes
- **Consistent State**: No session management needed
- **Full UI Access**: All NiFi features available for analysis

## Advanced MCP Playwright Patterns

### UI Analysis Patterns
```javascript
// Pattern 1: Basic UI Analysis
await accessNiFi(page);
// Analyze UI elements, extract processor information, etc.

// Pattern 2: Processor Configuration Analysis
async function analyzeProcessorConfig(page) {
  await accessNiFi(page);
  
  // Look for processor components
  const processors = await page.locator('[data-testid*="processor"]').all();
  const processorData = [];
  
  for (const processor of processors) {
    const processorInfo = await processor.textContent();
    processorData.push(processorInfo);
  }
  
  return processorData;
}

// Pattern 3: Canvas Flow Analysis
async function analyzeCanvasFlow(page) {
  await accessNiFi(page);
  
  // Analyze the flow structure
  const connections = await page.locator('.connection').count();
  const processors = await page.locator('.processor').count();
  
  return {
    connectionCount: connections,
    processorCount: processors,
    timestamp: new Date().toISOString()
  };
}
```

### Test Generation Patterns
```javascript
// Pattern 1: Record User Interactions
async function recordUserInteractions(page) {
  await accessNiFi(page);
  // Record user interactions, generate test scripts
  
  // Start recording interactions
  await page.startTracing({ screenshots: true, snapshots: true });
  
  // Perform actions that will be converted to tests
  await page.click('button[aria-label="Add Processor"]');
  
  // Stop recording and generate test
  await page.stopTracing({ path: 'interaction-trace.json' });
}

// Pattern 2: Generate Test Templates
async function generateTestTemplate(page, scenario) {
  await accessNiFi(page);
  
  const template = {
    scenario: scenario,
    setup: 'await accessNiFi(page);',
    steps: [],
    assertions: []
  };
  
  // Generate test steps based on UI analysis
  const elements = await page.locator('[data-testid]').all();
  for (const element of elements) {
    const testId = await element.getAttribute('data-testid');
    template.steps.push(`await page.click('[data-testid="${testId}"]');`);
  }
  
  return template;
}
```

### Documentation Generation Patterns
```javascript
// Pattern 1: Screenshot Documentation
async function generateDocumentationScreenshots(page) {
  await accessNiFi(page);
  
  // Capture main interface
  await page.screenshot({ 
    path: 'nifi-main-interface.png',
    fullPage: true 
  });
  
  // Capture processor palette
  await page.click('[aria-label="Processor Palette"]');
  await page.screenshot({ 
    path: 'nifi-processor-palette.png' 
  });
}

// Pattern 2: UI Flow Documentation
async function documentUIFlows(page) {
  await accessNiFi(page);
  
  const flows = [];
  
  // Document main navigation flow
  const navItems = await page.locator('nav a').all();
  for (const item of navItems) {
    const text = await item.textContent();
    const href = await item.getAttribute('href');
    flows.push({ text, href, type: 'navigation' });
  }
  
  return flows;
}
```

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
2. **Verify Access**: Ensure NiFi loads at https://localhost:9095/nifi
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
curl -k https://localhost:9095/nifi
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

## Complete Example Workflows

### Workflow 1: UI Discovery and Analysis
```javascript
// Complete workflow for discovering NiFi UI capabilities
async function discoverNiFiCapabilities(page) {
  // Step 1: Access NiFi
  await accessNiFi(page);
  
  // Step 2: Analyze main interface
  const mainElements = await page.locator('[data-testid], [aria-label]').all();
  const capabilities = [];
  
  for (const element of mainElements) {
    const testId = await element.getAttribute('data-testid');
    const ariaLabel = await element.getAttribute('aria-label');
    const text = await element.textContent();
    
    capabilities.push({
      testId,
      ariaLabel,
      text: text?.trim(),
      visible: await element.isVisible()
    });
  }
  
  // Step 3: Document findings
  console.log('NiFi UI Capabilities:', capabilities);
  
  return capabilities;
}
```

### Workflow 2: Processor Catalog Analysis
```javascript
// Analyze available processors for documentation
async function analyzeProcessorCatalog(page) {
  await accessNiFi(page);
  
  // Open processor palette
  await page.click('[aria-label="Add Processor"]');
  await page.waitForSelector('.processor-types', { timeout: 10000 });
  
  // Extract processor information
  const processors = await page.locator('.processor-type').all();
  const catalog = [];
  
  for (const processor of processors) {
    const name = await processor.locator('.processor-name').textContent();
    const description = await processor.locator('.processor-description').textContent();
    
    catalog.push({
      name: name?.trim(),
      description: description?.trim()
    });
  }
  
  return catalog;
}
```

### Workflow 3: Integration with Cypress Testing
```javascript
// Generate Cypress test cases from MCP analysis
async function generateCypressTests(page) {
  await accessNiFi(page);
  
  // Analyze testable elements
  const testableElements = await page.locator('[data-testid]').all();
  const testCases = [];
  
  for (const element of testableElements) {
    const testId = await element.getAttribute('data-testid');
    const isClickable = await element.evaluate(el => 
      el.tagName === 'BUTTON' || 
      el.tagName === 'A' || 
      el.getAttribute('role') === 'button'
    );
    
    if (isClickable) {
      testCases.push({
        testId,
        cypressTest: `cy.get('[data-testid="${testId}"]').should('be.visible').click();`,
        description: `Test clicking ${testId} element`
      });
    }
  }
  
  return testCases;
}
```

## Usage Patterns

### Application Analysis
Use MCP Playwright to analyze NiFi UI components and identify testing targets:

```javascript
// Analyze processor components
await page.goto('https://localhost:9095/nifi/');

// Discover processor selectors
const processors = await page.locator('[data-testid*="processor"]').all();
console.log(`Found ${processors.length} processors`);

// Analyze dialog structures
const addProcessorButton = await page.locator('button:has-text("Add Processor")');
await addProcessorButton.click();

// Extract dialog selectors for Cypress tests
const dialogSelectors = await page.locator('[role="dialog"] *[data-testid]').all();
```

### Element Discovery
Identify robust selectors for Cypress test implementation:

```javascript
// Discover data-testid attributes
const testIds = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('[data-testid]'))
    .map(el => el.getAttribute('data-testid'));
});

// Find fallback selectors
const fallbackSelectors = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('[aria-label], [role]'))
    .map(el => ({
      'aria-label': el.getAttribute('aria-label'),
      'role': el.getAttribute('role'),
      'tagName': el.tagName.toLowerCase()
    }));
});
```

### Integration with Cypress
Generate Cypress test code from MCP Playwright analysis:

```javascript
// Generate Cypress selectors from Playwright analysis
function generateCypressSelectors(elements) {
  return elements.map(el => {
    const strategies = [
      el.testId ? `[data-testid="${el.testId}"]` : null,
      el.ariaLabel ? `[aria-label="${el.ariaLabel}"]` : null,
      el.role ? `[role="${el.role}"]` : null
    ].filter(Boolean);
    
    return {
      primary: strategies[0],
      fallbacks: strategies.slice(1)
    };
  });
}
```

## Development Workflow Integration

### Test Development Process
1. **Analyze with MCP Playwright**: Discover UI structure and selectors
2. **Generate Cypress Commands**: Create robust test commands
3. **Implement Tests**: Use discovered selectors in Cypress tests
4. **Validate**: Verify tests work with MCP Playwright insights

### Debugging Support
Use MCP Playwright for debugging test failures:

```javascript
// Debug Cypress selector issues
await page.goto('https://localhost:9095/nifi/');

// Test selector reliability
const selector = '[data-testid="add-processor"]';
const element = await page.locator(selector);
const isVisible = await element.isVisible();
const isEnabled = await element.isEnabled();

console.log(`Selector ${selector}: visible=${isVisible}, enabled=${isEnabled}`);
```

## Best Practices

### Selector Discovery
- **Prefer data-testid**: Look for existing data-testid attributes first
- **Use semantic selectors**: Leverage ARIA labels and roles
- **Create fallback strategies**: Multiple selector options for reliability
- **Validate cross-browser**: Test selectors in different environments

### Performance Optimization
- **Use specific selectors**: Avoid broad CSS selectors
- **Minimize network requests**: Cache analysis results
- **Batch operations**: Group multiple analysis tasks
- **Focus on test-relevant elements**: Don't analyze entire application

### Integration Guidelines
- **Share findings**: Document discovered selectors for team use
- **Update Cypress tests**: Apply insights to improve test reliability
- **Maintain selector libraries**: Keep reusable selector collections
- **Version control**: Track selector changes over time

## Troubleshooting

### Common Issues

#### Connection Problems
```bash
# Verify NiFi is accessible
curl -k -f https://localhost:9095/nifi-api/system-diagnostics

# Check Docker containers
docker ps | grep nifi
```

#### Element Discovery Issues
- **Timing problems**: Wait for page load complete
- **Dynamic content**: Handle Angular component loading
- **Selector specificity**: Use more specific selectors

#### Integration Challenges
- **Selector translation**: Map Playwright selectors to Cypress format
- **Environment differences**: Account for test vs development environments
- **State management**: Handle application state changes

### Performance Tips
- **Selective analysis**: Focus on specific UI areas
- **Caching**: Store analysis results for reuse
- **Parallel operations**: Use concurrent analysis where possible
- **Resource management**: Clean up browser instances

---

*For technical support or questions about MCP Playwright integration, refer to the main project documentation or create an issue in the project repository.*
