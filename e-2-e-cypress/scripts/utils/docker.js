#!/usr/bin/env node
/**
 * Docker container operations utility for e-2-e-cypress scripts
 * Handles NiFi container management and health checks
 */

/**
 * ⚠️  DEPRECATION NOTICE ⚠️
 * 
 * This Docker utility and its container management functions are DEPRECATED.
 * Container lifecycle should be managed externally by Maven profiles using exec-maven-plugin,
 * following the CUI standard pattern.
 * 
 * Preferred approach:
 * - Use Maven integration-tests profile: `mvn test -Pintegration-tests`
 * - Container start/stop handled by scripts/start-integration-containers.sh and scripts/stop-integration-containers.sh
 * - JavaScript/Cypress code should NEVER start containers
 * 
 * This file is kept for backward compatibility but should not be used for new development.
 */

const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const { createLogger } = require('./logger');
const { sleep } = require('./common');
const { EXIT_CODES, ErrorFactory, RetryManager } = require('./error-handling');

const logger = createLogger({ context: 'docker' });

// Default container configuration
const DEFAULT_CONFIG = {
  nifiUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:9094/nifi',
  healthCheckTimeout: 5000,
  maxStartupWaitTime: 300000, // 5 minutes
  healthCheckInterval: 5000,
  dockerComposeFile: '../integration-testing/src/main/docker/docker-compose.yml'
};

class DockerManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.retryManager = new RetryManager({
      maxAttempts: 3,
      initialDelay: 2000,
      logger: logger
    });
  }

  /**
   * Execute a docker-compose command
   * @param {string[]} args - Docker compose arguments
   * @param {object} options - Spawn options
   * @returns {Promise<number>} exit code
   */
  async executeDockerCompose(args, options = {}) {
    return new Promise((resolve, reject) => {
      const defaultOptions = {
        cwd: this.config.dockerComposeFile.includes('/') 
          ? require('path').dirname(this.config.dockerComposeFile)
          : process.cwd(),
        stdio: options.silent ? 'pipe' : 'inherit'
      };

      const child = spawn('docker', ['compose', ...args], {
        ...defaultOptions,
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (options.silent) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (options.silent) {
          resolve({ code, stdout, stderr });
        } else {
          resolve(code);
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check if Docker is available
   * @returns {Promise<boolean>} true if Docker is available
   */
  async isDockerAvailable() {
    try {
      const result = await this.executeDockerCompose(['--version'], { silent: true });
      return result.code === 0;
    } catch (error) {
      logger.debug(`Docker not available: ${error.message}`);
      return false;
    }
  }

  /**
   * Start Docker containers
   * @param {object} options - Start options
   * @returns {Promise<boolean>} true if started successfully
   */
  async startContainers(options = {}) {
    const { detached = true, build = false } = options;

    logger.step('Starting Docker containers...');

    if (!(await this.isDockerAvailable())) {
      logger.failure('Docker is not available');
      return false;
    }

    try {
      const args = ['up'];
      if (detached) args.push('-d');
      if (build) args.push('--build');

      const exitCode = await this.executeDockerCompose(args);
      
      if (exitCode === 0) {
        logger.success('Docker containers started successfully');
        return true;
      } else {
        logger.failure(`Docker containers failed to start (exit code: ${exitCode})`);
        return false;
      }
    } catch (error) {
      logger.failure(`Failed to start containers: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop Docker containers
   * @returns {Promise<boolean>} true if stopped successfully
   */
  async stopContainers() {
    logger.step('Stopping Docker containers...');

    try {
      const exitCode = await this.executeDockerCompose(['down']);
      
      if (exitCode === 0) {
        logger.success('Docker containers stopped successfully');
        return true;
      } else {
        logger.failure(`Failed to stop containers (exit code: ${exitCode})`);
        return false;
      }
    } catch (error) {
      logger.failure(`Failed to stop containers: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if NiFi is healthy/accessible with retry logic
   * @returns {Promise<boolean>} true if NiFi is accessible
   */
  async checkNiFiHealth() {
    try {
      return await this.retryManager.execute(async () => {
        return await this._performHealthCheck();
      });
    } catch (error) {
      logger.debug(`Health check failed after retries: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform a single health check attempt
   * @returns {Promise<boolean>} true if NiFi is accessible
   * @private
   */
  async _performHealthCheck() {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.nifiUrl);
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        timeout: this.config.healthCheckTimeout,
        rejectUnauthorized: false // Accept self-signed certificates
      };

      let resolved = false;
      
      // Use HTTP or HTTPS based on the URL protocol
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(options, (res) => {
        if (!resolved) {
          resolved = true;
          req.destroy(); // Clean up the request
          resolve(res.statusCode >= 200 && res.statusCode < 400);
        }
      });

      req.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          const networkError = ErrorFactory.network(`Health check failed: ${error.message}`);
          reject(networkError);
        }
      });

      req.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          req.destroy();
          const timeoutError = ErrorFactory.timeout('Health check request timed out');
          reject(timeoutError);
        }
      });

      req.end();
    });
  }

  /**
   * Wait for NiFi to become healthy
   * @param {number} maxWaitTime - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} true if NiFi becomes healthy
   */
  async waitForNiFiHealth(maxWaitTime = this.config.maxStartupWaitTime) {
    logger.progress(`Waiting for NiFi to become available at ${this.config.nifiUrl}...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      if (await this.checkNiFiHealth()) {
        logger.success(`NiFi is healthy at ${this.config.nifiUrl}`);
        return true;
      }
      
      logger.debug(`NiFi not ready yet, waiting ${this.config.healthCheckInterval}ms...`);
      await sleep(this.config.healthCheckInterval);
    }
    
    logger.failure(`NiFi did not become healthy within ${maxWaitTime}ms`);
    return false;
  }

  /**
   * Get container status
   * @returns {Promise<object>} container status information
   */
  async getContainerStatus() {
    try {
      const result = await this.executeDockerCompose(['ps', '--format', 'json'], { silent: true });
      
      if (result.code === 0) {
        const containers = result.stdout.trim().split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
          
        return {
          success: true,
          containers,
          running: containers.filter(c => c.State === 'running').length,
          total: containers.length
        };
      } else {
        return {
          success: false,
          error: result.stderr,
          containers: [],
          running: 0,
          total: 0
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        containers: [],
        running: 0,
        total: 0
      };
    }
  }

  /**
   * Restart containers
   * @returns {Promise<boolean>} true if restarted successfully
   */
  async restartContainers() {
    logger.step('Restarting Docker containers...');
    
    const stopped = await this.stopContainers();
    if (!stopped) {
      return false;
    }
    
    return await this.startContainers();
  }

  /**
   * Check if containers are running
   * @returns {Promise<boolean>} true if at least one container is running
   */
  async areContainersRunning() {
    const status = await this.getContainerStatus();
    return status.success && status.running > 0;
  }

  /**
   * Auto-start containers if not running and wait for health
   * @param {object} options - Auto-start options
   * @returns {Promise<boolean>} true if containers are running and healthy
   */
  async autoStartAndWait(options = {}) {
    const { forceRestart = false } = options;
    
    if (forceRestart) {
      logger.step('Force restart requested, stopping containers first...');
      await this.stopContainers();
    }
    
    const running = await this.areContainersRunning();
    
    if (!running) {
      logger.step('Containers not running, starting them...');
      const started = await this.startContainers();
      if (!started) {
        return false;
      }
    } else {
      logger.info('Containers are already running');
    }
    
    return await this.waitForNiFiHealth();
  }
}

/**
 * Create a default Docker manager instance
 * @param {object} config - Docker manager configuration
 * @returns {DockerManager} Docker manager instance
 */
function createDockerManager(config = {}) {
  return new DockerManager(config);
}

module.exports = {
  DockerManager,
  createDockerManager,
  DEFAULT_CONFIG
};
