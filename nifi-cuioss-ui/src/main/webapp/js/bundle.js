/**
 * Master entry point for MultiIssuerJWTTokenAuthenticator UI.
 * This file is loaded by NiFi through the JsBundle mechanism.
 * It delegates to main.js for the actual component registration to avoid duplication.
 */
// import $ from 'cash-dom'; // Unused
// import nfCommon from 'nf.Common'; // Unused
import * as main from 'js/main';

'use strict';

export const init = function () {
    // Initialize the main module if it's available and components haven't been registered yet
    if (main && typeof main.init === 'function' && !window.jwtComponentsRegistered) {
        main.init();
    } else if (window.jwtComponentsRegistered) {
        // Components already registered, skipping initialization from bundle
    } else {
        // Main module not available or missing init function
    }
};
