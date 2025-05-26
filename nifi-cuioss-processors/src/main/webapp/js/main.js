/**
 * Main module for MultiIssuerJWTTokenAuthenticator UI components.
 * Provides functionality for custom UI components in NiFi.
 */
define([
    'jquery',
    'nf.Common',
    'components/jwksValidator',
    'components/tokenVerifier',
    'components/issuerConfigEditor',
    'services/apiClient',
    'utils/formatters'
], function ($, nfCommon, jwksValidator, tokenVerifier, issuerConfigEditor, _apiClient, _formatters) {
    'use strict';

    /**
     * Detects the browser language preference and logs it.
     * This function should be extended to integrate with NiFi's locale resolution system
     * when that information becomes available.
     */
    const detectBrowserLanguage = function () {
        // Get browser language
        const browserLanguage = navigator.language || navigator.userLanguage || 'en';

        // Log the detected language
        // eslint-disable-next-line no-console
        console.log('Detected browser language: ' + browserLanguage);

        // Extract the language code (e.g., 'en' from 'en-US')
        // Return the language code
        return browserLanguage.split('-')[0];
    };

    // Register custom UI components
    const registerCustomUiComponents = function () {
        // Detect browser language and use it for localization
        // This variable is intentionally unused for now
        // Will be used for localization in the future
        // eslint-disable-next-line no-unused-vars
        const userLanguage = detectBrowserLanguage();

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

        // Register help tooltips
        registerHelpTooltips();

        // Registration complete
        console.log('[DEBUG_LOG] All custom UI components registered successfully');
    };

    /**
     * Registers help tooltips for properties.
     */
    const registerHelpTooltips = function () {
        // Add help tooltips to property labels
        $('.property-label').each(function () {
            const propertyName = $(this).text().trim();
            const helpText = getHelpTextForProperty(propertyName);

            if (helpText) {
                $(this).append('<span class="help-tooltip fa fa-question-circle" title="' + helpText + '"></span>');
            }
        });

        // Initialize tooltips
        $('.help-tooltip').tooltip({
            position: {
                my: 'left top+5',
                at: 'left bottom'
            }
        });
    };

    /**
     * Gets help text for a property.
     *
     * @param {string} propertyName - The name of the property
     * @return {string} The help text for the property
     */
    const getHelpTextForProperty = function (propertyName) {
        // Get i18n resources from NiFi Common
        const i18n = nfCommon.getI18n();

        // Map property names to i18n keys
        const helpTextKeys = {
            'Token Location': 'property.token.location.help',
            'Token Header': 'property.token.header.help',
            'Custom Header Name': 'property.custom.header.name.help',
            'Bearer Token Prefix': 'property.bearer.token.prefix.help',
            'Require Valid Token': 'property.require.valid.token.help',
            'JWKS Refresh Interval': 'property.jwks.refresh.interval.help',
            'Maximum Token Size': 'property.maximum.token.size.help',
            'Allowed Algorithms': 'property.allowed.algorithms.help',
            'Require HTTPS for JWKS URLs': 'property.require.https.jwks.help'
        };

        // Get the i18n key for the property
        const key = helpTextKeys[propertyName];

        // Return the translated text or empty string if not found
        return key ? i18n[key] || '' : '';
    };

    // Return the public API
    return {
        /**
         * Initializes the custom UI components.
         */
        init: function () {
            console.log('[DEBUG_LOG] main.js init function called');

            // Register custom UI components when the document is ready
            $(document).ready(function () {
                console.log('[DEBUG_LOG] Document ready, registering custom UI components');
                registerCustomUiComponents();
            });

            // Add a delayed check to verify if components were registered
            setTimeout(function() {
                console.log('[DEBUG_LOG] Delayed check: verifying if custom tabs are visible');
                console.log('[DEBUG_LOG] Custom tabs count:', $('.tab.custom-tab').length);
                console.log('[DEBUG_LOG] Tab with issuer config:', $('.tab.custom-tab[data-tab-id="jwt.validation.issuer.configuration"]').length);
            }, 3000);
        }
    };
});
