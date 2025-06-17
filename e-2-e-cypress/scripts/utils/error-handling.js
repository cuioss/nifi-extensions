#!/usr/bin/env node
/**
 * Standardized Error Handling and Exit Codes for e-2-e-cypress
 * Provides consistent error codes, retry mechanisms, and structured error handling
 */

// Standard exit codes following Unix conventions
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  MISUSE_OF_BUILTIN: 2,
  CANNOT_EXECUTE: 126,
  COMMAND_NOT_FOUND: 127,
  INVALID_EXIT_ARGUMENT: 128,
  
  // Custom application-specific codes (128-255 range)
  CONFIGURATION_ERROR: 130,
  NETWORK_ERROR: 131,
  TIMEOUT_ERROR: 132,
  DEPENDENCY_ERROR: 133,
  PERMISSION_ERROR: 134,
  RESOURCE_ERROR: 135,
  VALIDATION_ERROR: 136,
  SERVICE_UNAVAILABLE: 137,
  AUTHENTICATION_ERROR: 138,
  AUTHORIZATION_ERROR: 139,
  DATA_ERROR: 140,
  SYSTEM_ERROR: 141
};

// Error categories for better error handling
const ERROR_CATEGORIES = {
  RECOVERABLE: 'recoverable',
  TEMPORARY: 'temporary',
  PERMANENT: 'permanent',
  CONFIGURATION: 'configuration',
  SYSTEM: 'system'
};

// Retry configuration
const RETRY_CONFIG = {
  DEFAULT_MAX_ATTEMPTS: 3,
  DEFAULT_INITIAL_DELAY: 1000, // 1 second
  DEFAULT_BACKOFF_FACTOR: 2,
  DEFAULT_MAX_DELAY: 30000, // 30 seconds
  DEFAULT_JITTER: true
};

/**
 * Standardized error class with categorization and retry hints
 */
class StandardError extends Error {
  constructor(message, code = EXIT_CODES.GENERAL_ERROR, category = ERROR_CATEGORIES.PERMANENT, retryable = false) {
    super(message);
    this.name = 'StandardError';
    this.code = code;
    this.category = category;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, StandardError);
  }

  /**
   * Convert error to structured object
   */
  toObject() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      retryable: this.retryable,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get human-readable error description
   */
  getDescription() {
    const codeNames = Object.keys(EXIT_CODES).find(key => EXIT_CODES[key] === this.code);
    return `${codeNames || 'UNKNOWN'} (${this.code}): ${this.message}`;
  }
}

/**
 * Error factory for creating specific error types
 */
class ErrorFactory {
  static configuration(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.CONFIGURATION_ERROR, ERROR_CATEGORIES.CONFIGURATION, retryable);
  }

  static network(message, retryable = true) {
    return new StandardError(message, EXIT_CODES.NETWORK_ERROR, ERROR_CATEGORIES.TEMPORARY, retryable);
  }

  static timeout(message, retryable = true) {
    return new StandardError(message, EXIT_CODES.TIMEOUT_ERROR, ERROR_CATEGORIES.TEMPORARY, retryable);
  }

  static dependency(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.DEPENDENCY_ERROR, ERROR_CATEGORIES.SYSTEM, retryable);
  }

  static permission(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.PERMISSION_ERROR, ERROR_CATEGORIES.SYSTEM, retryable);
  }

  static resource(message, retryable = true) {
    return new StandardError(message, EXIT_CODES.RESOURCE_ERROR, ERROR_CATEGORIES.TEMPORARY, retryable);
  }

  static validation(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.VALIDATION_ERROR, ERROR_CATEGORIES.CONFIGURATION, retryable);
  }

  static serviceUnavailable(message, retryable = true) {
    return new StandardError(message, EXIT_CODES.SERVICE_UNAVAILABLE, ERROR_CATEGORIES.TEMPORARY, retryable);
  }

  static authentication(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.AUTHENTICATION_ERROR, ERROR_CATEGORIES.CONFIGURATION, retryable);
  }

  static authorization(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.AUTHORIZATION_ERROR, ERROR_CATEGORIES.CONFIGURATION, retryable);
  }

  static data(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.DATA_ERROR, ERROR_CATEGORIES.PERMANENT, retryable);
  }

  static system(message, retryable = false) {
    return new StandardError(message, EXIT_CODES.SYSTEM_ERROR, ERROR_CATEGORIES.SYSTEM, retryable);
  }
}

/**
 * Retry mechanism with exponential backoff and jitter
 */
class RetryManager {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || RETRY_CONFIG.DEFAULT_MAX_ATTEMPTS;
    this.initialDelay = options.initialDelay || RETRY_CONFIG.DEFAULT_INITIAL_DELAY;
    this.backoffFactor = options.backoffFactor || RETRY_CONFIG.DEFAULT_BACKOFF_FACTOR;
    this.maxDelay = options.maxDelay || RETRY_CONFIG.DEFAULT_MAX_DELAY;
    this.jitter = options.jitter !== undefined ? options.jitter : RETRY_CONFIG.DEFAULT_JITTER;
    this.logger = options.logger;
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options
   * @returns {Promise} result of successful execution
   */
  async execute(fn, options = {}) {
    const { shouldRetry = (error) => error.retryable } = options;
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        if (this.logger && attempt > 1) {
          this.logger.debug(`Retry attempt ${attempt}/${this.maxAttempts}`);
        }
        
        return await fn();
        
      } catch (error) {
        lastError = error;
        
        if (this.logger) {
          this.logger.debug(`Attempt ${attempt} failed: ${error.message}`);
        }
        
        // Don't retry on last attempt or if error is not retryable
        if (attempt === this.maxAttempts || !shouldRetry(error)) {
          break;
        }
        
        // Calculate delay with exponential backoff and optional jitter
        const baseDelay = Math.min(
          this.initialDelay * Math.pow(this.backoffFactor, attempt - 1),
          this.maxDelay
        );
        
        const delay = this.jitter 
          ? baseDelay + (Math.random() * baseDelay * 0.1) // Add up to 10% jitter
          : baseDelay;
        
        if (this.logger) {
          this.logger.debug(`Waiting ${Math.round(delay)}ms before retry...`);
        }
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Enhanced error handler with structured logging and recovery suggestions
 */
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Handle error with appropriate logging and exit behavior
   * @param {Error} error - Error to handle
   * @param {Object} options - Handling options
   */
  handle(error, options = {}) {
    const { 
      exit = true, 
      suggestions = true,
      context = '',
      operation = 'Operation'
    } = options;

    // Ensure error is a StandardError
    const standardError = error instanceof StandardError 
      ? error 
      : new StandardError(error.message || 'Unknown error', EXIT_CODES.GENERAL_ERROR);

    // Log structured error information
    this.logError(standardError, context, operation);

    // Provide recovery suggestions if enabled
    if (suggestions) {
      this.provideSuggestions(standardError, operation);
    }

    // Exit if requested
    if (exit) {
      process.exit(standardError.code);
    }

    return standardError.code;
  }

  /**
   * Log error with structured information
   */
  logError(error, context, operation) {
    const contextStr = context ? ` [${context}]` : '';
    
    this.logger.failure(`${operation} failed${contextStr}: ${error.message}`);
    
    if (this.logger.logLevel >= 3) { // DEBUG level
      this.logger.debug(`Error details: ${JSON.stringify(error.toObject(), null, 2)}`);
    }
  }

  /**
   * Provide contextual recovery suggestions
   */
  provideSuggestions(error, operation) {
    const suggestions = this.getSuggestions(error, operation);
    
    if (suggestions.length > 0) {
      this.logger.info('💡 Possible solutions:');
      suggestions.forEach(suggestion => {
        this.logger.info(`  • ${suggestion}`);
      });
    }
  }

  /**
   * Get contextual suggestions based on error type
   */
  getSuggestions(error, operation) {
    const suggestions = [];

    switch (error.code) {
      case EXIT_CODES.CONFIGURATION_ERROR:
        suggestions.push('Check configuration files and environment variables');
        suggestions.push('Verify all required settings are provided');
        break;
        
      case EXIT_CODES.NETWORK_ERROR:
        suggestions.push('Check network connectivity');
        suggestions.push('Verify firewall settings');
        suggestions.push('Try again in a few moments');
        break;
        
      case EXIT_CODES.TIMEOUT_ERROR:
        suggestions.push('Increase timeout values if possible');
        suggestions.push('Check system performance and load');
        suggestions.push('Verify services are responding');
        break;
        
      case EXIT_CODES.DEPENDENCY_ERROR:
        suggestions.push('Install missing dependencies');
        suggestions.push('Check package.json and requirements');
        suggestions.push('Run npm install or equivalent');
        break;
        
      case EXIT_CODES.PERMISSION_ERROR:
        suggestions.push('Check file and directory permissions');
        suggestions.push('Run with appropriate privileges if needed');
        suggestions.push('Verify user has necessary access rights');
        break;
        
      case EXIT_CODES.SERVICE_UNAVAILABLE:
        suggestions.push('Start required services (Docker, NiFi, etc.)');
        suggestions.push('Check service health and status');
        suggestions.push('Wait for services to fully initialize');
        break;
        
      case EXIT_CODES.AUTHENTICATION_ERROR:
        suggestions.push('Check credentials and authentication settings');
        suggestions.push('Verify tokens and certificates are valid');
        suggestions.push('Review authentication configuration');
        break;
        
      default:
        if (error.retryable) {
          suggestions.push('Try the operation again');
          suggestions.push('Check system resources and status');
        } else {
          suggestions.push('Review the error message and fix the underlying issue');
          suggestions.push('Check logs for more detailed information');
        }
        break;
    }

    return suggestions;
  }
}

/**
 * Process exit handler with cleanup and structured logging
 */
class ExitHandler {
  constructor(logger) {
    this.logger = logger || {
      warning: (msg) => console.warn(`⚠️  ${msg}`),
      failure: (msg) => console.error(`❌ ${msg}`),
      debug: (msg) => console.debug(`🐛 ${msg}`)
    };
    this.cleanupHandlers = [];
    this.setupSignalHandlers();
  }

  /**
   * Register cleanup function
   */
  onCleanup(handler) {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.warning(`Received ${signal}, initiating graceful shutdown...`);
        this.cleanup().then(() => {
          process.exit(EXIT_CODES.SUCCESS);
        });
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.failure(`Uncaught exception: ${error.message}`);
      this.logger.debug(error.stack);
      this.cleanup().then(() => {
        process.exit(EXIT_CODES.SYSTEM_ERROR);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.failure(`Unhandled promise rejection: ${reason}`);
      this.logger.debug(`Promise: ${promise}`);
      this.cleanup().then(() => {
        process.exit(EXIT_CODES.SYSTEM_ERROR);
      });
    });
  }

  /**
   * Execute all cleanup handlers
   */
  async cleanup() {
    this.logger.debug('Running cleanup handlers...');
    
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.warning(`Cleanup handler failed: ${error.message}`);
      }
    }
    
    this.logger.debug('Cleanup completed');
  }

  /**
   * Exit with code and message
   */
  exit(code, message = '') {
    if (message) {
      if (code === EXIT_CODES.SUCCESS) {
        this.logger.success(message);
      } else {
        this.logger.failure(message);
      }
    }
    
    this.cleanup().then(() => {
      process.exit(code);
    });
  }
}

module.exports = {
  EXIT_CODES,
  ERROR_CATEGORIES,
  RETRY_CONFIG,
  StandardError,
  ErrorFactory,
  RetryManager,
  ErrorHandler,
  ExitHandler
};
