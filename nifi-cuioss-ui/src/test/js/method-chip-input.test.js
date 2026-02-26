'use strict';

/**
 * Tests for method-chip-input.js — HTTP method chip/tag input component.
 */

jest.mock('../../main/webapp/js/utils.js');

import { createMethodChipInput } from '../../main/webapp/js/method-chip-input.js';
import { sanitizeHtml } from '../../main/webapp/js/utils.js';

describe('method-chip-input', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        sanitizeHtml.mockImplementation((s) => s);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    // -------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------

    it('should create chip area with label', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        expect(container.querySelector('label')).not.toBeNull();
        expect(container.querySelector('.method-chip-area')).not.toBeNull();
    });

    it('should create hidden input with class field-methods', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const hidden = container.querySelector('.field-methods');
        expect(hidden).not.toBeNull();
        expect(hidden.type).toBe('hidden');
        expect(hidden.name).toBe('methods');
    });

    it('should render initial chips from comma-separated value', () => {
        createMethodChipInput({ container, idx: 0, value: 'GET,POST' });
        const chips = container.querySelectorAll('.method-chip');
        expect(chips.length).toBe(2);
        expect(chips[0].dataset.method).toBe('GET');
        expect(chips[1].dataset.method).toBe('POST');
    });

    it('should set hidden field value from initial methods', () => {
        createMethodChipInput({ container, idx: 0, value: 'GET,DELETE' });
        expect(container.querySelector('.field-methods').value).toBe('GET,DELETE');
    });

    it('should handle empty initial value', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        expect(container.querySelectorAll('.method-chip').length).toBe(0);
        expect(container.querySelector('.field-methods').value).toBe('');
    });

    it('should handle undefined initial value', () => {
        createMethodChipInput({ container, idx: 0 });
        expect(container.querySelectorAll('.method-chip').length).toBe(0);
        expect(container.querySelector('.field-methods').value).toBe('');
    });

    it('should normalise method names to uppercase', () => {
        createMethodChipInput({ container, idx: 0, value: 'get,post' });
        const chips = container.querySelectorAll('.method-chip');
        expect(chips[0].dataset.method).toBe('GET');
        expect(chips[1].dataset.method).toBe('POST');
    });

    it('should deduplicate initial methods', () => {
        createMethodChipInput({ container, idx: 0, value: 'GET,GET,POST' });
        const chips = container.querySelectorAll('.method-chip');
        expect(chips.length).toBe(2);
    });

    it('should trim whitespace from initial methods', () => {
        createMethodChipInput({ container, idx: 0, value: ' GET , POST ' });
        expect(container.querySelector('.field-methods').value).toBe('GET,POST');
    });

    // -------------------------------------------------------------------
    // getValue
    // -------------------------------------------------------------------

    it('should return comma-separated value via getValue', () => {
        const input = createMethodChipInput({ container, idx: 0, value: 'GET,PUT,DELETE' });
        expect(input.getValue()).toBe('GET,PUT,DELETE');
    });

    it('should return empty string when no methods selected', () => {
        const input = createMethodChipInput({ container, idx: 0, value: '' });
        expect(input.getValue()).toBe('');
    });

    // -------------------------------------------------------------------
    // Chip removal
    // -------------------------------------------------------------------

    it('should remove chip when remove button is clicked', () => {
        createMethodChipInput({ container, idx: 0, value: 'GET,POST' });
        const removeBtn = container.querySelector('.method-chip-remove');
        removeBtn.click();
        const chips = container.querySelectorAll('.method-chip');
        expect(chips.length).toBe(1);
        expect(chips[0].dataset.method).toBe('POST');
    });

    it('should update hidden value after removal', () => {
        createMethodChipInput({ container, idx: 0, value: 'GET,POST,DELETE' });
        container.querySelector('.method-chip-remove').click();
        expect(container.querySelector('.field-methods').value).toBe('POST,DELETE');
    });

    // -------------------------------------------------------------------
    // Dropdown
    // -------------------------------------------------------------------

    it('should show dropdown on input focus', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        const dropdown = container.querySelector('.method-dropdown');
        expect(dropdown.classList.contains('open')).toBe(true);
    });

    it('should filter dropdown based on input value', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.value = 'GE';
        input.dispatchEvent(new Event('input'));
        const items = container.querySelectorAll('.method-dropdown-item');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toBe('GET');
    });

    it('should exclude already-selected methods from dropdown', () => {
        createMethodChipInput({ container, idx: 0, value: 'GET' });
        const input = container.querySelector('.method-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        const items = container.querySelectorAll('.method-dropdown-item');
        const texts = Array.from(items).map((i) => i.textContent);
        expect(texts).not.toContain('GET');
        expect(texts).toContain('POST');
    });

    it('should add method when dropdown item is clicked', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        const firstItem = container.querySelector('.method-dropdown-item');
        firstItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        const chips = container.querySelectorAll('.method-chip');
        expect(chips.length).toBe(1);
    });

    // -------------------------------------------------------------------
    // Keyboard interaction
    // -------------------------------------------------------------------

    it('should add method on Enter when dropdown item is highlighted', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        // Arrow down to highlight first item
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        // Enter to select
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(container.querySelectorAll('.method-chip').length).toBe(1);
    });

    it('should add typed method on Enter if it matches known method', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.value = 'post';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(container.querySelector('.field-methods').value).toBe('POST');
    });

    it('should not add unknown method on Enter', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.value = 'INVALID';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(container.querySelectorAll('.method-chip').length).toBe(0);
    });

    it('should remove last chip on Backspace in empty input', () => {
        createMethodChipInput({ container, idx: 0, value: 'GET,POST' });
        const input = container.querySelector('.method-chip-text-input');
        input.value = '';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
        expect(container.querySelector('.field-methods').value).toBe('GET');
    });

    it('should close dropdown on Escape', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        expect(container.querySelector('.method-dropdown').classList.contains('open')).toBe(true);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(container.querySelector('.method-dropdown').classList.contains('open')).toBe(false);
    });

    // -------------------------------------------------------------------
    // Accessibility
    // -------------------------------------------------------------------

    it('should have proper ARIA attributes', () => {
        createMethodChipInput({ container, idx: 5, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        expect(input.getAttribute('role')).toBe('combobox');
        expect(input.getAttribute('aria-expanded')).toBe('false');
        expect(input.getAttribute('aria-haspopup')).toBe('listbox');
        expect(input.getAttribute('aria-controls')).toBe('method-dropdown-5');
    });

    it('should set aria-expanded to true when dropdown is open', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const input = container.querySelector('.method-chip-text-input');
        input.dispatchEvent(new Event('focus'));
        expect(input.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have listbox role on dropdown', () => {
        createMethodChipInput({ container, idx: 0, value: '' });
        const dropdown = container.querySelector('.method-dropdown');
        expect(dropdown.getAttribute('role')).toBe('listbox');
    });

    // -------------------------------------------------------------------
    // Destroy
    // -------------------------------------------------------------------

    it('should remove DOM elements on destroy', () => {
        const input = createMethodChipInput({ container, idx: 0, value: 'GET' });
        expect(container.querySelector('.method-chip-area')).not.toBeNull();
        input.destroy();
        expect(container.querySelector('.method-chip-area')).toBeNull();
    });
});
