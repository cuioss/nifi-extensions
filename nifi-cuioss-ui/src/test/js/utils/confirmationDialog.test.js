/**
 * Tests for the Confirmation Dialog utility.
 * Updated to test vanilla JavaScript implementation.
 */

// No need to mock cash-dom as it's not used anymore

describe('confirmationDialog', () => {
    let confirmationDialog;
    let originalRAF;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Mock requestAnimationFrame
        originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = (callback) => {
            setTimeout(callback, 0);
            return 1;
        };

        confirmationDialog = require('../../../main/webapp/js/utils/confirmationDialog.js');

        // Set up DOM
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.requestAnimationFrame = originalRAF;
    });

    describe('showConfirmationDialog', () => {
        it('should create and show a confirmation dialog', async () => {
            const options = {
                title: 'Test Title',
                message: 'Test message',
                confirmText: 'Confirm',
                cancelText: 'Cancel',
                type: 'danger'
            };

            const dialogPromise = confirmationDialog.showConfirmationDialog(options);

            // Check dialog was created
            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();

            // Check dialog content
            expect(dialog.textContent).toContain('Test Title');
            expect(dialog.textContent).toContain('Test message');

            // Find buttons
            const confirmButton = dialog.querySelector('.confirm-button');
            const cancelButton = dialog.querySelector('.cancel-button');

            expect(confirmButton).toBeTruthy();
            expect(cancelButton).toBeTruthy();
            expect(confirmButton.textContent).toBe('Confirm');
            expect(cancelButton.textContent).toBe('Cancel');
        });

        it('should resolve to true when confirm button is clicked', async () => {
            const options = {
                title: 'Test',
                message: 'Test',
                onConfirm: jest.fn()
            };

            const dialogPromise = confirmationDialog.showConfirmationDialog(options);

            const dialog = document.querySelector('.confirmation-dialog');
            const confirmButton = dialog.querySelector('.confirm-button');

            confirmButton.click();

            const result = await dialogPromise;
            expect(result).toBe(true);
            expect(options.onConfirm).toHaveBeenCalled();
        });

        it('should resolve to false when cancel button is clicked', async () => {
            const options = {
                title: 'Test',
                message: 'Test',
                onCancel: jest.fn()
            };

            const dialogPromise = confirmationDialog.showConfirmationDialog(options);

            const dialog = document.querySelector('.confirmation-dialog');
            const cancelButton = dialog.querySelector('.cancel-button');

            cancelButton.click();

            const result = await dialogPromise;
            expect(result).toBe(false);
            expect(options.onCancel).toHaveBeenCalled();
        });

        it('should remove existing dialogs before creating new one', () => {
            // Create first dialog
            confirmationDialog.showConfirmationDialog({
                title: 'First',
                message: 'First'
            });

            // Create second dialog
            confirmationDialog.showConfirmationDialog({
                title: 'Second',
                message: 'Second'
            });

            // Should only have one dialog
            const dialogs = document.querySelectorAll('.confirmation-dialog');
            expect(dialogs.length).toBe(1);
            expect(dialogs[0].textContent).toContain('Second');
        });

        it('should handle Escape key to cancel', async () => {
            const options = {
                title: 'Test',
                message: 'Test'
            };

            const dialogPromise = confirmationDialog.showConfirmationDialog(options);

            // Wait for dialog to be added to DOM
            await new Promise(resolve => setTimeout(resolve, 10));

            // Trigger Escape key on the dialog element
            const dialog = document.querySelector('.confirmation-dialog');
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
            dialog.dispatchEvent(escapeEvent);

            const result = await dialogPromise;
            expect(result).toBe(false);
        });

        it('should apply correct type class', () => {
            const types = ['danger', 'warning', 'info'];

            types.forEach(type => {
                confirmationDialog.showConfirmationDialog({
                    title: 'Test',
                    message: 'Test',
                    type: type
                });

                const dialog = document.querySelector('.confirmation-dialog');
                expect(dialog.classList.contains(`dialog-${type}`)).toBe(true);

                // Clean up for next iteration
                dialog.remove();
            });
        });
    });

    describe('confirmDeleteIssuer', () => {
        it('should create a delete issuer confirmation dialog', () => {
            const onConfirm = jest.fn();
            const issuerName = 'TestIssuer';

            confirmationDialog.confirmDeleteIssuer(issuerName, onConfirm);

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();
            expect(dialog.textContent).toContain('Remove Issuer Configuration');
            expect(dialog.textContent).toContain(`remove the issuer "${issuerName}"`);
        });
    });

    describe('confirmClearForm', () => {
        it('should create a clear form confirmation dialog', () => {
            const onConfirm = jest.fn();

            confirmationDialog.confirmClearForm(onConfirm);

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();
            expect(dialog.textContent).toContain('Clear Form Data');
            expect(dialog.textContent).toContain('clear all form data');
        });
    });

    describe('confirmResetConfiguration', () => {
        it('should create a reset configuration confirmation dialog', () => {
            const onConfirm = jest.fn();

            confirmationDialog.confirmResetConfiguration(onConfirm);

            const dialog = document.querySelector('.confirmation-dialog');
            expect(dialog).toBeTruthy();
            expect(dialog.textContent).toContain('Reset Configuration');
            expect(dialog.textContent).toContain('reset all issuer configurations');
        });
    });

    describe('Dialog HTML creation', () => {
        it('should create proper HTML structure', () => {
            const options = {
                title: 'Test Title',
                message: 'Test message with <special> characters',
                confirmText: 'Yes',
                cancelText: 'No',
                type: 'warning'
            };

            confirmationDialog.showConfirmationDialog(options);

            const dialog = document.querySelector('.confirmation-dialog');

            // Check structure
            expect(dialog.querySelector('.dialog-content')).toBeTruthy();
            expect(dialog.querySelector('.dialog-header')).toBeTruthy();
            expect(dialog.querySelector('.dialog-body')).toBeTruthy();
            expect(dialog.querySelector('.dialog-footer')).toBeTruthy();

            // Check classes
            expect(dialog.classList.contains('dialog-warning')).toBe(true);

            // Check button classes
            const confirmButton = dialog.querySelector('.confirm-button');
            expect(confirmButton.classList.contains('warning-button')).toBe(true);
        });
    });

    describe('Focus management', () => {
        it('should focus on cancel button when dialog opens', async () => {
            confirmationDialog.showConfirmationDialog({
                title: 'Test',
                message: 'Test'
            });

            // Wait for next tick since requestAnimationFrame is mocked
            await new Promise(resolve => setTimeout(resolve, 10));

            const cancelButton = document.querySelector('.cancel-button');
            expect(document.activeElement).toBe(cancelButton);
        });
    });

    describe('createDialogHtml', () => {
        it('should escape HTML in title and message', () => {
            const { createDialogHtml } = confirmationDialog;

            const html = createDialogHtml(
                '<script>alert("xss")</script>',
                '<img src="x" onerror="alert(\'xss\')">',
                'OK',
                'Cancel',
                'danger'
            );

            // Check that HTML is escaped
            expect(html).toContain('&lt;script&gt;');
            expect(html).toContain('&lt;img');
            expect(html).not.toContain('<script>');
            expect(html).not.toContain('<img src="x"');
        });
    });
});
