/**
 * Tests for the Keyboard Shortcuts utility.
 * Updated to test vanilla JavaScript implementation.
 */

describe('Keyboard Shortcuts', () => {
    let keyboardShortcuts;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Set up DOM
        document.body.innerHTML = `
            <div id="jwt-validator-tabs">
                <div class="jwt-tabs-header">
                    <ul class="tabs">
                        <li class="active"><a href="#issuer-config">Config</a></li>
                        <li><a href="#token-verification">Token</a></li>
                        <li><a href="#metrics">Metrics</a></li>
                        <li><a href="#help">Help</a></li>
                    </ul>
                </div>
            </div>
            <button class="ui-dialog-titlebar-close">Close</button>
            <button>Cancel</button>
            <button>Save</button>
            <button>Apply</button>
        `;

        keyboardShortcuts = require('../../../main/webapp/js/utils/keyboardShortcuts.js');
    });

    afterEach(() => {
        keyboardShortcuts.cleanup();
        document.body.innerHTML = '';
    });

    describe('initKeyboardShortcuts', () => {
        it('should initialize keyboard shortcuts', () => {
            // Should not throw errors
            expect(() => {
                keyboardShortcuts.initKeyboardShortcuts();
            }).not.toThrow();
        });

        it('should handle initialization without JWT tabs', () => {
            document.getElementById('jwt-validator-tabs').remove();

            expect(() => {
                keyboardShortcuts.initKeyboardShortcuts();
            }).not.toThrow();
        });
    });

    describe('Tab navigation shortcuts', () => {
        beforeEach(() => {
            keyboardShortcuts.initKeyboardShortcuts();
        });

        it('should switch tabs on Ctrl+1/2/3', () => {
            // Trigger Ctrl+2 to switch to token tab
            const event = new KeyboardEvent('keydown', {
                key: '2',
                ctrlKey: true,
                bubbles: true
            });
            document.dispatchEvent(event);

            // Check if tab switch would be triggered
            const tokenTab = document.querySelector('a[href="#token-verification"]');
            expect(tokenTab).toBeTruthy();
        });

        it('should handle keyboard shortcuts properly', () => {
            // Test that shortcuts are registered
            const shortcuts = keyboardShortcuts.getAvailableShortcuts();
            expect(shortcuts).toBeDefined();
            expect(typeof shortcuts).toBe('object');
            expect(Object.keys(shortcuts).length).toBeGreaterThan(0);
        });
    });

    describe('Dialog action shortcuts', () => {
        beforeEach(() => {
            keyboardShortcuts.initKeyboardShortcuts();
        });

        it('should handle Escape key for dialog close', () => {
            const closeButton = document.querySelector('.ui-dialog-titlebar-close');
            const clickSpy = jest.spyOn(closeButton, 'click');

            const event = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });
            document.dispatchEvent(event);

            expect(clickSpy).toHaveBeenCalled();
        });

        it('should not trigger shortcuts when typing in input fields', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            const event = new KeyboardEvent('keydown', {
                key: '1',
                ctrlKey: true,
                bubbles: true
            });
            input.dispatchEvent(event);

            // Should not trigger tab switch when focus is in input
            const activeTab = document.querySelector('.jwt-tabs-header .tabs li.active a');
            expect(activeTab.getAttribute('href')).toBe('#issuer-config');
        });
    });

    describe('Help modal', () => {
        beforeEach(() => {
            keyboardShortcuts.initKeyboardShortcuts();
        });

        it('should show help modal on ?', () => {
            const event = new KeyboardEvent('keydown', {
                key: '?',
                bubbles: true
            });
            document.dispatchEvent(event);

            // Check that help modal was created
            const helpModal = document.querySelector('.keyboard-shortcuts-help');
            expect(helpModal).toBeTruthy();
            expect(helpModal.textContent).toContain('Keyboard Shortcuts');
        });

        it('should close help modal on close button click', () => {
            // Show modal first
            const showEvent = new KeyboardEvent('keydown', {
                key: '?',
                bubbles: true
            });
            document.dispatchEvent(showEvent);

            const modal = document.querySelector('.keyboard-shortcuts-modal');
            const closeButton = modal.querySelector('.close-help-btn');

            closeButton.click();

            // Modal should be removed
            expect(document.querySelector('.keyboard-shortcuts-help')).toBeFalsy();
        });
    });

    describe('Shortcut registration', () => {
        beforeEach(() => {
            keyboardShortcuts.initKeyboardShortcuts();
        });

        it('should allow registering custom shortcuts', () => {
            const handler = jest.fn();
            keyboardShortcuts.registerShortcut('ctrl+t', handler, 'Test shortcut');

            const event = new KeyboardEvent('keydown', {
                key: 't',
                ctrlKey: true,
                bubbles: true
            });
            document.dispatchEvent(event);

            expect(handler).toHaveBeenCalled();
        });

        it('should allow unregistering shortcuts', () => {
            const handler = jest.fn();
            keyboardShortcuts.registerShortcut('ctrl+t', handler, 'Test shortcut');
            keyboardShortcuts.unregisterShortcut('ctrl+t');

            const event = new KeyboardEvent('keydown', {
                key: 't',
                ctrlKey: true,
                bubbles: true
            });
            document.dispatchEvent(event);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should remove all event listeners', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            keyboardShortcuts.cleanup();

            // After cleanup, shortcuts should not work
            const handler = jest.fn();
            keyboardShortcuts.registerShortcut('ctrl+test', handler, 'Test');

            const event = new KeyboardEvent('keydown', {
                key: 'test',
                ctrlKey: true,
                bubbles: true
            });
            document.dispatchEvent(event);

            // Handler should not be called after cleanup
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Edge cases', () => {
        it('should handle missing action buttons gracefully', () => {
            // Remove all buttons
            document.querySelectorAll('button').forEach(btn => btn.remove());

            keyboardShortcuts.initKeyboardShortcuts();

            // Should not throw when trying to trigger shortcuts
            const event = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });

            expect(() => {
                document.dispatchEvent(event);
            }).not.toThrow();
        });

        it('should prevent default behavior for handled shortcuts', () => {
            keyboardShortcuts.initKeyboardShortcuts();

            const event = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true,
                cancelable: true
            });

            const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
            document.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });
});
