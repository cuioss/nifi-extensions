/**
 * Entry point for MultiIssuerJWTTokenAuthenticator UI components.
 * This file is responsible for loading and initializing the custom UI components.
 * It delegates to main.js for the actual component registration to avoid duplication.
 */
import $ from 'jquery';
import * as main from 'js/main'; // Assuming 'js/main' resolves correctly

'use strict'; // Keep 'use strict'

// Initialize when the document is ready
$(document).ready(function () {
    console.log('[DEBUG_LOG] nf-jwt-validator.js: Document ready');

    // Main module is now imported directly
    console.log('[DEBUG_LOG] nf-jwt-validator.js: Main module imported');

    // Initialize the main module if it's available and components haven't been registered yet
    if (main && typeof main.init === 'function' && !window.jwtComponentsRegistered) {
        console.log('[DEBUG_LOG] nf-jwt-validator.js: Initializing main module');
        main.init();
    } else if (window.jwtComponentsRegistered) {
        console.log('[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization');
    } else {
        // This case might indicate an issue with the import or the main module itself
        console.error('[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function');
    }

    console.log('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
});
