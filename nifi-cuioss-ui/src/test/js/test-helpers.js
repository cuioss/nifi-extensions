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

/**
 * Mock implementation of createFormField for unit tests.
 * Mirrors the real DOM structure so query selectors in tests keep working.
 *
 * @param {Object} opts
 * @returns {HTMLDivElement}
 */
export const mockCreateFormField = ({ container, idx, name, label, placeholder, value,
    extraClass, hidden, inputClass, isTextArea,
    helpKey, propertyKey, currentValue }) => {
    const div = document.createElement('div');
    div.className = `form-field field-container-${name}`;
    if (extraClass) div.classList.add(extraClass);
    if (hidden) div.classList.add('hidden');

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', `field-${name}-${idx}`);
    labelEl.textContent = `${label}:`;
    div.appendChild(labelEl);

    if (helpKey) {
        const { button, panel } = mockCreateContextHelp({ helpKey, propertyKey, currentValue });
        labelEl.appendChild(button);
        div.appendChild(panel);
    }

    const el = document.createElement(isTextArea ? 'textarea' : 'input');
    if (!isTextArea) el.type = 'text';
    el.id = `field-${name}-${idx}`;
    el.name = name;
    el.className = `field-${name} form-input${inputClass ? ` ${inputClass}` : ''}`;
    el.placeholder = placeholder || '';
    el.setAttribute('aria-label', label);
    if (isTextArea) {
        el.rows = 5;
        el.textContent = value || '';
    } else {
        el.value = value || '';
    }
    div.appendChild(el);

    container.appendChild(div);
    return div;
};
