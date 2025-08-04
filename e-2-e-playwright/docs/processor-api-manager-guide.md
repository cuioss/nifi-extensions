# ProcessorApiManager - API-Based Processor Management Guide

## Overview

The `ProcessorApiManager` utility provides reliable, API-based management of the MultiIssuerJWTTokenAuthenticator processor on the NiFi canvas. This approach replaces unreliable UI-based interactions with direct NiFi REST API calls, ensuring consistent test execution.

## Why API-Based Management?

The previous UI-based approach for placing processors on the canvas had several issues:
- Unreliable element selection due to dynamic UI rendering
- Race conditions with UI animations and transitions
- Inconsistent behavior across different test environments
- Difficulty handling various UI states and error conditions

The API-based approach provides:
- Direct, deterministic processor management
- No dependency on UI element visibility or timing
- Consistent behavior across all environments
- Better error handling and recovery

## Key Components

### 1. ProcessorApiManager (`utils/processor-api-manager.js`)

The main utility class that provides all processor management functionality via the NiFi REST API.

#### Core Methods:

- **`verifyMultiIssuerJWTTokenAuthenticatorIsDeployed()`**: Checks if the processor type is available in NiFi
- **`verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas()`**: Checks if the processor is currently on the canvas
- **`addMultiIssuerJWTTokenAuthenticatorOnCanvas(position)`**: Adds the processor to the canvas at specified position
- **`removeMultiIssuerJWTTokenAuthenticatorFromCanvas()`**: Removes the processor from the canvas
- **`ensureProcessorOnCanvas()`**: Ensures processor is on canvas (adds if missing)
- **`startProcessor()`**: Starts the processor
- **`stopProcessor()`**: Stops the processor

### 2. Setup Helper (`utils/processor-setup-helper.js`)

Provides simplified integration functions for use in test setup/teardown.

#### Helper Functions:

- **`setupMultiIssuerJWTAuthenticator(page, options)`**: Ensures processor is ready on canvas
- **`cleanupMultiIssuerJWTAuthenticator(page)`**: Removes processor after tests
- **`verifyProcessorStatus(page)`**: Gets detailed processor status

## Usage Examples

### Basic Usage in Tests

```javascript
import { test, expect } from '@playwright/test';
import { ProcessorApiManager } from '../utils/processor-api-manager.js';
import { AuthService } from '../utils/auth-service.js';

test('My test that needs the processor', async ({ page }) => {
  // Authenticate first
  const authService = new AuthService(page);
  await authService.ensureReady();
  
  // Setup processor
  const processorManager = new ProcessorApiManager(page);
  
  // Ensure processor is on canvas
  const ready = await processorManager.ensureProcessorOnCanvas();
  if (!ready) {
    test.skip('Processor not available');
  }
  
  // Your test logic here...
});
```

### Using the Setup Helper

```javascript
import { test } from '@playwright/test';
import { setupMultiIssuerJWTAuthenticator } from '../utils/processor-setup-helper.js';
import { AuthService } from '../utils/auth-service.js';

test.beforeEach(async ({ page }) => {
  // Authenticate
  const authService = new AuthService(page);
  await authService.ensureReady();
  
  // Ensure processor is on canvas
  const ready = await setupMultiIssuerJWTAuthenticator(page);
  if (!ready) {
    test.skip('Processor setup failed');
  }
});

test('Test with processor ready', async ({ page }) => {
  // Processor is guaranteed to be on canvas
  // Continue with your test...
});
```

### Full Lifecycle Management

```javascript
import { ProcessorApiManager } from '../utils/processor-api-manager.js';

test('Full processor lifecycle', async ({ page }) => {
  const manager = new ProcessorApiManager(page);
  
  // 1. Check deployment
  const isDeployed = await manager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
  if (!isDeployed) {
    test.skip('Processor not deployed');
  }
  
  // 2. Remove if exists
  await manager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
  
  // 3. Add to canvas
  const added = await manager.addMultiIssuerJWTTokenAuthenticatorOnCanvas({ x: 500, y: 300 });
  expect(added).toBe(true);
  
  // 4. Start processor
  const started = await manager.startProcessor();
  expect(started).toBe(true);
  
  // 5. Stop processor
  const stopped = await manager.stopProcessor();
  expect(stopped).toBe(true);
  
  // 6. Remove from canvas
  const removed = await manager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
  expect(removed).toBe(true);
});
```

## Migration Guide

### Updating Existing Tests

Replace UI-based processor setup with API-based approach:

#### Before (UI-based):
```javascript
// Unreliable UI-based approach
const processor = await findProcessor(page, 'MultiIssuerJWTTokenAuthenticator');
await processor.click();
// ... complex UI interactions
```

#### After (API-based):
```javascript
// Reliable API-based approach
const manager = new ProcessorApiManager(page);
await manager.ensureProcessorOnCanvas();
```

### Test Setup Pattern

For tests that require the processor:

```javascript
test.describe('Tests requiring MultiIssuerJWTTokenAuthenticator', () => {
  let processorManager;
  
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const authService = new AuthService(page);
    await authService.ensureReady();
    
    processorManager = new ProcessorApiManager(page);
    const ready = await processorManager.ensureProcessorOnCanvas();
    
    if (!ready) {
      throw new Error('Required processor not available');
    }
    
    await page.close();
  });
  
  test.beforeEach(async ({ page }) => {
    // Verify processor is still on canvas
    const manager = new ProcessorApiManager(page);
    const { exists } = await manager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
    
    if (!exists) {
      // Re-add if somehow removed
      await manager.addMultiIssuerJWTTokenAuthenticatorOnCanvas();
    }
  });
  
  // Your tests here...
});
```

## Troubleshooting

### Processor Not Deployed

If `verifyMultiIssuerJWTTokenAuthenticatorIsDeployed()` returns false:
1. Ensure the processor NAR file is installed in NiFi
2. Restart NiFi after installing the NAR
3. Check NiFi logs for any deployment errors

### Authentication Issues

If API calls fail with 401/403:
1. Ensure proper authentication before API calls
2. Check that the token is being passed correctly
3. Verify user has permissions to manage processors

### Processor Not Found on Canvas

If processor operations fail:
1. Use `verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas()` to check current state
2. Try removing and re-adding the processor
3. Check NiFi UI manually to verify actual state

## Running the Self-Test

To verify the ProcessorApiManager is working correctly:

```bash
npm test -- self-processor-api-manager.spec.js
```

This runs comprehensive tests of all API operations.

## API Endpoints Used

The utility uses these NiFi REST API endpoints:

- `GET /nifi-api/flow/processor-types` - List available processor types
- `GET /nifi-api/process-groups/{id}/processors` - List processors on canvas
- `POST /nifi-api/process-groups/{id}/processors` - Add processor to canvas
- `DELETE /nifi-api/processors/{id}` - Remove processor from canvas
- `PUT /nifi-api/processors/{id}/run-status` - Start/stop processor
- `GET /nifi-api/processors/{id}` - Get processor details

## Best Practices

1. **Always authenticate first**: Ensure proper authentication before using ProcessorApiManager
2. **Check deployment**: Verify processor is deployed before attempting to add to canvas
3. **Handle failures gracefully**: Use test.skip() when processor is not available
4. **Clean up in tests**: Remove test processors after completion when appropriate
5. **Use the helper functions**: Leverage processor-setup-helper.js for common patterns

## Support

For issues or questions:
1. Check the self-test output for diagnostic information
2. Review NiFi logs for API errors
3. Ensure NiFi and the processor NAR are properly installed
4. Verify network connectivity to NiFi API endpoints