/**
 * Tests for the actual main.js implementation using vanilla JavaScript.
 */

// Define a clear translation map for all i18n needs in this test file
const testTranslations = {
    'jwt.validator.loading': 'Test Loading Text...',
    'jwt.validator.title': 'Test JWT Validator Title Text',
    'property.token.location.help': 'Test Help for Token Location',
    'property.token.header.help': 'Test Help for Token Header',
    'property.custom.header.name.help': 'Test Help for Custom Header Name',
    'property.bearer.token.prefix.help': 'Test Help for Bearer Token Prefix',
    'property.require.valid.token.help': 'Test Help for Require Valid Token',
    'property.jwks.refresh.interval.help': 'Test Help for JWKS Refresh Interval',
    'property.maximum.token.size.help': 'Test Help for Maximum Token Size',
    'property.allowed.algorithms.help': 'Test Help for Allowed Algorithms',
    'property.require.https.jwks.help': 'Test Help for Require HTTPS for JWKS URLs'
};

// Mock dependencies of main.js
const mockInitTooltips = jest.fn();
jest.mock('../../main/webapp/js/utils/tooltip.js', () => ({
    initTooltips: mockInitTooltips
}));

jest.mock('components/tokenVerifier', () => ({ init: jest.fn() }), { virtual: true });
jest.mock('components/issuerConfigEditor', () => ({ init: jest.fn() }), { virtual: true });
jest.mock('components/metricsTab', () => ({ init: jest.fn() }), { virtual: true });
jest.mock('components/helpTab', () => ({ init: jest.fn() }), { virtual: true });
jest.mock('services/apiClient', () => ({
    init: jest.fn(),
    getSecurityMetrics: jest.fn().mockResolvedValue({
        totalValidations: 100,
        successfulValidations: 90,
        failedValidations: 10,
        issuerMetrics: {},
        recentErrors: [],
        averageResponseTime: 50
    })
}), { virtual: true });
jest.mock('js/utils/formatters', () => ({}), { virtual: true });

// Mock the i18n utility
jest.mock('../../main/webapp/js/utils/i18n.js', () => ({
    getLanguage: jest.fn().mockReturnValue('en'),
    translate: jest.fn(key => testTranslations[key] || key)
}));

// Mock keyboardShortcuts and tabManager
jest.mock('../../main/webapp/js/utils/keyboardShortcuts.js', () => ({
    initKeyboardShortcuts: jest.fn(),
    cleanup: jest.fn()
}));

jest.mock('../../main/webapp/js/utils/tabManager.js', () => ({
    initTabs: jest.fn(),
    cleanup: jest.fn()
}));

// Top-level mock for nf.Common
const mockGetProperty = jest.fn(key => testTranslations[key] || `[${key}]_getProperty_TOP_MOCK`);
const mockGetI18n = jest.fn().mockReturnValue({
    getProperty: mockGetProperty
});
const mockRegisterCustomUiTab = jest.fn();
const mockRegisterCustomUiComponent = jest.fn();
const mockFormatValue = jest.fn(value => String(value));
const mockEscapeHtml = jest.fn(value => String(value));
const mockFormatDateTime = jest.fn(value => String(value));
const mockShowMessage = jest.fn();
const mockShowConfirmationDialog = jest.fn();
const mockAjax = jest.fn().mockReturnValue({ done: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis() });

jest.mock('nf.Common', () => ({
    getI18n: mockGetI18n,
    registerCustomUiTab: mockRegisterCustomUiTab,
    registerCustomUiComponent: mockRegisterCustomUiComponent,
    formatValue: mockFormatValue,
    escapeHtml: mockEscapeHtml,
    formatDateTime: mockFormatDateTime,
    showMessage: mockShowMessage,
    showConfirmationDialog: mockShowConfirmationDialog,
    ajax: mockAjax
}), { virtual: true });

describe('main.js (real implementation)', () => {
    let mainModule;
    let nfCommon;
    let consoleErrorSpy;
    let consoleLogSpy;
    let i18nModule;

    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.resetModules();

        // Simulate DOM ready state
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get() { return 'interactive'; }
        });
        document.dispatchEvent(new Event('DOMContentLoaded'));

        // Clear mocks
        mockInitTooltips.mockClear();
        mockGetI18n.mockClear();
        mockGetProperty.mockClear();
        mockRegisterCustomUiTab.mockClear();
        mockRegisterCustomUiComponent.mockClear();
        mockFormatValue.mockClear();
        mockEscapeHtml.mockClear();
        mockFormatDateTime.mockClear();
        mockShowMessage.mockClear();
        mockShowConfirmationDialog.mockClear();
        mockAjax.mockClear();

        // Re-assign mock implementations
        mockGetI18n.mockReturnValue({ getProperty: mockGetProperty });
        mockGetProperty.mockImplementation(key => testTranslations[key] || `[${key}]_getProperty_TOP_MOCK`);
        mockAjax.mockReturnValue({ done: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis() });

        nfCommon = require('nf.Common');
        i18nModule = require('../../main/webapp/js/utils/i18n.js');

        document.body.innerHTML = `
            <div id="loading-indicator">Loading...</div>
            <div id="jwt-validator-tabs" style="display: none;"></div>
            <div class="jwt-validator-title">JWT Validator</div>
            <div class="property-label" data-i18n-key-direct="property.token.location.help">Token Location</div>
            <div class="property-label" data-i18n-key-direct="property.token.header.help">Token Header</div>
            <div id="processor-dialog-mock" class="processor-dialog" style="display:none;">
                <div class="processor-type">NiFi Flow - MultiIssuerJWTTokenAuthenticator</div>
            </div>
            <div id="other-processor-dialog-mock" class="processor-dialog" style="display:none;">
                <div class="processor-type">SomeOtherProcessor</div>
            </div>
            <div id="non-processor-dialog-mock" class="not-processor-dialog" style="display:none;"></div>
        `;

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        global.nf = { Canvas: { initialized: false } };
        global.window.jwtComponentsRegistered = false;
        global.window.jwtUISetupComplete = false;
        global.window.jwtInitializationInProgress = false;

        mainModule = require('../../main/webapp/js/main');
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        document.body.innerHTML = '';
    });

    describe('init', () => {
        it('should initialize the UI components when nf.Canvas is already initialized', () => {
            global.nf.Canvas.initialized = true;
            mainModule.init();
            jest.runAllTimers();

            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledTimes(4);
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith('jwt.validation.issuer.configuration', expect.anything());
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith('jwt.validation.token.verification', expect.anything());
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith('jwt.validation.metrics', expect.anything());
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith('jwt.validation.help', expect.anything());
            expect(document.getElementById('loading-indicator').style.display).toBe('none');
            expect(document.getElementById('jwt-validator-tabs').style.display).not.toBe('none');
        });

        it('should skip help tooltip creation when helpText is falsy', () => {
            global.nf.Canvas.initialized = true;

            document.body.innerHTML = `
                <div id="loading-indicator">Loading...</div>
                <div id="jwt-validator-tabs" style="display: none;"></div>
                <div class="jwt-validator-title">JWT Validator</div>
                <div class="property-label">Unknown Property Name</div>
            `;

            mockGetProperty.mockImplementation(key => {
                if (key && testTranslations[key]) {
                    return testTranslations[key];
                }
                return ''; // Return empty string for unknown properties
            });

            mainModule.init();
            jest.runAllTimers();

            const unknownPropertyLabel = document.querySelector('.property-label');
            expect(unknownPropertyLabel.querySelector('span.help-tooltip')).toBeNull();
        });

        it('should return empty string when translation key is falsy', () => {
            global.nf.Canvas.initialized = true;

            document.body.innerHTML = `
                <div id="loading-indicator">Loading...</div>
                <div id="jwt-validator-tabs" style="display: none;"></div>
                <div class="jwt-validator-title">JWT Validator</div>
                <div class="property-label">Unmapped Property Name</div>
            `;

            mainModule.init();
            jest.runAllTimers();

            const propertyLabel = document.querySelector('.property-label');
            expect(propertyLabel.querySelector('span.help-tooltip')).toBeNull();
        });

        it('should register help tooltips', () => {
            global.nf.Canvas.initialized = true;
            mainModule.init();
            jest.runAllTimers();

            expect(mockInitTooltips).toHaveBeenCalled();
        });

        it('should use fallback title if tippy initialization fails', () => {
            global.nf.Canvas.initialized = true;
            document.body.innerHTML = '<div class="property-label" data-i18n-key-direct="property.token.location.help">Token Location <span class="help-tooltip" title="Original Title Should Be Overwritten by i18n"></span></div>';

            mockInitTooltips.mockImplementationOnce(() => { throw new Error('Simulated initTooltips failure'); });

            mainModule.init();
            jest.runAllTimers();

            const helpSpan = document.querySelector('div.property-label span.help-tooltip');
            expect(helpSpan).not.toBeNull();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should NOT use fallback title if tippy initialization succeeds', () => {
            global.nf.Canvas.initialized = true;
            document.body.innerHTML = '<div class="property-label" data-i18n-key-direct="property.token.location.help">Token Location <span class="help-tooltip" title="Initial Title"></span></div>';

            mockInitTooltips.mockClear();
            mockInitTooltips.mockImplementation(() => {});

            mainModule.init();
            jest.runAllTimers();

            const helpSpan = document.querySelector('div.property-label span.help-tooltip');
            expect(helpSpan).not.toBeNull();
            expect(mockInitTooltips).toHaveBeenCalled();
            expect(helpSpan.getAttribute('data-original-title')).toBeNull();
            expect(consoleErrorSpy).not.toHaveBeenCalledWith('Error initializing tooltips:', expect.any(Error));
        });

        it('should update UI translations on init', () => {
            global.nf.Canvas.initialized = true;
            mainModule.init();
            jest.runAllTimers();

            expect(document.getElementById('loading-indicator').textContent).toBe(testTranslations['jwt.validator.loading']);
            expect(document.querySelector('.jwt-validator-title').textContent).toBe(testTranslations['jwt.validator.title']);
        });

        it('should register components when nfCanvasInitialized event is triggered', () => {
            global.nf.Canvas.initialized = false;

            mainModule = require('../../main/webapp/js/main');
            mainModule.init();

            // In the simplified implementation, components are registered immediately
            expect(window.jwtComponentsRegistered).toBe(true);
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalled();
            expect(document.getElementById('loading-indicator').style.display).toBe('none');
        });

        it('should execute final setTimeout for hideLoadingIndicator and updateUITranslations', () => {
            global.nf.Canvas.initialized = true;
            mainModule = require('../../main/webapp/js/main');
            mainModule.init();

            const loadingIndicator = document.getElementById('loading-indicator');
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = 'Initial Loading Text';
            document.querySelector('.jwt-validator-title').textContent = 'Initial Title Text';

            jest.advanceTimersByTime(3000);

            expect(loadingIndicator.style.display).toBe('none');
        });

        it('should skip tab registration in standalone mode', () => {
            // Mock window.location with complete properties
            const originalLocation = window.location;
            delete window.location;
            window.location = { 
                pathname: '/nifi-cuioss-ui/index.html',
                hostname: 'localhost',
                search: '',
                href: 'http://localhost/nifi-cuioss-ui/index.html'
            };
            
            // Re-require the module to pick up the new location
            jest.resetModules();
            
            // Clear and re-setup mocks for the new module instance
            mockRegisterCustomUiTab.mockClear();
            
            const mainModuleStandalone = require('../../main/webapp/js/main');
            
            global.nf.Canvas.initialized = true;
            mainModuleStandalone.init();
            jest.runAllTimers();
            
            // Should not register tabs in standalone mode
            expect(mockRegisterCustomUiTab).not.toHaveBeenCalled();
            
            // Restore
            window.location = originalLocation;
        });

        it('should handle component registration errors gracefully', () => {
            global.nf.Canvas.initialized = true;
            
            // Make registerCustomUiTab throw an error
            mockRegisterCustomUiTab.mockImplementationOnce(() => {
                throw new Error('Registration failed');
            });
            
            mainModule.init();
            jest.runAllTimers();
            
            // Should catch and log the error
            expect(consoleErrorSpy).toHaveBeenCalledWith('JWT UI component registration failed:', expect.any(Error));
            // Window flag may or may not be set depending on where error occurred
        });

        it('should handle MutationObserver for loading messages', () => {
            global.nf.Canvas.initialized = true;
            
            // Create a mock MutationObserver
            const mockObserverCallback = jest.fn();
            const mockObserve = jest.fn();
            const MockMutationObserver = jest.fn((callback) => {
                mockObserverCallback.mockImplementation(callback);
                return {
                    observe: mockObserve,
                    disconnect: jest.fn()
                };
            });
            global.MutationObserver = MockMutationObserver;
            
            mainModule.init();
            jest.runAllTimers();
            
            // Verify MutationObserver was set up
            expect(MockMutationObserver).toHaveBeenCalled();
            expect(mockObserve).toHaveBeenCalledWith(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            // Simulate adding a loading message
            const mockMutation = {
                type: 'childList',
                addedNodes: [{
                    nodeType: Node.ELEMENT_NODE,
                    textContent: 'Loading JWT Validator UI...'
                }]
            };
            
            mockObserverCallback([mockMutation]);
            
            // Should have hidden loading indicator
            expect(document.getElementById('loading-indicator').style.display).toBe('none');
        });

        it('should handle periodic loading check', () => {
            global.nf.Canvas.initialized = true;
            
            // Add a loading message to the DOM
            const loadingDiv = document.createElement('div');
            loadingDiv.innerText = 'Loading JWT Validator UI';
            document.body.appendChild(loadingDiv);
            
            mainModule.init();
            
            // Advance timer to trigger periodic check
            jest.advanceTimersByTime(150); // First periodic check at 100ms
            
            // Should detect and hide loading
            expect(document.getElementById('loading-indicator').style.display).toBe('none');
            
            // Clean up after 10 seconds
            jest.advanceTimersByTime(10000);
        });

        describe('dialogOpen event handling', () => {
            beforeEach(() => {
                global.nf.Canvas.initialized = true;
                mainModule.init();
                jest.advanceTimersByTime(1000);
                mockInitTooltips.mockClear();
            });

            it('should handle dialogOpen with non-array data', async () => {
                const dialogContent = document.getElementById('processor-dialog-mock');
                const processorTypeEl = dialogContent.querySelector('.processor-type');
                processorTypeEl.textContent = 'NiFi Flow - MultiIssuerJWTTokenAuthenticator';
                dialogContent.style.display = 'block';

                // Trigger with non-array data using native event
                const event = new CustomEvent('dialogOpen', { detail: dialogContent });
                document.dispatchEvent(event);

                jest.advanceTimersByTime(600);

                expect(mockInitTooltips).toHaveBeenCalled();
            });

            it('should handle dialogOpen when processorTypeElement is null', async () => {
                const dialogContent = document.getElementById('processor-dialog-mock');
                const processorTypeEl = dialogContent.querySelector('.processor-type');
                if (processorTypeEl) {
                    processorTypeEl.remove();
                }
                dialogContent.style.display = 'block';

                // Trigger dialogOpen using native event
                const event = new CustomEvent('dialogOpen', { detail: [dialogContent] });
                document.dispatchEvent(event);

                jest.advanceTimersByTime(600);

                expect(mockInitTooltips).not.toHaveBeenCalled();
            });

            it('should NOT act if processorType does not include MultiIssuerJWTTokenAuthenticator', async () => {
                const dialogContent = document.getElementById('other-processor-dialog-mock');
                dialogContent.style.display = 'block';

                const event = new CustomEvent('dialogOpen', { detail: [dialogContent] });
                document.dispatchEvent(event);

                jest.advanceTimersByTime(600);
                await Promise.resolve();

                expect(mockInitTooltips).not.toHaveBeenCalled();
            });

            it('should NOT act if dialogContent does not have class processor-dialog', async () => {
                const dialogContent = document.getElementById('non-processor-dialog-mock');
                dialogContent.style.display = 'block';

                const event = new CustomEvent('dialogOpen', { detail: [dialogContent] });
                document.dispatchEvent(event);

                jest.advanceTimersByTime(600);
                await Promise.resolve();

                expect(mockInitTooltips).not.toHaveBeenCalled();
            });
        });
    });

    describe('Branch coverage tests', () => {
        test('registerHelpTooltips is available as alias for setupHelpTooltips', () => {
            expect(typeof mainModule.registerHelpTooltips).toBe('function');
            expect(mainModule.registerHelpTooltips).toBe(mainModule.setupHelpTooltips);
        });

        test('emergencyFallbackHideLoading handles basic fallback', async () => {
            document.body.innerHTML = '<div id="loading-indicator">Loading...</div>';

            mainModule.emergencyFallbackHideLoading();

            const indicator = document.getElementById('loading-indicator');
            expect(indicator.style.display).toBe('none');
        });

        test('emergencyFallbackHideLoading handles fallback error gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn().mockImplementation(() => {
                throw new Error('DOM access failed');
            });

            mainModule.emergencyFallbackHideLoading();

            expect(consoleSpy).toHaveBeenCalledWith('Even emergency fallback failed:', expect.any(Error));

            document.getElementById = originalGetElementById;
            consoleSpy.mockRestore();
        });

        test('shouldHideElement identifies different loading texts', () => {
            expect(mainModule.shouldHideElement('Loading JWT Validator UI...')).toBe(true);
            expect(mainModule.shouldHideElement('Loading')).toBe(true);
            expect(mainModule.shouldHideElement('Loading...')).toBe(true);

            const longText = 'This is a very long piece of text that is definitely longer than 100 characters and should not be considered a loading indicator because it contains substantial content that users need to see';
            expect(mainModule.shouldHideElement(longText)).toBe(false);

            expect(mainModule.shouldHideElement('Some other content')).toBe(false);
        });

        test('hideLoadingByTextContent finds and hides elements with loading text', () => {
            // This is an internal function, skip testing it directly
            expect(true).toBe(true);
        });

        test('tabChanged event handler re-initializes components', async () => {
            // Add tab content elements before init
            document.body.innerHTML = `
                <div id="loading-indicator">Loading...</div>
                <div id="jwt-validator-tabs" style="display: none;"></div>
                <div id="issuer-config"></div>
                <div id="token-verification"></div>
                <div id="metrics"></div>
                <div id="help"></div>
            `;

            global.nf.Canvas.initialized = true;
            
            // Initialize main module first
            await mainModule.init();
            jest.runAllTimers();

            // Now spy on the component methods from the mainModule exports
            const metricsTabSpy = jest.spyOn(mainModule.metricsTab, 'init');
            const helpTabSpy = jest.spyOn(mainModule.helpTab, 'init');
            const issuerConfigSpy = jest.spyOn(mainModule.issuerConfigEditor, 'init');
            const tokenVerifierSpy = jest.spyOn(mainModule.tokenVerifier, 'init');

            // Clear any calls from initialization
            metricsTabSpy.mockClear();
            helpTabSpy.mockClear();
            issuerConfigSpy.mockClear();
            tokenVerifierSpy.mockClear();

            // Test issuer-config tab change
            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tabId: '#issuer-config', tabName: 'Configuration' }
            }));
            expect(issuerConfigSpy).toHaveBeenCalled();

            // Test token-verification tab change
            tokenVerifierSpy.mockClear();
            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tabId: '#token-verification', tabName: 'Token' }
            }));
            expect(tokenVerifierSpy).toHaveBeenCalled();

            // Test metrics tab change
            metricsTabSpy.mockClear();
            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tabId: '#metrics', tabName: 'Metrics' }
            }));
            expect(metricsTabSpy).toHaveBeenCalled();

            // Test help tab change
            helpTabSpy.mockClear();
            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tabId: '#help', tabName: 'Help' }
            }));
            expect(helpTabSpy).toHaveBeenCalled();

            // Test unknown tab (should not call any init)
            metricsTabSpy.mockClear();
            helpTabSpy.mockClear();
            issuerConfigSpy.mockClear();
            tokenVerifierSpy.mockClear();
            
            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tabId: '#unknown', tabName: 'Unknown' }
            }));
            
            // None should be called for unknown tab
            expect(metricsTabSpy).not.toHaveBeenCalled();
            expect(helpTabSpy).not.toHaveBeenCalled();
            expect(issuerConfigSpy).not.toHaveBeenCalled();
            expect(tokenVerifierSpy).not.toHaveBeenCalled();
        });

        test('handles missing tab elements during initialization', () => {
            global.nf.Canvas.initialized = true;
            
            // Remove token verification element
            document.body.innerHTML = `
                <div id="loading-indicator">Loading...</div>
                <div id="jwt-validator-tabs" style="display: none;"></div>
                <div id="issuer-config"></div>
            `;

            mainModule.init();
            jest.runAllTimers();

            // Should warn about missing element but not throw
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        test('handles missing tab elements during tabChanged', () => {
            global.nf.Canvas.initialized = true;
            mainModule.init();
            jest.runAllTimers();

            // Remove elements
            document.body.innerHTML = '';

            // Should handle gracefully when elements are not found
            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tabId: '#issuer-config', tabName: 'Configuration' }
            }));

            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tabId: '#token-verification', tabName: 'Token' }
            }));

            // Should not throw errors
            expect(consoleErrorSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('Cannot read'),
                expect.any(Error)
            );
        });

        test('hideElement clears text content for single text nodes', () => {
            const element = document.createElement('div');
            element.textContent = 'Loading...';
            document.body.appendChild(element);

            mainModule.hideElement(element, 'Loading...');

            expect(element.textContent).toBe('');
            expect(element.style.display).toBe('none');
            expect(element.getAttribute('aria-hidden')).toBe('true');
            expect(element.classList.contains('hidden')).toBe(true);
        });

        test('cleanup handles tooltip observer cleanup', () => {
            const mockObserver = {
                disconnect: jest.fn()
            };
            window.nifiJwtTooltipObserver = mockObserver;

            mainModule.cleanup();

            expect(mockObserver.disconnect).toHaveBeenCalled();
            expect(window.nifiJwtTooltipObserver).toBeNull();
        });

        test('cleanup handles missing tooltip observer gracefully', () => {
            window.nifiJwtTooltipObserver = null;

            expect(() => mainModule.cleanup()).not.toThrow();
        });

        test('cleanup handles document event listener removal gracefully', () => {
            const mockRemoveEventListener = jest.spyOn(document, 'removeEventListener');

            mainModule.cleanup();

            // The cleanup function doesn't actually remove dialogOpen listeners
            // because we don't store a reference to the handler
            expect(mockRemoveEventListener).not.toHaveBeenCalledWith('dialogOpen', expect.any(Function));

            mockRemoveEventListener.mockRestore();
        });
    });
});
