'use strict';

/**
 * Chip/tag input component for HTTP method selection.
 * Thin wrapper around the generic {@link module:js/chip-input} factory.
 *
 * @module js/method-chip-input
 */

import { t } from './utils.js';
import { createChipInput } from './chip-input.js';

/** Standard HTTP methods available for selection. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

/**
 * Create a method chip input widget inside the given container.
 *
 * @param {object}      opts
 * @param {HTMLElement}  opts.container   parent element to append to
 * @param {number}       opts.idx         unique index for field IDs
 * @param {string}      [opts.value]      initial comma-separated methods
 * @returns {{ getValue: () => string, destroy: () => void }}
 */
export const createMethodChipInput = ({ container, idx, value }) =>
    createChipInput({
        container, idx, value,
        config: {
            cssPrefix: 'method',
            availableValues: HTTP_METHODS,
            fieldName: 'methods',
            fieldClass: 'field-methods',
            label: `${t('chip.methods.label')}:`,
            placeholder: t('chip.methods.placeholder'),
            ariaLabel: t('chip.methods.aria'),
            normalize: (v) => v.toUpperCase(),
            displayLabel: (v) => v,
            removeAriaLabel: (v) => t('chip.methods.remove.aria', v),
            isAllowed: (v) => HTTP_METHODS.includes(v),
            minSelected: 0,
            dispatchChange: false
        }
    });
