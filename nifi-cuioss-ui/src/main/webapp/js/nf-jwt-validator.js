/**
 * JWT Validator initialization script
 * This script initializes the JWT validator UI when the DOM is loaded
 */

// Add event listener for DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    // Check if components are already registered or initialization is in progress
    if (window.jwtComponentsRegistered) {
        console.info('[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization');
        return;
    }

    if (window.jwtInitializationInProgress) {
        console.info('[DEBUG_LOG] nf-jwt-validator.js: Initialization already in progress, skipping');
        return;
    }

    // Set initialization flag
    window.jwtInitializationInProgress = true;

    console.info('[DEBUG_LOG] nf-jwt-validator.js: Document ready');

    try {
        // Import main module
        const main = require('js/main');
        console.info('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');

        // Check if main module is valid and has init function
        if (main && typeof main.init === 'function') {
            console.info('[DEBUG_LOG] nf-jwt-validator.js: Initializing main module');

            // Initialize main module
            const result = main.init();

            // Handle Promise or non-Promise result
            if (result && typeof result.then === 'function') {
                result.then(() => {
                    console.info('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
                    window.jwtComponentsRegistered = true;
                    window.jwtInitializationInProgress = false;
                }).catch(error => {
                    console.error('[DEBUG_LOG] nf-jwt-validator.js: Initialization failed', error);
                    window.jwtInitializationInProgress = false;
                });
            } else {
                console.info('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete (non-Promise result)');
                window.jwtComponentsRegistered = true;
                window.jwtInitializationInProgress = false;
            }
        } else {
            console.error('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function');
            window.jwtInitializationInProgress = false;
        }
    } catch (error) {
        console.error('[DEBUG_LOG] nf-jwt-validator.js: Error during initialization', error);
        window.jwtInitializationInProgress = false;
    }

    // Handle loading indicator hiding
    try {
        const loadingIndicators = document.querySelectorAll('#loading-indicator, .loading-indicator, [id*="loading"]');
        if (loadingIndicators && loadingIndicators.length > 0) {
            for (const indicator of loadingIndicators) {
                indicator.style.display = 'none';
            }
            window.jwtLoadingIndicatorHidden = true;
        } else {
            console.warn('No loading indicators found to hide');
        }
    } catch (error) {
        console.error('[DEBUG_LOG] nf-jwt-validator.js: Error hiding loading indicators', error);
    }
});
