/**
 * Simple initialization utility - replaces the over-engineered ComponentManager.
 * For a simple 3-tab form UI, we don't need complex registration patterns.
 */
import * as nfCommon from 'nf.Common';

/**
 * Simple component registration - replaces 420 lines of ComponentManager complexity.
 * @param {Array} components - Array of {tabId, module} objects to register
 * @returns {Promise<boolean>} True if all components registered successfully
 */
export const registerComponents = async (components) => {
    try {
        // Simple loop - no complex state management needed
        for (const { tabId, module } of components) {
            nfCommon.registerCustomUiTab(tabId, module);
        }
        return true;
    } catch (error) {
        console.error('Component registration failed:', error);
        return false;
    }
};

/**
 * Initialize help tooltips with simple error handling.
 * @param {Function} getHelpTextForProperty - Function to get help text
 * @param {Function} initTooltips - Tooltip initialization function
 */
export const initializeHelpTooltips = (getHelpTextForProperty, initTooltips) => {
    try {
        // Find property labels and add tooltips
        document.querySelectorAll('.property-label').forEach(label => {
            const propertyName = label.textContent.trim();
            const helpText = getHelpTextForProperty(propertyName);

            if (helpText && !label.querySelector('.help-tooltip')) {
                const tooltipSpan = document.createElement('span');
                tooltipSpan.className = 'help-tooltip fa fa-question-circle';
                tooltipSpan.title = helpText;
                label.appendChild(tooltipSpan);
            }
        });

        // Initialize tooltips
        initTooltips('.help-tooltip');
    } catch (error) {
        console.debug('Help tooltips initialization skipped:', error.message);
    }
};
