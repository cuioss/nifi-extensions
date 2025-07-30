/**
 * Bundle wrapper to provide expected interface for tests
 * This wraps the main module to match test expectations
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

// Re-export other functions tests might need
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
