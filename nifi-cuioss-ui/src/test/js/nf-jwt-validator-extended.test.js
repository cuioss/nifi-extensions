/**
 * @file Extended tests for nf-jwt-validator.js
 * Improves coverage for initialization script
 */

describe('nf-jwt-validator.js Extended Tests', () => {
    let mockMain;
    let consoleInfoSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;
    let mockLoadingIndicator;
    let originalWindow;

    beforeEach(() => {
        // Clear any existing flags
        delete window.jwtComponentsRegistered;
        delete window.jwtInitializationInProgress;
        delete window.jwtLoadingIndicatorHidden;

        // Mock console methods
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Mock main module
        mockMain = {
            init: jest.fn()
        };
        jest.doMock('js/main', () => mockMain, { virtual: true });

        // Create mock loading indicator
        mockLoadingIndicator = document.createElement('div');
        mockLoadingIndicator.id = 'loading-indicator';
        mockLoadingIndicator.style.display = 'block';
        document.body.appendChild(mockLoadingIndicator);

        // Store original window properties
        originalWindow = {
            jwtComponentsRegistered: window.jwtComponentsRegistered,
            jwtInitializationInProgress: window.jwtInitializationInProgress
        };
    });

    afterEach(() => {
        // Clean up DOM
        document.body.innerHTML = '';

        // Restore window properties
        window.jwtComponentsRegistered = originalWindow.jwtComponentsRegistered;
        window.jwtInitializationInProgress = originalWindow.jwtInitializationInProgress;

        // Clear mocks
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('Initialization Scenarios', () => {
        it('should skip initialization if components are already registered', () => {
            window.jwtComponentsRegistered = true;

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization'
            );
            expect(mockMain.init).not.toHaveBeenCalled();
        });

        it('should skip initialization if already in progress', () => {
            window.jwtInitializationInProgress = true;

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Initialization already in progress, skipping'
            );
            expect(mockMain.init).not.toHaveBeenCalled();
        });

        it('should handle successful initialization with Promise result', async () => {
            const initPromise = Promise.resolve();
            mockMain.init.mockReturnValue(initPromise);

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(window.jwtInitializationInProgress).toBe(true);
            expect(mockMain.init).toHaveBeenCalled();

            // Wait for promise to resolve
            await initPromise;
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(window.jwtComponentsRegistered).toBe(true);
            expect(window.jwtInitializationInProgress).toBe(false);
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Initialization complete'
            );
        });

        it('should handle failed initialization with Promise rejection', async () => {
            const error = new Error('Init failed');
            const initPromise = Promise.reject(error);
            mockMain.init.mockReturnValue(initPromise);

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            // Wait for promise to reject
            try {
                await initPromise;
            } catch (e) {
                // Expected
            }
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(window.jwtInitializationInProgress).toBe(false);
            expect(window.jwtComponentsRegistered).toBeUndefined();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Initialization failed',
                error
            );
        });

        it('should handle non-Promise initialization result', () => {
            mockMain.init.mockReturnValue('success');

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(window.jwtComponentsRegistered).toBe(true);
            expect(window.jwtInitializationInProgress).toBe(false);
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Initialization complete (non-Promise result)'
            );
        });

        it('should handle missing main module', () => {
            jest.doMock('js/main', () => null, { virtual: true });

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(window.jwtInitializationInProgress).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function'
            );
        });

        it('should handle main module without init function', () => {
            jest.doMock('js/main', () => ({ someOtherMethod: jest.fn() }), { virtual: true });

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(window.jwtInitializationInProgress).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Main module not available or missing init function'
            );
        });

        it('should handle require error', () => {
            jest.doMock('js/main', () => {
                throw new Error('Module not found');
            }, { virtual: true });

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(window.jwtInitializationInProgress).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Error during initialization',
                expect.any(Error)
            );
        });
    });

    describe('Loading Indicator Handling', () => {
        it('should hide loading indicators by id', () => {
            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(mockLoadingIndicator.style.display).toBe('none');
            expect(window.jwtLoadingIndicatorHidden).toBe(true);
        });

        it('should hide multiple loading indicators', () => {
            // Add more loading indicators
            const indicator2 = document.createElement('div');
            indicator2.className = 'loading-indicator';
            indicator2.style.display = 'block';
            document.body.appendChild(indicator2);

            const indicator3 = document.createElement('div');
            indicator3.id = 'custom-loading-spinner';
            indicator3.style.display = 'block';
            document.body.appendChild(indicator3);

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(mockLoadingIndicator.style.display).toBe('none');
            expect(indicator2.style.display).toBe('none');
            expect(indicator3.style.display).toBe('none');
            expect(window.jwtLoadingIndicatorHidden).toBe(true);
        });

        it('should warn when no loading indicators found', () => {
            // Remove loading indicator
            document.body.removeChild(mockLoadingIndicator);

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(consoleWarnSpy).toHaveBeenCalledWith('No loading indicators found to hide');
            expect(window.jwtLoadingIndicatorHidden).toBeUndefined();
        });

        it('should handle error when hiding loading indicators', () => {
            // Mock querySelectorAll to throw error
            const originalQuerySelectorAll = document.querySelectorAll;
            document.querySelectorAll = jest.fn().mockImplementation((selector) => {
                if (selector.includes('loading')) {
                    throw new Error('QuerySelector error');
                }
                return originalQuerySelectorAll.call(document, selector);
            });

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Error hiding loading indicators',
                expect.any(Error)
            );

            // Restore original
            document.querySelectorAll = originalQuerySelectorAll;
        });
    });

    describe('Edge Cases', () => {
        it('should handle DOMContentLoaded being fired multiple times', () => {
            mockMain.init.mockReturnValue(true);

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded twice
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);
            document.dispatchEvent(event);

            // Should only initialize once
            expect(mockMain.init).toHaveBeenCalledTimes(1);
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Components already registered, skipping initialization'
            );
        });

        it('should handle main.init returning undefined', () => {
            mockMain.init.mockReturnValue(undefined);

            // Load the script
            require('../../main/webapp/js/nf-jwt-validator');

            // Trigger DOMContentLoaded
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);

            expect(window.jwtComponentsRegistered).toBe(true);
            expect(window.jwtInitializationInProgress).toBe(false);
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[DEBUG_LOG] nf-jwt-validator.js: Initialization complete (non-Promise result)'
            );
        });
    });
});
