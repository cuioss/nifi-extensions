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
            const nfStyleSheetRef = $('link[href*="nf-processor-ui.css"]').attr('href');
            if (nfStyleSheetRef) {
                // Use styles.css instead of jwt-validator-ui.css which doesn't exist
                const cssPath = nfStyleSheetRef.substring(0, nfStyleSheetRef.lastIndexOf('/') + 1) + 'styles.css';
                console.log('[DEBUG_LOG] Loading CSS from path:', cssPath);
                $('head').append('<link rel="stylesheet" href="' + cssPath + '" type="text/css" />');
            } else {
                console.error('[DEBUG_LOG] Could not find nf-processor-ui.css reference');
            }
        } catch (e) {
            console.error('[DEBUG_LOG] Error loading CSS:', e);
        }
    }

    // Register custom UI components
    function registerCustomUiComponents() {
        // Load required modules
        require([
            'jquery',
            'nf.Common',
            'components/jwksValidator',
            'components/tokenVerifier',
            'components/issuerConfigEditor',
            'services/apiClient',
            'utils/formatters'
        ], function ($, nfCommon, jwksValidator, tokenVerifier, issuerConfigEditor, _apiClient, _formatters) {
            // Detect browser language and use it for localization
            const browserLanguage = navigator.language || navigator.userLanguage || 'en';
            console.log('[DEBUG_LOG] Detected browser language:', browserLanguage);

            // Debug: Log component registration start
            console.log('[DEBUG_LOG] Starting custom UI component registration');
            console.log('[DEBUG_LOG] JWKS Validator available:', typeof jwksValidator === 'object');
            console.log('[DEBUG_LOG] Token Verifier available:', typeof tokenVerifier === 'object');
            console.log('[DEBUG_LOG] Issuer Config Editor available:', typeof issuerConfigEditor === 'object');

            // Register JWKS Validator component
            console.log('[DEBUG_LOG] Registering JWKS Validator components');
            nfCommon.registerCustomUiComponent('jwt.validation.jwks.url', jwksValidator, {
                jwks_type: 'server'
            });

            nfCommon.registerCustomUiComponent('jwt.validation.jwks.file', jwksValidator, {
                jwks_type: 'file'
            });

            nfCommon.registerCustomUiComponent('jwt.validation.jwks.content', jwksValidator, {
                jwks_type: 'memory'
            });

            // Register Token Verifier component for the verification tab
            console.log('[DEBUG_LOG] Registering Token Verifier tab');
            nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);

            // Register Issuer Config Editor component for the issuer configuration tab
            console.log('[DEBUG_LOG] Registering Issuer Config Editor tab');
            nfCommon.registerCustomUiTab('jwt.validation.issuer.configuration', issuerConfigEditor);
            console.log('[DEBUG_LOG] Issuer Config Editor registration complete');

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