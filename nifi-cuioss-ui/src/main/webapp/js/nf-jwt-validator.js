/**
 * JWT Validator initialization script
 * This script initializes the JWT validator UI when the DOM is loaded
 */

/**
 * Check if initialization can proceed
 * @returns {boolean} True if initialization should proceed
 */
const canInitialize = () => {
    if (globalThis.jwtComponentsRegistered) {
        console.info('[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization');
        return false;
    }
    if (globalThis.jwtInitializationInProgress) {
        console.info('[DEBUG_LOG] nf-jwt-validator.js: Initialization already in progress, skipping');
        return false;
    }
    return true;
};

/**
 * Handle initialization result (Promise or synchronous)
 * @param {*} result - The initialization result
 */
const handleInitResult = (result) => {
    if (result && typeof result.then === 'function') {
        result.then(() => {
            console.info('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
            globalThis.jwtComponentsRegistered = true;
            globalThis.jwtInitializationInProgress = false;
        }).catch(error => {
            console.error('[DEBUG_LOG] nf-jwt-validator.js: Initialization failed', error);
            globalThis.jwtInitializationInProgress = false;
        });
    } else {
        console.info('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete (non-Promise result)');
        globalThis.jwtComponentsRegistered = true;
        globalThis.jwtInitializationInProgress = false;
    }
};

/**
 * Initialize the main module
 */
const initializeMainModule = () => {
    const main = require('js/main');
    console.info('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');

    if (main && typeof main.init === 'function') {
        console.info('[DEBUG_LOG] nf-jwt-validator.js: Initializing main module');
        handleInitResult(main.init());
    } else {
        console.error('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function');
        globalThis.jwtInitializationInProgress = false;
    }
};

/**
 * Hide all loading indicators
 */
const hideLoadingIndicators = () => {
    const loadingIndicators = document.querySelectorAll('#loading-indicator, .loading-indicator, [id*="loading"]');
    if (loadingIndicators && loadingIndicators.length > 0) {
        for (const indicator of loadingIndicators) {
            indicator.style.display = 'none';
        }
        globalThis.jwtLoadingIndicatorHidden = true;
    } else {
        console.warn('No loading indicators found to hide');
    }
};

// Add event listener for DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    if (!canInitialize()) {
        return;
    }

    globalThis.jwtInitializationInProgress = true;
    console.info('[DEBUG_LOG] nf-jwt-validator.js: Document ready');

    try {
        initializeMainModule();
    } catch (error) {
        console.error('[DEBUG_LOG] nf-jwt-validator.js: Error during initialization', error);
        globalThis.jwtInitializationInProgress = false;
    }

    try {
        hideLoadingIndicators();
    } catch (error) {
        console.error('[DEBUG_LOG] nf-jwt-validator.js: Error hiding loading indicators', error);
    }
});
