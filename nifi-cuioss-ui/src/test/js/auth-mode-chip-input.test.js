'use strict';

/**
 * Tests for auth-mode-chip-input.js — auth mode chip/tag input component.
 */

jest.mock('../../main/webapp/js/utils.js');

import { createAuthModeChipInput } from '../../main/webapp/js/auth-mode-chip-input.js';
import { t, sanitizeHtml } from '../../main/webapp/js/utils.js';

describe('auth-mode-chip-input', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        sanitizeHtml.mockImplementation((s) => s);
        t.mockImplementation((key, ...args) => key);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    // -------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------

    it('should create chip area with label', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        expect(container.querySelector('label')).not.toBeNull();
        expect(container.querySelector('.auth-mode-chip-area')).not.toBeNull();
    });

    it('should create hidden input with class field-auth-mode', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const hidden = container.querySelector('.field-auth-mode');
        expect(hidden).not.toBeNull();
        expect(hidden.type).toBe('hidden');
        expect(hidden.name).toBe('auth-mode');
    });

    it('should render initial chips from comma-separated value', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,local-only' });
        const chips = container.querySelectorAll('.auth-mode-chip');
        expect(chips.length).toBe(2);
        expect(chips[0].dataset.mode).toBe('bearer');
        expect(chips[1].dataset.mode).toBe('local-only');
    });

    it('should set hidden field value from initial modes', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,none' });
        expect(container.querySelector('.field-auth-mode').value).toBe('bearer,none');
    });

    it('should handle empty initial value', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        expect(container.querySelectorAll('.auth-mode-chip').length).toBe(0);
        expect(container.querySelector('.field-auth-mode').value).toBe('');
    });

    it('should handle undefined initial value', () => {
        createAuthModeChipInput({ container, idx: 0 });
        expect(container.querySelectorAll('.auth-mode-chip').length).toBe(0);
        expect(container.querySelector('.field-auth-mode').value).toBe('');
    });

    it('should normalise mode names to lowercase', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'Bearer,None' });
        const chips = container.querySelectorAll('.auth-mode-chip');
        expect(chips[0].dataset.mode).toBe('bearer');
        expect(chips[1].dataset.mode).toBe('none');
    });

    it('should deduplicate initial modes', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,bearer,none' });
        const chips = container.querySelectorAll('.auth-mode-chip');
        expect(chips.length).toBe(2);
    });

    it('should trim whitespace from initial modes', () => {
        createAuthModeChipInput({ container, idx: 0, value: ' bearer , none ' });
        expect(container.querySelector('.field-auth-mode').value).toBe('bearer,none');
    });

    it('should ignore unknown auth modes in initial value', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,unknown,none' });
        const chips = container.querySelectorAll('.auth-mode-chip');
        expect(chips.length).toBe(2);
        expect(container.querySelector('.field-auth-mode').value).toBe('bearer,none');
    });

    it('should display human-readable labels on chips', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'local-only' });
        const chip = container.querySelector('.auth-mode-chip');
        expect(chip.textContent).toContain('Local Only');
    });

    // -------------------------------------------------------------------
    // getValue
    // -------------------------------------------------------------------

    it('should return comma-separated value via getValue', () => {
        const input = createAuthModeChipInput({ container, idx: 0, value: 'bearer,local-only,none' });
        expect(input.getValue()).toBe('bearer,local-only,none');
    });

    it('should return empty string when no modes selected', () => {
        const input = createAuthModeChipInput({ container, idx: 0, value: '' });
        expect(input.getValue()).toBe('');
    });

    // -------------------------------------------------------------------
    // Chip removal
    // -------------------------------------------------------------------

    it('should remove chip when remove button is clicked and more than one selected', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,none' });
        const removeBtn = container.querySelector('.auth-mode-chip-remove');
        removeBtn.click();
        const chips = container.querySelectorAll('.auth-mode-chip');
        expect(chips.length).toBe(1);
        expect(chips[0].dataset.mode).toBe('none');
    });

    it('should NOT remove last chip (at least one must remain)', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer' });
        const removeBtn = container.querySelector('.auth-mode-chip-remove');
        removeBtn.click();
        const chips = container.querySelectorAll('.auth-mode-chip');
        expect(chips.length).toBe(1);
        expect(chips[0].dataset.mode).toBe('bearer');
    });

    it('should dispatch change event on hidden field when chip is removed', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,none' });
        const hidden = container.querySelector('.field-auth-mode');
        const handler = jest.fn();
        hidden.addEventListener('change', handler);

        container.querySelector('.auth-mode-chip-remove').click();
        expect(handler).toHaveBeenCalled();
    });

    it('should update hidden value after removal', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,local-only,none' });
        container.querySelector('.auth-mode-chip-remove').click();
        expect(container.querySelector('.field-auth-mode').value).toBe('local-only,none');
    });

    // -------------------------------------------------------------------
    // Dropdown
    // -------------------------------------------------------------------

    it('should show dropdown on input focus', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        const dropdown = container.querySelector('.auth-mode-dropdown');
        expect(dropdown.classList.contains('open')).toBe(true);
    });

    it('should filter dropdown based on input value', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.value = 'bear';
        input.dispatchEvent(new Event('input'));
        const items = container.querySelectorAll('.auth-mode-dropdown-item');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toBe('Bearer');
    });

    it('should filter dropdown by display label', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.value = 'local';
        input.dispatchEvent(new Event('input'));
        const items = container.querySelectorAll('.auth-mode-dropdown-item');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toBe('Local Only');
    });

    it('should exclude already-selected modes from dropdown', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        const items = container.querySelectorAll('.auth-mode-dropdown-item');
        const texts = Array.from(items).map((i) => i.textContent);
        expect(texts).not.toContain('Bearer');
        expect(texts).toContain('Local Only');
        expect(texts).toContain('None');
    });

    it('should add mode when dropdown item is clicked', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        const firstItem = container.querySelector('.auth-mode-dropdown-item');
        firstItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        const chips = container.querySelectorAll('.auth-mode-chip');
        expect(chips.length).toBe(1);
    });

    // -------------------------------------------------------------------
    // Keyboard interaction
    // -------------------------------------------------------------------

    it('should navigate dropdown with ArrowDown and ArrowUp', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        // Should not throw and dropdown should still be visible
        const dropdown = container.querySelector('.auth-mode-dropdown');
        expect(dropdown.classList.contains('open')).toBe(true);
    });

    it('should add mode on Enter when dropdown item is highlighted', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(container.querySelectorAll('.auth-mode-chip').length).toBe(1);
    });

    it('should add typed mode on Enter if it matches known mode', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.value = 'none';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(container.querySelector('.field-auth-mode').value).toBe('none');
    });

    it('should not add unknown mode on Enter', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.value = 'invalid';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(container.querySelectorAll('.auth-mode-chip').length).toBe(0);
    });

    it('should remove last chip on Backspace only when more than one selected', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer,none' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.value = '';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
        expect(container.querySelector('.field-auth-mode').value).toBe('bearer');
    });

    it('should NOT remove chip on Backspace when only one selected', () => {
        createAuthModeChipInput({ container, idx: 0, value: 'bearer' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.value = '';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
        expect(container.querySelector('.field-auth-mode').value).toBe('bearer');
    });

    it('should close dropdown on Escape', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        expect(container.querySelector('.auth-mode-dropdown').classList.contains('open')).toBe(true);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(container.querySelector('.auth-mode-dropdown').classList.contains('open')).toBe(false);
    });

    // -------------------------------------------------------------------
    // Accessibility
    // -------------------------------------------------------------------

    it('should have proper ARIA attributes', () => {
        createAuthModeChipInput({ container, idx: 5, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        expect(input.getAttribute('role')).toBe('combobox');
        expect(input.getAttribute('aria-expanded')).toBe('false');
        expect(input.getAttribute('aria-haspopup')).toBe('listbox');
        expect(input.getAttribute('aria-controls')).toBe('auth-mode-dropdown-5');
    });

    it('should set aria-expanded to true when dropdown is open', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        expect(input.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have listbox role on dropdown', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const dropdown = container.querySelector('.auth-mode-dropdown');
        expect(dropdown.getAttribute('role')).toBe('listbox');
    });

    // -------------------------------------------------------------------
    // Change event
    // -------------------------------------------------------------------

    it('should dispatch change event on hidden field when mode is added', () => {
        createAuthModeChipInput({ container, idx: 0, value: '' });
        const hidden = container.querySelector('.field-auth-mode');
        const handler = jest.fn();
        hidden.addEventListener('change', handler);

        const input = container.querySelector('.auth-mode-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        const firstItem = container.querySelector('.auth-mode-dropdown-item');
        firstItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        expect(handler).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // Destroy
    // -------------------------------------------------------------------

    it('should remove DOM elements on destroy', () => {
        const input = createAuthModeChipInput({ container, idx: 0, value: 'bearer' });
        expect(container.querySelector('.auth-mode-chip-area')).not.toBeNull();
        input.destroy();
        expect(container.querySelector('.auth-mode-chip-area')).toBeNull();
    });

    it('should leave container empty after destroy', () => {
        const input = createAuthModeChipInput({ container, idx: 0, value: 'bearer,none' });
        input.destroy();
        expect(container.innerHTML).toBe('');
    });
});
