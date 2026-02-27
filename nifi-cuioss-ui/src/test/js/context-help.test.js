'use strict';

/**
 * Tests for context-help.js — Disclosure widget for inline configuration help.
 */

jest.mock('../../main/webapp/js/utils.js');

import { createContextHelp, createFormField, resetHelpIdCounter } from '../../main/webapp/js/context-help.js';
import * as utils from '../../main/webapp/js/utils.js';

describe('context-help', () => {
    beforeEach(() => {
        resetHelpIdCounter();
        utils.sanitizeHtml.mockImplementation((s) => s || '');
        utils.t.mockImplementation((key) => key);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create button and panel elements', () => {
        const { button, panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        expect(button).toBeInstanceOf(HTMLButtonElement);
        expect(panel).toBeInstanceOf(HTMLDivElement);
    });

    it('should set correct ARIA attributes on button', () => {
        const { button } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.getAttribute('aria-controls')).toBe('context-help-panel-0');
        expect(button.type).toBe('button');
        expect(button.className).toBe('context-help-toggle');
    });

    it('should set correct attributes on panel', () => {
        const { panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        expect(panel.id).toBe('context-help-panel-0');
        expect(panel.className).toBe('context-help-panel');
        expect(panel.getAttribute('role')).toBe('region');
        expect(panel.hidden).toBe(true);
    });

    it('should render description, property key, and value in panel', () => {
        const { panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        const description = panel.querySelector('.context-help-description');
        expect(description).not.toBeNull();
        expect(description.textContent).toBe('contexthelp.global.listening.port');

        const code = panel.querySelector('.context-help-property code');
        expect(code).not.toBeNull();
        expect(code.textContent).toBe('rest.gateway.listening.port');

        const value = panel.querySelector('.context-help-value');
        expect(value).not.toBeNull();
        expect(value.textContent).toBe('9443');
    });

    it('should toggle panel visibility on button click', () => {
        const { button, panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        document.body.appendChild(button);
        document.body.appendChild(panel);

        // Initially hidden
        expect(panel.hidden).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('false');

        // Click to open
        button.click();
        expect(panel.hidden).toBe(false);
        expect(button.getAttribute('aria-expanded')).toBe('true');

        // Click to close
        button.click();
        expect(panel.hidden).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('should close panel on Escape key from button', () => {
        const { button, panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        document.body.appendChild(button);
        document.body.appendChild(panel);

        // Open first
        button.click();
        expect(panel.hidden).toBe(false);

        // Press Escape on button
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(panel.hidden).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('should close panel on Escape key from panel', () => {
        const { button, panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        document.body.appendChild(button);
        document.body.appendChild(panel);

        // Open
        button.click();
        expect(panel.hidden).toBe(false);

        // Press Escape on panel
        panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(panel.hidden).toBe(true);
    });

    it('should not close panel on non-Escape key', () => {
        const { button, panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        document.body.appendChild(button);
        document.body.appendChild(panel);

        // Open
        button.click();
        expect(panel.hidden).toBe(false);

        // Press Enter (should not close)
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(panel.hidden).toBe(false);
    });

    it('should use translation function for description', () => {
        utils.t.mockImplementation((key) => {
            if (key === 'contexthelp.global.listening.port') return 'Port description text';
            if (key === 'contexthelp.toggle.aria') return 'Show field help';
            return key;
        });

        const { panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        const description = panel.querySelector('.context-help-description');
        expect(description.textContent).toBe('Port description text');
    });

    it('should show N/A when currentValue is not provided', () => {
        const { panel } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port'
        });

        const value = panel.querySelector('.context-help-value');
        expect(value.textContent).toBe('common.na');
    });

    it('should generate unique IDs for multiple instances', () => {
        const first = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        const second = createContextHelp({
            helpKey: 'contexthelp.global.queue.size',
            propertyKey: 'rest.gateway.request.queue.size',
            currentValue: '100'
        });

        expect(first.button.getAttribute('aria-controls')).toBe('context-help-panel-0');
        expect(second.button.getAttribute('aria-controls')).toBe('context-help-panel-1');
        expect(first.panel.id).not.toBe(second.panel.id);
    });

    it('should reset ID counter for test isolation', () => {
        createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        resetHelpIdCounter();

        const { button } = createContextHelp({
            helpKey: 'contexthelp.global.queue.size',
            propertyKey: 'rest.gateway.request.queue.size',
            currentValue: '100'
        });

        expect(button.getAttribute('aria-controls')).toBe('context-help-panel-0');
    });

    it('should contain sr-only text for screen readers', () => {
        const { button } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        const srOnly = button.querySelector('.sr-only');
        expect(srOnly).not.toBeNull();
        expect(srOnly.textContent).toBe('contexthelp.toggle.aria');
    });

    it('should contain FontAwesome icon', () => {
        const { button } = createContextHelp({
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        const icon = button.querySelector('.fa-info-circle');
        expect(icon).not.toBeNull();
    });
});

describe('createFormField', () => {
    beforeEach(() => {
        resetHelpIdCounter();
        utils.sanitizeHtml.mockImplementation((s) => s || '');
        utils.t.mockImplementation((key) => key);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create an input field with label', () => {
        const container = document.createElement('div');
        const div = createFormField({
            container, idx: 0, name: 'path',
            label: 'Path', placeholder: '/api/*', value: '/foo'
        });

        expect(div.className).toBe('form-field field-container-path');
        const label = div.querySelector('label');
        expect(label.textContent).toBe('Path:');
        expect(label.getAttribute('for')).toBe('field-path-0');
        const input = div.querySelector('input');
        expect(input.type).toBe('text');
        expect(input.value).toBe('/foo');
        expect(input.placeholder).toBe('/api/*');
        expect(container.contains(div)).toBe(true);
    });

    it('should create a textarea when isTextArea is true', () => {
        const container = document.createElement('div');
        const div = createFormField({
            container, idx: 1, name: 'content',
            label: 'Content', value: 'abc', isTextArea: true
        });

        const textarea = div.querySelector('textarea');
        expect(textarea).not.toBeNull();
        expect(textarea.rows).toBe(5);
        expect(textarea.textContent).toBe('abc');
        expect(div.querySelector('input')).toBeNull();
    });

    it('should attach context help when helpKey is provided', () => {
        const container = document.createElement('div');
        const div = createFormField({
            container, idx: 0, name: 'port',
            label: 'Port', value: '9443',
            helpKey: 'contexthelp.global.listening.port',
            propertyKey: 'rest.gateway.listening.port',
            currentValue: '9443'
        });

        const toggle = div.querySelector('.context-help-toggle');
        expect(toggle).not.toBeNull();
        const panel = div.querySelector('.context-help-panel');
        expect(panel).not.toBeNull();
    });

    it('should not attach context help when helpKey is absent', () => {
        const container = document.createElement('div');
        const div = createFormField({
            container, idx: 0, name: 'port',
            label: 'Port', value: '9443'
        });

        expect(div.querySelector('.context-help-toggle')).toBeNull();
        expect(div.querySelector('.context-help-panel')).toBeNull();
    });

    it('should apply extraClass and hidden', () => {
        const container = document.createElement('div');
        const div = createFormField({
            container, idx: 0, name: 'url',
            label: 'URL', extraClass: 'jwks-type-url', hidden: true
        });

        expect(div.classList.contains('jwks-type-url')).toBe(true);
        expect(div.classList.contains('hidden')).toBe(true);
    });

    it('should apply inputClass to the input element', () => {
        const container = document.createElement('div');
        createFormField({
            container, idx: 0, name: 'test',
            label: 'Test', inputClass: 'route-config-field'
        });

        const input = container.querySelector('input');
        expect(input.className).toContain('route-config-field');
    });
});
