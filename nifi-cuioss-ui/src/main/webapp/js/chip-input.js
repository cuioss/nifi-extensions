'use strict';

/**
 * Generic chip/tag input factory. Creates an autocomplete dropdown with
 * available values and renders selected items as removable chips. The
 * underlying value is a comma-separated string.
 *
 * Domain-specific wrappers (method-chip-input, auth-mode-chip-input)
 * delegate to this factory with their own configuration.
 *
 * @module js/chip-input
 */

import { sanitizeHtml } from './utils.js';
import { createContextHelp } from './context-help.js';

/**
 * @typedef {object} ChipInputConfig
 * @property {string}   cssPrefix       CSS class prefix (e.g. 'method' or 'auth-mode')
 * @property {string[]} availableValues selectable values
 * @property {string}   fieldName       hidden input name attribute
 * @property {string}   fieldClass      hidden input CSS class
 * @property {string}   label           label text (including colon)
 * @property {string}   placeholder     input placeholder
 * @property {string}   ariaLabel       input aria-label
 * @property {(v:string)=>string}  normalize       value normalizer (e.g. toUpperCase)
 * @property {(v:string)=>string}  displayLabel    maps value to display text
 * @property {(v:string)=>string}  removeAriaLabel maps value to remove-button aria-label
 * @property {(v:string)=>boolean} isAllowed       validates whether a typed value is acceptable
 * @property {number}   [minSelected=0] minimum selected items (prevents removing below this)
 * @property {boolean}  [dispatchChange=false] dispatch 'change' event on hidden field
 * @property {string}   [helpKey]       i18n key for context-help description (optional)
 * @property {string}   [propertyKey]   NiFi property key shown in help panel (optional)
 * @property {string}   [currentValue]  current property value shown in help panel (optional)
 */

/**
 * Create a chip input widget inside the given container.
 *
 * @param {object}         opts
 * @param {HTMLElement}    opts.container   parent element to append to
 * @param {number}         opts.idx         unique index for field IDs
 * @param {string}        [opts.value]      initial comma-separated values
 * @param {ChipInputConfig} opts.config    domain-specific configuration
 * @returns {{ getValue: () => string, destroy: () => void }}
 */
export const createChipInput = ({ container, idx, value, config }) => {
    const {
        cssPrefix, availableValues, fieldName, fieldClass,
        label, placeholder, ariaLabel,
        normalize, displayLabel, removeAriaLabel, isAllowed,
        minSelected = 0, dispatchChange = false,
        helpKey, propertyKey, currentValue
    } = config;

    const wrapper = document.createElement('div');
    wrapper.className = `form-field field-container-${cssPrefix}`;
    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', `${cssPrefix}-input-${idx}`);
    labelEl.textContent = label;
    if (helpKey) {
        const { button, panel } = createContextHelp({ helpKey, propertyKey, currentValue });
        labelEl.appendChild(button);
        wrapper.appendChild(labelEl);
        wrapper.appendChild(panel);
    } else {
        wrapper.appendChild(labelEl);
    }

    const chipArea = document.createElement('div');
    chipArea.className = `${cssPrefix}-chip-area`;

    const chipsContainer = document.createElement('div');
    chipsContainer.className = `${cssPrefix}-chips`;

    const inputWrapper = document.createElement('div');
    inputWrapper.className = `${cssPrefix}-input-wrapper`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `${cssPrefix}-input-${idx}`;
    input.className = `${cssPrefix}-chip-text-input`;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', ariaLabel);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-haspopup', 'listbox');

    const dropdown = document.createElement('ul');
    dropdown.className = `${cssPrefix}-dropdown`;
    dropdown.setAttribute('role', 'listbox');
    dropdown.id = `${cssPrefix}-dropdown-${idx}`;
    input.setAttribute('aria-controls', dropdown.id);

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = fieldName;
    hidden.className = fieldClass;

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(dropdown);
    chipArea.appendChild(chipsContainer);
    chipArea.appendChild(inputWrapper);
    wrapper.appendChild(chipArea);
    wrapper.appendChild(hidden);
    container.appendChild(wrapper);

    // -- State --
    const selected = new Set();
    let highlightIndex = -1;

    const syncHidden = () => {
        hidden.value = Array.from(selected).join(',');
        if (dispatchChange) {
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    const addItem = (item) => {
        const normalized = normalize(item.trim());
        if (!normalized || selected.has(normalized)) return;
        if (!isAllowed(normalized)) return;
        selected.add(normalized);
        syncHidden();
        renderChips();
        input.value = '';
        closeDropdown();
        input.focus();
    };

    const removeItem = (item) => {
        if (selected.size <= minSelected) return;
        selected.delete(item);
        syncHidden();
        renderChips();
        input.focus();
    };

    const renderChips = () => {
        chipsContainer.innerHTML = '';
        for (const item of selected) {
            const chip = document.createElement('span');
            chip.className = `${cssPrefix}-chip`;
            chip.setAttribute(`data-${cssPrefix === 'method' ? 'method' : 'mode'}`, item);
            const display = sanitizeHtml(displayLabel(item));
            chip.innerHTML = `${display}<button type="button" `
                + `class="${cssPrefix}-chip-remove" aria-label="${removeAriaLabel(item)}">`
                + '\u00d7</button>';
            chip.querySelector(`.${cssPrefix}-chip-remove`).addEventListener('click', (e) => {
                e.stopPropagation();
                removeItem(item);
            });
            chipsContainer.appendChild(chip);
        }
    };

    // -- Dropdown --
    const getFiltered = () => {
        const filter = normalize(input.value.trim());
        return availableValues.filter((v) => {
            if (selected.has(v)) return false;
            const normalizedV = normalize(v);
            return normalizedV.includes(filter)
                || displayLabel(v).toLowerCase().includes(filter.toLowerCase());
        });
    };

    const renderDropdown = () => {
        const filtered = getFiltered();
        dropdown.innerHTML = '';
        highlightIndex = -1;
        if (filtered.length === 0) {
            closeDropdown();
            return;
        }
        for (const item of filtered) {
            const li = document.createElement('li');
            li.className = `${cssPrefix}-dropdown-item`;
            li.setAttribute('role', 'option');
            li.textContent = displayLabel(item);
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                addItem(item);
            });
            dropdown.appendChild(li);
        }
        dropdown.classList.add('open');
        input.setAttribute('aria-expanded', 'true');
    };

    const closeDropdown = () => {
        dropdown.classList.remove('open');
        dropdown.innerHTML = '';
        input.setAttribute('aria-expanded', 'false');
        highlightIndex = -1;
    };

    const highlightItemAt = (index) => {
        const items = dropdown.querySelectorAll(`.${cssPrefix}-dropdown-item`);
        items.forEach((el) => el.classList.remove('highlighted'));
        if (index >= 0 && index < items.length) {
            items[index].classList.add('highlighted');
            items[index].scrollIntoView?.({ block: 'nearest' });
        }
    };

    // -- Event handlers --
    let blurTimeout = null;
    const onInput = () => renderDropdown();
    const onFocus = () => renderDropdown();
    const onBlur = () => { blurTimeout = setTimeout(closeDropdown, 150); };

    const onKeydown = (e) => {
        const items = dropdown.querySelectorAll(`.${cssPrefix}-dropdown-item`);
        const filtered = getFiltered();
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!dropdown.classList.contains('open')) { renderDropdown(); return; }
                highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
                highlightItemAt(highlightIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                highlightIndex = Math.max(highlightIndex - 1, 0);
                highlightItemAt(highlightIndex);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                    addItem(filtered[highlightIndex]);
                } else if (input.value.trim()) {
                    const typed = normalize(input.value.trim());
                    if (isAllowed(typed)) addItem(typed);
                }
                break;
            case 'Backspace':
                if (!input.value) {
                    const all = Array.from(selected);
                    if (all.length > minSelected) removeItem(all.at(-1));
                }
                break;
            case 'Escape':
                closeDropdown();
                break;
        }
    };

    const onChipAreaClick = (e) => {
        if (e.target === chipArea || e.target === chipsContainer) input.focus();
    };

    input.addEventListener('input', onInput);
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKeydown);
    chipArea.addEventListener('click', onChipAreaClick);

    // -- Init --
    if (value) {
        const items = value.split(',').map((v) => normalize(v.trim())).filter(Boolean);
        for (const item of items) {
            if (isAllowed(item)) selected.add(item);
        }
        syncHidden();
        renderChips();
    }

    return {
        getValue: () => hidden.value,
        destroy: () => {
            if (blurTimeout) clearTimeout(blurTimeout);
            input.removeEventListener('input', onInput);
            input.removeEventListener('focus', onFocus);
            input.removeEventListener('blur', onBlur);
            input.removeEventListener('keydown', onKeydown);
            chipArea.removeEventListener('click', onChipAreaClick);
            wrapper.remove();
        }
    };
};
