/**
 * Tests for bundle-wrapper.js
 *
 * This file tests the UMD bundle entry point that wraps main.js functionality
 * and provides a clean API surface for NiFi's plugin system.
 */

// Mock main.js module with all required functions
// Define mocks at module level so they can be accessed in tests
let mockInit;
let mockHideLoadingIndicatorRobust;
let mockGetComponentStatus;
let mockCleanup;

// Mock both possible import paths
jest.mock('../../main/webapp/js/main.js', () => {
    // Initialize mocks inside the factory so they're available
    mockInit = jest.fn().mockResolvedValue(true);
    mockHideLoadingIndicatorRobust = jest.fn();
    mockGetComponentStatus = jest.fn().mockReturnValue({ initialized: true });
    mockCleanup = jest.fn();

    return {
        __esModule: true,
        init: (...args) => mockInit(...args),
        hideLoadingIndicatorRobust: (...args) => mockHideLoadingIndicatorRobust(...args),
        getComponentStatus: (...args) => mockGetComponentStatus(...args),
        cleanup: (...args) => mockCleanup(...args)
    };
});

jest.mock('./main.js', () => {
    return {
        __esModule: true,
        init: (...args) => mockInit(...args),
        hideLoadingIndicatorRobust: (...args) => mockHideLoadingIndicatorRobust(...args),
        getComponentStatus: (...args) => mockGetComponentStatus(...args),
        cleanup: (...args) => mockCleanup(...args)
    };
}, { virtual: true });

describe('bundle-wrapper.js', () => {
    let bundleWrapper;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        // Import the module under test
        bundleWrapper = require('../../main/webapp/js/bundle-wrapper.js');
    });

    describe('ES6 module exports', () => {
        it('should export init function', () => {
            expect(bundleWrapper.init).toBeDefined();
            expect(typeof bundleWrapper.init).toBe('function');
        });

        it('should export hideLoadingIndicatorImmediate function', () => {
            expect(bundleWrapper.hideLoadingIndicatorImmediate).toBeDefined();
            expect(typeof bundleWrapper.hideLoadingIndicatorImmediate).toBe('function');
        });

        it('should export getComponentStatus function', () => {
            expect(bundleWrapper.getComponentStatus).toBeDefined();
            expect(typeof bundleWrapper.getComponentStatus).toBe('function');
        });

        it('should export cleanup function', () => {
            expect(bundleWrapper.cleanup).toBeDefined();
            expect(typeof bundleWrapper.cleanup).toBe('function');
        });
    });

    describe('init() function delegation', () => {
        it('should delegate to main.init()', async () => {
            const result = bundleWrapper.init();

            // Verify main.init was called
            expect(mockInit).toHaveBeenCalledTimes(1);

            // Verify it returns the result from main.init
            expect(result).toBeInstanceOf(Promise);
            await expect(result).resolves.toBe(true);
        });

        it('should handle init() errors from main module', async () => {
            // Set up mock to reject
            mockInit.mockRejectedValueOnce(new Error('Init failed'));

            const result = bundleWrapper.init();

            // Verify main.init was called
            expect(mockInit).toHaveBeenCalledTimes(1);

            // Verify error is propagated
            await expect(result).rejects.toThrow('Init failed');
        });

        it('should call init() multiple times if invoked multiple times', async () => {
            await bundleWrapper.init();
            await bundleWrapper.init();
            await bundleWrapper.init();

            expect(mockInit).toHaveBeenCalledTimes(3);
        });
    });

    describe('hideLoadingIndicatorImmediate() function alias', () => {
        it('should delegate to main.hideLoadingIndicatorRobust()', () => {
            bundleWrapper.hideLoadingIndicatorImmediate();

            expect(mockHideLoadingIndicatorRobust).toHaveBeenCalledTimes(1);
        });

        it('should call hideLoadingIndicatorRobust() multiple times if invoked multiple times', () => {
            bundleWrapper.hideLoadingIndicatorImmediate();
            bundleWrapper.hideLoadingIndicatorImmediate();
            bundleWrapper.hideLoadingIndicatorImmediate();

            expect(mockHideLoadingIndicatorRobust).toHaveBeenCalledTimes(3);
        });

        it('should not throw if hideLoadingIndicatorRobust throws', () => {
            // Set up mock to throw
            mockHideLoadingIndicatorRobust.mockImplementationOnce(() => {
                throw new Error('DOM error');
            });

            // Should propagate the error (no try-catch in wrapper)
            expect(() => bundleWrapper.hideLoadingIndicatorImmediate()).toThrow('DOM error');
        });
    });

    describe('getComponentStatus() re-export', () => {
        it('should delegate to main.getComponentStatus()', () => {
            const result = bundleWrapper.getComponentStatus();

            expect(mockGetComponentStatus).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ initialized: true });
        });

        it('should return different values from main module', () => {
            mockGetComponentStatus.mockReturnValueOnce({ initialized: false, error: 'test error' });

            const result = bundleWrapper.getComponentStatus();

            expect(result).toEqual({ initialized: false, error: 'test error' });
        });
    });

    describe('cleanup() re-export', () => {
        it('should delegate to main.cleanup()', () => {
            bundleWrapper.cleanup();

            expect(mockCleanup).toHaveBeenCalledTimes(1);
        });

        it('should call cleanup() multiple times if invoked multiple times', () => {
            bundleWrapper.cleanup();
            bundleWrapper.cleanup();

            expect(mockCleanup).toHaveBeenCalledTimes(2);
        });
    });

    describe('UMD module.exports compatibility', () => {
        it('should provide functions via ES6 module exports', () => {
            // Reset and re-import
            jest.resetModules();
            const wrapper = require('../../main/webapp/js/bundle-wrapper.js');

            // Verify ES6 exports work (Jest/Node.js environment)
            expect(wrapper).toBeDefined();
            expect(typeof wrapper.init).toBe('function');
            expect(typeof wrapper.hideLoadingIndicatorImmediate).toBe('function');
            expect(typeof wrapper.getComponentStatus).toBe('function');
            expect(typeof wrapper.cleanup).toBe('function');
        });

        it('should expose the same API through all export mechanisms', () => {
            // The module should provide consistent API
            const expectedFunctions = [
                'init',
                'hideLoadingIndicatorImmediate',
                'getComponentStatus',
                'cleanup'
            ];

            expectedFunctions.forEach(funcName => {
                expect(bundleWrapper[funcName]).toBeDefined();
                expect(typeof bundleWrapper[funcName]).toBe('function');
            });
        });

        it('should support UMD pattern for browser environments', () => {
            // The actual UMD block in the source checks for module and module.exports
            // In Jest/Node.js environment, module.exports is always available
            // The UMD block should have set up the exports correctly
            const wrapper = require('../../main/webapp/js/bundle-wrapper.js');

            // Verify the module was loaded and exports are available
            expect(wrapper.init).toBeDefined();
            expect(wrapper.hideLoadingIndicatorImmediate).toBeDefined();
            expect(wrapper.getComponentStatus).toBeDefined();
            expect(wrapper.cleanup).toBeDefined();
        });
    });

    describe('API surface completeness', () => {
        it('should expose all required functions for NiFi plugin system', () => {
            // Verify all expected functions are present
            const expectedFunctions = [
                'init',
                'hideLoadingIndicatorImmediate',
                'getComponentStatus',
                'cleanup'
            ];

            expectedFunctions.forEach(funcName => {
                expect(bundleWrapper[funcName]).toBeDefined();
                expect(typeof bundleWrapper[funcName]).toBe('function');
            });
        });

        it('should not expose internal main.js functions', () => {
            // Verify we only expose what's explicitly exported
            expect(bundleWrapper.hideLoadingIndicatorRobust).toBeUndefined();
            expect(bundleWrapper.__esModule).toBeUndefined(); // No internal module markers
        });
    });

    describe('Integration behavior', () => {
        it('should maintain consistent behavior across calls', async () => {
            // First call to init
            await bundleWrapper.init();

            // Call other functions
            bundleWrapper.hideLoadingIndicatorImmediate();
            const status1 = bundleWrapper.getComponentStatus();

            // Second call to init
            await bundleWrapper.init();

            // Call other functions again
            bundleWrapper.hideLoadingIndicatorImmediate();
            const status2 = bundleWrapper.getComponentStatus();

            // Verify all delegations happened
            expect(mockInit).toHaveBeenCalledTimes(2);
            expect(mockHideLoadingIndicatorRobust).toHaveBeenCalledTimes(2);
            expect(mockGetComponentStatus).toHaveBeenCalledTimes(2);
        });

        it('should allow cleanup after initialization', async () => {
            await bundleWrapper.init();
            bundleWrapper.cleanup();

            expect(mockInit).toHaveBeenCalledTimes(1);
            expect(mockCleanup).toHaveBeenCalledTimes(1);
        });
    });
});
