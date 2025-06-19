#!/usr/bin/env node
/**
 * Centralized logging utility for e-2-e-cypress scripts
 * Provides consistent formatting and log levels across all scripts
 */

const fs = require('fs');
const path = require('path');
const { getTimestamp } = require('./common');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Log levels
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || LogLevel.INFO;
    this.logFile = options.logFile || null;
    this.includeTimestamp = options.includeTimestamp !== false;
    this.useColors = options.useColors !== false && process.stdout.isTTY;
    this.context = options.context || '';
  }

  /**
   * Set the current log level
   * @param {number} level - Log level from LogLevel enum
   */
  setLogLevel(level) {
    this.logLevel = level;
  }

  /**
   * Set context for all log messages
   * @param {string} context - Context identifier
   */
  setContext(context) {
    this.context = context;
  }

  /**
   * Format a log message with timestamp and context
   * @param {string} level - Log level name
   * @param {string} message - Log message
   * @param {string} color - ANSI color code
   * @returns {string} formatted message
   */
  formatMessage(level, message, color = '') {
    let formatted = '';
    
    if (this.includeTimestamp) {
      const timestamp = getTimestamp();
      formatted += `[${timestamp}] `;
    }
    
    if (this.context) {
      formatted += `[${this.context}] `;
    }
    
    const levelTag = `${level.toUpperCase()}:`;
    
    if (this.useColors && color) {
      formatted += `${color}${levelTag}${colors.reset} ${message}`;
    } else {
      formatted += `${levelTag} ${message}`;
    }
    
    return formatted;
  }

  /**
   * Write to log file if configured
   * @param {string} message - Message to write
   */
  writeToFile(message) {
    if (this.logFile) {
      try {
        // Remove ANSI color codes for file output
        const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
        fs.appendFileSync(this.logFile, cleanMessage + '\n');
      } catch (error) {
        // Don't throw if file logging fails
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   */
  error(message) {
    if (this.logLevel >= LogLevel.ERROR) {
      const formatted = this.formatMessage('error', message, colors.red);
      console.error(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   */
  warn(message) {
    if (this.logLevel >= LogLevel.WARN) {
      const formatted = this.formatMessage('warn', message, colors.yellow);
      console.warn(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   */
  info(message) {
    if (this.logLevel >= LogLevel.INFO) {
      const formatted = this.formatMessage('info', message, colors.cyan);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   */
  debug(message) {
    if (this.logLevel >= LogLevel.DEBUG) {
      const formatted = this.formatMessage('debug', message, colors.dim);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log a success message (special info)
   * @param {string} message - Success message
   */
  success(message) {
    if (this.logLevel >= LogLevel.INFO) {
      const formatted = this.formatMessage('success', `✅ ${message}`, colors.green);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log a step/progress message
   * @param {string} message - Step message
   */
  step(message) {
    if (this.logLevel >= LogLevel.INFO) {
      const formatted = this.formatMessage('step', `🔍 ${message}`, colors.blue);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log a warning with a special icon
   * @param {string} message - Warning message
   */
  warning(message) {
    if (this.logLevel >= LogLevel.WARN) {
      const formatted = this.formatMessage('warning', `⚠️  ${message}`, colors.yellow);
      console.warn(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log an error with a special icon
   * @param {string} message - Error message
   */
  failure(message) {
    if (this.logLevel >= LogLevel.ERROR) {
      const formatted = this.formatMessage('error', `❌ ${message}`, colors.red);
      console.error(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log a progress message
   * @param {string} message - Progress message
   */
  progress(message) {
    if (this.logLevel >= LogLevel.INFO) {
      const formatted = this.formatMessage('progress', `⏳ ${message}`, colors.magenta);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Create a child logger with additional context
   * @param {string} childContext - Additional context
   * @returns {Logger} new logger instance
   */
  child(childContext) {
    return new Logger({
      logLevel: this.logLevel,
      logFile: this.logFile,
      includeTimestamp: this.includeTimestamp,
      useColors: this.useColors,
      context: this.context ? `${this.context}:${childContext}` : childContext
    });
  }
}

/**
 * Create a default logger instance
 * @param {object} options - Logger options
 * @returns {Logger} logger instance
 */
function createLogger(options = {}) {
  return new Logger(options);
}

module.exports = {
  Logger,
  LogLevel,
  createLogger
};
