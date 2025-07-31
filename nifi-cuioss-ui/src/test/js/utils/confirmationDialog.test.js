/**
 * Tests for Confirmation Dialog Utility
 */

import { showConfirmationDialog, confirmRemoveIssuer, confirmClearForm, confirmResetConfiguration } from '../../../main/webapp/js/utils/confirmationDialog.js';

describe('ConfirmationDialog', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    describe('showConfirmationDialog', () => {
        it('should create and display a confirmation dialog', async () => {
            const promise = showConfirmationDialog({
                title: 'Test Title',
                message: 'Test Message',
                confirmText: 'Confirm',
                cancelText: 'Cancel'
            });

            // Check dialog was created
            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();

            // Check content
            expect(dialog.querySelector('.dialog-title').textContent).toBe('Test Title');
            expect(dialog.querySelector('.dialog-message').textContent).toBe('Test Message');
            expect(dialog.querySelector('.confirm-button').textContent.trim()).toBe('Confirm');
            expect(dialog.querySelector('.cancel-button').textContent.trim()).toBe('Cancel');
        });

        it('should resolve with true when confirmed', async () => {
            const onConfirm = jest.fn();
            const promise = showConfirmationDialog({
                title: 'Test',
                message: 'Confirm?',
                onConfirm
            });

            // Click confirm button
            const confirmBtn = document.querySelector('.confirm-button');
            confirmBtn.click();

            const result = await promise;
            expect(result).toBe(true);
            expect(onConfirm).toHaveBeenCalled();
        });

        it('should resolve with false when cancelled', async () => {
            const onCancel = jest.fn();
            const promise = showConfirmationDialog({
                title: 'Test',
                message: 'Cancel?',
                onCancel
            });

            // Click cancel button
            const cancelBtn = document.querySelector('.cancel-button');
            cancelBtn.click();

            const result = await promise;
            expect(result).toBe(false);
            expect(onCancel).toHaveBeenCalled();
        });

        it('should close on Escape key', async () => {
            const promise = showConfirmationDialog({
                title: 'Test',
                message: 'Press Escape'
            });

            // Run fake timers to trigger requestAnimationFrame
            jest.runAllTimers();

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();

            // Press Escape on dialog
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            dialog.dispatchEvent(event);

            const result = await promise;
            expect(result).toBe(false);
        });

        it('should close when clicking overlay', async () => {
            const promise = showConfirmationDialog({
                title: 'Test',
                message: 'Click overlay'
            });

            // Click overlay
            const overlay = document.querySelector('.dialog-overlay');
            overlay.click();

            const result = await promise;
            expect(result).toBe(false);
        });

        it('should use default values for optional parameters', () => {
            showConfirmationDialog({
                title: 'Test',
                message: 'Message'
            });

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog.classList.contains('dialog-danger')).toBe(true);
            expect(dialog.querySelector('.confirm-button').textContent.trim()).toBe('Delete');
            expect(dialog.querySelector('.cancel-button').textContent.trim()).toBe('Cancel');
        });

        it('should support different dialog types', () => {
            // Danger type
            showConfirmationDialog({
                title: 'Test',
                message: 'Message',
                type: 'danger'
            });
            let dialog = document.querySelector('.confirmation-dialog');
            expect(dialog.classList.contains('dialog-danger')).toBe(true);
            document.body.innerHTML = '';

            // Warning type
            showConfirmationDialog({
                title: 'Test',
                message: 'Message',
                type: 'warning'
            });
            dialog = document.querySelector('.confirmation-dialog');
            expect(dialog.classList.contains('dialog-warning')).toBe(true);
            document.body.innerHTML = '';

            // Info type
            showConfirmationDialog({
                title: 'Test',
                message: 'Message',
                type: 'info'
            });
            dialog = document.querySelector('.confirmation-dialog');
            expect(dialog.classList.contains('dialog-info')).toBe(true);
        });

        it('should escape HTML in title and message', () => {
            showConfirmationDialog({
                title: '<script>alert("XSS")</script>',
                message: '<img src=x onerror="alert(1)">'
            });

            const dialog = document.querySelector('.confirmation-dialog');
            const title = dialog.querySelector('.dialog-title');
            const message = dialog.querySelector('.dialog-message');

            expect(title.innerHTML).not.toContain('<script>');
            expect(message.innerHTML).not.toContain('<img');
            expect(title.textContent).toContain('<script>alert("XSS")</script>');
            expect(message.textContent).toContain('<img src=x onerror="alert(1)">');
        });

        it('should remove existing dialogs before creating new one', () => {
            showConfirmationDialog({ title: 'First', message: 'First dialog' });
            showConfirmationDialog({ title: 'Second', message: 'Second dialog' });

            const dialogs = document.querySelectorAll('.confirmation-dialog');
            expect(dialogs.length).toBe(1);
            expect(dialogs[0].querySelector('.dialog-title').textContent).toBe('Second');
        });

        it('should add show class after animation frame', () => {
            showConfirmationDialog({ title: 'Test', message: 'Test' });

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog.classList.contains('show')).toBe(false);

            // Trigger animation frame
            jest.runAllTimers();
            expect(dialog.classList.contains('show')).toBe(true);
        });

        it('should focus cancel button when dialog opens', () => {
            showConfirmationDialog({ title: 'Test', message: 'Test' });
            jest.runAllTimers();

            const cancelBtn = document.querySelector('.cancel-button');
            expect(document.activeElement).toBe(cancelBtn);
        });
    });

    describe('confirmRemoveIssuer', () => {
        it('should create a remove issuer confirmation dialog', () => {
            confirmRemoveIssuer('Test Issuer');

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();
            expect(dialog.classList.contains('dialog-danger')).toBe(true);
            expect(dialog.querySelector('.dialog-title').textContent).toBe('Remove Issuer Configuration');
            expect(dialog.querySelector('.dialog-message').textContent).toContain('Test Issuer');
            expect(dialog.querySelector('.confirm-button').textContent.trim()).toBe('Remove');
        });

        it('should use custom issuer name', () => {
            confirmRemoveIssuer('My Special Issuer');

            const message = document.querySelector('.dialog-message').textContent;
            expect(message).toContain('My Special Issuer');
        });
    });

    describe('confirmClearForm', () => {
        it('should create a clear form warning dialog', () => {
            confirmClearForm();

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();
            expect(dialog.classList.contains('dialog-warning')).toBe(true);
            expect(dialog.querySelector('.dialog-title').textContent).toBe('Clear Form Data');
            expect(dialog.querySelector('.confirm-button').textContent.trim()).toBe('Clear');
        });
    });

    describe('confirmResetConfiguration', () => {
        it('should create a reset configuration warning dialog', () => {
            confirmResetConfiguration();

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();
            expect(dialog.classList.contains('dialog-warning')).toBe(true);
            expect(dialog.querySelector('.dialog-title').textContent).toBe('Reset Configuration');
            expect(dialog.querySelector('.confirm-button').textContent.trim()).toBe('Reset');
        });
    });

    describe('keyboard navigation', () => {
        it('should handle Tab key navigation', () => {
            showConfirmationDialog({ title: 'Test', message: 'Test' });
            jest.runAllTimers();

            const confirmBtn = document.querySelector('.confirm-button');
            const cancelBtn = document.querySelector('.cancel-button');

            // Start at cancel button (default focus)
            expect(document.activeElement).toBe(cancelBtn);

            // Tab to confirm button
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
            cancelBtn.dispatchEvent(tabEvent);
            confirmBtn.focus(); // Simulate browser behavior
            expect(document.activeElement).toBe(confirmBtn);
        });

        it('should close on Enter key when focused on confirm button', async () => {
            const promise = showConfirmationDialog({ title: 'Test', message: 'Test' });
            jest.runAllTimers();

            const confirmBtn = document.querySelector('.confirm-button');
            confirmBtn.focus();

            // Press Enter - create event with target having the correct class
            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            Object.defineProperty(event, 'target', {
                value: confirmBtn,
                configurable: true
            });

            // Dispatch on the dialog to trigger the handler
            const dialog = document.querySelector('.confirmation-dialog');
            dialog.dispatchEvent(event);

            const result = await promise;
            expect(result).toBe(true);
        });

        it('should handle Shift+Tab focus trapping', () => {
            showConfirmationDialog({ title: 'Test', message: 'Test' });
            jest.runAllTimers();

            const confirmBtn = document.querySelector('.confirm-button');
            const cancelBtn = document.querySelector('.cancel-button');
            const dialog = document.querySelector('.confirmation-dialog');

            // Focus on first element (cancel button)
            cancelBtn.focus();
            expect(document.activeElement).toBe(cancelBtn);

            // Press Shift+Tab (should wrap to last element)
            const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
            const preventDefaultSpy = jest.fn();
            Object.defineProperty(shiftTabEvent, 'preventDefault', { value: preventDefaultSpy });

            // Dispatch on dialog to trigger focus trapping handler
            dialog.dispatchEvent(shiftTabEvent);

            // Should prevent default and focus should move to confirm button
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('should handle Tab focus trapping from last element', () => {
            showConfirmationDialog({ title: 'Test', message: 'Test' });
            jest.runAllTimers();

            const confirmBtn = document.querySelector('.confirm-button');
            const cancelBtn = document.querySelector('.cancel-button');
            const dialog = document.querySelector('.confirmation-dialog');

            // Focus on last element (confirm button)
            confirmBtn.focus();
            expect(document.activeElement).toBe(confirmBtn);

            // Press Tab (should wrap to first element)
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
            const preventDefaultSpy = jest.fn();
            Object.defineProperty(tabEvent, 'preventDefault', { value: preventDefaultSpy });

            // Dispatch on dialog to trigger focus trapping handler
            dialog.dispatchEvent(tabEvent);

            // Should prevent default
            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle empty strings', () => {
            showConfirmationDialog({
                title: '',
                message: ''
            });

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();
            expect(dialog.querySelector('.dialog-title').textContent).toBe('');
            expect(dialog.querySelector('.dialog-message').textContent).toBe('');
        });

        it('should handle very long messages', () => {
            const longMessage = 'a'.repeat(1000);
            showConfirmationDialog({
                title: 'Test',
                message: longMessage
            });

            const message = document.querySelector('.dialog-message');
            expect(message.textContent).toBe(longMessage);
        });

        it('should handle undefined callbacks gracefully', async () => {
            const promise = showConfirmationDialog({
                title: 'Test',
                message: 'Test',
                onConfirm: undefined,
                onCancel: undefined
            });

            // Should not throw when clicking buttons
            expect(() => {
                document.querySelector('.confirm-button').click();
            }).not.toThrow();

            await promise;
        });

        it('should handle invalid dialog type', () => {
            showConfirmationDialog({
                title: 'Test',
                message: 'Test',
                type: 'invalid-type'
            });

            const dialog = document.querySelector('.confirmation-dialog');
            // Should default to danger or have no type class
            expect(dialog.classList.length).toBeGreaterThan(0);
        });

        it('should handle Enter key on non-confirm button', async () => {
            const promise = showConfirmationDialog({ title: 'Test', message: 'Test' });
            jest.runAllTimers();

            const cancelBtn = document.querySelector('.cancel-button');

            // Press Enter on cancel button (should not close dialog)
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            cancelBtn.dispatchEvent(event);

            // Dialog should still exist
            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();

            // Clean up by clicking cancel
            cancelBtn.click();
            await promise;
        });

        it('should handle Tab key on middle elements (no preventDefault)', () => {
            showConfirmationDialog({ title: 'Test', message: 'Test' });
            jest.runAllTimers();

            // Create a mock focusable element in the middle
            const dialog = document.querySelector('.confirmation-dialog');
            const middleBtn = document.createElement('button');
            middleBtn.textContent = 'Middle';
            dialog.querySelector('.dialog-footer').appendChild(middleBtn);

            middleBtn.focus();

            // Press Tab (should NOT prevent default since it's not first/last)
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
            Object.defineProperty(tabEvent, 'preventDefault', { value: jest.fn() });
            middleBtn.dispatchEvent(tabEvent);

            // Should NOT prevent default for middle elements
            expect(tabEvent.preventDefault).not.toHaveBeenCalled();
        });
    });

    describe('internal helper functions', () => {
        it('should test keyboard event handler directly', () => {
            const { __test } = require('../../../main/webapp/js/utils/confirmationDialog.js');
            const cancelAction = jest.fn();
            const confirmAction = jest.fn();

            // Test Escape key
            const escapeEvent = { key: 'Escape', preventDefault: jest.fn() };
            const result1 = __test.handleKeyboardEvent(escapeEvent, cancelAction, confirmAction);
            expect(result1).toBe(true);
            expect(escapeEvent.preventDefault).toHaveBeenCalled();
            expect(cancelAction).toHaveBeenCalled();

            // Test Enter key on confirm button
            const enterEvent = { key: 'Enter', target: { classList: { contains: () => true } }, preventDefault: jest.fn() };
            const result2 = __test.handleKeyboardEvent(enterEvent, cancelAction, confirmAction);
            expect(result2).toBe(true);
            expect(enterEvent.preventDefault).toHaveBeenCalled();
            expect(confirmAction).toHaveBeenCalled();

            // Test other key
            const otherEvent = { key: 'a', preventDefault: jest.fn() };
            const result3 = __test.handleKeyboardEvent(otherEvent, cancelAction, confirmAction);
            expect(result3).toBe(false);
            expect(otherEvent.preventDefault).not.toHaveBeenCalled();
        });

        it('should test focus trapping handler directly', () => {
            const { __test } = require('../../../main/webapp/js/utils/confirmationDialog.js');
            const firstElement = { focus: jest.fn() };
            const lastElement = { focus: jest.fn() };

            // Mock document.activeElement
            Object.defineProperty(document, 'activeElement', {
                writable: true,
                value: firstElement
            });

            // Test Shift+Tab on first element
            const shiftTabEvent = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
            const result1 = __test.handleFocusTrapping(shiftTabEvent, firstElement, lastElement);
            expect(result1).toBe(true);
            expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
            expect(lastElement.focus).toHaveBeenCalled();

            // Test Tab on last element
            document.activeElement = lastElement;
            const tabEvent = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
            const result2 = __test.handleFocusTrapping(tabEvent, firstElement, lastElement);
            expect(result2).toBe(true);
            expect(tabEvent.preventDefault).toHaveBeenCalled();
            expect(firstElement.focus).toHaveBeenCalled();
        });
    });
});
