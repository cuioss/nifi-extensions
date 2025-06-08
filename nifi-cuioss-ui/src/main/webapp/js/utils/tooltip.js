// utils/tooltip.js
import tippy from 'tippy.js';
import * as nfCommon from 'nf.Common'; // Import nfCommon
// Note: CSS files for tippy.js should be included in the main HTML or via separate CSS build process

export function initTooltips(selector, options = {}, context = document) {
    let elements;
    if (typeof selector === 'string') {
        elements = context.querySelectorAll(selector);
    } else if (Array.isArray(selector)) {
        elements = selector;
    } else {
        elements = [selector];
    }

    if (elements.length === 0) return null;

    // Default options similar to our jQuery UI tooltip config
    const defaultOptions = {
        placement: 'bottom-start', // Similar to our jQuery UI positioning
        arrow: true,
        theme: 'light-border',
        appendTo: 'parent' // Attaches tooltip to parent instead of document.body
    };

    // Merge default options with provided options
    const tippyOptions = { ...defaultOptions, ...options };

    try {
        return tippy(Array.from(elements), tippyOptions);
    } catch (error) {
        // Log error if Tippy.js initialization fails.
        nfCommon?.logError?.('Error initializing tooltip: ' + error.message);
        // It's important to return null or an empty instance array if tippy fails,
        // consistent with tippy's behavior on empty selectors.
        return null;
    }
}
