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
    'utils/formatters',
    'utils/i18n'
], function ($, nfCommon, tokenVerifier, issuerConfigEditor, _apiClient, _formatters, i18n) {
    // jQuery UI is already loaded via script tag
    'use strict';

    // Global flag to track if components have been registered
    window.jwtComponentsRegistered = window.jwtComponentsRegistered || false;

    // Register custom UI components
    const registerCustomUiComponents = function () {
        // Check if components have already been registered
        if (window.jwtComponentsRegistered) {
            return;
        }

        // Initialize i18n with browser language
        const userLanguage = i18n.getLanguage();

        // Register Token Verifier component for the verification tab
        nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);

        // Register Issuer Config Editor component for the issuer configuration tab
        nfCommon.registerCustomUiTab('jwt.validation.issuer.configuration', issuerConfigEditor);

        // Register help tooltips
        registerHelpTooltips();

        // Set the flag to indicate components have been registered
        window.jwtComponentsRegistered = true;
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
            } else {
                // Fallback to title attribute if tooltip function is not available
                $('.help-tooltip').each(function() {
                    const title = $(this).attr('title');
                    if (title) {
                        $(this).attr('data-original-title', title);
                    }
                });
            }
        } catch (e) {
            console.error('Error initializing tooltips:', e);
        }
    };

    /**
     * Gets help text for a property.
     *
     * @param {string} propertyName - The name of the property
     * @return {string} The help text for the property
     */
    const getHelpTextForProperty = function (propertyName) {
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

        // Return the translated text using the i18n module or empty string if not found
        return key ? i18n.translate(key) : '';
    };

    /**
     * Hides the loading indicator and shows the UI components.
     */
    const hideLoadingIndicator = function() {
        console.log('[DEBUG_LOG] Hiding loading indicator');
        $('#loading-indicator').hide();
        $('#jwt-validator-tabs').show();
    };

    /**
     * Updates UI text with translations from the current language.
     */
    const updateUITranslations = function() {
        // Update loading indicator text
        $('#loading-indicator').text(i18n.translate('jwt.validator.loading'));

        // Update other static UI elements
        $('.jwt-validator-title').text(i18n.translate('jwt.validator.title'));

        // Update language selector
        updateLanguageSelector();
    };

    /**
     * Adds a language selector to the UI.
     */
    const addLanguageSelector = function() {
        // Create language selector container if it doesn't exist
        if ($('#language-selector').length === 0) {
            const container = $('#jwt-validator-container');

            // Create language selector
            const languageSelector = $('<div id="language-selector" class="language-selector"></div>');

            // Add language selector to the container
            container.prepend(languageSelector);

            // Update language selector with available languages
            updateLanguageSelector();
        }
    };

    /**
     * Updates the language selector with available languages.
     */
    const updateLanguageSelector = function() {
        const languageSelector = $('#language-selector');
        if (languageSelector.length === 0) {
            return;
        }

        // Clear existing content
        languageSelector.empty();

        // Add label
        languageSelector.append('<span class="language-label">Language: </span>');

        // Get available languages
        const availableLanguages = i18n.getAvailableLanguages();
        const currentLanguage = i18n.getLanguage();

        // Create language buttons
        availableLanguages.forEach(function(langCode) {
            const button = $('<button class="language-button"></button>')
                .text(langCode.toUpperCase())
                .attr('data-lang', langCode)
                .toggleClass('active', langCode === currentLanguage)
                .on('click', function() {
                    const lang = $(this).attr('data-lang');
                    // Change language
                    if (window.nfJwtValidator && typeof window.nfJwtValidator.changeLanguage === 'function') {
                        window.nfJwtValidator.changeLanguage(lang);
                    }
                });

            languageSelector.append(button);
        });
    };

    // Return the public API
    return {
        /**
         * Initializes the custom UI components.
         */
        init: function () {
            // Update UI translations immediately
            updateUITranslations();

            // Register event to ensure UI is properly loaded after NiFi completes initialization
            if (typeof nf !== 'undefined' && nf.Canvas && nf.Canvas.initialized) {
                registerCustomUiComponents();
                // Hide loading indicator and show UI components
                hideLoadingIndicator();
            } else {
                // Wait for NiFi to be fully initialized
                $(document).on('nfCanvasInitialized', function() {
                    registerCustomUiComponents();
                    // Hide loading indicator and show UI components
                    hideLoadingIndicator();
                });
            }

            // Register custom UI components when the document is ready
            $(document).ready(function () {
                registerCustomUiComponents();

                // Update UI translations
                updateUITranslations();

                // Hide loading indicator and show UI components
                hideLoadingIndicator();

                // Add event listener to track when the processor dialog opens
                $(document).on('dialogOpen', function(event, dialogContent) {
                    if ($(dialogContent).hasClass('processor-dialog')) {
                        // Use setTimeout to allow the dialog to fully render
                        setTimeout(function() {
                            const processorType = $('.processor-type', dialogContent).text();

                            if (processorType.includes('MultiIssuerJWTTokenAuthenticator')) {
                                registerHelpTooltips();
                                // Update translations in the dialog
                                updateUITranslations();
                            }
                        }, 500);
                    }
                });

                // Add language selector
                addLanguageSelector();
            });

            // Add a delayed check to ensure loading indicator is hidden
            setTimeout(function() {
                // Ensure loading indicator is hidden
                hideLoadingIndicator();
                // Ensure translations are applied
                updateUITranslations();
            }, 3000);
        },

        /**
         * Changes the UI language.
         * 
         * @param {string} langCode - The language code to set
         */
        changeLanguage: function(langCode) {
            if (i18n.setLanguage(langCode)) {
                // Update UI with new translations
                updateUITranslations();
                console.log('[DEBUG_LOG] Language changed to: ' + langCode);
                return true;
            }
            return false;
        }
    };
});
