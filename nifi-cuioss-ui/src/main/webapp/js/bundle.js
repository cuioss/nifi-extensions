/**
 * Master entry point for MultiIssuerJWTTokenAuthenticator UI.
 * This file is loaded by NiFi through the JsBundle mechanism.
 */
define([
    'jquery',
    'nf.Common',
    'js/main'
], function ($, nfCommon, main) {
    'use strict';

    console.log('[DEBUG_LOG] NiFi JWT Validator master entry point loaded');

    // Initialize when the document is ready
    $(document).ready(function() {
        console.log('[DEBUG_LOG] Document ready in master entry point');

        // Initialize the main module if components haven't been registered yet
        if (!window.jwtComponentsRegistered) {
            console.log('[DEBUG_LOG] Components not registered yet, initializing main module');
            main.init();
        } else {
            console.log('[DEBUG_LOG] Components already registered, skipping initialization');
        }

        console.log('[DEBUG_LOG] Master initialization complete');
    });

    // Return a public API for the bundle
    return {
        /**
         * Initialize the UI bundle
         */
        init: function() {
            console.log('[DEBUG_LOG] Bundle init method called directly');
            // Initialize the main module if components haven't been registered yet
            if (!window.jwtComponentsRegistered) {
                console.log('[DEBUG_LOG] Components not registered yet, initializing main module from bundle.init()');
                main.init();
            } else {
                console.log('[DEBUG_LOG] Components already registered, skipping initialization from bundle.init()');
            }
        }
    };
});
