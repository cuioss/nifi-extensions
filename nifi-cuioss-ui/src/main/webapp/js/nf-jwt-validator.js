/**
 * Entry point for MultiIssuerJWTTokenAuthenticator UI components.
 * This file is responsible for loading and initializing the custom UI components.
 * It delegates to main.js for the actual component registration to avoid duplication.
 */
// import $ from './utils/jquery-compat.js'; // Removed as it's unused in this file
import * as main from 'js/main'; // Assuming 'js/main' resolves correctly

'use strict'; // Keep 'use strict'

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', function () {
    // Initialize the main module if it's available and components haven't been registered yet
    if (main && typeof main.init === 'function' && !window.jwtComponentsRegistered) {
        main.init();
    } else if (window.jwtComponentsRegistered) {
        // Components already registered, skipping initialization
    } else {
        // This case might indicate an issue with the import or the main module itself
    }
});
