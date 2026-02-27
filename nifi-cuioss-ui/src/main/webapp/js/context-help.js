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
