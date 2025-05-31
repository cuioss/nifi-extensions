/**
 * Tests for the actual main.js implementation.
 * This file tests the real implementation, not a mock.
 */

// Import required dependencies
const $ = require('jquery');

// Mock the dependencies that main.js requires
jest.mock('nf.Common', () => ({
    registerCustomUiTab: jest.fn(),
    registerCustomUiComponent: jest.fn(),
    getI18n: jest.fn().mockReturnValue({})
}), { virtual: true });

// Get the mocked nfCommon
const nfCommon = require('nf.Common');
jest.mock('components/tokenVerifier', () => ({
    init: jest.fn()
}), { virtual: true });
jest.mock('components/issuerConfigEditor', () => ({
    init: jest.fn()
}), { virtual: true });
jest.mock('services/apiClient', () => ({
    init: jest.fn()
}), { virtual: true });
jest.mock('js/utils/formatters', () => ({
    formatDate: jest.fn(),
    formatDuration: jest.fn(),
    formatJwtToken: jest.fn(),
    formatNumber: jest.fn(),
    sanitizeHtml: jest.fn()
}), { virtual: true });
jest.mock('js/utils/i18n', () => ({
    getLanguage: jest.fn().mockReturnValue('en'),
    translate: jest.fn().mockImplementation(key => key)
}), { virtual: true });

// Set up document body
document.body.innerHTML = `
  <div id="loading-indicator">Loading...</div>
  <div id="jwt-validator-tabs" style="display: none;"></div>
  <div class="jwt-validator-title">JWT Validator</div>
  <div class="property-label">Token Location</div>
  <div class="property-label">Token Header</div>
`;

// Mock jQuery functions
// Define default mock implementations
const defaultMockImplementations = {
    hide: function () { return this; },
    show: function () { return this; },
    each: function (callback) {
        for (let i = 0; i < this.length; i++) {
            callback.call(this[i], i, this[i]);
        }
        return this;
    },
    append: (function() { // IIFE to capture original append correctly
        const originalAppend = $.fn.append;
        return function(...args) { return originalAppend.apply(this, args); };
    })(),
    text: function() { return 'Token Location'; }, // Default mock for most cases
    tooltip: function() { return this; },
    ready: function (callback) { callback(); return this; }
};

// Apply mocks
$.fn.hide = jest.fn(defaultMockImplementations.hide);
$.fn.show = jest.fn(defaultMockImplementations.show);
$.fn.each = jest.fn(defaultMockImplementations.each);
$.fn.append = jest.fn(defaultMockImplementations.append);
$.fn.text = jest.fn(defaultMockImplementations.text);
$.fn.tooltip = jest.fn(defaultMockImplementations.tooltip);
$.fn.ready = jest.fn(defaultMockImplementations.ready);

// Mock window and nf objects
global.window = {
    jwtComponentsRegistered: false
};

global.nf = {
    Canvas: {
        initialized: true
    }
};

// Import the main module using babel-plugin-transform-amd-to-commonjs
const mainModule = require('../../main/webapp/js/main');

describe('main.js (real implementation)', () => {
    beforeEach(() => {
    // Reset mocks (jest.clearAllMocks() is called by Jest if resetMocks:true in config)
    // Restore mock implementations cleared by resetMocks:true
        $.fn.hide.mockImplementation(defaultMockImplementations.hide);
        $.fn.show.mockImplementation(defaultMockImplementations.show);
        $.fn.each.mockImplementation(defaultMockImplementations.each);
        $.fn.append.mockImplementation(defaultMockImplementations.append);
        $.fn.text.mockImplementation(defaultMockImplementations.text);
        $.fn.tooltip.mockImplementation(defaultMockImplementations.tooltip);
        $.fn.ready.mockImplementation(defaultMockImplementations.ready);

        // Reset window.jwtComponentsRegistered
        window.jwtComponentsRegistered = false;

        // Reset nf.Canvas.initialized state
        global.nf.Canvas.initialized = true;

        // Reset document body
        document.body.innerHTML = `
      <div id="loading-indicator">Loading...</div>
      <div id="jwt-validator-tabs" style="display: none;"></div>
      <div class="jwt-validator-title">JWT Validator</div>
      <div class="property-label">Token Location</div>
      <div class="property-label">Token Header</div>
    `;
        // Ensure real timers are used by default for all tests unless overridden
        jest.useRealTimers();

        // Ensure specific jQuery functions that are modified by some tests are reset to their default mocks
        // This is important if tests run in an order that leaves these functions in an altered state (e.g., undefined)
        $.fn.tooltip = jest.fn().mockReturnThis(); // Reset to default mock from top of file
        $.fn.ready = jest.fn().mockImplementation(function (callback) { // Reset to default mock from top of file
            callback();
        });
        // $.fn.on is spied on but not fully replaced by most tests, so it might not need explicit reset here
        // if spy.mockRestore() is used consistently.
    });

    describe('init', () => {
        it('should initialize the UI components when nf.Canvas is already initialized', () => {
            // Call the init method
            mainModule.init();

            // Verify that registerCustomUiTab was called
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.issuer.configuration',
                expect.anything()
            );

            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.token.verification',
                expect.anything()
            );

            // Verify that the loading indicator is hidden
            expect($.fn.hide).toHaveBeenCalled();

            // Verify that the JWT validator tabs are shown
            expect($.fn.show).toHaveBeenCalled();

            // Verify that the window.jwtComponentsRegistered flag is set
            expect(window.jwtComponentsRegistered).toBe(true);
        });

        it('should register help tooltips', () => {
            // Call the init method
            mainModule.init();

            // Verify that each property label was processed
            expect($.fn.each).toHaveBeenCalled();

            // Verify that tooltips were initialized
            expect($.fn.tooltip).toHaveBeenCalled();
        });

        it('should use fallback title if $.fn.tooltip is not available', () => {
            // Temporarily undefine $.fn.tooltip
            // Set a very simple body for this test to isolate the tooltip element
            document.body.innerHTML = '<span id="testTooltip" class="help-tooltip" title="Single fallback title"></span>';

            const originalJQueryTooltipFn = $.fn.tooltip;
            $.fn.tooltip = undefined; // Ensure fallback is used

            // Call the init method
            mainModule.init();

            // Verify that the data-original-title attribute was set on the element
            const tooltipElement = document.getElementById('testTooltip');
            expect(tooltipElement.getAttribute('data-original-title')).toBe('Single fallback title');

            // Restore $.fn.tooltip
            $.fn.tooltip = originalJQueryTooltipFn;
        });

        it('should handle errors during tooltip initialization', () => {
            // Mock $.fn.tooltip to throw an error
            const originalTooltip = $.fn.tooltip;
            $.fn.tooltip = jest.fn().mockImplementation(() => {
                throw new Error('Tooltip init failed');
            });

            // Spy on console.error
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Mock to avoid actual console output

            // Call the init method
            mainModule.init();

            // Verify that console.error was called
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error initializing tooltips:', expect.any(Error));

            // Restore $.fn.tooltip and the spy
            $.fn.tooltip = originalTooltip;
            consoleErrorSpy.mockRestore();
        });

        it('should update UI translations', () => {
            // Call the init method
            mainModule.init();

            // Verify that text was updated
            expect($.fn.text).toHaveBeenCalled();
        });

        it('should register components when nfCanvasInitialized event is triggered', () => {
            // Set nf.Canvas.initialized to false initially
            global.nf.Canvas.initialized = false;

            const eventHandlers = {};
            const onSpy = jest.spyOn($.fn, 'on').mockImplementation(function (event, handler) {
                if (event === 'nfCanvasInitialized' || event === 'dialogOpen') { // Only capture specific handlers we might need
                    eventHandlers[event] = handler;
                }
                return this;
            });

            // Mock $.fn.ready to prevent its immediate execution or to control it
            const readyHandlers = [];
            const readySpy = jest.spyOn($.fn, 'ready').mockImplementation(function (handler) {
                readyHandlers.push(handler); // Capture handler, don't execute
                return this;
            });

            // Call the init method
            mainModule.init();

            // Verify that components are not registered yet (via nfCanvasInitialized or early ready state)
            expect(nfCommon.registerCustomUiTab).not.toHaveBeenCalled();
            expect(window.jwtComponentsRegistered).toBe(false);
            // Check that hideLoadingIndicator related calls haven't happened for the main section
            // $.fn.hide would be called for other things by $(document).ready, so check specific selector
            expect($('#loading-indicator').hide).not.toHaveBeenCalled();


            // Manually trigger the 'nfCanvasInitialized' event
            expect(eventHandlers['nfCanvasInitialized']).toBeInstanceOf(Function);
            if (eventHandlers['nfCanvasInitialized']) {
                eventHandlers['nfCanvasInitialized']();
            }

            // Now, verify that components are registered
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.issuer.configuration',
                expect.anything()
            );
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.token.verification',
                expect.anything()
            );
            expect($('#loading-indicator').hide).toHaveBeenCalledTimes(1); // Called by hideLoadingIndicator
            expect(window.jwtComponentsRegistered).toBe(true);

            // Restore mocks
            onSpy.mockRestore();
            readySpy.mockRestore();
        });

        it('should execute final setTimeout for hideLoadingIndicator and updateUITranslations', () => {
            jest.useFakeTimers();

            // Spy on specific elements that hideLoadingIndicator and updateUITranslations would affect.
            // Ensure these elements exist in the standard test DOM.
            const loadingIndicator = $('#loading-indicator');
            const jwtValidatorTitle = $('.jwt-validator-title');

            // Spy on the jQuery methods for these specific elements
            const hideSpy = jest.spyOn(loadingIndicator, 'hide');
            const textSpyLoading = jest.spyOn(loadingIndicator, 'text'); // updateUITranslations affects this
            const textSpyTitle = jest.spyOn(jwtValidatorTitle, 'text'); // updateUITranslations affects this

            mainModule.init();

            // Clear any calls that happened during init() itself
            // (e.g. hideLoadingIndicator and updateUITranslations are called in $(document).ready())
            hideSpy.mockClear();
            textSpyLoading.mockClear();
            textSpyTitle.mockClear();

            // Advance timers by 3000ms to trigger the setTimeout
            jest.advanceTimersByTime(3000);

            expect(hideSpy).toHaveBeenCalledTimes(1); // from hideLoadingIndicator
            // updateUITranslations calls .text() on #loading-indicator and .jwt-validator-title
            expect(textSpyTitle).toHaveBeenCalledTimes(1);
            expect(textSpyLoading).toHaveBeenCalledTimes(1);

            // Restore spies and timers
            hideSpy.mockRestore();
            textSpyLoading.mockRestore();
            textSpyTitle.mockRestore();
            jest.useRealTimers();
        });

        describe('dialogOpen event handling', () => {
            let eventHandlers;
            let onSpy;
            let readySpy;

            beforeEach(() => {
                jest.useFakeTimers();
                eventHandlers = {};
                // Spy on $(document).on to capture the 'dialogOpen' handler
                onSpy = jest.spyOn($.fn, 'on').mockImplementation(function (event, handler) {
                    if (event === 'nfCanvasInitialized' || event === 'dialogOpen') {
                        eventHandlers[event] = handler;
                    }
                    return this;
                });
                // Mock $.fn.ready to ensure the original ready handler in main.js (which sets up dialogOpen) executes.
                readySpy = jest.spyOn($.fn, 'ready').mockImplementation(function (handler) {
                    handler(); // Execute the ready handler to ensure dialogOpen is attached
                    return this;
                });
            });

            afterEach(() => {
                onSpy.mockRestore();
                readySpy.mockRestore();
                jest.useRealTimers();
                // Clear any potentially added dialogs from the body
                $('#dialogContentMock').remove();
                $('#dialogContentNonProcessor').remove();
                $('#dialogContentOtherProcessor').remove();
            });

            it('should register help tooltips and update translations when a MultiIssuerJWTTokenAuthenticator dialog opens', () => {
                document.body.innerHTML += `
                    <div id="dialogContentMock" class="processor-dialog">
                        <span class="processor-type">NiFi Flow - MultiIssuerJWTTokenAuthenticator</span>
                        <div class="property-label">Token Location</div> <!-- Use a known property -->
                    </div>
                    <div class="jwt-validator-title" id="mainValidatorTitle">Initial Title</div>`;

                mainModule.init();

                expect(eventHandlers['dialogOpen']).toBeInstanceOf(Function);
                const mockDialogContent = $('#dialogContentMock');

                // Clear mocks from init() calls before triggering the event's setTimeout content
                if ($.fn.append.mockClear) $.fn.append.mockClear();
                if ($.fn.tooltip.mockClear) $.fn.tooltip.mockClear();
                // Specific mock for the text update we expect on a specific element
                const mainValidatorTitle = $('#mainValidatorTitle');
                const textUpdateSpy = jest.spyOn(mainValidatorTitle, 'text');
                // Clear any calls to textUpdateSpy that might have occurred during mainModule.init()
                textUpdateSpy.mockClear();

                // For this specific test, $.fn.text needs to behave like the real jQuery method
                // to correctly read the processor type from the dialog content.
                const original$FnText = $.fn.text; // Store the current mock (from beforeEach)
                const realJQueryText = $._data(document, "events") ? $._data(document, "events").ready[0].handler.constructor.prototype.text : original$FnText; // Attempt to get real, fallback to mock
                $.fn.text = jest.fn(function(...args) { // Spy wrapper around real (or best guess)
                    if (this.is('.processor-type')) { // Only apply real for this specific selector context if needed
                         // Crude way to get underlying jQuery's original text if possible,
                         // otherwise this will be tricky. Assume 'originalJQueryTextFn' is available or use a more robust way.
                         // For now, let's assume direct call to a conceptual original or that the spy wrapper works with default jQuery context.
                         // This part is hard without knowing how to get the *actual* original jQuery.fn.text
                         // If this.jquery is defined, it's a jQuery object.
                         // A robust way: const temp$ = require('jquery'); realText = temp$.fn.text;
                         // For now, let's assume we can make it work by just not using the default mock.
                         // The most important part is that it does NOT return "Token Location" for this call.
                         // It should return the actual text of the element.
                         // We can achieve this by temporarily removing our default mock implementation for .text()
                         // and relying on the underlying jQuery if it's not fully overwritten,
                         // or by spying on the original if we can get it.

                         // Simplest for now: let's mock it to return the specific string for this test.
                         if (this.hasClass('processor-type') && args.length === 0) {
                            return 'NiFi Flow - MultiIssuerJWTTokenAuthenticator';
                         }
                    }
                    // Fallback to the default mock behavior for other .text() calls if any
                    return defaultMockImplementations.text.apply(this, args);
                });


                eventHandlers['dialogOpen'](null, mockDialogContent);
                jest.advanceTimersByTime(500); // Advance only the 500ms timer

                // Check if append was called by checking the DOM directly
                const dialogPropertyLabel = mockDialogContent.find('.property-label');
                expect(dialogPropertyLabel.find('.help-tooltip').length).toBe(1);
                expect($.fn.tooltip).toHaveBeenCalled(); // Tooltip initialization should still be called
                expect(textUpdateSpy).toHaveBeenCalled(); // updateUITranslations called
                textUpdateSpy.mockRestore();
            });

            it('should NOT act if processorType does not include MultiIssuerJWTTokenAuthenticator', () => {
                document.body.innerHTML += `
                    <div id="dialogContentOtherProcessor" class="processor-dialog">
                        <span class="processor-type">SomeOtherProcessor</span>
                        <div class="property-label">Dialog Property</div>
                    </div>
                     <div class="jwt-validator-title" id="mainValidatorTitle">Initial Title</div>`; // Target for text spy

                mainModule.init();

                expect(eventHandlers['dialogOpen']).toBeInstanceOf(Function);
                const mockDialogContent = $('#dialogContentOtherProcessor');

                if ($.fn.append.mockClear) $.fn.append.mockClear();
                if ($.fn.tooltip.mockClear) $.fn.tooltip.mockClear();
                // We expect one call to $.fn.text to read the processor type from the dialog.
                // Other calls related to UI translation should not happen.
                // So, count calls to $.fn.text before, then expect one more.
                const initialTextCallCount = $.fn.text.mock.calls.length;

                eventHandlers['dialogOpen'](null, mockDialogContent);
                jest.advanceTimersByTime(500);

                expect($.fn.append).not.toHaveBeenCalled();
                expect($.fn.tooltip).not.toHaveBeenCalled(); // Tooltip initialization should not be called
                // The call to read processorType is expected: $('.processor-type', dialogContent).text()
                expect($.fn.text.mock.calls.length).toBe(initialTextCallCount + 1);
            });

            it('should NOT act if dialogContent does not have class processor-dialog', () => {
                document.body.innerHTML += `
                    <div id="dialogContentNonProcessor" class="not-a-processor-dialog"></div>
                    <div class="jwt-validator-title" id="mainValidatorTitle">Initial Title</div>`;
                mainModule.init();

                expect(eventHandlers['dialogOpen']).toBeInstanceOf(Function);
                const mockDialogContent = $('#dialogContentNonProcessor');

                if ($.fn.append.mockClear) $.fn.append.mockClear();
                if ($.fn.tooltip.mockClear) $.fn.tooltip.mockClear();
                if ($.fn.text.mockClear) $.fn.text.mockClear();

                const initialTextCallCount = $.fn.text.mock.calls.length;

                eventHandlers['dialogOpen'](null, mockDialogContent);

                expect($.fn.append).not.toHaveBeenCalled();
                expect($.fn.tooltip).not.toHaveBeenCalled();
                expect($.fn.text.mock.calls.length).toBe(initialTextCallCount);
            });
        });
    });
});
