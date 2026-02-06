'use strict';

// Initialize the JWT UI components when the page loads
document.addEventListener('DOMContentLoaded', function () {
    // eslint-disable-next-line no-console
    console.log('DOM loaded, initializing JWT UI...');

    // Initialize the UI components - the bundle exposes nifiCuiossUI global variable
    if (globalThis.nifiCuiossUI && typeof globalThis.nifiCuiossUI.init === 'function') {
        // eslint-disable-next-line no-console
        console.log('Initializing JWT UI from Vite bundle');
        globalThis.nifiCuiossUI.init().then(function (success) {
            if (success) {
                // eslint-disable-next-line no-console
                console.log('JWT UI initialization completed successfully');
            } else {
                // eslint-disable-next-line no-console
                console.warn('JWT UI initialization completed with warnings');
            }
        }).catch(function (error) {
            // eslint-disable-next-line no-console
            console.error('JWT UI initialization failed:', error);
        });
    } else {
        // eslint-disable-next-line no-console
        console.error('nifiCuiossUI not found in global scope. Bundle may not have loaded correctly.');
    }
});

// Add global error handler for debugging
globalThis.addEventListener('error', function (event) {
    // eslint-disable-next-line no-console
    console.error('Global error:', event.error);
});
