'use strict';

/**
 * Tests for context-help.js — Disclosure widget for inline configuration help.
 */

jest.mock('../../main/webapp/js/utils.js');

import { createContextHelp, resetHelpIdCounter } from '../../main/webapp/js/context-help.js';
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

        const icon = button.querySelector('.fa-circle-info');
        expect(icon).not.toBeNull();
        expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
});
