'use strict';

/**
 * Main initialization module for NiFi CUIOSS JWT validation UI components.
 *
 * This module provides simplified, streamlined initialization for the JWT validation
 * UI components. It replaces the previous over-engineered 344-line initialization
 * system with a clean, maintainable approach suitable for a 3-tab form interface.
 *
 * Key responsibilities:
 * - Register JWT validation UI tabs with NiFi
 * - Initialize help tooltips for form fields
 * - Manage UI translations and loading states
 * - Handle processor dialog events
 *
 * @fileoverview Main initialization for NiFi JWT validation UI
 * @author CUIOSS Team
 * @since 1.0.0
 */
import $ from 'cash-dom';
import * as nfCommon from 'nf.Common';
import * as tokenVerifier from './components/tokenVerifier.js';
import * as issuerConfigEditor from './components/issuerConfigEditor.js';
import * as i18n from './utils/i18n.js';
import { initTooltips } from './utils/tooltip.js';
import { API, CSS, NIFI, UI_TEXT } from './utils/constants.js';

/**
 * Registers JWT validation components with the NiFi UI framework.
 *
 * This function handles the core component registration process, including:
 * - Initializing the i18n translation system
 * - Registering issuer configuration and token verification tabs
 * - Setting up test compatibility flags
 *
 * @returns {boolean} True if registration succeeded, false if it failed
 *
 * @example
 * // Register components during initialization
 * const success = registerComponents();
 * if (!success) {
 *   console.error('Component registration failed');
 * }
 */
const registerComponents = () => {
    try {
        // Initialize i18n
        i18n.getLanguage();

        // Register the two main UI tabs
        nfCommon.registerCustomUiTab(NIFI.COMPONENT_TABS.ISSUER_CONFIG, issuerConfigEditor);
        nfCommon.registerCustomUiTab(NIFI.COMPONENT_TABS.TOKEN_VERIFICATION, tokenVerifier);

        // Set flag for test compatibility
        window.jwtComponentsRegistered = true;

        // Components registered successfully
        return true;
    } catch (error) {
        // Component registration failed - error logged internally
        console.debug('JWT UI component registration failed:', error);
        return false;
    }
};

/**
 * Sets up help tooltips for property labels in NiFi processor configuration dialogs.
 *
 * This function automatically detects property labels and adds contextual help tooltips
 * using the centralized property label mapping. It provides a streamlined approach
 * to tooltip management without complex state tracking.
 *
 * Process:
 * 1. Searches for elements with the property-label class
 * 2. Maps label text to i18n help text keys
 * 3. Creates FontAwesome question-circle tooltips
 * 4. Initializes tooltip behavior
 *
 * @throws {Error} Logs debug message if tooltip setup fails (non-critical)
 *
 * @example
 * // Automatically called during initialization
 * setupHelpTooltips(); // Adds tooltips to all property labels
 */
const setupHelpTooltips = () => {
    try {
        // Find property labels and add tooltips
        $(CSS.SELECTORS.PROPERTY_LABEL).each((_index, label) => {
            const propertyName = $(label).text().trim();
            const helpKey = UI_TEXT.PROPERTY_LABELS[propertyName];

            if (helpKey && $(label).find(CSS.SELECTORS.HELP_TOOLTIP).length === 0) {
                const helpText = nfCommon.getI18n().getProperty(helpKey);
                if (helpText) {
                    const tooltip = $(
                        `<span class="${CSS.CLASSES.HELP_TOOLTIP} ` +
                        `${CSS.CLASSES.FA} ${CSS.CLASSES.FA_QUESTION_CIRCLE}"></span>`
                    );
                    tooltip.attr('title', helpText);
                    $(label).append(tooltip);
                }
            }
        });

        // Initialize tooltips
        initTooltips(CSS.SELECTORS.HELP_TOOLTIP);
    } catch (error) {
        // Help tooltips setup skipped - non-critical
        console.debug('JWT UI help tooltips setup failed:', error);
    }
};

/**
 * Sets up the basic UI state by hiding the loading indicator and showing main tabs.
 *
 * This function provides simple UI state management without complex state tracking.
 * It ensures proper visibility of UI elements during the initialization process.
 *
 * @example
 * // Called during initialization
 * setupUI(); // Hides loading, shows main UI
 */
const setupUI = () => {
    // Hide loading indicator (set display: none for test compatibility)
    const loadingIndicator = document.getElementById(CSS.IDS.LOADING_INDICATOR);
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }

    // Show main UI
    const tabs = document.getElementById(CSS.IDS.JWT_VALIDATOR_TABS);
    if (tabs) {
        tabs.style.display = '';
    }

    // Update translations
    updateTranslations();
};

/**
 * Updates UI text elements with localized translations.
 *
 * This function provides simple translation updates without complex translation
 * management. It updates key UI text elements using the NiFi i18n system.
 *
 * @example
 * // Update all translatable text
 * updateTranslations(); // Updates loading text and title
 */
const updateTranslations = () => {
    const i18nObj = nfCommon.getI18n();

    // Update loading text
    const loadingIndicator = $(`#${CSS.IDS.LOADING_INDICATOR}`);
    if (loadingIndicator.length) {
        loadingIndicator.text(i18nObj.getProperty(UI_TEXT.I18N_KEYS.JWT_VALIDATOR_LOADING) || 'Loading...');
    }

    // Update title
    const title = $(CSS.SELECTORS.JWT_VALIDATOR_TITLE);
    if (title.length) {
        title.text(i18nObj.getProperty(UI_TEXT.I18N_KEYS.JWT_VALIDATOR_TITLE) || 'JWT Validator');
    }
};

/**
 * Sets up event handlers for NiFi processor dialog open events.
 *
 * This function provides simple dialog handling without complex event management.
 * It listens for processor dialog events and initializes tooltips and translations
 * when the JWT authenticator processor dialog is opened.
 *
 * @example
 * // Setup dialog event handlers
 * setupDialogHandlers(); // Registers dialog open event listener
 */
const setupDialogHandlers = () => {
    $(document).on('dialogOpen', (_event, data) => {
        const dialogElement = Array.isArray(data) ? data[0] : data;

        const isProcessorDialog = dialogElement?.classList?.contains(
            CSS.CLASSES.PROCESSOR_DIALOG
        );

        if (isProcessorDialog) {
            setTimeout(() => {
                const processorType = dialogElement
                    .querySelector(CSS.SELECTORS.PROCESSOR_TYPE)?.textContent?.trim();

                if (processorType?.includes(
                    NIFI.PROCESSOR_TYPES.MULTI_ISSUER_JWT_AUTHENTICATOR)) {
                    setupHelpTooltips();
                    updateTranslations();
                }
            }, API.TIMEOUTS.DIALOG_DELAY);
        }
    });
};

/**
 * Main initialization function for the JWT validation UI components.
 *
 * This function replaces the previous 344-line over-engineered initialization
 * system with a clean, maintainable approach. It handles component registration,
 * UI setup, and error recovery with proper fallback mechanisms.
 *
 * @async
 * @returns {Promise<void>} Promise that resolves when initialization is complete
 *
 * @example
 * // Initialize the JWT UI components
 * await init();
 * console.log('JWT UI ready');
 */
export const init = async () => {
    try {
        // Register components
        const success = registerComponents();

        if (success) {
            // Setup UI elements
            setupUI();
            setupHelpTooltips();
            setupDialogHandlers();

            // JWT UI initialization completed
        } else {
            // Fallback - just hide loading and show basic UI
            setupUI();
        }

        // Add timeout fallback for test compatibility
        setTimeout(() => {
            setupUI();
        }, API.TIMEOUTS.UI_FALLBACK_TIMEOUT);
    } catch (error) {
        // JWT UI initialization failed - error handled internally
        console.debug(error);
        setupUI(); // Always try to show something
    }
};

/**
 * Cleans up event handlers and resources used by the JWT UI components.
 *
 * This function provides simple cleanup without complex resource management.
 * It removes event handlers to prevent memory leaks when the component is disposed.
 *
 * @example
 * // Cleanup when component is destroyed
 * cleanup(); // Removes all event handlers
 */
export const cleanup = () => {
    try {
        // Simple cleanup - just remove event handlers
        $(document).off('dialogOpen');
        // JWT UI cleanup completed
    } catch (error) {
        // JWT UI cleanup failed - error handled internally
        console.debug(error);
    }
};

/**
 * Returns the current status of registered JWT validation components.
 *
 * This function provides simple status checking without complex component tracking.
 * It returns a static list of component statuses for debugging and monitoring.
 *
 * @returns {Array<Object>} Array of component status objects
 * @returns {string} returns[].id - Component identifier
 * @returns {string} returns[].status - Component status (always 'registered')
 *
 * @example
 * // Check component registration status
 * const statuses = getComponentStatus();
 * console.log(statuses); // [{id: 'issuer-config-editor', status: 'registered'}, ...]
 */
export const getComponentStatus = () => {
    return [
        { id: 'issuer-config-editor', status: 'registered' },
        { id: 'token-verifier', status: 'registered' },
        { id: 'help-tooltips', status: 'registered' }
    ];
};
