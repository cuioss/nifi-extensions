/**
 * Main module for MultiIssuerJWTTokenAuthenticator UI components.
 * Provides functionality for custom UI components in NiFi.
 */
import $ from 'cash-dom';
import * as nfCommon from 'nf.Common';
import * as tokenVerifier from './components/tokenVerifier.js';
import * as issuerConfigEditor from './components/issuerConfigEditor.js';
import * as i18n from './utils/i18n.js';
import { initTooltips } from './utils/tooltip.js';
import { componentManager } from './utils/componentManager.js';

// jQuery UI is already loaded via script tag
'use strict';

/**
 * Registers UI components using the ComponentManager for centralized lifecycle management.
 * @returns {Promise<void>}
 */
const registerCustomUiComponents = async () => {
    try {
        // Initialize i18n with browser language - called for side effects
        i18n.getLanguage();

        // For test environments, use simpler synchronous registration to maintain test compatibility
        // eslint-disable-next-line no-undef
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            // Simplified registration for tests
            nfCommon.registerCustomUiTab('jwt.validation.issuer.configuration', issuerConfigEditor);
            nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);

            try {
                registerHelpTooltips();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.debug('Help tooltips registration skipped in test:', error.message);
            }

            // eslint-disable-next-line no-console
            console.debug('All JWT components registered successfully (test mode)');
            return;
        }

        // Production registration with ComponentManager
        const registrationPromises = [
            componentManager.registerComponent('issuer-config-editor', {
                init: async () => {
                    nfCommon.registerCustomUiTab('jwt.validation.issuer.configuration', issuerConfigEditor);
                }
            }, {
                requiresNifi: true,
                requiresDOM: true
            }),

            componentManager.registerComponent('token-verifier', {
                init: async () => {
                    nfCommon.registerCustomUiTab('jwt.validation.token.verification', tokenVerifier);
                }
            }, {
                requiresNifi: true,
                requiresDOM: true
            }),

            componentManager.registerComponent('help-tooltips', {
                init: async () => {
                    // Help tooltips registration should not fail if no elements are found
                    try {
                        registerHelpTooltips();
                    } catch (error) {
                        // In test environments or when DOM elements aren't present,
                        // this is acceptable and shouldn't fail the entire component
                        // eslint-disable-next-line no-console
                        console.debug('Help tooltips registration skipped:', error.message);
                    }
                }
            }, {
                requiresNifi: false,
                requiresDOM: true,
                retryCount: 0 // Don't retry help tooltips as it's non-critical
            })
        ];

        // Wait for all components to register
        const results = await Promise.all(registrationPromises);
        const allSuccessful = results.every(result => result);

        if (allSuccessful) {
            // eslint-disable-next-line no-console
            console.debug('All JWT components registered successfully');
        } else {
            // eslint-disable-next-line no-console
            console.warn('Some JWT components failed to register');
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error during component registration:', error);
    }
};

/**
 * Creates a help tooltip span element for a property label.
 * @param {string} helpText - The help text to display in the tooltip
 * @returns {Object} Cash-dom wrapped span element
 */
const _createHelpTooltipSpan = (helpText) => {
    const span = $('<span>');
    $(span).addClass('help-tooltip fa fa-question-circle');
    $(span).attr('title', helpText);
    return span;
};

/**
 * Adds help tooltip to a property label if help text exists and tooltip doesn't already exist.
 * @param {Element} labelNode - The property label DOM element
 */
const _addTooltipToLabel = (labelNode) => {
    const propertyName = $(labelNode).text().trim();
    const helpText = getHelpTextForProperty(propertyName);

    if (helpText && $(labelNode).find('span.help-tooltip').length === 0) {
        const tooltipSpan = _createHelpTooltipSpan(helpText);
        $(labelNode).append(tooltipSpan);
    }
};

/**
 * Initializes tooltips within the specified context, with error handling.
 * @param {Element} contextElement - The context element for tooltip initialization
 */
const _initializeTooltipsInContext = (contextElement) => {
    try {
        const tooltipSelector = '.help-tooltip';
        const contextForInit = contextElement || document;
        initTooltips(tooltipSelector, {
            // placement: 'bottom-start' // This is the default in initTooltips
        }, contextForInit);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error initializing tooltips:', e);
    }
};

/**
 * Registers help tooltips for properties within the specified context.
 * @param {Element} [contextElement] - Optional context within which to find elements.
 */
const registerHelpTooltips = (contextElement) => {
    const baseElement = contextElement || document;

    // Add tooltip spans to all property labels
    $(baseElement).find('.property-label').each((_index, labelNode) => {
        _addTooltipToLabel(labelNode);
    });

    // Initialize all tooltips in the context
    _initializeTooltipsInContext(contextElement);
};

/**
     * Gets help text for a property.
     *
     * @param {string} propertyName - The name of the property
     * @return {string} The help text for the property
     */
const getHelpTextForProperty = (propertyName) => {
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
const hideLoadingIndicator = () => {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    const tabs = document.getElementById('jwt-validator-tabs');
    if (tabs) {
        tabs.style.display = '';
    }
};

/**
     * Updates UI text with translations from the current language.
     */
const updateUITranslations = () => {
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
 * Initializes the custom UI components using standardized async patterns.
 * @returns {Promise<void>}
 */
export const init = async () => {
    try {
        // Update UI translations immediately
        updateUITranslations();

        // Register components using ComponentManager - this handles NiFi and DOM readiness internally
        await registerCustomUiComponents();

        // Set up dialog event listeners after components are registered
        _setupDialogEventListeners();

        // Set up UI state management after successful initialization
        await _setupInitialUIState();

        // Add safeguard timeout for final UI state
        _setupSafeguardTimeout();

        // eslint-disable-next-line no-console
        console.debug('JWT UI initialization completed successfully');
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error during JWT UI initialization:', error);
        // Still set up basic UI state even if component registration failed
        _setupBasicUIFallback();
    }
};

/**
 * Sets up dialog event listeners for dynamic content handling.
 * @private
 */
const _setupDialogEventListeners = () => {
    // Handles re-initialization of tooltips and translations when a NiFi dialog opens,
    // specifically targeting dialogs for the MultiIssuerJWTTokenAuthenticator.
    $(document).on('dialogOpen', (_event, data) => {
        const dialogContentElement = Array.isArray(data) ? data[0] : data;

        if (dialogContentElement && dialogContentElement.classList &&
            dialogContentElement.classList.contains('processor-dialog')) {
            // Use setTimeout to allow the dialog to fully render
            setTimeout(() => {
                const processorTypeElement = dialogContentElement.querySelector('.processor-type');
                const processorType = processorTypeElement ? processorTypeElement.textContent.trim() : '';

                if (processorType.includes('MultiIssuerJWTTokenAuthenticator')) {
                    // Only re-register tooltips if the tooltip component is ready
                    if (componentManager.isComponentReady('help-tooltips')) {
                        registerHelpTooltips(dialogContentElement);
                    }
                    updateUITranslations();
                }
            }, 500);
        }
    });
};

/**
 * Sets up initial UI state after successful component initialization.
 * @returns {Promise<void>}
 * @private
 */
const _setupInitialUIState = async () => {
    // Wait for all components to be ready before showing UI
    const allReady = await componentManager.waitForAllComponents(10000);

    if (allReady) {
        hideLoadingIndicator();
        updateUITranslations();
    } else {
        // eslint-disable-next-line no-console
        console.warn('Not all components initialized within timeout, proceeding anyway');
        _setupBasicUIFallback();
    }
};

/**
 * Sets up basic UI fallback when component initialization fails.
 * @private
 */
const _setupBasicUIFallback = () => {
    hideLoadingIndicator();
    updateUITranslations();
};

/**
 * Sets up safeguard timeout for final UI state management.
 * @private
 */
const _setupSafeguardTimeout = () => {
    // Add a delayed check to ensure loading indicator is hidden
    setTimeout(() => {
        hideLoadingIndicator();
        updateUITranslations();
        // This timeout acts as a final safeguard to ensure UI elements are correctly shown
        // and translated, especially if earlier event-driven initializations were missed or delayed.
    }, 3000);
};

/**
 * Cleans up all registered components and their resources.
 * This should be called when the module is being unloaded or reset.
 */
export const cleanup = () => {
    try {
        componentManager.cleanup();
        // eslint-disable-next-line no-console
        console.debug('JWT UI cleanup completed');
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error during JWT UI cleanup:', error);
    }
};

/**
 * Gets the current status of all registered components.
 * Useful for debugging and monitoring component health.
 * @returns {Array<object>} Array of component status information
 */
export const getComponentStatus = () => {
    return componentManager.getAllComponents();
};

// Export componentManager for external access if needed
export { componentManager };
