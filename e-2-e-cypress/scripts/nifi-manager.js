#!/usr/bin/env node
/**
 * Unified NiFi Manager for e-2-e-cypress
 * Consolidates NiFi checking, starting, and test execution functionality
 * 
 * Modes:
 * --check-only    : Check NiFi availability and run tests if available, exit gracefully if not
 * --auto-start    : Automatically start NiFi if not available, then run tests
 * --force-start   : Force restart NiFi containers, then run tests
 * --no-tests      : Only manage NiFi containers, don't run tests
 * --status        : Show NiFi and container status
 */

const { createLogger } = require('./utils/logger');
const { createDockerManager } = require('./utils/docker');
const { parseCommandLineArgs, hasFlag, getOption, ensureProjectDirectory } = require('./utils/common');
const { spawn } = require('child_process');

// Configuration
const DEFAULT_CONFIG = {
  nifiHttpsUrl: process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi/',
  nifiHttpUrl: 'http://localhost:9094/nifi/',
  keycloakUrl: process.env.CYPRESS_KEYCLOAK_URL || 'https://localhost:9085/auth',
  selftestTimeout: 600000, // 10 minutes
  containerStartupTimeout: 180000, // 3 minutes
  maxNiFiWaitTime: 600000 // 10 minutes
};

class NiFiManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger({ context: 'nifi-manager' });
    this.dockerManager = createDockerManager({
      nifiUrl: this.config.nifiHttpUrl, // Use HTTP for Docker health checks
      maxStartupWaitTime: this.config.maxNiFiWaitTime,
      healthCheckTimeout: 5000
    });
    this.currentNiFiUrl = null;
  }

  /**
   * Check NiFi availability and determine the best URL to use
   * @returns {Promise<{available: boolean, url: string|null}>}
   */
  async checkNiFiAvailability() {
    this.logger.step('Checking NiFi availability...');

    // Try HTTPS first
    let available = await this.dockerManager.checkNiFiHealth();
    if (available) {
      // Double-check HTTPS endpoint
      const httpsManager = createDockerManager({ nifiUrl: this.config.nifiHttpsUrl });
      const httpsAvailable = await httpsManager.checkNiFiHealth();
      if (httpsAvailable) {
        this.logger.success(`NiFi HTTPS is available at ${this.config.nifiHttpsUrl}`);
        return { available: true, url: this.config.nifiHttpsUrl };
      }
    }

    // Check HTTP endpoint
    available = await this.dockerManager.checkNiFiHealth();
    if (available) {
      this.logger.success(`NiFi HTTP is available at ${this.config.nifiHttpUrl}`);
      return { available: true, url: this.config.nifiHttpUrl };
    }

    this.logger.info('NiFi is not available at either HTTPS or HTTP endpoints');
    return { available: false, url: null };
  }

  /**
   * Run Cypress selftests
   * @param {string} nifiUrl - The NiFi URL to use for testing
   * @returns {Promise<number>} exit code
   */
  async runSelftests(nifiUrl) {
    return new Promise((resolve) => {
      this.logger.step(`Running Cypress selftests with ${nifiUrl}...`);

      const cypress = spawn('npx', ['cypress', 'run', '--config-file', 'cypress.selftests.config.js'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          CYPRESS_BASE_URL: nifiUrl,
          CYPRESS_KEYCLOAK_URL: this.config.keycloakUrl
        }
      });

      // Set timeout for tests
      const timeout = setTimeout(() => {
        this.logger.warning('Test timeout reached - terminating Cypress process');
        cypress.kill('SIGTERM');
        resolve(1);
      }, this.config.selftestTimeout);

      cypress.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          this.logger.success('Selftests completed successfully');
        } else {
          this.logger.failure(`Selftests failed with code ${code}`);
        }
        resolve(code);
      });

      cypress.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.failure(`Failed to start selftests: ${error.message}`);
        resolve(1);
      });
    });
  }

  /**
   * Show status of NiFi and containers
   */
  async showStatus() {
    this.logger.step('Checking system status...');

    // Check Docker availability
    const dockerAvailable = await this.dockerManager.isDockerAvailable();
    this.logger.info(`Docker: ${dockerAvailable ? '✅ Available' : '❌ Not available'}`);

    // Check container status
    const containerStatus = await this.dockerManager.getContainerStatus();
    if (containerStatus.success) {
      this.logger.info(`Containers: ${containerStatus.running}/${containerStatus.total} running`);
      if (containerStatus.containers.length > 0) {
        containerStatus.containers.forEach(container => {
          const status = container.State === 'running' ? '✅' : '❌';
          this.logger.info(`  ${status} ${container.Name}: ${container.State}`);
        });
      }
    } else {
      this.logger.warning('Could not get container status');
    }

    // Check NiFi availability
    const nifiStatus = await this.checkNiFiAvailability();
    if (nifiStatus.available) {
      this.logger.success(`NiFi: Available at ${nifiStatus.url}`);
    } else {
      this.logger.warning('NiFi: Not available');
    }

    return nifiStatus.available;
  }

  /**
   * Execute check-only mode
   */
  async executeCheckOnly() {
    this.logger.info('Running in check-only mode');

    const nifiStatus = await this.checkNiFiAvailability();

    if (!nifiStatus.available) {
      this.logger.warning('NiFi is not available - skipping selftests (this is normal for builds without running containers)');
      this.logger.info('💡 To run selftests, start NiFi containers first or use auto-start mode');
      return 0; // Exit successfully
    }

    this.currentNiFiUrl = nifiStatus.url;
    return await this.runSelftests(this.currentNiFiUrl);
  }

  /**
   * Execute auto-start mode
   */
  async executeAutoStart() {
    this.logger.info('Running in auto-start mode');

    let nifiStatus = await this.checkNiFiAvailability();

    if (!nifiStatus.available) {
      this.logger.warning('NiFi is not available - attempting to start containers...');

      const started = await this.dockerManager.autoStartAndWait();
      if (!started) {
        this.logger.failure('Failed to start NiFi containers');
        this.logger.failure('This could be due to:');
        this.logger.failure('  - Docker not running');
        this.logger.failure('  - Network connectivity issues');
        this.logger.failure('  - Container startup timeout');
        this.logger.failure('  - Missing Docker Compose files');
        return 1;
      }

      // Recheck availability after startup
      nifiStatus = await this.checkNiFiAvailability();
      if (!nifiStatus.available) {
        this.logger.failure('NiFi did not become available after startup attempt');
        return 1;
      }
    }

    this.currentNiFiUrl = nifiStatus.url;
    this.logger.success(`NiFi is ready for testing at ${this.currentNiFiUrl}`);
    return await this.runSelftests(this.currentNiFiUrl);
  }

  /**
   * Execute force-start mode
   */
  async executeForceStart() {
    this.logger.info('Running in force-start mode - restarting containers');

    const restarted = await this.dockerManager.autoStartAndWait({ forceRestart: true });
    if (!restarted) {
      this.logger.failure('Failed to restart NiFi containers');
      return 1;
    }

    const nifiStatus = await this.checkNiFiAvailability();
    if (!nifiStatus.available) {
      this.logger.failure('NiFi did not become available after restart');
      return 1;
    }

    this.currentNiFiUrl = nifiStatus.url;
    this.logger.success(`NiFi is ready for testing at ${this.currentNiFiUrl}`);
    return await this.runSelftests(this.currentNiFiUrl);
  }

  /**
   * Execute container management only (no tests)
   */
  async executeContainerOnly(mode) {
    if (mode === 'start') {
      this.logger.info('Starting NiFi containers...');
      const started = await this.dockerManager.autoStartAndWait();
      return started ? 0 : 1;
    } else if (mode === 'stop') {
      this.logger.info('Stopping NiFi containers...');
      const stopped = await this.dockerManager.stopContainers();
      return stopped ? 0 : 1;
    } else if (mode === 'restart') {
      this.logger.info('Restarting NiFi containers...');
      const restarted = await this.dockerManager.restartContainers();
      return restarted ? 0 : 1;
    }
    return 1;
  }
}

/**
 * Display usage information
 */
function showUsage() {
  console.log(`
NiFi Manager - Unified NiFi container and test management

Usage: node nifi-manager.js [options]

Modes:
  --check-only          Check NiFi availability and run tests if available (default)
  --auto-start          Automatically start NiFi if not available, then run tests
  --force-start         Force restart NiFi containers, then run tests
  --no-tests            Only manage containers, don't run tests
  --status              Show NiFi and container status

Container Management:
  --start               Start NiFi containers (use with --no-tests)
  --stop                Stop NiFi containers (use with --no-tests)  
  --restart             Restart NiFi containers (use with --no-tests)

Options:
  --nifi-url <url>      Override NiFi base URL
  --keycloak-url <url>  Override Keycloak URL
  --timeout <ms>        Test timeout in milliseconds (default: 600000)
  --help                Show this help message

Examples:
  node nifi-manager.js                    # Check-only mode (safe for builds)
  node nifi-manager.js --auto-start       # Auto-start mode (for development)
  node nifi-manager.js --force-start      # Force restart and test
  node nifi-manager.js --status           # Show system status
  node nifi-manager.js --no-tests --start # Just start containers
  node nifi-manager.js --no-tests --stop  # Just stop containers
`);
}

/**
 * Main execution
 */
async function main() {
  // Ensure we're in the right directory
  ensureProjectDirectory();

  const args = parseCommandLineArgs();

  // Show help if requested
  if (hasFlag(args, 'help')) {
    showUsage();
    return 0;
  }

  // Create manager with custom config if provided
  const config = {};
  if (getOption(args, 'nifi-url')) {
    config.nifiHttpUrl = getOption(args, 'nifi-url');
  }
  if (getOption(args, 'keycloak-url')) {
    config.keycloakUrl = getOption(args, 'keycloak-url');
  }
  if (getOption(args, 'timeout')) {
    config.selftestTimeout = parseInt(getOption(args, 'timeout'));
  }

  const manager = new NiFiManager(config);

  try {
    // Handle status mode
    if (hasFlag(args, 'status')) {
      await manager.showStatus();
      return 0;
    }

    // Handle container-only modes
    if (hasFlag(args, 'no-tests')) {
      if (hasFlag(args, 'start')) {
        return await manager.executeContainerOnly('start');
      } else if (hasFlag(args, 'stop')) {
        return await manager.executeContainerOnly('stop');
      } else if (hasFlag(args, 'restart')) {
        return await manager.executeContainerOnly('restart');
      } else {
        console.error('❌ --no-tests requires --start, --stop, or --restart');
        return 1;
      }
    }

    // Handle test execution modes
    if (hasFlag(args, 'force-start')) {
      return await manager.executeForceStart();
    } else if (hasFlag(args, 'auto-start')) {
      return await manager.executeAutoStart();
    } else {
      // Default to check-only mode
      return await manager.executeCheckOnly();
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return 1;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { NiFiManager, DEFAULT_CONFIG };
