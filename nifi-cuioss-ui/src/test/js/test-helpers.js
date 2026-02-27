'use strict';

/**
 * Shared test utilities for Jest test suites.
 * @module test/js/test-helpers
 */

/**
 * Mock implementation of createContextHelp for unit tests.
 * Creates real DOM elements so tests can assert on button/panel presence
 * and toggle behaviour without loading the real module.
 *
 * @param {Object} opts
 * @param {string} opts.helpKey
 * @param {string} opts.propertyKey
 * @param {string} [opts.currentValue]
 * @returns {{ button: HTMLButtonElement, panel: HTMLDivElement }}
 */
export const mockCreateContextHelp = ({ helpKey, propertyKey, currentValue }) => {
    const button = document.createElement('button');
    button.className = 'context-help-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.dataset.helpKey = helpKey;

    const panel = document.createElement('div');
    panel.className = 'context-help-panel';
    panel.hidden = true;
    panel.innerHTML = `<code>${propertyKey}</code><span>${currentValue || ''}</span>`;

    button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
    });

    return { button, panel };
};
