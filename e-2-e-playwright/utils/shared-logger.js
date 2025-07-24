/**
 * @file Shared Logger Utility
 * Provides a consistent logging interface for tests and utilities
 * @version 1.0.0
 */

/**
 * Logger class with different log levels
 */
class Logger {
  /**
   * Create a new logger instance
   * @param {string} name - The name of the logger
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Format a log message with timestamp and logger name
   * @param {string} level - The log level
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   * @returns {string} The formatted log message
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedMessage = args.length > 0 ? this.formatArgs(message, args) : message;
    return `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${formattedMessage}`;
  }

  /**
   * Format a message with arguments
   * @param {string} message - The message template
   * @param {Array<any>} args - The arguments to format into the message
   * @returns {string} The formatted message
   */
  formatArgs(message, args) {
    if (message.includes('%s') || message.includes('%d') || message.includes('%j') || message.includes('%o')) {
      // Node.js util.format style
      return this.formatNodeStyle(message, args);
    } else {
      // Simple concatenation
      return `${message} ${args.join(' ')}`;
    }
  }

  /**
   * Format a message using Node.js util.format style
   * @param {string} message - The message template
   * @param {Array<any>} args - The arguments to format into the message
   * @returns {string} The formatted message
   */
  formatNodeStyle(message, args) {
    let index = 0;
    return message.replace(/%[sdjo]/g, () => {
      if (index < args.length) {
        const arg = args[index++];
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      }
      return '';
    });
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   */
  info(message, ...args) {
    console.log(this.formatMessage('info', message, ...args));
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   */
  debug(message, ...args) {
    console.log(this.formatMessage('debug', message, ...args));
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   */
  warn(message, ...args) {
    console.warn(this.formatMessage('warn', message, ...args));
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   */
  error(message, ...args) {
    console.error(this.formatMessage('error', message, ...args));
  }

  /**
   * Log a success message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   */
  success(message, ...args) {
    console.log(this.formatMessage('success', message, ...args));
  }
}

// Create and export default loggers for different components
export const testLogger = new Logger('Test');
export const authLogger = new Logger('Auth');
export const processorLogger = new Logger('Processor');
export const accessibilityLogger = new Logger('Accessibility');

// Export the Logger class for creating custom loggers
export { Logger };

// Export a function to create a new logger instance
export function createLogger(name) {
  return new Logger(name);
}