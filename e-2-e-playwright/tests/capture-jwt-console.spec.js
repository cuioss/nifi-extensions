const { test, expect } = require('@playwright/test');

import { AuthService } from '../utils/auth-service.js';
import { setupAuthAwareErrorDetection, saveTestBrowserLogs } from '../utils/console-logger.js';

test.describe('JWT UI Console Error Capture', () => {
  test('Capture JWT UI Console Errors', async ({ page }, testInfo) => {
    // Setup unified console logging system instead of custom implementation
    // Skip initial canvas checks since JWT UI page doesn't have a canvas
    const errorDetection = await setupAuthAwareErrorDetection(page, testInfo);
    
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
    
    // Check for critical errors after navigation (skip canvas checks for JWT UI page)
    // The JWT UI page doesn't have a canvas, so we only check for console errors
    const criticalErrors = errorDetection.getCriticalErrors();
    if (criticalErrors.length > 0) {
      const jsErrors = criticalErrors.filter(error => 
        error.type === 'JAVASCRIPT_ERROR' || 
        error.type === 'MODULE_LOADING_ERROR'
      );
      if (jsErrors.length > 0) {
        throw new Error(`Critical JavaScript errors detected: ${jsErrors.map(e => e.message).join(', ')}`);
      }
    }
    
    // Save the captured logs using the unified logging system
    const logResult = await saveTestBrowserLogs(testInfo);
    
    if (logResult) {
      console.log('\n=== UNIFIED LOGGING SYSTEM REPORT ===');
      console.log(`Console logs saved to: ${logResult.jsonLog}`);
      console.log(`Human-readable logs saved to: ${logResult.textLog}`);
      console.log(`Total log entries: ${logResult.totalLogs}`);
      console.log(`Test ID: ${logResult.testId}`);
    }
    
    // Create a JWT-specific summary report that integrates with unified logging
    // This report is saved in target/logs/ to be part of the unified logging system
    const fs = require('fs');
    const path = require('path');
    
    // Create target/logs directory if it doesn't exist
    const targetDir = path.join(process.cwd(), 'target');
    const logsDir = path.join(targetDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const summaryReport = {
      timestamp: new Date().toISOString(),
      url: jwtUIUrl,
      loadingIndicatorVisible: isVisible,
      loadingIndicatorText: isVisible ? await loadingIndicator.textContent() : null,
      unifiedLogFiles: logResult ? {
        jsonLog: logResult.jsonLog,
        textLog: logResult.textLog,
        totalLogs: logResult.totalLogs
      } : null,
      testInfo: {
        title: testInfo.title,
        testId: logResult?.testId || 'unknown'
      }
    };
    
    // Save the summary report in target/logs/ following unified logging naming convention
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryFileName = `capture-jwt-console-JWT_UI_Console_Error_Capture-summary-${timestamp}.json`;
    const summaryPath = path.join(logsDir, summaryFileName);
    fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
    
    console.log('\n=== JWT UI SUMMARY REPORT SAVED ===');
    console.log(`JWT UI summary report saved to: ${summaryPath}`);
    console.log(`This report is now part of the unified logging system under target/logs/`);
    
    // Cleanup
    errorDetection.cleanup();
  });
});