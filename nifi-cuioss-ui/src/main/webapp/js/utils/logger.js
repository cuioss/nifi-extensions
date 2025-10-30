/**
 * @file Centralized logging utility for NiFi UI components
 * Provides consistent logging with proper levels and environment-aware output
 * Follows CUI logging standards adapted for browser environment
 */

/**
 * Log levels following CUI standards
 * INFO (001-99), WARN (100-199), ERROR (200-299), FATAL (300-399)
 */
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

/**
 * Environment detection for log level control
 */
const isDevelopment = () => {
    // Check for development indicators
    const hostname = globalThis?.location?.hostname || '';
    const search = globalThis?.location?.search || '';
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.endsWith('.local') ||
           search.includes('debug=true') ||
           (typeof localStorage !== 'undefined' && localStorage.getItem('nifi-debug') === 'true');
};

/**
 * Default log level based on environment
 */
const DEFAULT_LOG_LEVEL = isDevelopment() ? LogLevel.DEBUG : LogLevel.WARN;

/**
 * Logger class providing centralized logging for NiFi UI components
 */
class NiFiLogger {
    constructor(component = 'NiFi-UI', logLevel = DEFAULT_LOG_LEVEL) {
        this.component = component;
        this.logLevel = logLevel;
        this.startTime = Date.now();
    }

    /**
     * Creates a timestamp for log entries
     * @returns {string} Formatted timestamp
     */
    _getTimestamp() {
        const now = new Date();
        const elapsed = now.getTime() - this.startTime;
        return `[${now.toISOString()}] (+${elapsed}ms)`;
    }

    /**
     * Formats log message with component context
     * @param {string} level - Log level
     * @param {string} message - Primary message
     * @param {...any} args - Additional arguments
     * @returns {Array} Formatted message parts
     */
    _formatMessage(level, message, ...args) {
        const timestamp = this._getTimestamp();
        const prefix = `${timestamp} [${level}] ${this.component}:`;
        return [prefix, message, ...args];
    }

    /**
     * Checks if log level should be output
     * @param {number} level - Log level to check
     * @returns {boolean} True if should log
     */
    _shouldLog(level) {
        return level >= this.logLevel;
    }

    /**
     * Debug level logging - development and troubleshooting information
     * @param {string} message - Debug message
     * @param {...any} args - Additional arguments
     */
    debug(message, ...args) {
        if (this._shouldLog(LogLevel.DEBUG)) {
            // eslint-disable-next-line no-console
            console.debug(...this._formatMessage('DEBUG', message, ...args));
        }
    }

    /**
     * Info level logging - general information (001-099)
     * @param {string} message - Info message
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        if (this._shouldLog(LogLevel.INFO)) {
            // eslint-disable-next-line no-console
            console.info(...this._formatMessage('INFO', message, ...args));
        }
    }

    /**
     * Warning level logging - potential issues (100-199)
     * @param {string} message - Warning message
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        if (this._shouldLog(LogLevel.WARN)) {
            // eslint-disable-next-line no-console
            console.warn(...this._formatMessage('WARN', message, ...args));
        }
    }

    /**
     * Error level logging - errors and exceptions (200-299)
     * @param {string} message - Error message
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        if (this._shouldLog(LogLevel.ERROR)) {
            // eslint-disable-next-line no-console
            console.error(...this._formatMessage('ERROR', message, ...args));
        }
    }

    /**
     * Fatal level logging - critical system failures (300-399)
     * @param {string} message - Fatal message
     * @param {...any} args - Additional arguments
     */
    fatal(message, ...args) {
        if (this._shouldLog(LogLevel.FATAL)) {
            // eslint-disable-next-line no-console
            console.error(...this._formatMessage('FATAL', message, ...args));
        }
    }

    /**
     * Creates a child logger with component-specific context
     * @param {string} childComponent - Child component name
     * @returns {NiFiLogger} New logger instance
     */
    child(childComponent) {
        return new NiFiLogger(`${this.component}:${childComponent}`, this.logLevel);
    }

    /**
     * Sets log level dynamically
     * @param {number} level - New log level
     */
    setLogLevel(level) {
        this.logLevel = level;
    }

    /**
     * Performance timing helper
     * @param {string} operation - Operation name
     * @returns {Function} Function to call when operation completes
     */
    time(operation) {
        const startTime = performance.now();
        this.debug(`Starting operation: ${operation}`);

        return () => {
            const duration = performance.now() - startTime;
            this.debug(`Operation completed: ${operation} (${duration.toFixed(2)}ms)`);
        };
    }
}

/**
 * Default logger instance for general use
 */
const logger = new NiFiLogger('NiFi-UI');

/**
 * Factory function to create component-specific loggers
 * @param {string} component - Component name
 * @returns {NiFiLogger} Logger instance for component
 */
const createLogger = (component) => new NiFiLogger(component);

/**
 * Expose log levels for external configuration
 */
const LOG_LEVELS = LogLevel;

// Enable debug mode via browser console
if (typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined') {
    globalThis.nifiDebug = {
        enable: () => {
            localStorage.setItem('nifi-debug', 'true');
            logger.setLogLevel(LogLevel.DEBUG);
            logger.info('Debug logging enabled');
        },
        disable: () => {
            localStorage.removeItem('nifi-debug');
            logger.setLogLevel(LogLevel.WARN);
            logger.info('Debug logging disabled');
        },
        setLevel: (level) => {
            logger.setLogLevel(level);
            logger.info(`Log level set to: ${Object.keys(LogLevel)[level]}`);
        }
    };
}

export { logger, createLogger, LOG_LEVELS, LogLevel };
export default logger;
