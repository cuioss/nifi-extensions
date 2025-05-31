/**
 * Tests for the actual main.js implementation.
 * This file tests the real implementation, not a mock.
 */

// Import required dependencies
import $ from 'jquery';
import nfCommon from 'nf.Common'; // nf.Common is mocked via jest.mock below
import * as mainModule from '../../main/webapp/js/main'; // Module under test

// Mock the dependencies that main.js requires
const mockI18nObject = {
    getProperty: jest.fn(key => {
        // console.log(`[TEST_DEBUG] nfCommon.getI18n().getProperty called with key: "${key}"`);
        if (key === 'help.token-location') {
            // console.log('[TEST_DEBUG] Matched "help.token-location", returning tooltip text.');
            return 'This is a tooltip for token location.';
        }
        if (key === 'help.token-header') {
            return 'This is a tooltip for token header.';
        }
        // console.log(`[TEST_DEBUG] Did not match "${key}", returning key itself.`);
        return key;
    })
};

jest.mock('nf.Common', () => ({
    registerCustomUiTab: jest.fn(),
    registerCustomUiComponent: jest.fn(),
    getI18n: jest.fn().mockReturnValue(mockI18nObject)
}), { virtual: true });

// nfCommon is now available here due to jest.mock hoisting

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
const defaultMockImplementations = {
    hide: function () { return this; },
    show: function () { return this; },
    each: function (callback) {
        for (let i = 0; i < this.length; i++) {
            callback.call(this[i], i, this[i]);
        }
        return this;
    },
    append: (function () {
        const originalAppend = $.fn.append;
        return function (...args) { return originalAppend.apply(this, args); };
    })(),
    text: function () { return 'Token Location'; },
    tooltip: function () { return this; },
    ready: function (callback) { callback(); return this; }
};

$.fn.hide = jest.fn(defaultMockImplementations.hide);
$.fn.show = jest.fn(defaultMockImplementations.show);
$.fn.each = jest.fn(defaultMockImplementations.each);

const originalJQueryAppend = (function () {
    const $temp = $();
    return $temp.append.constructor.prototype.append;
})();
defaultMockImplementations.append = originalJQueryAppend;

$.fn.append = jest.fn(function (...args) {
    // const targetHtml = this.prop('outerHTML') ? this.prop('outerHTML') : 'selector ' + this.selector;
    // console.log('[TEST_DEBUG] $.fn.append called on:', targetHtml, 'with args:', JSON.stringify(args));
    return originalJQueryAppend.apply(this, args);
});
$.fn.text = jest.fn(defaultMockImplementations.text);
$.fn.tooltip = jest.fn(defaultMockImplementations.tooltip);
$.fn.ready = jest.fn(defaultMockImplementations.ready);

global.window = {
    jwtComponentsRegistered: false
};

global.nf = {
    Canvas: {
        initialized: true
    }
};

// mainModule is imported at the top

describe('main.js (real implementation)', () => {
    beforeEach(() => {
        $.fn.hide.mockImplementation(defaultMockImplementations.hide);
        $.fn.show.mockImplementation(defaultMockImplementations.show);
        $.fn.each.mockImplementation(defaultMockImplementations.each);
        $.fn.append = jest.fn(function (...args) {
            let targetDescription = 'unknown';
            try {
                targetDescription = this.prop('outerHTML') || this.selector || (this.is ? (this.is(document) ? 'document' : 'unknown_jq_object') : 'unknown_object');
            } catch (e) {
                targetDescription = 'error_getting_description';
            }
            // console.log('[TEST_DEBUG] $.fn.append called on:', targetDescription, 'with args:', JSON.stringify(args));
            return originalJQueryAppend.apply(this, args);
        });
        $.fn.text.mockImplementation(defaultMockImplementations.text);
        $.fn.tooltip.mockImplementation(defaultMockImplementations.tooltip);
        $.fn.ready.mockImplementation(defaultMockImplementations.ready);

        nfCommon.registerCustomUiTab.mockClear();
        nfCommon.registerCustomUiComponent.mockClear();
        nfCommon.getI18n.mockClear();
        mockI18nObject.getProperty.mockClear();

        nfCommon.getI18n.mockReturnValue(mockI18nObject);

        window.jwtComponentsRegistered = false;
        global.nf.Canvas.initialized = true;

        document.body.innerHTML = `
      <div id="loading-indicator">Loading...</div>
      <div id="jwt-validator-tabs" style="display: none;"></div>
      <div class="jwt-validator-title">JWT Validator</div>
      <div class="property-label">Token Location</div>
      <div class="property-label">Token Header</div>
    `;
        jest.useRealTimers();

        $.fn.tooltip = jest.fn().mockReturnThis();
        $.fn.ready = jest.fn().mockImplementation(function (callback) {
            callback();
        });
    });

    describe('init', () => {
        it('should initialize the UI components when nf.Canvas is already initialized', () => {
            mainModule.init();
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.issuer.configuration',
                expect.anything()
            );
            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledWith(
                'jwt.validation.token.verification',
                expect.anything()
            );
            expect($.fn.hide).toHaveBeenCalled();
            expect($.fn.show).toHaveBeenCalled();
            expect(window.jwtComponentsRegistered).toBe(true);
        });

        it('should register help tooltips', () => {
            mainModule.init();
            expect($.fn.each).toHaveBeenCalled();
            expect($.fn.tooltip).toHaveBeenCalled();
        });

        it('should use fallback title if $.fn.tooltip is not available', () => {
            document.body.innerHTML = '<span id="testTooltip" class="help-tooltip" title="Single fallback title"></span>';
            const originalJQueryTooltipFn = $.fn.tooltip;
            $.fn.tooltip = undefined;
            mainModule.init();
            const tooltipElement = document.getElementById('testTooltip');
            expect(tooltipElement.getAttribute('data-original-title')).toBe('Single fallback title');
            $.fn.tooltip = originalJQueryTooltipFn;
        });

        it('should handle errors during tooltip initialization', () => {
            const originalTooltip = $.fn.tooltip;
            $.fn.tooltip = jest.fn().mockImplementation(() => {
                throw new Error('Tooltip init failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mainModule.init();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error initializing tooltips:', expect.any(Error));
            $.fn.tooltip = originalTooltip;
            consoleErrorSpy.mockRestore();
        });

        it('should update UI translations', () => {
            mainModule.init();
            expect($.fn.text).toHaveBeenCalled();
        });

        it('should register components when nfCanvasInitialized event is triggered', () => {
            global.nf.Canvas.initialized = false;
            const eventHandlers = {};
            const onSpy = jest.spyOn($.fn, 'on').mockImplementation(function (event, handler) {
                if (event === 'nfCanvasInitialized' || event === 'dialogOpen') {
                    eventHandlers[event] = handler;
                }
                return this;
            });
            const readySpy = jest.spyOn($.fn, 'ready').mockImplementation(function (handler) {
                // Don't execute handler immediately for this specific test if it causes issues
                return this;
            });

            mainModule.init();

            // Manually trigger $(document).ready() handlers if mainModule.init() itself doesn't.
            // This is a bit of a guess, as the original code relied on $(document).ready implicitly.
            // If mainModule.init() itself sets up $(document).on('nfCanvasInitialized',...), then this might not be needed.
            // For now, let's assume mainModule.init() should be called and it sets things up.

            expect(nfCommon.registerCustomUiTab).not.toHaveBeenCalled();
            expect(window.jwtComponentsRegistered).toBe(false);

            const loadingIndicator = $('#loading-indicator');
            const hideSpy = jest.spyOn(loadingIndicator, 'hide');


            expect(eventHandlers['nfCanvasInitialized']).toBeInstanceOf(Function);
            if (eventHandlers['nfCanvasInitialized']) {
                eventHandlers['nfCanvasInitialized']();
            }

            expect(nfCommon.registerCustomUiTab).toHaveBeenCalledTimes(2); // Called for both tabs
            expect(hideSpy).toHaveBeenCalledTimes(1);
            expect(window.jwtComponentsRegistered).toBe(true);

            onSpy.mockRestore();
            readySpy.mockRestore();
            hideSpy.mockRestore();
        });

        it('should execute final setTimeout for hideLoadingIndicator and updateUITranslations', () => {
            jest.useFakeTimers();
            const loadingIndicatorHideSpy = jest.spyOn($('#loading-indicator'), 'hide');
            const textFnSpy = jest.spyOn($.fn, 'text');
            mainModule.init();
            loadingIndicatorHideSpy.mockClear();
            textFnSpy.mockClear();
            jest.advanceTimersByTime(3000);
            expect(loadingIndicatorHideSpy).toHaveBeenCalledTimes(1);
            let titleCalls = 0;
            let loadingTextCalls = 0;
            textFnSpy.mock.contexts.forEach(context => {
                if (context.is('.jwt-validator-title')) {
                    titleCalls++;
                }
                if (context.is('#loading-indicator')) {
                    loadingTextCalls++;
                }
            });
            expect(titleCalls).toBe(1);
            expect(loadingTextCalls).toBe(1);
            loadingIndicatorHideSpy.mockRestore();
            textFnSpy.mockRestore();
            jest.useRealTimers();
        });

        describe('dialogOpen event handling', () => {
            let eventHandlers;
            let onSpy;
            let readySpy;

            beforeEach(() => {
                jest.useFakeTimers();
                eventHandlers = {};
                onSpy = jest.spyOn($.fn, 'on').mockImplementation(function (event, handler) {
                    if (event === 'nfCanvasInitialized' || event === 'dialogOpen') {
                        eventHandlers[event] = handler;
                    }
                    return this;
                });
                readySpy = jest.spyOn($.fn, 'ready').mockImplementation(function (handler) {
                    handler();
                    return this;
                });
            });

            afterEach(() => {
                onSpy.mockRestore();
                readySpy.mockRestore();
                jest.useRealTimers();
                $('#dialogContentMock').remove();
                $('#dialogContentNonProcessor').remove();
                $('#dialogContentOtherProcessor').remove();
            });

            it.skip('should register help tooltips and update translations when a MultiIssuerJWTTokenAuthenticator dialog opens', () => {
                document.body.innerHTML += `
                    <div id="dialogContentMock" class="processor-dialog">
                        <span class="processor-type">NiFi Flow - MultiIssuerJWTTokenAuthenticator</span>
                        <div class="property-label">Token Location</div>
                    </div>
                    <div class="jwt-validator-title" id="mainValidatorTitle">Initial Title</div>`;

                mainModule.init();

                expect(eventHandlers['dialogOpen']).toBeInstanceOf(Function);
                const mockDialogContent = $('#dialogContentMock');

                if ($.fn.append.mockClear) $.fn.append.mockClear();
                if ($.fn.tooltip.mockClear) $.fn.tooltip.mockClear();
                const mainValidatorTitle = $('#mainValidatorTitle');
                const textUpdateSpy = jest.spyOn(mainValidatorTitle, 'text');
                textUpdateSpy.mockClear();

                const originalFnText = $.fn.text;
                $.fn.text = jest.fn(function () {
                    if (this.hasClass('processor-type')) {
                        return 'NiFi Flow - MultiIssuerJWTTokenAuthenticator';
                    }
                    if (this.hasClass('property-label')) {
                        const element = this.get(0);
                        return (element && element.textContent) ? element.textContent.trim() : '';
                    }
                    return defaultMockImplementations.text.apply(this, arguments);
                });

                if ($.fn.append.mockClear) {
                    $.fn.append.mockClear();
                }

                eventHandlers['dialogOpen'](null, mockDialogContent);
                jest.advanceTimersByTime(500);

                let updatedDialogPropertyLabel = mockDialogContent.find('.property-label');
                // const propertyLabelElement = updatedDialogPropertyLabel.get(0);
                // updatedDialogPropertyLabel = $(propertyLabelElement);

                expect(updatedDialogPropertyLabel.find('span.help-tooltip').length).toBe(1);
                expect($.fn.append).toHaveBeenCalled();
                expect($.fn.tooltip).toHaveBeenCalled();
                expect(textUpdateSpy).toHaveBeenCalled();

                $.fn.text = originalFnText;
                textUpdateSpy.mockRestore();
            });

            it('should NOT act if processorType does not include MultiIssuerJWTTokenAuthenticator', () => {
                document.body.innerHTML += `
                    <div id="dialogContentOtherProcessor" class="processor-dialog">
                        <span class="processor-type">SomeOtherProcessor</span>
                        <div class="property-label">Dialog Property</div>
                    </div>
                     <div class="jwt-validator-title" id="mainValidatorTitle">Initial Title</div>`;

                const originalFnAppend = $.fn.append;
                $.fn.append = jest.fn(originalFnAppend);

                mainModule.init();

                expect(eventHandlers['dialogOpen']).toBeInstanceOf(Function);
                const mockDialogContent = $('#dialogContentOtherProcessor');

                if ($.fn.tooltip.mockClear) $.fn.tooltip.mockClear();
                const initialTextCallCount = $.fn.text.mock ? $.fn.text.mock.calls.length : 0;

                eventHandlers['dialogOpen'](null, mockDialogContent);
                jest.advanceTimersByTime(500);

                expect($.fn.append).not.toHaveBeenCalled();
                expect($.fn.tooltip).not.toHaveBeenCalled();
                const currentTextCallCount = $.fn.text.mock ? $.fn.text.mock.calls.length : 0;
                expect(currentTextCallCount).toBe(initialTextCallCount + 1); // Only processorType read

                $.fn.append = originalFnAppend;
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
                const initialTextCallCount = $.fn.text.mock ? $.fn.text.mock.calls.length : 0;


                eventHandlers['dialogOpen'](null, mockDialogContent);

                expect($.fn.append).not.toHaveBeenCalled();
                expect($.fn.tooltip).not.toHaveBeenCalled();
                const currentTextCallCount = $.fn.text.mock ? $.fn.text.mock.calls.length : 0;
                expect(currentTextCallCount).toBe(initialTextCallCount);
            });
        });
    });
});
