// utils/tooltip.js
import tippy from 'tippy.js';
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
        // Fallback to title attribute if tooltip function fails
        Array.from(elements).forEach(element => {
            const title = element.getAttribute('title');
            if (title) {
                element.setAttribute('data-original-title', title);
            }
        });
        return null;
    }
}
