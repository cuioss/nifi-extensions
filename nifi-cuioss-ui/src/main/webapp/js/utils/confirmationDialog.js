'use strict';

/**
 * Confirmation dialog utility for destructive actions.
 *
 * This module provides consistent, accessible confirmation dialogs for potentially
 * destructive actions throughout the application. It creates modal dialogs with
 * customizable messages, buttons, and styling based on the action type.
 *
 * Features:
 * - Promise-based API for async/await usage
 * - Customizable button text and styling
 * - Keyboard navigation and accessibility support
 * - Different visual styles based on action type (danger, warning, info)
 *
 * @fileoverview Confirmation dialog utilities for destructive actions
 * @module utils/confirmationDialog
 */

/**
 * Shows a confirmation dialog for destructive actions.
 * @param {Object} options - Configuration options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Main message text
 * @param {string} [options.confirmText='Delete'] - Text for confirm button
 * @param {string} [options.cancelText='Cancel'] - Text for cancel button
 * @param {string} [options.type='danger'] - Dialog type: 'danger', 'warning', 'info'
 * @param {Function} [options.onConfirm] - Callback when confirmed
 * @param {Function} [options.onCancel] - Callback when cancelled
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export const showConfirmationDialog = (options) => {
    const {
        title,
        message,
        confirmText = 'Delete',
        cancelText = 'Cancel',
        type = 'danger',
        onConfirm,
        onCancel
    } = options;

    return new Promise((resolve) => {
        // Remove any existing confirmation dialogs
        for (const dialog of document.querySelectorAll('.confirmation-dialog')) {
            dialog.remove();
        }

        // Create dialog HTML
        const dialogHtml = createDialogHtml(title, message, confirmText, cancelText, type);

        // Add to page
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = dialogHtml;
        const dialog = tempDiv.firstElementChild;
        document.body.appendChild(dialog);

        // Set up event handlers
        setupDialogEventHandlers(dialog, resolve, onConfirm, onCancel);

        // Show dialog with animation
        requestAnimationFrame(() => {
            dialog.classList.add('show');
            const cancelButton = dialog.querySelector('.cancel-button');
            if (cancelButton) {
                cancelButton.focus();
            }
        });
    });
};

/**
 * Escapes HTML to prevent XSS attacks.
 * @private
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Creates the HTML structure for the confirmation dialog.
 * @param {string} title - Dialog title
 * @param {string} message - Main message
 * @param {string} confirmText - Confirm button text
 * @param {string} cancelText - Cancel button text
 * @param {string} type - Dialog type
 * @returns {string} Dialog HTML
 */
const createDialogHtml = (title, message, confirmText, cancelText, type) => {
    const typeClass = getDialogTypeClass(type);
    const icon = getDialogIcon(type);

    return `
        <div class="confirmation-dialog ${typeClass}">
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <div class="dialog-header">
                    <div class="dialog-icon">${icon}</div>
                    <h3 class="dialog-title">${escapeHtml(title)}</h3>
                </div>
                <div class="dialog-body">
                    <p class="dialog-message">${escapeHtml(message)}</p>
                </div>
                <div class="dialog-footer">
                    <button class="cancel-button">${escapeHtml(cancelText)}</button>
                    <button class="confirm-button ${type}-button">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        </div>
    `;
};

/**
 * Sets up event handlers for the dialog.
 * @param {HTMLElement} dialog - Dialog element
 * @param {Function} resolve - Promise resolve function
 * @param {Function} onConfirm - Confirm callback
 * @param {Function} onCancel - Cancel callback
 */
const setupDialogEventHandlers = (dialog, resolve, onConfirm, onCancel) => {
    const confirmAction = () => {
        closeDialog(dialog);
        if (onConfirm) onConfirm();
        resolve(true);
    };

    const cancelAction = () => {
        closeDialog(dialog);
        if (onCancel) onCancel();
        resolve(false);
    };

    // Button handlers
    const confirmButton = dialog.querySelector('.confirm-button');
    const cancelButton = dialog.querySelector('.cancel-button');
    if (confirmButton) confirmButton.addEventListener('click', confirmAction);
    if (cancelButton) cancelButton.addEventListener('click', cancelAction);

    // Overlay click to cancel
    const overlay = dialog.querySelector('.dialog-overlay');
    if (overlay) overlay.addEventListener('click', cancelAction);

    // Keyboard handlers
    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelAction();
        } else if (e.key === 'Enter' && e.target.classList.contains('confirm-button')) {
            e.preventDefault();
            confirmAction();
        }
    });

    // Trap focus within dialog
    trapFocus(dialog);
};

/**
 * Closes and removes the dialog with animation.
 * @param {HTMLElement} dialog - Dialog element
 */
const closeDialog = (dialog) => {
    dialog.classList.remove('show');
    setTimeout(() => {
        dialog.remove();
    }, 300);
};

/**
 * Traps focus within the dialog for accessibility.
 * @param {HTMLElement} dialog - Dialog element
 */
const trapFocus = (dialog) => {
    const focusableElements = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    if (lastElement) {
                        lastElement.focus();
                    }
                }
            } else {
                // Tab - handle focus for last element or let default behavior work
                const isLastElementActive = document.activeElement === lastElement;
                if (isLastElementActive) {
                    e.preventDefault();
                    if (firstElement) {
                        firstElement.focus();
                    }
                }
            }
        }
    });
};

/**
 * Gets the CSS class for the dialog type.
 * @param {string} type - Dialog type
 * @returns {string} CSS class name
 */
const getDialogTypeClass = (type) => {
    switch (type) {
        case 'danger':
            return 'dialog-danger';
        case 'warning':
            return 'dialog-warning';
        case 'info':
            return 'dialog-info';
        default:
            return 'dialog-danger';
    }
};

/**
 * Gets the icon for the dialog type.
 * @param {string} type - Dialog type
 * @returns {string} Icon HTML
 */
const getDialogIcon = (type) => {
    switch (type) {
        case 'danger':
            return '🗑️';
        case 'warning':
            return '⚠️';
        case 'info':
            return 'ℹ️';
        default:
            return '🗑️';
    }
};

/**
 * Shows a confirmation dialog for removing an issuer.
 * @param {string} issuerName - Name of the issuer to remove
 * @param {Function} onConfirm - Callback when confirmed
 * @returns {Promise<boolean>} Resolves to true if confirmed
 */
export const confirmRemoveIssuer = (issuerName, onConfirm) => {
    return showConfirmationDialog({
        title: 'Remove Issuer Configuration',
        message: `Are you sure you want to remove the issuer "${issuerName}"? ` +
            'This action cannot be undone.',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        type: 'danger',
        onConfirm
    });
};

/**
 * Shows a confirmation dialog for clearing form data.
 * @param {Function} onConfirm - Callback when confirmed
 * @returns {Promise<boolean>} Resolves to true if confirmed
 */
export const confirmClearForm = (onConfirm) => {
    return showConfirmationDialog({
        title: 'Clear Form Data',
        message: 'Are you sure you want to clear all form data? Any unsaved changes will be lost.',
        confirmText: 'Clear',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm
    });
};

/**
 * Shows a confirmation dialog for resetting configuration.
 * @param {Function} onConfirm - Callback when confirmed
 * @returns {Promise<boolean>} Resolves to true if confirmed
 */
export const confirmResetConfiguration = (onConfirm) => {
    return showConfirmationDialog({
        title: 'Reset Configuration',
        message: 'This will reset all issuer configurations to their default values. Are you sure you want to continue?',
        confirmText: 'Reset',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm
    });
};

/**
 * Handles keyboard events for dialog (extracted for testing)
 * @param {KeyboardEvent} e - The keyboard event
 * @param {Function} cancelAction - Function to call on Escape
 * @param {Function} confirmAction - Function to call on Enter (if on confirm button)
 * @returns {boolean} True if event was handled
 */
const _handleKeyboardEvent = (e, cancelAction, confirmAction) => {
    if (e.key === 'Escape') {
        e.preventDefault();
        cancelAction();
        return true;
    } else if (e.key === 'Enter' && e.target.classList.contains('confirm-button')) {
        e.preventDefault();
        confirmAction();
        return true;
    }
    return false;
};

/**
 * Handles focus trapping for accessibility (extracted for testing)
 * @param {KeyboardEvent} e - The keyboard event
 * @param {HTMLElement} firstElement - First focusable element
 * @param {HTMLElement} lastElement - Last focusable element
 * @returns {boolean} True if focus was trapped
 */
const _handleFocusTrapping = (e, firstElement, lastElement) => {
    if (e.key === 'Tab') {
        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                if (lastElement) {
                    lastElement.focus();
                }
                return true;
            }
        } else {
            // Tab - handle focus for last element or let default behavior work
            const isLastElementActive = document.activeElement === lastElement;
            if (isLastElementActive) {
                e.preventDefault();
                if (firstElement) {
                    firstElement.focus();
                }
                return true;
            }
            // Return false to indicate focus was not trapped in this case
            return false;
        }
    }
    return false;
};

// Export internal functions for testing
export const __test = {
    handleKeyboardEvent: _handleKeyboardEvent,
    handleFocusTrapping: _handleFocusTrapping
};

// Export createDialogHtml for testing
export { createDialogHtml };

// Alias for backward compatibility
export const confirmDeleteIssuer = confirmRemoveIssuer;
