/**
 * Master entry point for MultiIssuerJWTTokenAuthenticator UI.
 * This file is loaded by NiFi through the JsBundle mechanism.
 * It delegates to main.js for the actual component registration to avoid duplication.
 */
define([
    'jquery',
    'nf.Common',
    'js/main'
], function ($, nfCommon, main) {
    'use strict';

    console.log('[DEBUG_LOG] NiFi JWT Validator master entry point loaded');

    // Return a public API for the bundle
    return {
        /**
         * Initialize the UI bundle
         */
        init: function() {
            console.log('[DEBUG_LOG] Bundle init method called');

            // Initialize the main module if it's available and components haven't been registered yet
            if (main && typeof main.init === 'function' && !window.jwtComponentsRegistered) {
                console.log('[DEBUG_LOG] Initializing main module from bundle');
                main.init();
            } else if (window.jwtComponentsRegistered) {
                console.log('[DEBUG_LOG] Components already registered, skipping initialization from bundle');
            } else {
                console.error('[DEBUG_LOG] Main module not available or missing init function');
            }
        }
    };
});
