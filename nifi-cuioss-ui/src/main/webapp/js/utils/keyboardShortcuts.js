'use strict';

/**
 * Keyboard shortcuts utility for NiFi CUIOSS UI components.
 * Provides keyboard navigation and shortcuts for common actions.
 */

/**
 * Map of keyboard shortcuts to actions
 */
const SHORTCUTS = {
    // Token Verifier shortcuts
    'ctrl+enter': 'verify-token',
    'cmd+enter': 'verify-token', // Mac equivalent
    'alt+v': 'verify-token',

    // Tab navigation
    'ctrl+1': 'goto-tab-1',
    'ctrl+2': 'goto-tab-2',
    'ctrl+3': 'goto-tab-3',
    'cmd+1': 'goto-tab-1', // Mac equivalent
    'cmd+2': 'goto-tab-2',
    'cmd+3': 'goto-tab-3',

    // Form shortcuts
    'ctrl+s': 'save-form',
    'cmd+s': 'save-form', // Mac equivalent
    'alt+r': 'reset-form',
    'escape': 'close-dialog',

    // Help
    'f1': 'show-help',
    '?': 'show-help'
};

/**
 * Current keyboard shortcut handlers
 */
const activeHandlers = new Map();

/**
 * Initialize keyboard shortcuts for the application
 */
export const initKeyboardShortcuts = () => {
    // Remove any existing handlers
    cleanup();

    // Add global keydown listener
    document.addEventListener('keydown', handleKeydown);

    // Store handler reference for cleanup
    globalThis.__keyboardShortcutHandler = handleKeydown;

    // Show shortcuts hint
    showShortcutsHint();
};

/**
 * Handle keydown events and trigger appropriate actions
 * @param {Event} event - The keydown event
 */
const handleKeydown = (event) => {
    const key = getKeyString(event);
    const action = SHORTCUTS[key];

    if (action && isValidContext(event)) {
        event.preventDefault();
        event.stopPropagation();
        executeAction(action);
    }
};

/**
 * Convert keyboard event to key string
 * @param {Event} event - The keyboard event
 * @returns {string} Key string (e.g., 'ctrl+enter', 'alt+v')
 */
const getKeyString = (event) => {
    const parts = [];

    // Add modifiers
    if (event.ctrlKey || event.metaKey) {
        parts.push(event.ctrlKey ? 'ctrl' : 'cmd');
    }
    if (event.altKey) {
        parts.push('alt');
    }
    if (event.shiftKey) {
        parts.push('shift');
    }

    // Add main key
    const key = event.key ? event.key.toLowerCase() : '';
    if (key === 'enter') {
        parts.push('enter');
    } else if (key === 'escape') {
        parts.push('escape');
    } else if (key === 'f1') {
        parts.push('f1');
    } else if (key && key.match(/^[a-z0-9?]$/)) {
        parts.push(key);
    }

    return parts.join('+');
};

/**
 * Check if keyboard shortcut should be active in current context
 * @param {Event} event - The keyboard event
 * @returns {boolean} True if shortcut should be active
 */
const isValidContext = (event) => {
    const target = event.target;
    const tagName = target.tagName ? target.tagName.toLowerCase() : '';

    // Don't trigger shortcuts when typing in input fields (except for specific shortcuts)
    if (tagName === 'input' || tagName === 'textarea') {
        const key = getKeyString(event);
        // Allow Ctrl+Enter and Cmd+Enter in text fields for submission
        return key === 'ctrl+enter' || key === 'cmd+enter' || key === 'escape';
    }

    return true;
};

/**
 * Execute the action for a keyboard shortcut
 * @param {string} action - The action to execute
 */
const executeAction = (action) => {
    // Check if it's a custom action
    if (action?.startsWith('custom-')) {
        const customHandler = activeHandlers.get(action);
        if (customHandler && customHandler.handler) {
            customHandler.handler();
            return;
        }
    }

    switch (action) {
        case 'verify-token':
            triggerTokenVerification();
            break;

        case 'goto-tab-1':
        case 'goto-tab-2':
        case 'goto-tab-3':
            switchToTab(parseInt(action.split('-')[2]) - 1);
            break;

        case 'save-form':
            triggerFormSave();
            break;

        case 'reset-form':
            triggerFormReset();
            break;

        case 'close-dialog':
            closeDialog();
            break;

        case 'show-help':
            showHelpDialog();
            break;

        default:
            // eslint-disable-next-line no-console
            console.debug('Unknown keyboard shortcut action:', action);
    }
};

/**
 * Trigger token verification if verify button is available
 */
const triggerTokenVerification = () => {
    const verifyButton = document.querySelector('.verify-token-button:not(:disabled)');
    if (verifyButton && verifyButton.offsetParent !== null) { // Check if visible
        verifyButton.click();
        showActionFeedback('Token verification started');
    }
};

/**
 * Switch to specified tab
 * @param {number} tabIndex - 0-based tab index
 */
const switchToTab = (tabIndex) => {
    const tabs = document.querySelectorAll('.tab-nav-item');
    if (tabs.length > tabIndex) {
        tabs[tabIndex].click();
        showActionFeedback(`Switched to tab ${tabIndex + 1}`);
    }
};

/**
 * Trigger form save if save button is available
 */
const triggerFormSave = () => {
    const buttons = Array.from(document.querySelectorAll('button:not(:disabled)'));
    const saveButton = buttons.find(btn =>
        btn.offsetParent !== null && // Check if visible
        (btn.textContent.includes('Save') || btn.textContent.includes('Apply'))
    );
    if (saveButton) {
        saveButton.click();
        showActionFeedback('Form save triggered');
    }
};

/**
 * Trigger form reset if reset button is available
 */
const triggerFormReset = () => {
    const buttons = Array.from(document.querySelectorAll('button:not(:disabled)'));
    const resetButton = buttons.find(btn =>
        btn.offsetParent !== null && // Check if visible
        (btn.textContent.includes('Reset') || btn.textContent.includes('Clear'))
    );
    if (resetButton) {
        resetButton.click();
        showActionFeedback('Form reset triggered');
    }
};

/**
 * Close dialog or modal if open
 */
const closeDialog = () => {
    // Try to find and click close buttons
    const closeButton = document.querySelector('.ui-dialog-titlebar-close') ||
        Array.from(document.querySelectorAll('button')).find(btn =>
            btn.offsetParent !== null && // Check if visible
            (btn.textContent.includes('Cancel') || btn.textContent.includes('Close'))
        );

    if (closeButton) {
        closeButton.click();
        showActionFeedback('Dialog closed');
    }
};

/**
 * Show help dialog with keyboard shortcuts
 */
const showHelpDialog = () => {
    const helpContent = `
        <div class="keyboard-shortcuts-help">
            <h3>Keyboard Shortcuts</h3>
            <div class="shortcuts-grid">
                <div class="shortcut-group">
                    <h4>Token Verification</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> or <kbd>Alt</kbd>+<kbd>V</kbd>
                        <span>Verify Token</span>
                    </div>
                </div>
                <div class="shortcut-group">
                    <h4>Navigation</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl</kbd>+<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>
                        <span>Switch Tabs</span>
                    </div>
                </div>
                <div class="shortcut-group">
                    <h4>Forms</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl</kbd>+<kbd>S</kbd>
                        <span>Save Form</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Alt</kbd>+<kbd>R</kbd>
                        <span>Reset Form</span>
                    </div>
                </div>
                <div class="shortcut-group">
                    <h4>General</h4>
                    <div class="shortcut-item">
                        <kbd>Esc</kbd>
                        <span>Close Dialog</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>F1</kbd> or <kbd>?</kbd>
                        <span>Show Help</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Create help modal (simplified implementation)
    const modalHtml = `
        <div class="keyboard-shortcuts-modal">
            <div class="modal-overlay"></div>
            <div class="modal-content">
                ${helpContent}
                <button class="close-help-btn">Close</button>
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    const modal = tempDiv.firstElementChild;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-help-btn').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
};

/**
 * Show brief action feedback to user
 * @param {string} message - The feedback message
 */
const showActionFeedback = (message) => {
    // Create feedback toast
    const feedback = document.createElement('div');
    feedback.className = 'keyboard-action-feedback';
    feedback.textContent = message;

    document.body.appendChild(feedback);

    // Auto-remove after 2 seconds
    setTimeout(() => {
        feedback.classList.add('fade-out');
        setTimeout(() => feedback.remove(), 300);
    }, 2000);
};

/**
 * Show hints about available keyboard shortcuts
 */
const showShortcutsHint = () => {
    // Only show once per session
    if (sessionStorage.getItem('nifi-jwt-shortcuts-shown')) {
        return;
    }

    setTimeout(() => {
        const hintHtml = `
            <div class="shortcuts-hint">
                <span>💡 Press <kbd>F1</kbd> or <kbd>?</kbd> for keyboard shortcuts</span>
                <button class="close-hint">×</button>
            </div>
        `;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = hintHtml;
        const hint = tempDiv.firstElementChild;

        document.body.appendChild(hint);
        hint.querySelector('.close-hint').addEventListener('click', () => hint.remove());

        // Auto-hide after 5 seconds
        setTimeout(() => {
            hint.classList.add('fade-out');
            setTimeout(() => hint.remove(), 300);
        }, 5000);

        sessionStorage.setItem('nifi-jwt-shortcuts-shown', 'true');
    }, 2000);
};

/**
 * Register a custom keyboard shortcut handler
 * @param {string} shortcut - The keyboard shortcut (e.g., 'ctrl+k')
 * @param {Function} handler - The handler function
 * @param {string} description - Description of the shortcut
 */
export const registerShortcut = (shortcut, handler, description) => {
    SHORTCUTS[shortcut] = `custom-${Date.now()}`;
    activeHandlers.set(SHORTCUTS[shortcut], { handler, description });
};

/**
 * Unregister a custom keyboard shortcut
 * @param {string} shortcut - The keyboard shortcut to remove
 */
export const unregisterShortcut = (shortcut) => {
    const action = SHORTCUTS[shortcut];
    if (action?.startsWith('custom-')) {
        activeHandlers.delete(action);
        delete SHORTCUTS[shortcut];
    }
};

/**
 * Clean up keyboard shortcut handlers
 */
export const cleanup = () => {
    if (globalThis.__keyboardShortcutHandler) {
        document.removeEventListener('keydown', globalThis.__keyboardShortcutHandler);
        delete globalThis.__keyboardShortcutHandler;
    }
    activeHandlers.clear();
    for (const el of document.querySelectorAll('.keyboard-shortcuts-modal, .keyboard-action-feedback, .shortcuts-hint')) {
        el.remove();
    }
};

/**
 * Get list of available shortcuts for documentation
 * @returns {Object} Map of shortcuts to descriptions
 */
export const getAvailableShortcuts = () => {
    const shortcuts = {};

    for (const [key, action] of Object.entries(SHORTCUTS)) {
        switch (action) {
            case 'verify-token':
                shortcuts[key] = 'Verify JWT token';
                break;
            case 'goto-tab-1':
            case 'goto-tab-2':
            case 'goto-tab-3':
                shortcuts[key] = `Switch to tab ${action.split('-')[2]}`;
                break;
            case 'save-form':
                shortcuts[key] = 'Save current form';
                break;
            case 'reset-form':
                shortcuts[key] = 'Reset current form';
                break;
            case 'close-dialog':
                shortcuts[key] = 'Close dialog or modal';
                break;
            case 'show-help':
                shortcuts[key] = 'Show keyboard shortcuts help';
                break;
            default:
                if (activeHandlers.has(action)) {
                    shortcuts[key] = activeHandlers.get(action)?.description || 'Custom shortcut';
                }
        }
    }

    return shortcuts;
};
