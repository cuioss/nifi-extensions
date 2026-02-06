'use strict';

// In production, NiFi provides the nf.Common object
// Map it to nfCommon for compatibility with our code
if (globalThis.nf !== undefined && globalThis.nf.Common) {
    globalThis.nfCommon = globalThis.nf.Common;
} else if (globalThis.nfCommon === undefined) {
    // Only log error if nfCommon is not already available from another source
    // eslint-disable-next-line no-console
    console.warn('NiFi Common API not available. UI functionality may be limited.');
    // Create a minimal stub to prevent errors
    globalThis.nfCommon = {
        registerCustomUiTab: function () {
            // eslint-disable-next-line no-console
            console.warn('registerCustomUiTab called but NiFi API not available');
        },
        getI18n: function () {
            return {
                getProperty: function (key) { return key; }
            };
        }
    };
}
