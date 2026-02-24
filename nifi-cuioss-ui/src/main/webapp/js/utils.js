'use strict';

/**
 * Consolidated utilities: validation, i18n, error display, sanitization, logging.
 *
 * @module js/utils
 */

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[JWT-UI]';

/* eslint-disable no-console */
export const log = {
    debug: (...args) => console.debug(LOG_PREFIX, ...args),
    info: (...args) => console.info(LOG_PREFIX, ...args),
    warn: (...args) => console.warn(LOG_PREFIX, ...args),
    error: (...args) => console.error(LOG_PREFIX, ...args)
};
/* eslint-enable no-console */

// ---------------------------------------------------------------------------
// i18n  (3 keys x 2 languages  is all that is actually used)
// ---------------------------------------------------------------------------

const TRANSLATIONS = {
    en: {
        'jwt.validator.help.title': 'JWT Authenticator Help',
        'jwt.validator.metrics.title': 'JWT Validation Metrics',
        'jwt.validator.help.tab.name': 'Help',
        'origin.badge.persisted.title': 'Loaded from processor properties (persisted)',
        'origin.badge.modified.title': 'Modified in this session (not yet persisted)',
        'origin.badge.new.title': 'Created in this session (not yet persisted)',
        'origin.badge.modified': 'Modified',
        'origin.badge.new': 'New'
    },
    de: {
        'jwt.validator.help.title': 'JWT-Authentifikator-Hilfe',
        'jwt.validator.metrics.title': 'JWT-Validierungsmetriken',
        'jwt.validator.help.tab.name': 'Hilfe',
        'origin.badge.persisted.title': 'Aus Prozessor-Eigenschaften geladen (persistent)',
        'origin.badge.modified.title': 'In dieser Sitzung geändert (noch nicht persistent)',
        'origin.badge.new.title': 'In dieser Sitzung erstellt (noch nicht persistent)',
        'origin.badge.modified': 'Geändert',
        'origin.badge.new': 'Neu'
    }
};

const browserLang = typeof navigator === 'undefined' ? 'en' : (navigator.language || 'en');
const lang = browserLang.startsWith('de') ? 'de' : 'en';

/**
 * Translate a key to the current browser language.
 * @param {string} key  i18n key
 * @returns {string}
 */
export const t = (key) => TRANSLATIONS[lang]?.[key]
    ?? TRANSLATIONS.en[key]
    ?? key;

// ---------------------------------------------------------------------------
// HTML sanitisation
// ---------------------------------------------------------------------------

/**
 * Escapes HTML entities to prevent XSS.
 * @param {string} html  raw string
 * @returns {string}  safe string
 */
export const sanitizeHtml = (html) => {
    if (!html) return '';
    const d = document.createElement('div');
    d.textContent = html;
    return d.innerHTML;
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Format a number with locale-aware thousands separator.
 * @param {number|null|undefined} n
 * @returns {string}
 */
export const formatNumber = (n) => {
    if (n == null) return '';
    return new Intl.NumberFormat('en-US').format(n);
};

/**
 * Format a Date (or date-string) to a locale string.
 * @param {Date|string|null|undefined} d
 * @returns {string}
 */
export const formatDate = (d) => {
    if (!d) return '';
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return String(d);
        return date.toLocaleString();
    } catch {
        return String(d);
    }
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-useless-escape
const RE_URL = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([\/?#].*)?$/;
const RE_SAFE_NAME = /^[a-zA-Z0-9._-]+$/;
const RE_PROCESSOR_ID = /\/processors\/([a-f0-9-]+)/i;

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid
 * @property {string}  [error]
 * @property {string}  [sanitizedValue]
 */

/**
 * Validate that a value is present and non-empty.
 * @param {*} value
 * @param {boolean} [required=true]
 * @returns {ValidationResult}
 */
export const validateRequired = (value, required = true) => {
    const s = value == null ? '' : String(value).trim();
    const empty = s === '' || s.toLowerCase() === 'null'
        || s.toLowerCase() === 'undefined';
    if (required && empty) {
        return { isValid: false, error: 'This field is required.', sanitizedValue: '' };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Validate a URL string.
 * @param {string} url
 * @param {Object} [opts]
 * @param {boolean} [opts.httpsOnly=false]
 * @param {number}  [opts.maxLength=2048]
 * @returns {ValidationResult}
 */
export const validateUrl = (url, opts = {}) => {
    const { httpsOnly = false, maxLength = 2048 } = opts;
    const req = validateRequired(url);
    if (!req.isValid) return { isValid: false, error: 'URL is required.', sanitizedValue: '' };
    const s = req.sanitizedValue;
    if (s.length > maxLength) {
        return { isValid: false, error: `URL is too long (maximum ${maxLength} characters).`, sanitizedValue: s };
    }
    // eslint-disable-next-line no-useless-escape
    const httpsPattern = /^https:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([\/?#].*)?$/;
    const pattern = httpsOnly ? httpsPattern : RE_URL;
    if (!pattern.test(s)) {
        const proto = httpsOnly ? 'HTTPS' : 'HTTP/HTTPS';
        return { isValid: false, error: `Invalid URL format. Must be a valid ${proto} URL.`, sanitizedValue: s };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Validate JWT token format.
 * @param {string} token
 * @returns {ValidationResult}
 */
export const validateJwtToken = (token) => {
    const req = validateRequired(token);
    if (!req.isValid) return { isValid: false, error: 'Token is required.', sanitizedValue: '' };
    const s = req.sanitizedValue;
    if (s.length < 10) return { isValid: false, error: 'Token is too short (minimum 10 characters).', sanitizedValue: s };
    if (s.length > 10000) return { isValid: false, error: 'Token is too long (maximum 10000 characters).', sanitizedValue: s };
    if (s.split('.').length < 2) {
        return { isValid: false, error: 'Invalid token format. Expected at least 2 parts separated by dots.', sanitizedValue: s };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Validate issuer name.
 * @param {string} name
 * @returns {ValidationResult}
 */
export const validateIssuerName = (name) => {
    const req = validateRequired(name);
    if (!req.isValid) return { isValid: false, error: 'Issuer name is required.', sanitizedValue: '' };
    const s = req.sanitizedValue;
    if (s.length < 2) return { isValid: false, error: 'Issuer name must be at least 2 characters long.', sanitizedValue: s };
    if (s.length > 100) return { isValid: false, error: 'Issuer name is too long (maximum 100 characters).', sanitizedValue: s };
    if (!RE_SAFE_NAME.test(s)) {
        return { isValid: false, error: 'Issuer name can only contain letters, numbers, hyphens, underscores, and dots.', sanitizedValue: s };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Extract a NiFi processor UUID from a URL.
 * @param {string} url
 * @returns {ValidationResult}
 */
export const validateProcessorIdFromUrl = (url) => {
    const req = validateRequired(url);
    if (!req.isValid) return { isValid: false, error: 'URL is required for processor ID extraction.', sanitizedValue: '' };
    const match = RE_PROCESSOR_ID.exec(req.sanitizedValue);
    if (!match) return { isValid: false, error: 'URL does not contain a valid processor ID.', sanitizedValue: '' };
    return { isValid: true, sanitizedValue: match[1].toLowerCase() };
};

/**
 * Validate complete issuer config form data.
 * @param {Object} fd  form data
 * @returns {ValidationResult}
 */
export const validateIssuerConfig = (fd) => {
    const errors = [];
    const r1 = validateIssuerName(fd.issuerName);
    if (!r1.isValid) errors.push(`Issuer Name: ${r1.error}`);
    const r2 = validateUrl(fd.issuer, { httpsOnly: false });
    if (!r2.isValid) errors.push(`Issuer URI: ${r2.error}`);
    const r3 = validateUrl(fd['jwks-url'], { httpsOnly: false });
    if (!r3.isValid) errors.push(`JWKS URL: ${r3.error}`);
    if (errors.length > 0) return { isValid: false, error: errors.join(' ') };
    return { isValid: true };
};

// ---------------------------------------------------------------------------
// UI error / success display
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable error message from various error shapes.
 * @param {Object|Error|null} error
 * @returns {string}
 */
const extractErrorMessage = (error) => {
    if (!error) return 'Unknown error';
    if (error.responseJSON?.message) return error.responseJSON.message;
    if (error.responseJSON?.error) return error.responseJSON.error;
    if (error.responseText) {
        try {
            const parsed = JSON.parse(error.responseText);
            if (parsed.message) return parsed.message;
            if (parsed.error) return parsed.error;
        } catch { /* not JSON */ }
        // HTML responses (e.g., Jetty error pages) — show status instead of raw markup
        if (error.responseText.trimStart().startsWith('<')) {
            return `Server error (HTTP ${error.status || 'unknown'})`;
        }
        return error.responseText;
    }
    return error.statusText || error.message || 'Unknown error';
};

/**
 * Show an error message inside a container element.
 * @param {HTMLElement} el  target container
 * @param {Object|Error|null} error
 * @param {Object} [i18n]  optional i18n map (unused keys kept for compat)
 * @param {string} [prefixKey]
 */
export const displayUiError = (el, error, i18n = {}, prefixKey = 'processor.jwt.validationError') => {
    const msg = extractErrorMessage(error);
    const prefix = i18n[prefixKey] || 'Error';
    const target = el?.[0] || el;
    if (!target) return;
    target.innerHTML = `
        <div class="error-message" role="alert" aria-live="assertive">
            <div class="error-content">
                <strong>${sanitizeHtml(prefix)}:</strong> ${sanitizeHtml(msg)}
            </div>
        </div>`;
};

/**
 * Show a success message inside a container element.
 * @param {HTMLElement} el  target container
 * @param {string} message
 */
export const displayUiSuccess = (el, message) => {
    const target = el?.[0] || el;
    if (!target) return;
    target.innerHTML = `
        <div class="success-message" role="status" aria-live="polite">
            <div class="success-content">${sanitizeHtml(message)}</div>
        </div>`;
    setTimeout(() => {
        const msg = target.querySelector('.success-message');
        if (msg) msg.remove();
    }, 5000);
};

/**
 * Create an XHR-like error object for API error handling.
 * @param {Object|null} xhr
 * @returns {{status: number, statusText: string, responseText: string}}
 */
export const createXhrErrorObject = (xhr) => {
    if (!xhr) return { status: 0, statusText: 'Unknown error', responseText: '' };
    return {
        status: xhr.status,
        statusText: xhr.statusText || 'Unknown error',
        responseText: xhr.responseText || ''
    };
};

// ---------------------------------------------------------------------------
// Confirmation dialog (native <dialog>)
// ---------------------------------------------------------------------------

/**
 * Show a confirmation dialog.  Returns a Promise<boolean>.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.confirmText='Delete']
 * @param {string} [opts.cancelText='Cancel']
 * @param {Function} [opts.onConfirm]
 * @returns {Promise<boolean>}
 */
export const showConfirmationDialog = ({
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    onConfirm
}) => new Promise((resolve) => {
    // Remove existing dialogs
    for (const d of document.querySelectorAll('.confirmation-dialog')) d.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'confirmation-dialog dialog-danger show';
    wrapper.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
            <div class="dialog-header"><h3 class="dialog-title">${sanitizeHtml(title)}</h3></div>
            <div class="dialog-body"><p class="dialog-message">${sanitizeHtml(message)}</p></div>
            <div class="dialog-footer">
                <button class="cancel-button">${sanitizeHtml(cancelText)}</button>
                <button class="confirm-button danger-button">${sanitizeHtml(confirmText)}</button>
            </div>
        </div>`;
    document.body.appendChild(wrapper);

    const close = (confirmed) => {
        wrapper.remove();
        if (confirmed && onConfirm) onConfirm();
        resolve(confirmed);
    };

    wrapper.querySelector('.confirm-button').addEventListener('click', () => close(true));
    wrapper.querySelector('.cancel-button').addEventListener('click', () => close(false));
    wrapper.querySelector('.dialog-overlay').addEventListener('click', () => close(false));
    wrapper.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
    });
    wrapper.querySelector('.cancel-button').focus();
});

/**
 * Show a Remove Issuer confirmation dialog.
 * @param {string} issuerName
 * @param {Function} onConfirm
 * @returns {Promise<boolean>}
 */
export const confirmRemoveIssuer = (issuerName, onConfirm) => showConfirmationDialog({
    title: 'Remove Issuer Configuration',
    message: `Are you sure you want to remove the issuer "${issuerName}"? This action cannot be undone.`,
    confirmText: 'Remove',
    cancelText: 'Cancel',
    onConfirm
});

/**
 * Show a Remove Route confirmation dialog.
 * @param {string} routeName
 * @param {Function} onConfirm
 * @returns {Promise<boolean>}
 */
export const confirmRemoveRoute = (routeName, onConfirm) => showConfirmationDialog({
    title: 'Remove Route Configuration',
    message: `Are you sure you want to remove the route "${routeName}"? This action cannot be undone.`,
    confirmText: 'Remove',
    cancelText: 'Cancel',
    onConfirm
});

/**
 * Show a Clear Form confirmation dialog.
 * @param {Function} onConfirm
 * @returns {Promise<boolean>}
 */
export const confirmClearForm = (onConfirm) => showConfirmationDialog({
    title: 'Clear Form Data',
    message: 'Are you sure you want to clear all form data? Any unsaved changes will be lost.',
    confirmText: 'Clear',
    cancelText: 'Cancel',
    onConfirm
});
