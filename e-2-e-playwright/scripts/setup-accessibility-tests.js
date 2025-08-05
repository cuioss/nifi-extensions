#!/usr/bin/env node

/**
 * Script to set up prerequisites for accessibility tests
 * This ensures the MultiIssuerJWTTokenAuthenticator processor is on the canvas
 */

import { chromium } from '@playwright/test';
import { AuthService } from '../utils/auth-service.js';
import { ProcessorApiManager } from '../utils/processor-api-manager.js';

async function setupAccessibilityTests() {
  let browser;
  let context;
  let page;

  try {
    console.log('🚀 Setting up prerequisites for accessibility tests...\n');

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      ignoreHTTPSErrors: true,
    });

    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      acceptDownloads: true,
    });

    page = await context.newPage();

    // 1. Check NiFi availability
    console.log('1️⃣ Checking NiFi availability...');
    const authService = new AuthService(page);
    const isAvailable = await authService.checkNiFiAccessibility();
    
    if (!isAvailable) {
      throw new Error('NiFi is not accessible at https://localhost:9095/nifi');
    }
    console.log('✅ NiFi is accessible\n');

    // 2. Navigate to NiFi and authenticate
    console.log('2️⃣ Navigating to NiFi and authenticating...');
    await page.goto('https://localhost:9095/nifi', { waitUntil: 'networkidle' });
    await authService.login();
    console.log('✅ Authentication successful\n');

    // 3. Ensure processor is on canvas
    console.log('3️⃣ Ensuring MultiIssuerJWTTokenAuthenticator is on canvas...');
    const processorManager = new ProcessorApiManager(page);
    
    const { exists } = await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
    
    if (!exists) {
      console.log('📦 Processor not found on canvas, adding it...');
      const added = await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas();
      
      if (!added) {
        throw new Error('Failed to add MultiIssuerJWTTokenAuthenticator to canvas');
      }
      console.log('✅ Processor added successfully\n');
    } else {
      console.log('✅ Processor already on canvas\n');
    }

    // 4. Verify deployment
    console.log('4️⃣ Verifying processor deployment...');
    const deployment = await processorManager.verifyMultiIssuerJWTTokenAuthenticatorDeployment();
    
    if (!deployment.deployed) {
      throw new Error(`Processor deployment verification failed: ${deployment.message}`);
    }
    console.log('✅ Processor is properly deployed\n');

    console.log('🎉 All prerequisites are set up successfully!');
    console.log('You can now run the accessibility tests.\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\nPlease ensure:');
    console.error('1. NiFi is running (./integration-testing/src/main/docker/run-and-deploy.sh)');
    console.error('2. The MultiIssuerJWTTokenAuthenticator NAR is deployed');
    console.error('3. You have proper network connectivity\n');
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

// Run the setup
setupAccessibilityTests();