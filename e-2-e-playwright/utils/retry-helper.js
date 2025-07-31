/**
 * @file Enhanced retry utility for E2E tests
 * Provides sophisticated retry logic for flaky test scenarios
 * @version 1.0.0
 */

/**
 * Retry configuration options
 * @typedef {Object} RetryOptions
 * @property {number} maxRetries - Maximum number of retry attempts
 * @property {number} initialDelay - Initial delay between retries in ms
 * @property {number} maxDelay - Maximum delay between retries in ms
 * @property {number} backoffMultiplier - Exponential backoff multiplier
 * @property {Function} shouldRetry - Custom function to determine if retry should happen
 * @property {Function} onRetry - Callback function called on each retry attempt
 */

/**
 * Default retry configuration
 * @type {RetryOptions}
 */
const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 1.5,
    shouldRetry: (error, attempt) => {
        // Default retry logic - retry on common flaky test errors
        const errorMessage = error.message.toLowerCase();
        
        // Always retry on timeout errors
        if (errorMessage.includes('timeout')) return true;
        
        // Retry on network-related errors
        if (errorMessage.includes('network') || 
            errorMessage.includes('connection') ||
            errorMessage.includes('refused')) return true;
        
        // Retry on element not found errors (could be timing issues)
        if (errorMessage.includes('element not found') ||
            errorMessage.includes('not visible') ||
            errorMessage.includes('detached')) return true;
        
        // Retry on NiFi service availability errors
        if (errorMessage.includes('nifi') && 
            errorMessage.includes('not available')) return true;
        
        // Don't retry on assertion errors or test logic errors
        if (errorMessage.includes('expect') ||
            errorMessage.includes('assertion')) return false;
        
        return true; // Default to retry for other errors
    },
    onRetry: (error, attempt, delay) => {
        console.log(`🔄 Retry attempt ${attempt} after ${delay}ms delay. Error: ${error.message}`);
    }
};

/**
 * Executes a function with sophisticated retry logic
 * @param {Function} fn - The function to execute (can be async)
 * @param {RetryOptions} options - Retry configuration options
 * @returns {Promise<*>} The result of the function or throws the last error
 */
export async function withRetry(fn, options = {}) {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError;
    let delay = config.initialDelay;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            // Don't retry if this is the last attempt
            if (attempt === config.maxRetries) {
                break;
            }
            
            // Check if we should retry this error
            if (!config.shouldRetry(error, attempt + 1)) {
                throw error;
            }
            
            // Call retry callback
            config.onRetry(error, attempt + 1, delay);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Calculate next delay with exponential backoff
            delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
        }
    }
    
    // If we get here, all retries failed
    throw new Error(`Operation failed after ${config.maxRetries + 1} attempts. Last error: ${lastError.message}`);
}

/**
 * Specialized retry function for Playwright page interactions
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Function} fn - Function that takes the page as parameter
 * @param {RetryOptions} options - Retry configuration options
 * @returns {Promise<*>} The result of the function
 */
export async function withPageRetry(page, fn, options = {}) {
    const pageSpecificOptions = {
        ...options,
        shouldRetry: (error, attempt) => {
            const errorMessage = error.message.toLowerCase();
            
            // Playwright-specific retry conditions
            if (errorMessage.includes('page crashed') ||
                errorMessage.includes('page closed') ||
                errorMessage.includes('context closed')) return true;
            
            // Element interaction issues
            if (errorMessage.includes('element is not attached') ||
                errorMessage.includes('element is not visible') ||
                errorMessage.includes('element is outside of the viewport')) return true;
            
            // Navigation issues
            if (errorMessage.includes('navigation timeout') ||
                errorMessage.includes('waiting for navigation')) return true;
            
            // Use default retry logic for other cases
            return DEFAULT_RETRY_OPTIONS.shouldRetry(error, attempt);
        },
        onRetry: (error, attempt, delay) => {
            console.log(`🔄 Page retry attempt ${attempt} after ${delay}ms. Error: ${error.message}`);
            // Optionally reload the page on retry for certain errors
            if (error.message.toLowerCase().includes('page crashed')) {
                console.log('📄 Reloading page due to page crash...');
                // Note: page reload would be handled by the calling function
            }
        }
    };
    
    return withRetry(() => fn(page), pageSpecificOptions);
}

/**
 * Specialized retry function for element interactions
 * @param {import('@playwright/test').Locator} locator - Playwright locator
 * @param {Function} fn - Function that takes the locator as parameter
 * @param {RetryOptions} options - Retry configuration options
 * @returns {Promise<*>} The result of the function
 */
export async function withElementRetry(locator, fn, options = {}) {
    const elementSpecificOptions = {
        ...options,
        maxRetries: options.maxRetries || 5, // More retries for element interactions
        initialDelay: options.initialDelay || 500, // Shorter initial delay
        shouldRetry: (error, attempt) => {
            const errorMessage = error.message.toLowerCase();
            
            // Element-specific retry conditions
            if (errorMessage.includes('element not found') ||
                errorMessage.includes('element is not attached') ||
                errorMessage.includes('element is not visible') ||
                errorMessage.includes('element is not stable') ||
                errorMessage.includes('element is outside of the viewport')) return true;
            
            // Use default retry logic for other cases
            return DEFAULT_RETRY_OPTIONS.shouldRetry(error, attempt);
        },
        onRetry: (error, attempt, delay) => {
            console.log(`🎯 Element retry attempt ${attempt} after ${delay}ms. Error: ${error.message}`);
        }
    };
    
    return withRetry(() => fn(locator), elementSpecificOptions);
}

/**
 * Creates a retry configuration optimized for NiFi UI interactions
 * @param {Object} overrides - Configuration overrides
 * @returns {RetryOptions} NiFi-optimized retry configuration
 */
export function createNiFiRetryConfig(overrides = {}) {
    return {
        maxRetries: 4, // NiFi UI can be slow to load
        initialDelay: 2000, // Give NiFi components time to initialize
        maxDelay: 15000,
        backoffMultiplier: 1.3,
        shouldRetry: (error, attempt) => {
            const errorMessage = error.message.toLowerCase();
            
            // NiFi-specific retry conditions
            if (errorMessage.includes('nifi') ||
                errorMessage.includes('processor') ||
                errorMessage.includes('advanced ui') ||
                errorMessage.includes('custom ui')) return true;
            
            // Loading and initialization issues
            if (errorMessage.includes('loading') ||
                errorMessage.includes('initializing') ||
                errorMessage.includes('not ready')) return true;
            
            return DEFAULT_RETRY_OPTIONS.shouldRetry(error, attempt);
        },
        onRetry: (error, attempt, delay) => {
            console.log(`🔄 NiFi retry attempt ${attempt}/${overrides.maxRetries || 4} after ${delay}ms`);
            console.log(`   Error: ${error.message}`);
        },
        ...overrides
    };
}

/**
 * Utility function to add retry capability to existing test functions
 * @param {Object} testObject - The test object (e.g., from describe block)
 * @param {string} methodName - The method name to wrap with retry
 * @param {RetryOptions} options - Retry configuration options
 */
export function addRetryToMethod(testObject, methodName, options = {}) {
    const originalMethod = testObject[methodName];
    if (typeof originalMethod !== 'function') {
        throw new Error(`Method ${methodName} not found or is not a function`);
    }
    
    testObject[methodName] = async function(...args) {
        return withRetry(() => originalMethod.apply(this, args), options);
    };
}