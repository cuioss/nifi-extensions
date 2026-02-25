'use strict';

/**
 * Chip/tag input component for HTTP method selection.
 * Provides an autocomplete dropdown with standard HTTP methods and renders
 * selected methods as removable chips. The underlying value is a
 * comma-separated string compatible with the existing route property format.
 *
 * @module js/method-chip-input
 */

import { sanitizeHtml } from './utils.js';

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
export const createMethodChipInput = ({ container, idx, value }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field field-container-methods';
    wrapper.innerHTML = `<label for="method-input-${idx}">Methods:</label>`;

    const chipArea = document.createElement('div');
    chipArea.className = 'method-chip-area';

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'method-chips';

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'method-input-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `method-input-${idx}`;
    input.className = 'method-chip-text-input';
    input.placeholder = 'Type to add method…';
    input.setAttribute('aria-label', 'Add HTTP method');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-haspopup', 'listbox');

    const dropdown = document.createElement('ul');
    dropdown.className = 'method-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.id = `method-dropdown-${idx}`;
    input.setAttribute('aria-controls', dropdown.id);

    // Hidden field to hold comma-separated value for form extraction
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'methods';
    hidden.className = 'field-methods';

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
    };

    const addMethod = (method) => {
        const m = method.trim().toUpperCase();
        if (!m || selected.has(m)) return;
        selected.add(m);
        syncHidden();
        renderChips();
        input.value = '';
        closeDropdown();
        input.focus();
    };

    const removeMethod = (method) => {
        selected.delete(method);
        syncHidden();
        renderChips();
        input.focus();
    };

    const renderChips = () => {
        chipsContainer.innerHTML = '';
        for (const m of selected) {
            const chip = document.createElement('span');
            chip.className = 'method-chip';
            chip.setAttribute('data-method', m);
            chip.innerHTML = `${sanitizeHtml(m)}<button type="button" class="method-chip-remove" aria-label="Remove ${sanitizeHtml(m)}">\u00d7</button>`;
            chip.querySelector('.method-chip-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeMethod(m);
            });
            chipsContainer.appendChild(chip);
        }
    };

    // -- Dropdown --
    const getFilteredMethods = () => {
        const filter = input.value.trim().toUpperCase();
        return HTTP_METHODS.filter((m) => !selected.has(m) && m.includes(filter));
    };

    const renderDropdown = () => {
        const filtered = getFilteredMethods();
        dropdown.innerHTML = '';
        highlightIndex = -1;

        if (filtered.length === 0) {
            closeDropdown();
            return;
        }

        for (let i = 0; i < filtered.length; i++) {
            const li = document.createElement('li');
            li.className = 'method-dropdown-item';
            li.setAttribute('role', 'option');
            li.textContent = filtered[i];
            li.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevent blur
                addMethod(filtered[i]);
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

    const highlightItem = (index) => {
        const items = dropdown.querySelectorAll('.method-dropdown-item');
        items.forEach((item) => item.classList.remove('highlighted'));
        if (index >= 0 && index < items.length) {
            items[index].classList.add('highlighted');
            items[index].scrollIntoView?.({ block: 'nearest' });
        }
    };

    // -- Event handlers --
    input.addEventListener('input', () => {
        renderDropdown();
    });

    input.addEventListener('focus', () => {
        renderDropdown();
    });

    input.addEventListener('blur', () => {
        // Small delay to allow mousedown on dropdown items
        setTimeout(closeDropdown, 150);
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.method-dropdown-item');
        const filtered = getFilteredMethods();

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!dropdown.classList.contains('open')) {
                renderDropdown();
                return;
            }
            highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
            highlightItem(highlightIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightIndex = Math.max(highlightIndex - 1, 0);
            highlightItem(highlightIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                addMethod(filtered[highlightIndex]);
            } else if (input.value.trim()) {
                // Allow adding the typed value if it matches a known method
                const typed = input.value.trim().toUpperCase();
                if (HTTP_METHODS.includes(typed)) {
                    addMethod(typed);
                }
            }
        } else if (e.key === 'Backspace' && !input.value) {
            // Remove last chip on backspace in empty input
            const chips = Array.from(selected);
            if (chips.length > 0) {
                removeMethod(chips[chips.length - 1]);
            }
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });

    // Click on chip area focuses input
    chipArea.addEventListener('click', (e) => {
        if (e.target === chipArea || e.target === chipsContainer) {
            input.focus();
        }
    });

    // -- Init --
    if (value) {
        const methods = value.split(',').map((m) => m.trim().toUpperCase()).filter(Boolean);
        for (const m of methods) {
            selected.add(m);
        }
        syncHidden();
        renderChips();
    }

    return {
        /** @returns {string} comma-separated selected methods */
        getValue: () => hidden.value,
        destroy: () => {
            wrapper.remove();
        }
    };
};
