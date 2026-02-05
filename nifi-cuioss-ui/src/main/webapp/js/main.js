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
import { createLogger } from './utils/logger.js';
import * as nfCommon from 'nf.Common';
import * as tokenVerifier from './components/tokenVerifier.js';
import * as issuerConfigEditor from './components/issuerConfigEditor.js';
import * as metricsTab from './components/metricsTab.js';
import * as helpTab from './components/helpTab.js';
import * as i18n from './utils/i18n.js';
import { initTooltips } from './utils/tooltip.js';
import { cleanup as cleanupKeyboardShortcuts, initKeyboardShortcuts } from './utils/keyboardShortcuts.js';
import { initTabs, cleanup as cleanupTabs } from './utils/tabManager.js';
import { API, CSS, NIFI, UI_TEXT } from './utils/constants.js';

const logger = createLogger('NiFi-Main');

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

        // Skip registerCustomUiTab calls in standalone mode - tabs already exist in HTML
        // In production NiFi environment, these would register with the real NiFi framework
        const isStandaloneMode = globalThis.location.href.includes('nifi-cuioss-ui') ||
                                 globalThis.location.href.includes('localhost:9095') ||
                                 globalThis.location.pathname.includes('/nifi-cuioss-ui');
        if (typeof nfCommon.registerCustomUiTab === 'function' && !isStandaloneMode) {
            // Only register tabs when running inside NiFi (not standalone)
            nfCommon.registerCustomUiTab(NIFI.COMPONENT_TABS.ISSUER_CONFIG, issuerConfigEditor);
            nfCommon.registerCustomUiTab(NIFI.COMPONENT_TABS.TOKEN_VERIFICATION, tokenVerifier);
            nfCommon.registerCustomUiTab(NIFI.COMPONENT_TABS.METRICS, metricsTab);
            nfCommon.registerCustomUiTab(NIFI.COMPONENT_TABS.HELP, helpTab);
        } else {
            logger.info('Skipping tab registration in standalone mode');
        }

        // Set flag for test compatibility
        globalThis.jwtComponentsRegistered = true;

        // Components registered successfully
        return true;
    } catch (error) {
        // Component registration failed - error logged internally
        // eslint-disable-next-line no-console
        console.error('JWT UI component registration failed:', error);
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
        for (const label of document.querySelectorAll(CSS.SELECTORS.PROPERTY_LABEL)) {
            const propertyName = label.textContent.trim();
            const helpKey = UI_TEXT.PROPERTY_LABELS[propertyName];

            if (helpKey && !label.querySelector(CSS.SELECTORS.HELP_TOOLTIP)) {
                const helpText = nfCommon.getI18n().getProperty(helpKey);
                if (helpText) {
                    const tooltip = document.createElement('span');
                    tooltip.className = `${CSS.CLASSES.HELP_TOOLTIP} ` +
                        `${CSS.CLASSES.FA} ${CSS.CLASSES.FA_QUESTION_CIRCLE}`;
                    tooltip.setAttribute('title', helpText);
                    label.appendChild(tooltip);
                }
            }
        }

        // Initialize tooltips for help elements
        initTooltips(CSS.SELECTORS.HELP_TOOLTIP);

        // Initialize tooltips for elements with title attributes
        initTooltips('[title]', { placement: 'bottom' });

        // Initialize tooltips for help text elements created by FormFieldFactory
        initTooltips('.help-tooltip', { placement: 'right' });

        // Setup observer for dynamically added tooltips
        setupTooltipObserver();

        // Setup continuous loading monitoring - critical for roundtrip testing
        setupContinuousLoadingMonitoring();
    } catch (error) {
        // Help tooltips setup skipped - non-critical
        logger.debug('JWT UI help tooltips setup failed:', error);
    }
};

/**
 * Check if node contains loading text
 * @param {Node} node - The node to check
 * @returns {boolean} True if node contains loading text
 */
const nodeContainsLoadingText = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }
    const textContent = node.textContent?.trim() || '';
    return textContent.includes('Loading JWT') ||
           textContent.includes('Loading Validator') ||
           textContent.includes('Loading JWT Validator UI');
};

/**
 * Process mutation for loading indicators
 * @param {MutationRecord} mutation - The mutation record
 * @returns {boolean} True if loading indicator found
 */
const processMutationForLoading = (mutation) => {
    if (mutation.type !== 'childList') {
        return false;
    }
    for (const node of mutation.addedNodes) {
        if (nodeContainsLoadingText(node)) {
            return true;
        }
    }
    return false;
};

/**
 * Handle mutation observer callback for loading indicators
 * @param {MutationRecord[]} mutations - Array of mutations
 */
const handleLoadingMutations = (mutations) => {
    let needsHiding = false;
    for (const mutation of mutations) {
        if (processMutationForLoading(mutation)) {
            needsHiding = true;
            break;
        }
    }

    if (needsHiding) {
        logger.debug('MutationObserver detected loading message, hiding immediately');
        hideLoadingIndicatorRobust();
    }
};

/**
 * Sets up continuous monitoring for loading indicators that might appear at any time.
 * This is critical for catching loading messages that appear after initialization.
 * Enhanced to follow roundtrip testing requirements for immediate feedback.
 */
const setupContinuousLoadingMonitoring = () => {
    // Set up mutation observer to catch dynamically added loading elements
    if (typeof MutationObserver !== 'undefined') {
        const loadingObserver = new MutationObserver(handleLoadingMutations);

        loadingObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Store observer for cleanup
        globalThis.jwtLoadingObserver = loadingObserver;
    }

    // Set up periodic monitoring as additional safety net
    const periodicCheck = setInterval(() => {
        const hasLoadingMessage = document.querySelector('*')?.innerText?.includes('Loading JWT Validator UI');
        if (hasLoadingMessage) {
            logger.debug('Periodic check detected loading message, hiding immediately');
            hideLoadingIndicatorRobust();
        }
    }, 100); // Check every 100ms

    // Clear periodic check after 10 seconds (should be sufficient)
    setTimeout(() => {
        clearInterval(periodicCheck);
        logger.debug('Periodic loading check completed');
    }, 10000);

    logger.debug('Continuous loading monitoring set up successfully');
};

/**
 * Initialize tooltips for a single node
 * @param {Node} node - The node to process
 */
const initializeTooltipsForNode = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    const elementsWithTitle = node.querySelectorAll('[title]');
    const helpTooltips = node.querySelectorAll('.help-tooltip');

    if (elementsWithTitle.length > 0) {
        initTooltips(Array.from(elementsWithTitle), { placement: 'bottom' });
    }

    if (helpTooltips.length > 0) {
        initTooltips(Array.from(helpTooltips), { placement: 'right' });
    }
};

/**
 * Process mutation for tooltip initialization
 * @param {MutationRecord} mutation - The mutation record
 */
const processMutationForTooltips = (mutation) => {
    if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
            initializeTooltipsForNode(node);
        }
    }
};

/**
 * Sets up mutation observer to initialize tooltips on dynamically added elements.
 * This ensures tooltips work on form fields created after initial page load.
 */
const setupTooltipObserver = () => {
    try {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                processMutationForTooltips(mutation);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Store observer for cleanup
        if (!globalThis.nifiJwtTooltipObserver) {
            globalThis.nifiJwtTooltipObserver = observer;
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.debug('Failed to setup tooltip observer:', error);
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
    try {
        // Hide loading indicator with multiple strategies for robustness
        const loadingIndicator = document.getElementById(CSS.IDS.LOADING_INDICATOR);
        if (loadingIndicator) {
            // Use multiple methods to ensure hiding works
            loadingIndicator.style.display = 'none';
            loadingIndicator.style.visibility = 'hidden';
            loadingIndicator.setAttribute('aria-hidden', 'true');

            // Add CSS class to hide it
            loadingIndicator.classList.add('hidden');

            // Remove any potential inline styles that might override our hiding
            if (loadingIndicator.style.removeProperty) {
                loadingIndicator.style.removeProperty('display');
                loadingIndicator.style.display = 'none';
            }

            logger.debug('Loading indicator successfully hidden');
        } else {
            // Try alternative selectors as fallback
            const altLoadingIndicator = document.querySelector('#loading-indicator, .loading-indicator, [id*="loading"]');
            if (altLoadingIndicator) {
                altLoadingIndicator.style.display = 'none';
                altLoadingIndicator.style.visibility = 'hidden';
            }
        }

        // Show main UI
        const tabs = document.getElementById(CSS.IDS.JWT_VALIDATOR_TABS);
        if (tabs) {
            tabs.style.display = '';
            tabs.style.visibility = 'visible';
        }
        // Note: If tabs not found, this is expected if tabs haven't been created by registerComponents yet

        // Update translations
        updateTranslations();

        // Set a flag to indicate UI setup is complete
        globalThis.jwtUISetupComplete = true;
    } catch (error) {
        console.error('Error in setupUI():', error);
        // Fallback: try basic hiding without additional logic
        try {
            const basicLoadingIndicator = document.getElementById('loading-indicator');
            if (basicLoadingIndicator) {
                basicLoadingIndicator.style.display = 'none';
            }
        } catch (fallbackError) {
            console.error('Even fallback setupUI failed:', fallbackError);
        }
    }
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
    const loadingIndicator = document.getElementById(CSS.IDS.LOADING_INDICATOR);
    if (loadingIndicator) {
        loadingIndicator.textContent = i18nObj.getProperty(UI_TEXT.I18N_KEYS.JWT_VALIDATOR_LOADING) || 'Loading...';
    }

    // Update title
    const title = document.querySelector(CSS.SELECTORS.JWT_VALIDATOR_TITLE);
    if (title) {
        title.textContent = i18nObj.getProperty(UI_TEXT.I18N_KEYS.JWT_VALIDATOR_TITLE) || 'JWT Validator';
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
    document.addEventListener('dialogOpen', (event) => {
        const data = event.detail;
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
 * Initializes tab content components when tabs are shown
 */
const initializeTabContent = () => {
    try {
        logger.info('Initializing tab content components...');

        // Initialize all tabs immediately since they exist in the DOM
        logger.info('Initializing issuer config tab');
        const issuerConfigElement = document.getElementById('issuer-config');
        if (issuerConfigElement) {
            // Provide required parameters: element, callback, url
            const callback = () => logger.debug('Issuer config initialized');
            const url = globalThis.location.href;
            issuerConfigEditor.init(issuerConfigElement, callback, url);
        } else {
            logger.warn('Issuer config tab element not found');
        }

        logger.info('Initializing token verification tab');
        const tokenVerifierElement = document.getElementById('token-verification');
        if (tokenVerifierElement) {
            // Provide required parameters: element, config, type, callback
            const callback = () => logger.debug('Token verifier initialized');
            tokenVerifier.init(tokenVerifierElement, {}, 'jwt', callback);
        } else {
            logger.warn('Token verification tab element not found');
        }

        logger.info('Initializing metrics tab');
        metricsTab.init();

        logger.info('Initializing help tab');
        helpTab.init();

        // Also set up tab change handler for any re-initialization needs
        document.addEventListener('tabChanged', (event) => {
            const data = event.detail;
            logger.debug('Tab changed to:', data.tabId);

            switch (data.tabId) {
                case '#issuer-config': {
                    const issuerElement = document.getElementById('issuer-config');
                    if (issuerElement) {
                        const callback = () => logger.debug('Issuer config re-initialized');
                        const url = globalThis.location.href;
                        issuerConfigEditor.init(issuerElement, callback, url);
                    }
                    break;
                }
                case '#token-verification': {
                    const tokenElement = document.getElementById('token-verification');
                    if (tokenElement) {
                        const callback = () => logger.debug('Token verifier re-initialized');
                        tokenVerifier.init(tokenElement, {}, 'jwt', callback);
                    }
                    break;
                }
                case '#metrics':
                    metricsTab.init();
                    break;
                case '#help':
                    helpTab.init();
                    break;
                default:
                    logger.warn('Unknown tab:', data.tabId);
            }
        });

        logger.info('Tab content initialization setup complete');
    } catch (error) {
        logger.error('Failed to initialize tab content:', error);
    }
};

/**
 * Main initialization function for the JWT validation UI components.
 *
 * This function replaces the previous 344-line over-engineered initialization
 * system with a clean, maintainable approach. It handles component registration,
 * UI setup, and error recovery with proper fallback mechanisms.
 * Enhanced to follow roundtrip testing requirements.
 *
 * @async
 * @returns {Promise<boolean>} Promise that resolves when initialization is complete
 *
 * @example
 * // Initialize the JWT UI components
 * await init();
 * console.log('JWT UI ready');
 */
export const init = () => {
    return new Promise((resolve) => {
        try {
            logger.debug('JWT UI initialization starting...');

            // Prevent double initialization
            if (globalThis.jwtInitializationInProgress || globalThis.jwtUISetupComplete) {
                logger.debug('Initialization already in progress or complete, skipping');
                resolve(true);
                return;
            }

            globalThis.jwtInitializationInProgress = true;

            // CRITICAL: Hide loading indicator immediately as first action
            logger.info('PRIORITY: Hiding loading indicator immediately');
            hideLoadingIndicatorRobust();

            // Register components synchronously
            logger.debug('Registering JWT UI components...');
            const success = registerComponents();

            if (success) {
                logger.debug('Component registration successful, setting up UI...');
                setupUI();
                initTabs();
                registerHelpTooltips();
                setupDialogHandlers();
                initKeyboardShortcuts();

                // Initialize tab content components
                initializeTabContent();
                logger.info('JWT UI initialization completed successfully');
            } else {
                console.warn('Component registration failed, using fallback...');
                setupUI();
                initTabs();
                registerHelpTooltips();
                initKeyboardShortcuts();

                // Initialize tab content components
                initializeTabContent();
            }

            // Multiple safety checks to ensure loading indicator is hidden
            setTimeout(() => {
                logger.debug('100ms safety check: ensuring loading indicator is hidden');
                hideLoadingIndicatorRobust();
            }, 100);

            setTimeout(() => {
                logger.debug('500ms safety check: ensuring loading indicator is hidden');
                hideLoadingIndicatorRobust();
            }, 500);

            // Final fallback timeout
            setTimeout(() => {
                logger.debug('Final 1s fallback: ensuring UI is visible and loading hidden');
                setupUI();
                hideLoadingIndicatorRobust();
                updateTranslations();
            }, API.TIMEOUTS.DIALOG_DELAY);

            globalThis.jwtInitializationInProgress = false;
            resolve(success);
        } catch (error) {
            console.error('JWT UI initialization failed:', error);

            // Always try to hide loading indicator even on failure
            hideLoadingIndicatorRobust();
            setupUI();

            globalThis.jwtInitializationInProgress = false;
            resolve(false);
        }
    });
};

/**
 * Robustly hides the loading indicator using multiple strategies.
 * This function is called multiple times as a safety measure.
 * Enhanced to follow roundtrip testing requirements for immediate UI feedback.
 */
const hideLoadingIndicatorRobust = () => {
    try {
        logger.debug('hideLoadingIndicatorRobust: Starting comprehensive loading indicator removal');

        // Strategy 1: Hide by standard ID
        hideLoadingByStandardId();

        // Strategy 2: Hide by various selectors
        hideLoadingBySelectors();

        // Strategy 3: Hide by text content
        hideLoadingByTextContent();

        // Set completion flag
        globalThis.jwtLoadingIndicatorHidden = true;

        // Expose hiding function for test access
        globalThis.jwtHideLoadingIndicator = hideLoadingIndicatorRobust;
        logger.debug('hideLoadingIndicatorRobust: Comprehensive loading indicator removal completed');
    } catch (error) {
        console.warn('Error in hideLoadingIndicatorRobust:', error);
        emergencyFallbackHideLoading();
    }
};

/**
 * Hide loading indicator by standard ID
 */
const hideLoadingByStandardId = () => {
    const loadingIndicator = document.getElementById(CSS.IDS.LOADING_INDICATOR);
    if (loadingIndicator) {
        const originalText = loadingIndicator.textContent;

        // Forcefully hide using multiple approaches
        loadingIndicator.style.setProperty('display', 'none', 'important');
        loadingIndicator.style.setProperty('visibility', 'hidden', 'important');
        loadingIndicator.style.setProperty('opacity', '0', 'important');
        loadingIndicator.setAttribute('aria-hidden', 'true');
        loadingIndicator.classList.add('hidden');

        // Clear content
        loadingIndicator.textContent = '';
        loadingIndicator.innerHTML = '';

        logger.debug(`Loading indicator hidden via standard ID (was: "${originalText}")`);
    }
};

/**
 * Hide loading indicators by various selectors
 */
const hideLoadingBySelectors = () => {
    const selectors = [
        '#loading-indicator',
        '.loading-indicator',
        '[id*="loading"]',
        '[class*="loading"]'
    ];

    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.setAttribute('aria-hidden', 'true');
                element.classList.add('hidden');
            }
        } catch (selectorError) {
            console.debug('Selector ignored:', selector, selectorError);
        }
    }
};

/**
 * Hide elements containing loading text
 * Enhanced to catch all possible loading indicators including simulated ones
 */
const hideLoadingByTextContent = () => {
    const allElements = document.getElementsByTagName('*');
    const loadingTexts = ['Loading JWT Validator UI', 'Loading JWT', 'Loading'];

    let hiddenCount = 0;
    logger.debug('hideLoadingByTextContent: Starting scan of', allElements.length, 'elements');

    for (const element of allElements) {
        const textContent = element.textContent?.trim() || '';
        const hasLoadingText = loadingTexts.some(text => textContent.includes(text));

        if (hasLoadingText) {
            logger.debug('Found element with loading text:', textContent, 'on element:', element.tagName, element.id, element.className);
            if (shouldHideElement(textContent)) {
                hideElement(element, textContent);
                hiddenCount++;
            } else {
                logger.debug('Element not hidden because shouldHideElement returned false');
            }
        }
    }

    // Also check for elements by various IDs that might contain loading messages
    const loadingIds = ['loading-indicator', 'simulated-loading', 'jwt-loading', 'validator-loading'];
    for (const id of loadingIds) {
        const element = document.getElementById(id);
        if (element) {
            logger.debug(`Found element with ID ${id}:`, element.textContent?.trim());
            if (element.textContent?.trim().includes('Loading')) {
                hideElement(element, element.textContent.trim());
                hiddenCount++;
            }
        }
    }

    logger.debug(`hideLoadingByTextContent: Hidden ${hiddenCount} loading indicators`);
};

/**
 * Determine if element should be hidden based on text content
 */
const shouldHideElement = (textContent) => {
    logger.debug('shouldHideElement checking:', textContent);
    const shouldHide = textContent.length < 100 &&
           (textContent === 'Loading JWT Validator UI...' ||
            textContent.startsWith('Loading JWT') ||
            textContent.startsWith('Loading'));
    logger.debug('shouldHideElement result:', shouldHide);
    return shouldHide;
};

/**
 * Hide individual element and clear its content
 */
const hideElement = (element, textContent) => {
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('opacity', '0', 'important');
    element.setAttribute('aria-hidden', 'true');
    element.classList.add('hidden');

    // Clear content for extra safety
    if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
        element.textContent = '';
    }

    logger.debug(`Hidden element with loading text: "${textContent}"`);
};

/**
 * Emergency fallback for loading indicator hiding
 */
const emergencyFallbackHideLoading = () => {
    try {
        const basicIndicator = document.getElementById('loading-indicator');
        if (basicIndicator) {
            basicIndicator.style.display = 'none';
            logger.debug('Emergency fallback: basic loading indicator hidden');
        }
    } catch (fallbackError) {
        console.error('Even emergency fallback failed:', fallbackError);
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
        // Note: Need to track and remove specific event listeners added with addEventListener
        cleanupKeyboardShortcuts();
        cleanupTabs();

        // Cleanup tooltip observer
        if (globalThis.nifiJwtTooltipObserver) {
            globalThis.nifiJwtTooltipObserver.disconnect();
            globalThis.nifiJwtTooltipObserver = null;
        }

        // Cleanup loading observer
        if (globalThis.jwtLoadingObserver) {
            globalThis.jwtLoadingObserver.disconnect();
            globalThis.jwtLoadingObserver = null;
        }

        // JWT UI cleanup completed
    } catch (error) {
        // JWT UI cleanup failed - error handled internally
        // eslint-disable-next-line no-console
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

/**
 * Alias for setupHelpTooltips() - provided for test compatibility.
 * Tests expect this function name for tooltip initialization.
 */
export const registerHelpTooltips = setupHelpTooltips;

// Export helper functions for testing branch coverage
export {
    emergencyFallbackHideLoading,
    hideLoadingIndicatorRobust,
    shouldHideElement,
    hideElement,
    setupHelpTooltips
};

// Export tab components for external access
export * as helpTab from './components/helpTab.js';
export * as metricsTab from './components/metricsTab.js';
export * as issuerConfigEditor from './components/issuerConfigEditor.js';
export * as tokenVerifier from './components/tokenVerifier.js';
