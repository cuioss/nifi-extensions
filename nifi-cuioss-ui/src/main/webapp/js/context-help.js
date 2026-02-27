'use strict';

/**
 * Context-help disclosure widget (WAI-ARIA Disclosure pattern).
 *
 * Factory function returns a button + panel pair that can be inserted
 * next to any configuration label to provide inline help text,
 * the NiFi property key, and the current value.
 *
 * @module js/context-help
 */

import { t, sanitizeHtml } from './utils.js';

/** Auto-incrementing counter for unique element IDs. */
let helpIdCounter = 0;

/**
 * Reset the ID counter (for test isolation).
 */
export const resetHelpIdCounter = () => { helpIdCounter = 0; };

/**
 * Create a context-help disclosure widget.
 *
 * @param {Object} opts
 * @param {string} opts.helpKey       i18n key for the description text
 * @param {string} opts.propertyKey   NiFi property key (shown in panel)
 * @param {string} [opts.currentValue]  current property value (shown in panel)
 * @returns {{ button: HTMLButtonElement, panel: HTMLDivElement }}
 */
export const createContextHelp = ({ helpKey, propertyKey, currentValue }) => {
    const id = helpIdCounter++;
    const panelId = `context-help-panel-${id}`;

    // -- toggle button --
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'context-help-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', panelId);
    button.innerHTML = '<i class="fa fa-info-circle"></i>'
        + `<span class="sr-only">${sanitizeHtml(t('contexthelp.toggle.aria'))}</span>`;

    // -- disclosure panel --
    const panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'context-help-panel';
    panel.setAttribute('role', 'region');
    panel.hidden = true;

    const description = sanitizeHtml(t(helpKey));
    const safeKey = sanitizeHtml(propertyKey);
    const displayValue = currentValue ? sanitizeHtml(currentValue) : sanitizeHtml(t('common.na'));

    panel.innerHTML =
        `<p class="context-help-description">${description}</p>`
        + '<hr>'
        + '<div class="context-help-property">'
            + `<code>${safeKey}</code>`
            + `<span class="context-help-value">${displayValue}</span>`
        + '</div>';

    // -- toggle logic --
    const toggle = (show) => {
        const expanded = typeof show === 'boolean' ? show : button.getAttribute('aria-expanded') === 'true';
        const next = typeof show === 'boolean' ? show : !expanded;
        button.setAttribute('aria-expanded', String(next));
        panel.hidden = !next;
    };

    button.addEventListener('click', () => toggle());

    // Escape key dismisses the panel and returns focus to the button
    const onEscape = (e) => {
        if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
            toggle(false);
            button.focus();
        }
    };
    button.addEventListener('keydown', onEscape);
    panel.addEventListener('keydown', onEscape);

    return { button, panel };
};

/**
 * Create a labelled form field (input or textarea) with optional context-help.
 *
 * This helper eliminates boilerplate duplication across form builders by
 * encapsulating the common pattern: div > label > [help toggle] > input.
 *
 * @param {Object}  opts
 * @param {HTMLElement} opts.container   parent element to append the field to
 * @param {number}      opts.idx         form-instance index (for unique IDs)
 * @param {string}      opts.name        field name (used in id / class / name attribute)
 * @param {string}      opts.label       visible label text
 * @param {string}      [opts.placeholder]
 * @param {string}      [opts.value]
 * @param {string}      [opts.extraClass]  additional CSS class on the wrapper div
 * @param {boolean}     [opts.hidden]      start hidden
 * @param {string}      [opts.inputClass]  extra CSS class for the input element
 * @param {boolean}     [opts.isTextArea]  render a &lt;textarea&gt; instead of &lt;input&gt;
 * @param {string}      [opts.helpKey]     i18n key for context-help description
 * @param {string}      [opts.propertyKey] NiFi property key (shown in help panel)
 * @param {string}      [opts.currentValue] current property value
 * @returns {HTMLDivElement}
 */
export const createFormField = ({ container, idx, name, label, placeholder, value,
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
        const { button, panel } = createContextHelp({ helpKey, propertyKey, currentValue });
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
