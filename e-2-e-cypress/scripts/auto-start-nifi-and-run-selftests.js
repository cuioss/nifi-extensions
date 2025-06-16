#!/usr/bin/env node
/**
 * Automatically start NiFi containers if needed and run selftests
 * This ensures selftests always run successfully by managing the NiFi environment
 */

const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const NIFI_URL = process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi/';
const NIFI_HTTP_URL = 'http://localhost:9094/nifi/'; // Alternative HTTP endpoint (note trailing slash)
const CHECK_TIMEOUT = 5000; // 5 seconds
const CONTAINER_STARTUP_TIMEOUT = 180000; // 3 minutes to start containers (Docker can be slow)
const NIFI_READY_TIMEOUT = 600000; // 10 minutes for NiFi to become ready

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
        // Accept any 2xx or 3xx response as "available"
        const isOk = res.statusCode >= 200 && res.statusCode < 400;
        if (isOk) {
          console.log(`✓ NiFi is accessible at ${url} (status: ${res.statusCode})`);
        } else {
          console.log(`⚠️  NiFi responded with status ${res.statusCode}`);
        }
        req.destroy();
        resolve(isOk);
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

    // Set a timeout for the container startup process (not NiFi readiness)
    const timeoutId = setTimeout(() => {
      console.error('⏰ Container startup timeout reached');
      startProcess.kill('SIGTERM');
      setTimeout(() => {
        if (!startProcess.killed) {
          console.error('❌ Process still alive, forcing kill');
          startProcess.kill('SIGKILL');
        }
      }, 5000); // Give 5 seconds for graceful shutdown
      resolve(false);
    }, CONTAINER_STARTUP_TIMEOUT);

    startProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        console.log('✅ NiFi containers started successfully');
        resolve(true);
      } else {
        console.log(`❌ Failed to start NiFi containers (exit code: ${code})`);
        resolve(false);
      }
    });

    startProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error(`❌ Failed to start NiFi containers: ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * Wait for NiFi to become available with retries
 * @param {string} url - The URL to check
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} retryDelay - Delay between retries in ms
 * @returns {Promise<boolean>} true if NiFi becomes available, false otherwise
 */
async function waitForNiFi(url, maxRetries = 120, retryDelay = 5000) {
  console.log(`⏳ Waiting for NiFi to become available at ${url}...`);
  console.log(`⏱️  Will retry for up to ${(maxRetries * retryDelay) / 60000} minutes`);
  
  for (let i = 0; i < maxRetries; i++) {
    const isAvailable = await checkNiFiAvailability(url);
    if (isAvailable) {
      console.log(`✅ NiFi became available after ${i + 1} attempts (${((i + 1) * retryDelay) / 1000}s)`);
      return true;
    }
    
    if (i < maxRetries - 1) {
      const elapsed = ((i + 1) * retryDelay) / 1000;
      const remaining = ((maxRetries - i - 1) * retryDelay) / 1000;
      console.log(`⏳ Attempt ${i + 1}/${maxRetries} - NiFi not ready yet (${elapsed}s elapsed, ${remaining}s remaining)`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  console.log(`❌ NiFi did not become available after ${maxRetries} attempts (${(maxRetries * retryDelay) / 60000} minutes)`);
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

    // Set a timeout to prevent hanging indefinitely
    const timeout = setTimeout(() => {
      console.log('⏰ Test timeout reached - killing Cypress process');
      cypress.kill('SIGTERM');
      resolve(1);
    }, 600000); // 10 minutes timeout

    cypress.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log('✅ Selftests completed successfully');
      } else {
        console.log(`❌ Selftests failed with code ${code}`);
      }
      resolve(code);
    });

    cypress.on('error', (error) => {
      clearTimeout(timeout);
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
      console.error('❌ This could be due to:');
      console.error('   - Docker not running');
      console.error('   - Network connectivity issues');
      console.error('   - Container startup timeout (3 minutes exceeded)');
      console.error('   - Missing Docker Compose files');
      console.error('❌ Build failed due to container startup failure');
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
