#!/usr/bin/env node
/**
 * Common utility functions shared across e-2-e-cypress scripts
 */

const fs = require('fs');
const path = require('path');
const { EXIT_CODES, ErrorFactory } = require('./error-handling');

/**
 * Check if we're in the correct e-2-e-cypress directory
 * @returns {boolean} true if in correct directory
 */
function checkProjectDirectory() {
  return fs.existsSync('package.json') && fs.existsSync('cypress.config.js');
}

/**
 * Ensure we're in the correct directory or exit
 */
function ensureProjectDirectory() {
  if (!checkProjectDirectory()) {
    const error = ErrorFactory.configuration('Not in e-2-e-cypress directory. Please run from the correct location.');
    throw error;
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to the file
 * @returns {boolean} true if file exists
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Check if a directory exists
 * @param {string} dirPath - Path to the directory
 * @returns {boolean} true if directory exists
 */
function directoryExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Path to create
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get project root directory
 * @returns {string} absolute path to project root
 */
function getProjectRoot() {
  return process.cwd();
}

/**
 * Parse command line arguments into an object
 * @param {string[]} args - Process arguments
 * @returns {object} parsed arguments
 */
function parseCommandLineArgs(args = process.argv.slice(2)) {
  const parsed = {
    flags: [],
    options: {},
    positional: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        parsed.options[key] = args[i + 1];
        i++; // Skip next argument as it's the value
      } else {
        parsed.flags.push(key);
      }
    } else if (arg.startsWith('-')) {
      parsed.flags.push(arg.slice(1));
    } else {
      parsed.positional.push(arg);
    }
  }

  return parsed;
}

/**
 * Utility function to check if a flag is present
 * @param {object} args - Parsed arguments
 * @param {string} flag - Flag to check
 * @returns {boolean} true if flag is present
 */
function hasFlag(args, flag) {
  return args.flags.includes(flag);
}

/**
 * Get option value with default
 * @param {object} args - Parsed arguments
 * @param {string} key - Option key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} option value or default
 */
function getOption(args, key, defaultValue = null) {
  return args.options[key] || defaultValue;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current timestamp in ISO format
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Execute a shell command and return promise
 * @param {string} command - Command to execute
 * @param {object} options - Spawn options
 * @returns {Promise} resolves with exit code
 */
function executeCommand(command, options = {}) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      resolve(code);
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  checkProjectDirectory,
  ensureProjectDirectory,
  fileExists,
  directoryExists,
  ensureDirectory,
  getProjectRoot,
  parseCommandLineArgs,
  hasFlag,
  getOption,
  sleep,
  getTimestamp,
  formatFileSize,
  executeCommand
};
