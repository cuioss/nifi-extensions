/**
 * Cash-DOM Polyfill for missing jQuery methods
 * Adds compatibility methods that Cash-DOM doesn't implement
 */
'use strict';

(function () {
    // Wait for Cash-DOM to be loaded
    if (typeof window.Cash === 'undefined' && typeof window.$ === 'undefined') {
        console.warn('Cash-DOM not loaded, skipping polyfill');
        return;
    }

    const cash = window.Cash || window.$;

    if (!cash || !cash.fn) {
        console.warn('Cash-DOM prototype not available, skipping polyfill');
        return;
    }

    /**
     * Add removeData method to Cash-DOM
     * Removes data attributes and clears internal data cache
     */
    cash.fn.removeData = function (key) {
        return this.each(function () {
            const element = this;

            if (key) {
                // Remove specific data attribute
                const dataAttr = 'data-' + key.replace(/[A-Z]/g, function (match) {
                    return '-' + match.toLowerCase();
                });
                element.removeAttribute(dataAttr);

                // Also try to clear from Cash's internal data cache if it exists
                if (element._cashData && element._cashData[key]) {
                    delete element._cashData[key];
                }
            } else {
                // Remove all data attributes
                const attributes = Array.from(element.attributes);
                attributes.forEach(function (attr) {
                    if (attr.name.startsWith('data-')) {
                        element.removeAttribute(attr.name);
                    }
                });

                // Clear entire internal data cache if it exists
                if (element._cashData) {
                    element._cashData = {};
                }
            }
        });
    };

    console.debug('Cash-DOM removeData polyfill loaded');
})();
