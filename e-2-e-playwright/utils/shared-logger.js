/**
 * @file Shared Logger Utility - Cleaned Version
 * Provides consistent logging with colors and emojis for E2E tests
 * @version 2.0.0
 */

/**
 * Logger class for consistent output formatting
 */
class Logger {
  constructor(name) {
    this.name = name;
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m'
    };
    
    this.emojis = {
      info: '📌',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🐛',
      test: '🧪'
    };
  }

  /**
   * Format a message with timestamp, emoji, and color
   * @param {string} level - Log level (info, success, warning, error)
   * @param {string} message - The message to format
   * @param {...any} args - Additional arguments to format into the message
   * @returns {string} Formatted message
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const emoji = this.emojis[level] || '';
    const color = this.getColorForLevel(level);
    
    // Format the message with any additional arguments
    let formattedMessage = message;
    if (args.length > 0) {
      formattedMessage = message.replace(/%s/g, () => args.shift() || '');
      if (args.length > 0) {
        formattedMessage += ' ' + args.join(' ');
      }
    }
    
    return `[${timestamp}] ${color}[${level.toUpperCase()}]${this.colors.reset} ${emoji} ${color}[${this.name}]${this.colors.reset} ${formattedMessage}`;
  }

  /**
   * Get color code for log level
   * @param {string} level - Log level
   * @returns {string} Color code
   */
  getColorForLevel(level) {
    const colorMap = {
      info: this.colors.blue,
      success: this.colors.green,
      warning: this.colors.yellow,
      error: this.colors.red,
      debug: this.colors.gray,
      test: this.colors.magenta
    };
    return colorMap[level] || this.colors.reset;
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
   * Log a warning message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   */
  warn(message, ...args) {
    console.warn(this.formatMessage('warning', message, ...args));
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

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to format into the message
   */
  debug(message, ...args) {
    // Only log debug messages if DEBUG environment variable is set
    if (process.env.DEBUG || process.env.PLAYWRIGHT_DEBUG) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }
}

// Create and export the loggers that are actually used in the codebase
export const processorLogger = new Logger('Processor');
export const authLogger = new Logger('Auth');

// Export the Logger class for creating custom loggers if needed
export { Logger };