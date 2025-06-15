#!/usr/bin/env node
/**
 * Automatically start NiFi containers if needed and run selftests
 * This ensures selftests always run successfully by managing the NiFi environment
 */

const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const NIFI_URL = process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi';
const NIFI_HTTP_URL = 'http://localhost:9094/nifi'; // Alternative HTTP endpoint
const CHECK_TIMEOUT = 5000; // 5 seconds
const STARTUP_TIMEOUT = 300000; // 5 minutes for NiFi startup

/**
 * Check if NiFi is accessible at a given URL
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} true if NiFi is accessible, false otherwise
 */
function checkNiFiAvailability(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      timeout: CHECK_TIMEOUT,
      rejectUnauthorized: false // Accept self-signed certificates
    };

    let resolved = false;
    
    const req = client.request(options, (res) => {
      if (!resolved) {
        resolved = true;
        console.log(`✓ NiFi is accessible at ${url} (status: ${res.statusCode})`);
        req.destroy();
        resolve(true);
      }
    });

    req.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    req.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        resolve(false);
      }
    });

    // Set a backup timeout to prevent hanging
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        resolve(false);
      }
    }, CHECK_TIMEOUT + 1000);

    req.end();
  });
}

/**
 * Start NiFi containers using the existing Docker scripts
 * @returns {Promise<boolean>} true if startup was successful, false otherwise
 */
function startNiFiContainers() {
  return new Promise((resolve) => {
    console.log('🚀 Starting NiFi containers...');
    
    // Path to the Docker script
    const scriptPath = path.resolve(__dirname, '../../integration-testing/src/main/docker/start-nifi.sh');
    
    const startProcess = spawn('bash', [scriptPath], {
      stdio: 'inherit',
      cwd: path.dirname(scriptPath)
    });

    startProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ NiFi containers started successfully');
        resolve(true);
      } else {
        console.log(`❌ Failed to start NiFi containers (exit code: ${code})`);
        resolve(false);
      }
    });

    startProcess.on('error', (error) => {
      console.error(`❌ Failed to start NiFi containers: ${error.message}`);
      resolve(false);
    });

    // Set a timeout for the startup process
    setTimeout(() => {
      console.log('⏰ NiFi startup timeout reached');
      startProcess.kill('SIGTERM');
      resolve(false);
    }, STARTUP_TIMEOUT);
  });
}

/**
 * Wait for NiFi to become available with retries
 * @param {string} url - The URL to check
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} retryDelay - Delay between retries in ms
 * @returns {Promise<boolean>} true if NiFi becomes available, false otherwise
 */
async function waitForNiFi(url, maxRetries = 60, retryDelay = 5000) {
  console.log(`⏳ Waiting for NiFi to become available at ${url}...`);
  
  for (let i = 0; i < maxRetries; i++) {
    const isAvailable = await checkNiFiAvailability(url);
    if (isAvailable) {
      return true;
    }
    
    if (i < maxRetries - 1) {
      console.log(`⏳ Attempt ${i + 1}/${maxRetries} - waiting ${retryDelay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return false;
}

/**
 * Run the selftests using Cypress
 * @param {string} nifiUrl - The NiFi URL to use for testing
 * @returns {Promise<number>} exit code
 */
function runSelftests(nifiUrl) {
  return new Promise((resolve) => {
    console.log(`🧪 Running Cypress selftests with ${nifiUrl}...`);
    
    const cypress = spawn('npx', ['cypress', 'run', '--config-file', 'cypress.selftests.config.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        CYPRESS_BASE_URL: nifiUrl,
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
  
  let currentNiFiUrl = NIFI_URL;
  
  // First check if NiFi is already running (HTTPS)
  let isNiFiAvailable = await checkNiFiAvailability(NIFI_URL);
  
  // If HTTPS is not available, check HTTP
  if (!isNiFiAvailable) {
    console.log('🔄 HTTPS not available, checking HTTP endpoint...');
    isNiFiAvailable = await checkNiFiAvailability(NIFI_HTTP_URL);
    if (isNiFiAvailable) {
      // Update the URL to use HTTP
      currentNiFiUrl = NIFI_HTTP_URL;
      console.log(`📝 Using HTTP endpoint: ${NIFI_HTTP_URL}`);
    }
  }
  
  if (!isNiFiAvailable) {
    console.log('⚠️  NiFi is not available - attempting to start containers...');
    
    const startupSuccess = await startNiFiContainers();
    if (!startupSuccess) {
      console.error('❌ Failed to start NiFi containers');
      process.exit(1);
    }
    
    // Wait for NiFi to become available after startup
    // Try HTTP first since the start script starts HTTP
    isNiFiAvailable = await waitForNiFi(NIFI_HTTP_URL);
    if (isNiFiAvailable) {
      currentNiFiUrl = NIFI_HTTP_URL;
      console.log(`📝 Using HTTP endpoint: ${NIFI_HTTP_URL}`);
    } else {
      // Try HTTPS as fallback
      isNiFiAvailable = await waitForNiFi(NIFI_URL);
      if (isNiFiAvailable) {
        currentNiFiUrl = NIFI_URL;
      }
    }
    
    if (!isNiFiAvailable) {
      console.error('❌ NiFi did not become available after startup attempt');
      process.exit(1);
    }
  }

  console.log(`✅ NiFi is ready for testing at ${currentNiFiUrl}`);
  const exitCode = await runSelftests(currentNiFiUrl);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
