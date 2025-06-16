#!/usr/bin/env node
/**
 * Check if NiFi is available and run selftests if it is, otherwise exit gracefully
 * This allows selftests to run during normal build when NiFi is available,
 * but not fail the build when NiFi is not running.
 */

const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

const NIFI_URL = process.env.CYPRESS_BASE_URL || 'http://localhost:9094/nifi';
const CHECK_TIMEOUT = 5000; // 5 seconds

/**
 * Check if NiFi is accessible
 * @returns {Promise<boolean>} true if NiFi is accessible, false otherwise
 */
function checkNiFiAvailability() {
  return new Promise((resolve) => {
    const url = new URL(NIFI_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      timeout: CHECK_TIMEOUT,
      rejectUnauthorized: false // Accept self-signed certificates
    };

    let resolved = false;
    
    // Use HTTP or HTTPS based on the URL protocol
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      if (!resolved) {
        resolved = true;
        console.log(`✓ NiFi is accessible at ${NIFI_URL} (status: ${res.statusCode})`);
        req.destroy(); // Clean up the request
        resolve(true);
      }
    });

    req.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        console.log(`✗ NiFi is not accessible at ${NIFI_URL}: ${error.code || error.message}`);
        resolve(false);
      }
    });

    req.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        console.log(`✗ NiFi check timed out after ${CHECK_TIMEOUT}ms at ${NIFI_URL}`);
        req.destroy();
        resolve(false);
      }
    });

    // Set a backup timeout to prevent hanging
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(`✗ NiFi check timed out (backup timeout) at ${NIFI_URL}`);
        req.destroy();
        resolve(false);
      }
    }, CHECK_TIMEOUT + 1000);

    req.end();
  });
}

/**
 * Run the selftests using Cypress
 * @returns {Promise<number>} exit code
 */
function runSelftests() {
  return new Promise((resolve) => {
    console.log('🧪 Running Cypress selftests...');
    
    const cypress = spawn('npx', ['cypress', 'run', '--config-file', 'cypress.selftests.config.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        CYPRESS_BASE_URL: NIFI_URL,
        CYPRESS_KEYCLOAK_URL: process.env.CYPRESS_KEYCLOAK_URL || 'https://localhost:9085/auth'
      }
    });

    cypress.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Selftests completed successfully');
      } else {
        console.log(`❌ Selftests failed with code ${code}`);
      }
      resolve(code);
    });

    cypress.on('error', (error) => {
      console.error(`❌ Failed to start selftests: ${error.message}`);
      resolve(1);
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Checking NiFi availability for selftests...');
  
  const isNiFiAvailable = await checkNiFiAvailability();
  
  if (!isNiFiAvailable) {
    console.log('⚠️  NiFi is not available - skipping selftests (this is normal for builds without running containers)');
    console.log('💡 To run selftests, start NiFi containers first or use -DskipTests=true to skip all tests');
    process.exit(0); // Exit successfully 
  }

  const exitCode = await runSelftests();
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
