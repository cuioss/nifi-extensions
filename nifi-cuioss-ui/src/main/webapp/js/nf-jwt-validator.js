/**
 * Entry point for MultiIssuerJWTTokenAuthenticator UI components.
 * This file is responsible for loading and initializing the custom UI components.
 */
(function($) {
    'use strict';

    // Load CSS
    function loadCss() {
        console.log('[DEBUG_LOG] Loading CSS for custom UI components');
        try {
            // Directly load our CSS files without relying on finding an existing CSS reference
            $('head').append('<link rel="stylesheet" href="css/styles.css" type="text/css" />');
            $('head').append('<link rel="stylesheet" href="css/main.css" type="text/css" />');
            console.log('[DEBUG_LOG] CSS files loaded directly');
        } catch (e) {
            console.error('[DEBUG_LOG] Error loading CSS:', e);
        }
    }

    // Register custom UI components
    function registerCustomUiComponents() {
        // Check if components have already been registered
        if (window.jwtComponentsRegistered) {
            console.log('[DEBUG_LOG] Components already registered in nf-jwt-validator, skipping registration');
            return;
        }

        // Load required modules
        require([
            'jquery',
            'nf.Common',
            'components/tokenVerifier',
            'components/issuerConfigEditor',
            'services/apiClient',
            'utils/formatters'
        ], function ($, nfCommon, tokenVerifier, issuerConfigEditor, _apiClient, _formatters) {
            // Check again after modules are loaded (in case they were registered while loading)
            if (window.jwtComponentsRegistered) {
                console.log('[DEBUG_LOG] Components registered while loading modules, skipping registration');
                return;
            }

            // jQuery UI is already loaded via script tag
            // Log jQuery UI availability for debugging
            console.log('[DEBUG_LOG] jQuery UI loaded in nf-jwt-validator:', typeof $.ui !== 'undefined');
            console.log('[DEBUG_LOG] jQuery UI tooltip available in nf-jwt-validator:', typeof $.fn.tooltip !== 'undefined');
            // Detect browser language and use it for localization
            const browserLanguage = navigator.language || navigator.userLanguage || 'en';
            console.log('[DEBUG_LOG] Detected browser language:', browserLanguage);

            // Debug: Log component registration start
            console.log('[DEBUG_LOG] Starting custom UI component registration from nf-jwt-validator');
            console.log('[DEBUG_LOG] Token Verifier available:', typeof tokenVerifier === 'object');
            console.log('[DEBUG_LOG] Issuer Config Editor available:', typeof issuerConfigEditor === 'object');

            // Register Token Verifier component for the verification tab
            console.log('[DEBUG_LOG] Registering Token Verifier tab');
            nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);

            // Register Issuer Config Editor component for the issuer configuration tab
            console.log('[DEBUG_LOG] Registering Issuer Config Editor tab');
            nfCommon.registerCustomUiTab('jwt.validation.issuer.configuration', issuerConfigEditor);
            console.log('[DEBUG_LOG] Issuer Config Editor registration complete');

            // Set the flag to indicate components have been registered
            window.jwtComponentsRegistered = true;

            // Add a delayed check to verify if components were registered
            setTimeout(function() {
                console.log('[DEBUG_LOG] Delayed check: verifying if custom tabs are visible');
                console.log('[DEBUG_LOG] Custom tabs count:', $('.tab.custom-tab').length);
                console.log('[DEBUG_LOG] Tab with issuer config:', $('.tab.custom-tab[data-tab-id="jwt.validation.issuer.configuration"]').length);
            }, 3000);
        });
    }

    // Initialize when the document is ready
    $(document).ready(function() {
        console.log('[DEBUG_LOG] nf-jwt-validator.js: Document ready');

        // Load CSS
        loadCss();

        // Register custom UI components
        registerCustomUiComponents();

        console.log('[DEBUG_LOG] nf-jwt-validator.js: Initialization complete');
    });
})(jQuery);
