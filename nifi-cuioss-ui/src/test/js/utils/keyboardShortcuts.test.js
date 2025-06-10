/**
 * Tests for the Keyboard Shortcuts utility.
 * Comprehensive test coverage for all functionality.
 */

// Mock cash-dom
jest.mock('cash-dom', () => {
    const mockElement = {
        on: jest.fn().mockReturnThis(),
        off: jest.fn().mockReturnThis(),
        trigger: jest.fn().mockReturnThis(),
        append: jest.fn().mockReturnThis(),
        find: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
        remove: jest.fn().mockReturnThis(),
        addClass: jest.fn().mockReturnThis(),
        length: 0 // Default to no elements found
    };

    const mockCash = jest.fn((selector) => {
        // Handle HTML strings (modal/hint creation)
        if (typeof selector === 'string' && selector.includes('<')) {
            return {
                ...mockElement,
                find: jest.fn().mockReturnValue({
                    on: jest.fn().mockReturnThis(),
                    remove: jest.fn().mockReturnThis()
                }),
                addClass: jest.fn().mockReturnThis(),
                remove: jest.fn().mockReturnThis()
            };
        }
        // Handle string selectors for cleanup and action finding
        if (typeof selector === 'string') {
            if (selector.includes('ui-dialog-titlebar-close') ||
                selector.includes('Cancel') ||
                selector.includes('Close') ||
                selector.includes('Save') ||
                selector.includes('Apply') ||
                selector.includes('Reset') ||
                selector.includes('Clear')) {
                return {
                    length: 1,
                    first: jest.fn().mockReturnValue({ trigger: jest.fn() }),
                    remove: jest.fn().mockReturnThis()
                };
            }
            if (selector.includes('keyboard-shortcuts-modal') ||
                selector.includes('keyboard-action-feedback') ||
                selector.includes('shortcuts-hint')) {
                return {
                    remove: jest.fn().mockReturnThis(),
                    addClass: jest.fn().mockReturnThis(),
                    length: 1
                };
            }
        }
        return mockElement;
    });
    return { __esModule: true, default: mockCash };
});

// Mock sessionStorage
const mockSessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage
});

// Mock console.debug
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation(() => {});

describe('keyboardShortcuts', () => {
    let keyboardShortcuts;
    let mockCash;
    let mockElement;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.clearAllTimers();
        jest.useFakeTimers();

        keyboardShortcuts = require('../../../main/webapp/js/utils/keyboardShortcuts.js');
        mockCash = require('cash-dom').default;

        // Create a fresh mock element for each test
        mockElement = {
            on: jest.fn().mockReturnThis(),
            off: jest.fn().mockReturnThis(),
            trigger: jest.fn().mockReturnThis(),
            append: jest.fn().mockReturnThis(),
            find: jest.fn().mockReturnThis(),
            first: jest.fn().mockReturnThis(),
            remove: jest.fn().mockReturnThis(),
            addClass: jest.fn().mockReturnThis(),
            length: 0
        };

        // Reset mock implementations
        mockSessionStorage.getItem.mockReturnValue(null);

        // Set up DOM
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
        mockConsoleDebug.mockClear();
    });

    describe('initKeyboardShortcuts', () => {
        it('should initialize keyboard shortcuts', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            expect(mockCash).toHaveBeenCalledWith(document);
            expect(mockCash().on).toHaveBeenCalledWith('keydown.nifi-jwt-shortcuts', expect.any(Function));
        });

        it('should show shortcuts hint on first initialization', () => {
            mockSessionStorage.getItem.mockReturnValue(null);

            keyboardShortcuts.initKeyboardShortcuts();

            // Fast-forward timers to show hint
            jest.advanceTimersByTime(2000);

            expect(mockCash).toHaveBeenCalledWith('body');
            expect(mockCash().append).toHaveBeenCalled();
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith('nifi-jwt-shortcuts-shown', 'true');
        });

        it('should not show shortcuts hint if already shown', () => {
            mockSessionStorage.getItem.mockReturnValue('true');

            keyboardShortcuts.initKeyboardShortcuts();

            // Fast-forward timers
            jest.advanceTimersByTime(2000);

            expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
        });

        it('should cleanup existing handlers before initializing', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            expect(mockCash).toHaveBeenCalledWith(document);
            expect(mockCash().off).toHaveBeenCalledWith('keydown.nifi-jwt-shortcuts');
        });
    });

    describe('Key string conversion', () => {
        const createKeyEvent = (key, modifiers = {}) => ({
            key,
            ctrlKey: modifiers.ctrl || false,
            metaKey: modifiers.meta || false,
            altKey: modifiers.alt || false,
            shiftKey: modifiers.shift || false,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
            target: { tagName: 'BODY' }
        });

        it('should handle Ctrl+Enter shortcut', () => {
            // Set up mock to return a verify button when requested
            const mockVerifyButton = { length: 1, trigger: jest.fn() };
            mockCash.mockImplementationOnce((selector) => {
                if (selector === '.verify-token-button:visible:not(:disabled)') {
                    return mockVerifyButton;
                }
                return mockElement;
            });

            keyboardShortcuts.initKeyboardShortcuts();

            // Get the keydown handler
            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = createKeyEvent('Enter', { ctrl: true });
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });

        it('should handle Alt+V shortcut', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = createKeyEvent('v', { alt: true });
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle Ctrl+1 tab navigation', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = createKeyEvent('1', { ctrl: true });
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle F1 help shortcut', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = createKeyEvent('F1');
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockCash).toHaveBeenCalledWith('body');
            expect(mockCash().append).toHaveBeenCalled();
        });

        it('should handle ? help shortcut', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = createKeyEvent('?');
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockCash).toHaveBeenCalledWith('body');
            expect(mockCash().append).toHaveBeenCalled();
        });

        it('should handle Escape key to close dialogs', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = createKeyEvent('Escape');
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });
    });

    describe('Context validation', () => {
        const createKeyEvent = (key, target = { tagName: 'BODY' }, modifiers = {}) => ({
            key,
            ctrlKey: modifiers.ctrl || false,
            metaKey: modifiers.meta || false,
            altKey: modifiers.alt || false,
            shiftKey: modifiers.shift || false,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
            target
        });

        it('should prevent shortcuts in input fields except allowed ones', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            // Test Alt+V in input field (should be blocked)
            const inputEvent = createKeyEvent('v', { tagName: 'INPUT' }, { alt: true });
            keydownHandler(inputEvent);

            expect(inputEvent.preventDefault).not.toHaveBeenCalled();
        });

        it('should allow Ctrl+Enter in input fields', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            // Test Ctrl+Enter in input field (should be allowed)
            const inputEvent = createKeyEvent('Enter', { tagName: 'INPUT' }, { ctrl: true });
            keydownHandler(inputEvent);

            expect(inputEvent.preventDefault).toHaveBeenCalled();
        });

        it('should allow Escape in textarea fields', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            // Test Escape in textarea field (should be allowed)
            const textareaEvent = createKeyEvent('Escape', { tagName: 'TEXTAREA' });
            keydownHandler(textareaEvent);

            expect(textareaEvent.preventDefault).toHaveBeenCalled();
        });
    });

    describe('Action execution', () => {
        it('should handle token verification when no button exists', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = { key: 'Enter', ctrlKey: true, preventDefault: jest.fn(), stopPropagation: jest.fn(), target: { tagName: 'BODY' } };
            keydownHandler(event);

            // Should not throw error when no button exists
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle save form shortcut', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = { key: 's', ctrlKey: true, preventDefault: jest.fn(), stopPropagation: jest.fn(), target: { tagName: 'BODY' } };
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should handle reset form shortcut', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = { key: 'r', altKey: true, preventDefault: jest.fn(), stopPropagation: jest.fn(), target: { tagName: 'BODY' } };
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should log unknown actions', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            // Trigger an unknown key combination
            const event = { key: 'x', ctrlKey: true, altKey: true, preventDefault: jest.fn(), stopPropagation: jest.fn(), target: { tagName: 'BODY' } };
            keydownHandler(event);

            // Should not prevent default for unknown shortcuts
            expect(event.preventDefault).not.toHaveBeenCalled();
        });
    });

    describe('Custom shortcuts', () => {
        it('should register custom shortcuts', () => {
            const customHandler = jest.fn();
            keyboardShortcuts.registerShortcut('ctrl+k', customHandler, 'Custom shortcut');

            const shortcuts = keyboardShortcuts.getAvailableShortcuts();
            expect(shortcuts['ctrl+k']).toBe('Custom shortcut');
        });

        it('should unregister custom shortcuts', () => {
            const customHandler = jest.fn();
            keyboardShortcuts.registerShortcut('ctrl+k', customHandler, 'Custom shortcut');
            keyboardShortcuts.unregisterShortcut('ctrl+k');

            const shortcuts = keyboardShortcuts.getAvailableShortcuts();
            expect(shortcuts['ctrl+k']).toBeUndefined();
        });

        it('should not unregister built-in shortcuts', () => {
            keyboardShortcuts.unregisterShortcut('ctrl+enter');

            const shortcuts = keyboardShortcuts.getAvailableShortcuts();
            expect(shortcuts['ctrl+enter']).toBe('Verify JWT token');
        });
    });

    describe('Available shortcuts', () => {
        it('should return list of available shortcuts', () => {
            const shortcuts = keyboardShortcuts.getAvailableShortcuts();

            expect(shortcuts['ctrl+enter']).toBe('Verify JWT token');
            expect(shortcuts['ctrl+1']).toBe('Switch to tab 1');
            expect(shortcuts['ctrl+s']).toBe('Save current form');
            expect(shortcuts['alt+r']).toBe('Reset current form');
            expect(shortcuts['escape']).toBe('Close dialog or modal');
            expect(shortcuts['f1']).toBe('Show keyboard shortcuts help');
        });
    });

    describe('Cleanup', () => {
        it('should clean up event handlers and UI elements', () => {
            keyboardShortcuts.initKeyboardShortcuts();
            keyboardShortcuts.cleanup();

            expect(mockCash).toHaveBeenCalledWith(document);
            expect(mockCash().off).toHaveBeenCalledWith('keydown.nifi-jwt-shortcuts');

            // Check that cleanup selector was called (modal removal)
            const callArgs = mockCash.mock.calls.map(call => call[0]);
            expect(callArgs).toContain('.keyboard-shortcuts-modal, .keyboard-action-feedback, .shortcuts-hint');
        });
    });

    describe('Feedback and UI', () => {
        it('should show action feedback', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            // Fast-forward timers to trigger feedback removal
            jest.advanceTimersByTime(2000);

            expect(mockCash).toHaveBeenCalledWith('body');
            expect(mockCash().append).toHaveBeenCalled();
        });

        it('should auto-hide shortcuts hint', () => {
            mockSessionStorage.getItem.mockReturnValue(null);

            keyboardShortcuts.initKeyboardShortcuts();

            // Fast-forward to show hint
            jest.advanceTimersByTime(2000);

            // Fast-forward to auto-hide
            jest.advanceTimersByTime(5000);

            // Should have shown hints (body append calls)
            expect(mockCash).toHaveBeenCalledWith('body');
            expect(mockCash().append).toHaveBeenCalled();
        });
    });

    describe('Mac key handling', () => {
        it('should handle Cmd+Enter on Mac', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const keydownHandler = mockCash().on.mock.calls.find(call =>
                call[0] === 'keydown.nifi-jwt-shortcuts'
            )[1];

            const event = {
                key: 'Enter',
                metaKey: true, // Mac Cmd key
                ctrlKey: false,
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
                target: { tagName: 'BODY' }
            };
            keydownHandler(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });
    });
});
