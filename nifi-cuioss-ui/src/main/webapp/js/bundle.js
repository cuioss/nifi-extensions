/**
 * Master entry point for MultiIssuerJWTTokenAuthenticator UI.
 * This file is loaded by NiFi through the JsBundle mechanism.
 * It delegates to main.js for the actual component registration to avoid duplication.
 */

'use strict';

import * as main from 'js/main'; // Match test mock path

// Function to immediately hide loading indicators
const hideLoadingIndicatorImmediate = () => {
    try {
        // Hide loading indicator with multiple strategies
        const indicators = document.querySelectorAll('#loading-indicator, .loading-indicator, [id*="loading"]');
        indicators.forEach(indicator => {
            indicator.style.display = 'none';
            indicator.style.visibility = 'hidden';
            indicator.setAttribute('aria-hidden', 'true');
            if (indicator.classList) {
                indicator.classList.add('hidden');
            }
        });

        // Also hide by text content
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && element.textContent.includes('Loading JWT')) {
                element.style.display = 'none';
                element.style.visibility = 'hidden';
                element.setAttribute('aria-hidden', 'true');
                if (element.classList) {
                    element.classList.add('hidden');
                }
            }
        });

        console.log('Loading indicator hidden in bundle.js');
    } catch (error) {
        console.warn('Error hiding loading indicator in bundle.js:', error);
    }
};

export const init = function () {
    console.log('Bundle.js init() called');

    // Immediately hide loading indicator
    hideLoadingIndicatorImmediate();

    // Check if components are already registered or initialization is in progress
    if (window.jwtComponentsRegistered || window.jwtInitializationInProgress) {
        console.log('Components already registered or initialization in progress, skipping initialization from bundle');
        return;
    }

    // Initialize the main module if it's available
    if (main && typeof main.init === 'function') {
        console.log('Initializing JWT UI components from bundle.js');
        main.init();
    } else {
        console.error('Main module not available or missing init function from bundle.js');
        // Still try to hide loading indicator
        hideLoadingIndicatorImmediate();
    }
};

// Export for testing
export { hideLoadingIndicatorImmediate };
