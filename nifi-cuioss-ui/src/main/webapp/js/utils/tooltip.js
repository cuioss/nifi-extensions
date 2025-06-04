// utils/tooltip.js
import tippy from 'tippy.js';
import * as nfCommon from 'nf.Common'; // Import nfCommon
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css'; // Optional for jQuery UI-like styling

export function initTooltips(selector, options = {}, context = document) {
    const elements = typeof selector === 'string'
        ? context.querySelectorAll(selector)
        : (Array.isArray(selector) ? selector : [selector]);

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
        if (nfCommon && nfCommon.logError) {
            nfCommon.logError('Error initializing tooltip: ' + error.message);
        }
        // It's important to return null or an empty instance array if tippy fails,
        // consistent with tippy's behavior on empty selectors.
        return null;
    }
}
