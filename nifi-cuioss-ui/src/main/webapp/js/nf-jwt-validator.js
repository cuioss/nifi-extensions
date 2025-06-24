/**
 * Entry point for MultiIssuerJWTTokenAuthenticator UI components.
 * This file is responsible for loading and initializing the custom UI components.
 * It delegates to main.js for the actual component registration to avoid duplication.
 */

'use strict';
import * as main from './main.js'; // Fixed import path

// Function to robustly hide loading indicator immediately
const hideLoadingImmediately = () => {
    try {
        // Try multiple strategies to find and hide loading indicators
        const selectors = [
            '#loading-indicator',
            '.loading-indicator',
            '[id*="loading"]',
            'div:contains("Loading JWT")',
        ];
        
        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.display = 'none';
                    element.style.visibility = 'hidden';
                    element.setAttribute('aria-hidden', 'true');
                    if (element.classList) {
                        element.classList.add('hidden');
                    }
                });
            } catch (selectorError) {
                // Ignore individual selector errors - some selectors may not be valid in all browsers
                console.debug('Selector error ignored:', selectorError);
            }
        });
        
        // Also check by text content
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
        
        console.log('Loading indicator hidden immediately in nf-jwt-validator.js');
    } catch (error) {
        console.warn('Error hiding loading indicator immediately:', error);
    }
};

// Hide loading immediately when script loads
hideLoadingImmediately();

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired in nf-jwt-validator.js');
    
    // Hide loading indicator again on DOM ready
    hideLoadingImmediately();
    
    // Initialize the main module if it's available and components haven't been registered yet
    if (main && typeof main.init === 'function' && !window.jwtComponentsRegistered && !window.jwtInitializationInProgress) {
        console.log('Initializing JWT UI components from nf-jwt-validator.js');
        main.init();
    } else if (window.jwtComponentsRegistered) {
        console.log('Components already registered, skipping initialization from nf-jwt-validator.js');
        // Still hide loading indicator
        hideLoadingImmediately();
    } else if (window.jwtInitializationInProgress) {
        console.log('Initialization already in progress, skipping duplicate initialization');
        // Still hide loading indicator
        hideLoadingImmediately();
    } else {
        console.error('Main module not available or missing init function');
        // Still try to hide loading indicator
        hideLoadingImmediately();
    }
});

// Also initialize immediately if DOM is already ready
if (document.readyState !== 'loading') {
    console.log('DOM already ready, initializing immediately');
    hideLoadingImmediately();
    
    if (main && typeof main.init === 'function' && !window.jwtComponentsRegistered && !window.jwtInitializationInProgress) {
        console.log('Initializing JWT UI components immediately');
        main.init();
    }
}
