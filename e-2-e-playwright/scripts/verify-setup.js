/**
 * @file Verify Setup Script
 * Simple script to verify that the Playwright module is set up correctly
 * @version 1.0.0
 */

console.log('🔵 Verifying Playwright module setup...');

// Check that required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  '../package.json',
  '../playwright.config.js',
  '../utils/constants.js',
  '../utils/auth-service.js',
  '../utils/processor.js',
  '../tests/01-verify-multi-issuer-jwt-token-authenticator-advanced.spec.js',
  '../tests/self-login.spec.js',
  '../tests/self-navigation.spec.js',
  '../tests/self-processor-advanced.spec.js',
  '../tests/self-browser-logging.spec.js'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.resolve(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ Found: ${file}`);
  } else {
    console.log(`❌ Missing: ${file}`);
    allFilesExist = false;
  }
});

// Check that Playwright is installed
try {
  require('@playwright/test');
  console.log('✅ Playwright is installed');
} catch (error) {
  console.log('❌ Playwright is not installed. Run "npm install" to install dependencies.');
  allFilesExist = false;
}

if (allFilesExist) {
  console.log('✅ Playwright module setup is complete!');
  console.log('');
  console.log('To run tests:');
  console.log('1. Install dependencies: npm install');
  console.log('2. Install browsers: npx playwright install');
  console.log('3. Run tests: npm run playwright:test');
} else {
  console.log('❌ Playwright module setup is incomplete. Please check the missing files.');
}