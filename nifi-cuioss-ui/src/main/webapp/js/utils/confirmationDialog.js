'use strict';

/**
 * Confirmation dialog utility for destructive actions.
 * Provides consistent confirmation dialogs across the application.
 */
import $ from 'cash-dom';

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
        $('.confirmation-dialog').remove();

        // Create dialog HTML
        const dialogHtml = createDialogHtml(title, message, confirmText, cancelText, type);

        // Add to page
        const $dialog = $(dialogHtml);
        $('body').append($dialog);

        // Set up event handlers
        setupDialogEventHandlers($dialog, resolve, onConfirm, onCancel);

        // Show dialog with animation
        requestAnimationFrame(() => {
            $dialog.addClass('show');
            $dialog.find('.confirm-button').focus();
        });
    });
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
                    <h3 class="dialog-title">${title}</h3>
                </div>
                <div class="dialog-body">
                    <p class="dialog-message">${message}</p>
                </div>
                <div class="dialog-footer">
                    <button class="cancel-button">${cancelText}</button>
                    <button class="confirm-button ${type}-button">${confirmText}</button>
                </div>
            </div>
        </div>
    `;
};

/**
 * Sets up event handlers for the dialog.
 * @param {Object} $dialog - jQuery dialog element
 * @param {Function} resolve - Promise resolve function
 * @param {Function} onConfirm - Confirm callback
 * @param {Function} onCancel - Cancel callback
 */
const setupDialogEventHandlers = ($dialog, resolve, onConfirm, onCancel) => {
    const confirmAction = () => {
        closeDialog($dialog);
        if (onConfirm) onConfirm();
        resolve(true);
    };

    const cancelAction = () => {
        closeDialog($dialog);
        if (onCancel) onCancel();
        resolve(false);
    };

    // Button handlers
    $dialog.find('.confirm-button').on('click', confirmAction);
    $dialog.find('.cancel-button').on('click', cancelAction);

    // Overlay click to cancel
    $dialog.find('.dialog-overlay').on('click', cancelAction);

    // Keyboard handlers
    $dialog.on('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelAction();
        } else if (e.key === 'Enter' && e.target.classList.contains('confirm-button')) {
            e.preventDefault();
            confirmAction();
        }
    });

    // Trap focus within dialog
    trapFocus($dialog);
};

/**
 * Closes and removes the dialog with animation.
 * @param {Object} $dialog - jQuery dialog element
 */
const closeDialog = ($dialog) => {
    $dialog.removeClass('show');
    setTimeout(() => {
        $dialog.remove();
    }, 300);
};

/**
 * Traps focus within the dialog for accessibility.
 * @param {Object} $dialog - jQuery dialog element
 */
const trapFocus = ($dialog) => {
    const focusableElements = $dialog.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements.first();
    const lastElement = focusableElements.last();

    $dialog.on('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement[0]) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement[0]) {
                    e.preventDefault();
                    firstElement.focus();
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
        message: `Are you sure you want to remove the issuer "${issuerName}"? This action cannot be undone.`,
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
