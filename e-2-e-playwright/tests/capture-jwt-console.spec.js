const { test, expect } = require('@playwright/test');

import { AuthService } from '../utils/auth-service.js';

test.describe('JWT UI Console Error Capture', () => {
  test('Capture JWT UI Console Errors', async ({ page }) => {
  const consoleMessages = [];
  const pageErrors = [];
  
  // Capture all console messages
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString()
    });
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.log(`[PAGE ERROR] ${error.message}`);
  });
  
  // First authenticate to NiFi
  console.log('Authenticating to NiFi...');
  const authService = new AuthService(page);
  await authService.ensureReady();
  
  // Navigate to JWT UI page after authentication
  const jwtUIUrl = 'https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/?id=08e20549-0198-1000-65a2-24abdfb667a2&revision=1&clientId=346173ec-4c73-459a-8a73-91c523fb9162&editable=true&disconnectedNodeAcknowledged=false';
  
  console.log('Navigating to JWT UI page...');
  await page.goto(jwtUIUrl);
  
  // Wait for page to load and modules to attempt loading
  await page.waitForTimeout(10000);
  
  // Check if loading indicator is visible
  const loadingIndicator = page.locator('#loading-indicator');
  const isVisible = await loadingIndicator.isVisible();
  console.log(`\n=== LOADING INDICATOR STATUS ===`);
  console.log(`Loading indicator visible: ${isVisible}`);
  
  if (isVisible) {
    const text = await loadingIndicator.textContent();
    console.log(`Loading indicator text: "${text}"`);
  }
  
  // Log all captured messages
  console.log(`\n=== CAPTURED CONSOLE MESSAGES (${consoleMessages.length}) ===`);
  consoleMessages.forEach((msg, index) => {
    console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    if (msg.location) {
      console.log(`   Location: ${msg.location.url}:${msg.location.lineNumber}:${msg.location.columnNumber}`);
    }
  });
  
  console.log(`\n=== CAPTURED PAGE ERRORS (${pageErrors.length}) ===`);
  pageErrors.forEach((error, index) => {
    console.log(`${index + 1}. ${error.message}`);
    if (error.stack) {
      console.log(`   Stack: ${error.stack}`);
    }
  });
  
  // Save to file
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    url: jwtUIUrl,
    loadingIndicatorVisible: isVisible,
    consoleMessages: consoleMessages,
    pageErrors: pageErrors
  };
  
  fs.writeFileSync('jwt-ui-console-errors.json', JSON.stringify(report, null, 2));
  console.log('\n=== REPORT SAVED ===');
  console.log('Console errors saved to: jwt-ui-console-errors.json');
  });
});