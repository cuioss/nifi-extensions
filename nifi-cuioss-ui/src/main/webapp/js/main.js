/**
 * Main module for MultiIssuerJWTTokenAuthenticator UI components.
 * Provides functionality for custom UI components in NiFi.
 */
define([
    'jquery',
    'nf.Common',
    'components/tokenVerifier',
    'components/issuerConfigEditor',
    'services/apiClient',
    'utils/formatters'
], function ($, nfCommon, tokenVerifier, issuerConfigEditor, _apiClient, _formatters) {
    // jQuery UI is already loaded via script tag
    // Log jQuery UI availability for debugging
    console.log('[DEBUG_LOG] jQuery UI loaded:', typeof $.ui !== 'undefined');
    console.log('[DEBUG_LOG] jQuery UI tooltip available:', typeof $.fn.tooltip !== 'undefined');
    'use strict';

    // Global flag to track if components have been registered
    window.jwtComponentsRegistered = window.jwtComponentsRegistered || false;

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
        // Check if components have already been registered
        if (window.jwtComponentsRegistered) {
            console.log('[DEBUG_LOG] Components already registered, skipping registration');
            return;
        }

        // Detect browser language and use it for localization
        // This variable is intentionally unused for now
        // Will be used for localization in the future
        // eslint-disable-next-line no-unused-vars
        const userLanguage = detectBrowserLanguage();

        // Debug: Log component registration start
        console.log('[DEBUG_LOG] Starting custom UI component registration');
        console.log('[DEBUG_LOG] Token Verifier available:', typeof tokenVerifier === 'object');
        console.log('[DEBUG_LOG] Issuer Config Editor available:', typeof issuerConfigEditor === 'object');

        // Register Token Verifier component for the verification tab
        console.log('[DEBUG_LOG] Registering Token Verifier tab');
        nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);

        // Register Issuer Config Editor component for the issuer configuration tab
        console.log('[DEBUG_LOG] Registering Issuer Config Editor tab');
        nfCommon.registerCustomUiTab('jwt.validation.issuer.configuration', issuerConfigEditor);
        console.log('[DEBUG_LOG] Issuer Config Editor registration complete');

        // Register help tooltips
        registerHelpTooltips();

        // Set the flag to indicate components have been registered
        window.jwtComponentsRegistered = true;

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
        try {
            // Check if tooltip function exists
            if ($.fn.tooltip) {
                $('.help-tooltip').tooltip({
                    position: {
                        my: 'left top+5',
                        at: 'left bottom'
                    }
                });
                console.log('[DEBUG_LOG] Tooltips initialized successfully');
            } else {
                // Fallback to title attribute if tooltip function is not available
                console.warn('[DEBUG_LOG] jQuery UI tooltip not available, using title attribute instead');
                $('.help-tooltip').each(function() {
                    const title = $(this).attr('title');
                    if (title) {
                        $(this).attr('data-original-title', title);
                    }
                });
            }
        } catch (e) {
            console.error('[DEBUG_LOG] Error initializing tooltips:', e);
        }
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

    /**
     * Hides the loading indicator and shows the UI components.
     */
    const hideLoadingIndicator = function() {
        console.log('[DEBUG_LOG] Hiding loading indicator');
        $('#loading-indicator').hide();
        $('#jwt-validator-tabs').show();
    };

    // Return the public API
    return {
        /**
         * Initializes the custom UI components.
         */
        init: function () {
            console.log('[DEBUG_LOG] main.js init function called');

            // Register event to ensure UI is properly loaded after NiFi completes initialization
            if (typeof nf !== 'undefined' && nf.Canvas && nf.Canvas.initialized) {
                console.log('[DEBUG_LOG] NiFi Canvas already initialized, registering components immediately');
                registerCustomUiComponents();
                // Hide loading indicator and show UI components
                hideLoadingIndicator();
            } else {
                // Wait for NiFi to be fully initialized
                console.log('[DEBUG_LOG] Waiting for NiFi Canvas to initialize');
                $(document).on('nfCanvasInitialized', function() {
                    console.log('[DEBUG_LOG] NiFi Canvas initialization detected, registering components');
                    registerCustomUiComponents();
                    // Hide loading indicator and show UI components
                    hideLoadingIndicator();
                });
            }

            // Register custom UI components when the document is ready
            $(document).ready(function () {
                console.log('[DEBUG_LOG] Document ready, registering custom UI components');
                registerCustomUiComponents();

                // Hide loading indicator and show UI components
                hideLoadingIndicator();

                // Add event listener to track when the processor dialog opens
                $(document).on('dialogOpen', function(event, dialogContent) {
                    if ($(dialogContent).hasClass('processor-dialog')) {
                        console.log('[DEBUG_LOG] Processor dialog opened, checking for our processor');

                        // Use setTimeout to allow the dialog to fully render
                        setTimeout(function() {
                            const processorType = $('.processor-type', dialogContent).text();
                            console.log('[DEBUG_LOG] Opened processor type:', processorType);

                            if (processorType.includes('MultiIssuerJWTTokenAuthenticator')) {
                                console.log('[DEBUG_LOG] Our processor dialog opened, checking for custom tabs');
                                console.log('[DEBUG_LOG] Custom tabs count:', $('.tab.custom-tab', dialogContent).length);
                                registerHelpTooltips();
                            }
                        }, 500);
                    }
                });
            });

            // Add a delayed check to verify if components were registered
            setTimeout(function() {
                console.log('[DEBUG_LOG] Delayed check: verifying if custom tabs are visible');
                console.log('[DEBUG_LOG] Custom tabs count:', $('.tab.custom-tab').length);
                console.log('[DEBUG_LOG] Tab with issuer config:', $('.tab.custom-tab[data-tab-id="jwt.validation.issuer.configuration"]').length);

                // Ensure loading indicator is hidden
                hideLoadingIndicator();
            }, 3000);
        }
    };
});
