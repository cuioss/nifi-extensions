/**
 * Main module for MultiIssuerJWTTokenAuthenticator UI components.
 * Provides functionality for custom UI components in NiFi.
 */
import $ from 'cash-dom';
import * as nfCommon from 'nf.Common';
import * as tokenVerifier from './components/tokenVerifier.js';
import * as issuerConfigEditor from './components/issuerConfigEditor.js';
// import * as _apiClient from './services/apiClient.js'; // Unused
// import * as _formatters from './utils/formatters.js'; // Unused
import * as i18n from './utils/i18n.js';
import { initTooltips } from './utils/tooltip.js';

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
    i18n.getLanguage(); // Result was unused, called for potential side effects.

    // Register Issuer Config Editor component for the issuer configuration tab
    nfCommon.registerCustomUiTab('jwt.validation.issuer.configuration', issuerConfigEditor);

    // Register Token Verifier component for the verification tab
    nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);

    // Register help tooltips
    registerHelpTooltips();

    // Set the flag to indicate components have been registered
    window.jwtComponentsRegistered = true;
};

/**
     * Registers help tooltips for properties.
     * @param {Element} [contextElement] - Optional context within which to find elements.
     */
const registerHelpTooltips = function (contextElement) {
    const baseElement = contextElement || document; // baseElement is a raw DOM node
    $(baseElement).find('.property-label').each(function (index, labelNode) {
        const propertyName = $(labelNode).text().trim();
        const helpText = getHelpTextForProperty(propertyName);

        if (helpText) {
            // Check if span already exists
            if ($(labelNode).find('span.help-tooltip').length === 0) {
                const span = $('<span>');
                $(span).addClass('help-tooltip fa fa-question-circle');
                $(span).attr('title', helpText);
                $(labelNode).append(span);
            }
        }
    });

    // Initialize tooltips
    try {
        const tooltipSelector = '.help-tooltip';
        // contextElement is expected to be a raw DOM element if provided for initTooltips.
        // initTooltips expects a DOM element or a selector string for its context.
        const contextForInit = contextElement ? contextElement : document;
        initTooltips(tooltipSelector, {
            // placement: 'bottom-start' // This is the default in initTooltips
        }, contextForInit);
    } catch (e) {
        // Error initializing tooltips
        // eslint-disable-next-line no-console
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

    // Return the translated text using nfCommon.getI18n().getProperty()
    return key ? nfCommon.getI18n().getProperty(key) : '';
};

/**
     * Hides the loading indicator and shows the UI components.
     */
const hideLoadingIndicator = function () {
    const loadingIndicator = $('#loading-indicator');
    if (loadingIndicator.length) {
        $(loadingIndicator).hide();
    }
    const tabs = $('#jwt-validator-tabs');
    if (tabs.length) {
        $(tabs).show();
    }
};

/**
     * Updates UI text with translations from the current language.
     */
const updateUITranslations = function () {
    // Update loading indicator text
    const loadingIndicator = $('#loading-indicator');
    if (loadingIndicator.length) {
        $(loadingIndicator).text(nfCommon.getI18n().getProperty('jwt.validator.loading'));
    }

    // Update other static UI elements
    const titleElement = $('.jwt-validator-title');
    if (titleElement.length) {
        $(titleElement).text(nfCommon.getI18n().getProperty('jwt.validator.title'));
    }
};

/**
 * Initializes the custom UI components.
 */
export const init = function () {
    // Update UI translations immediately
    updateUITranslations();

    // Register event to ensure UI is properly loaded after NiFi completes initialization
    if (typeof nf !== 'undefined' && nf.Canvas && nf.Canvas.initialized) {
        registerCustomUiComponents();
        // Hide loading indicator and show UI components
        hideLoadingIndicator();
    } else {
        // Wait for NiFi to be fully initialized
        document.addEventListener('nfCanvasInitialized', function () {
            registerCustomUiComponents();
            // Hide loading indicator and show UI components
            hideLoadingIndicator();
        });
    }

    // Register custom UI components when the document is ready
    document.addEventListener('DOMContentLoaded', function () {
        registerCustomUiComponents();

        // Update UI translations
        updateUITranslations();

        // Hide loading indicator and show UI components
        hideLoadingIndicator();

        // Add event listener to track when the processor dialog opens
        // Note: The conversion of $(document).on('dialogOpen', function (event, dialogContentElement)
        // is complex due to how jQuery handles custom events and additional parameters.
        // If 'dialogOpen' is a standard browser event, this is fine.
        // If it's a jQuery custom event triggered with extra parameters,
        // those parameters (dialogContentElement) won't be passed the same way.
        // Assuming 'dialogOpen' might be a custom event and for simplicity,
        // this specific handler will be left using cash-dom for now as per worker decision.
        // If it must be Vanilla JS, the event dispatch and listening mechanism needs careful review.
        // NiFi likely triggers 'dialogOpen' using jQuery's `trigger` method, passing `dialogContentElement` as an extra parameter.
        // Vanilla JS's `addEventListener` does not support this directly. Re-triggering would involve
        // finding all `trigger('dialogOpen')` calls and modifying them to use `CustomEvent` with a `detail` property,
        // which is a broader change than the current scope.
        $(document).on('dialogOpen', function (event, data) {
            const dialogContentElement = Array.isArray(data) ? data[0] : data;

            // $dialog is no longer needed as we will use dialogContentElement directly for classList and querySelector
            if (dialogContentElement && dialogContentElement.classList && dialogContentElement.classList.contains('processor-dialog')) {
                // Use setTimeout to allow the dialog to fully render
                setTimeout(function () {
                    const processorTypeElement = dialogContentElement.querySelector('.processor-type');
                    const processorType = processorTypeElement ? processorTypeElement.textContent.trim() : '';

                    if (processorType.includes('MultiIssuerJWTTokenAuthenticator')) {
                        registerHelpTooltips(dialogContentElement); // Pass raw DOM element as context
                        // Update translations in the dialog
                        updateUITranslations(); // This is global, might need context too if dialog has elements it targets
                    }
                }, 500);
            }
        });
    });

    // Add a delayed check to ensure loading indicator is hidden
    setTimeout(function () {
        // Ensure loading indicator is hidden
        hideLoadingIndicator();
        // Ensure translations are applied
        updateUITranslations();
    }, 3000);
};
