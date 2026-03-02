'use strict';

/**
 * Chip/tag input component for auth-mode selection.
 * Provides an autocomplete dropdown with available auth modes and renders
 * selected modes as removable chips. The underlying value is a
 * comma-separated string compatible with the management endpoint property format.
 *
 * @module js/auth-mode-chip-input
 */

import { sanitizeHtml, t } from './utils.js';

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
 * @returns {{ getValue: () => string, destroy: () => void }}
 */
export const createAuthModeChipInput = ({ container, idx, value }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field field-container-auth-mode';
    wrapper.innerHTML = `<label for="auth-mode-input-${idx}">${t('mgmt.authMode')}:</label>`;

    const chipArea = document.createElement('div');
    chipArea.className = 'auth-mode-chip-area';

    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'auth-mode-chips';

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'auth-mode-input-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `auth-mode-input-${idx}`;
    input.className = 'auth-mode-chip-text-input';
    input.placeholder = t('chip.authmode.placeholder');
    input.setAttribute('aria-label', t('chip.authmode.aria'));
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-haspopup', 'listbox');

    const dropdown = document.createElement('ul');
    dropdown.className = 'auth-mode-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.id = `auth-mode-dropdown-${idx}`;
    input.setAttribute('aria-controls', dropdown.id);

    // Hidden field to hold comma-separated value for form extraction
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'auth-mode';
    hidden.className = 'field-auth-mode';

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
        // Dispatch change event for external listeners
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const addMode = (mode) => {
        const m = mode.trim().toLowerCase();
        if (!m || selected.has(m) || !AUTH_MODES.includes(m)) return;
        selected.add(m);
        syncHidden();
        renderChips();
        input.value = '';
        closeDropdown();
        input.focus();
    };

    const removeMode = (mode) => {
        // Prevent removing the last chip — at least one must be selected
        if (selected.size <= 1) return;
        selected.delete(mode);
        syncHidden();
        renderChips();
        input.focus();
    };

    const renderChips = () => {
        chipsContainer.innerHTML = '';
        for (const m of selected) {
            const chip = document.createElement('span');
            chip.className = 'auth-mode-chip';
            chip.setAttribute('data-mode', m);
            const displayLabel = sanitizeHtml(AUTH_MODE_DISPLAY[m] || m);
            const removeAria = t('chip.authmode.remove.aria', displayLabel);
            chip.innerHTML = `${displayLabel}<button type="button" `
                + `class="auth-mode-chip-remove" aria-label="${removeAria}">`
                + '\u00d7</button>';
            chip.querySelector('.auth-mode-chip-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeMode(m);
            });
            chipsContainer.appendChild(chip);
        }
    };

    // -- Dropdown --
    const getFilteredModes = () => {
        const filter = input.value.trim().toLowerCase();
        return AUTH_MODES.filter((m) => !selected.has(m)
            && (m.includes(filter) || (AUTH_MODE_DISPLAY[m] || '').toLowerCase().includes(filter)));
    };

    const renderDropdown = () => {
        const filtered = getFilteredModes();
        dropdown.innerHTML = '';
        highlightIndex = -1;

        if (filtered.length === 0) {
            closeDropdown();
            return;
        }

        for (let i = 0; i < filtered.length; i++) {
            const li = document.createElement('li');
            li.className = 'auth-mode-dropdown-item';
            li.setAttribute('role', 'option');
            li.textContent = AUTH_MODE_DISPLAY[filtered[i]] || filtered[i];
            li.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevent blur
                addMode(filtered[i]);
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
        const items = dropdown.querySelectorAll('.auth-mode-dropdown-item');
        items.forEach((item) => item.classList.remove('highlighted'));
        if (index >= 0 && index < items.length) {
            items[index].classList.add('highlighted');
            items[index].scrollIntoView?.({ block: 'nearest' });
        }
    };

    // -- Event handlers (named for cleanup) --
    let blurTimeout = null;

    const onInput = () => renderDropdown();

    const onFocus = () => renderDropdown();

    const onBlur = () => {
        // Small delay to allow mousedown on dropdown items
        blurTimeout = setTimeout(closeDropdown, 150);
    };

    const onKeydown = (e) => {
        const items = dropdown.querySelectorAll('.auth-mode-dropdown-item');
        const filtered = getFilteredModes();

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!dropdown.classList.contains('open')) {
                    renderDropdown();
                    return;
                }
                highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
                highlightItem(highlightIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                highlightIndex = Math.max(highlightIndex - 1, 0);
                highlightItem(highlightIndex);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                    addMode(filtered[highlightIndex]);
                } else if (input.value.trim()) {
                    const typed = input.value.trim().toLowerCase();
                    if (AUTH_MODES.includes(typed)) {
                        addMode(typed);
                    }
                }
                break;
            case 'Backspace':
                if (!input.value) {
                    const chips = Array.from(selected);
                    if (chips.length > 1) {
                        removeMode(chips[chips.length - 1]);
                    }
                }
                break;
            case 'Escape':
                closeDropdown();
                break;
        }
    };

    const onChipAreaClick = (e) => {
        if (e.target === chipArea || e.target === chipsContainer) {
            input.focus();
        }
    };

    input.addEventListener('input', onInput);
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKeydown);
    chipArea.addEventListener('click', onChipAreaClick);

    // -- Init --
    if (value) {
        const modes = value.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
        for (const m of modes) {
            if (AUTH_MODES.includes(m)) {
                selected.add(m);
            }
        }
        syncHidden();
        renderChips();
    }

    return {
        /** @returns {string} comma-separated selected auth modes */
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
