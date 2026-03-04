'use strict';

/**
 * Chip/tag input component for auth-mode selection.
 * Thin wrapper around the generic {@link module:js/chip-input} factory.
 *
 * @module js/auth-mode-chip-input
 */

import { t } from './utils.js';
import { createChipInput } from './chip-input.js';

/** Available auth modes for selection. */
const AUTH_MODES = ['bearer', 'local-only', 'none'];

/** Display labels for each auth mode. */
const AUTH_MODE_DISPLAY = {
    'bearer': 'Bearer',
    'local-only': 'Local Only',
    'none': 'None'
};

/**
 * Create an auth-mode chip input widget inside the given container.
 *
 * @param {object}      opts
 * @param {HTMLElement}  opts.container   parent element to append to
 * @param {number}       opts.idx         unique index for field IDs
 * @param {string}      [opts.value]      initial comma-separated auth modes
 * @param {string}      [opts.helpKey]    i18n key for context-help description
 * @param {string}      [opts.propertyKey] NiFi property key shown in help panel
 * @param {string}      [opts.currentValue] current property value shown in help panel
 * @returns {{ getValue: () => string, destroy: () => void }}
 */
export const createAuthModeChipInput = ({
    container, idx, value,
    helpKey, propertyKey, currentValue
}) => createChipInput({
    container, idx, value,
    config: {
        cssPrefix: 'auth-mode',
        availableValues: AUTH_MODES,
        fieldName: 'auth-mode',
        fieldClass: 'field-auth-mode',
        label: `${t('mgmt.authMode')}:`,
        placeholder: t('chip.authmode.placeholder'),
        ariaLabel: t('chip.authmode.aria'),
        normalize: (v) => v.toLowerCase(),
        displayLabel: (v) => AUTH_MODE_DISPLAY[v] || v,
        removeAriaLabel: (v) =>
            t('chip.authmode.remove.aria', AUTH_MODE_DISPLAY[v] || v),
        isAllowed: (v) => AUTH_MODES.includes(v),
        minSelected: 1,
        dispatchChange: true,
        helpKey,
        propertyKey,
        currentValue
    }
});
