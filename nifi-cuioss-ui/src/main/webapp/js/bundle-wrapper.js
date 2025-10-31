/**
 * Production UMD bundle entry point for Vite build
 *
 * This file serves as the entry point in vite.config.js and is built into bundle.umd.cjs,
 * which is then loaded by NiFi's custom UI infrastructure.
 *
 * The wrapper provides a clean API surface for NiFi's plugin system by:
 * - Re-exporting core functions from main.js
 * - Providing backwards-compatible function aliases (e.g., hideLoadingIndicatorImmediate)
 * - Ensuring UMD module compatibility for browser environments
 */
'use strict';

// Import the actual main module
import * as main from './main.js';

// Create wrapper init function that calls main.init
export const init = () => {
    return main.init();
};

// Export hideLoadingIndicatorImmediate as alias for hideLoadingIndicatorRobust
export const hideLoadingIndicatorImmediate = () => {
    main.hideLoadingIndicatorRobust();
};

// Re-export other public API functions
export { getComponentStatus, cleanup } from './main.js';

// For UMD compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        init,
        hideLoadingIndicatorImmediate,
        getComponentStatus: main.getComponentStatus,
        cleanup: main.cleanup
    };
}
