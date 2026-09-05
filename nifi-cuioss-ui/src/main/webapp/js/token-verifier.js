'use strict';

/**
 * Token Verification tab component.
 *
 * @module js/token-verifier
 */

import { verifyToken } from './api.js';
import { sanitizeHtml, displayUiError, confirmClearForm, t } from './utils.js';

/**
 * Initialise the Token Verification tab inside the given container element.
 * @param {HTMLElement} container  the #token-verification pane
 */
export const init = (container) => {
    if (!container || container.querySelector('.token-verification-container')) return;

    container.innerHTML = `
        <div class="token-verification-container">
            <div class="token-input-section">
                <div class="form-field">
                    <label for="field-token-input">${t('token.input.label')}:</label>
                    <textarea id="field-token-input" class="form-input"
                              rows="5" placeholder="${t('token.input.placeholder')}"
                              aria-label="${t('token.input.label')}"></textarea>
                </div>
                <div class="button-container">
                    <button class="verify-token-button btn btn-primary">
                        <i class="fa fa-check"></i> ${t('token.btn.verify')}
                    </button>
                    <button class="clear-token-button btn btn-secondary">
                        <i class="fa fa-trash"></i> ${t('token.btn.clear')}
                    </button>
                </div>
            </div>
            <div class="token-results-section">
                <h3>${t('token.results.heading')}</h3>
                <div class="token-results-content" aria-live="polite" role="status"></div>
            </div>
        </div>`;

    const tokenInput = container.querySelector('#field-token-input');
    const results = container.querySelector('.token-results-content');

    container.querySelector('.verify-token-button').addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (!token) {
            // Pass a real Error so a meaningful "token required" message renders instead
            // of the "Unknown error" fallback a null error produced.
            displayUiError(results, new Error(t('validation.token.required')), {});
            return;
        }
        results.innerHTML = `<div class="verifying">${t('token.status.verifying')}</div>`;
        try {
            const result = await verifyToken(token);
            renderResults(result, results);
        } catch (error) {
            displayUiError(results, error, {});
        }
    });

    container.querySelector('.clear-token-button').addEventListener('click', () => {
        confirmClearForm(() => {
            tokenInput.value = '';
            results.innerHTML = '';
        });
    });
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const renderResults = (result, el) => {
    // The badge reports the authoritative verdict only. `exp` comes from the
    // NonValidatingJwtParser output, so it is decoded claim data, not a verification
    // outcome — buildClaimsHtml annotates it inside the decoded region instead.
    const statusClass = result.valid ? 'valid' : 'invalid';
    const statusText = result.valid ? t('token.status.valid') : t('token.status.invalid');
    const statusIcon = result.valid ? 'fa-check-circle' : 'fa-times-circle';

    let html = `<div class="verification-status ${statusClass}">
        <i class="fa ${statusIcon}"></i> <span>${statusText}</span></div>`;

    if (result.decoded) {
        html += `<div class="token-details">
            <p class="decoded-unverified-note">${t('token.section.decoded.unverified')}</p>`;
        if (result.decoded.header) {
            html += `<div class="token-section"><h4>${t('token.section.header')}</h4>
                <pre>${sanitizeHtml(JSON.stringify(result.decoded.header, null, 2))}</pre></div>`;
        }
        if (result.decoded.payload) {
            html += `<div class="token-section"><h4>${t('token.section.payload')}</h4>
                <pre>${sanitizeHtml(JSON.stringify(result.decoded.payload, null, 2))}</pre></div>`;
            html += buildClaimsHtml(result.decoded.payload);
        }
        html += '</div>';
    }

    if (result.error) {
        html += `<div class="verification-error">
            <strong>${t('token.error.prefix')}:</strong> ${sanitizeHtml(String(result.error))}</div>`;
    }

    el.innerHTML = html;
};

const buildClaimsHtml = (payload) => {
    let html = '<div class="token-claims">';
    // Explicit presence check, not truthiness: exp is a NumericDate, and 0
    // (1970-01-01T00:00:00Z, an already-expired token) is a present claim.
    if (payload.exp !== undefined && payload.exp !== null) {
        const expDate = new Date(payload.exp * 1000);
        const isExpired = expDate < new Date();
        const expiredSpan = isExpired
            ? ` <span class="expired-label">${t('token.claim.expired')}</span>` : '';
        const expiredClass = isExpired ? 'expired' : '';
        html += `<div class="claim ${expiredClass}">
            <strong>${t('token.claim.expiration')}:</strong> ${expDate.toLocaleString()}
            ${expiredSpan}</div>`;
    }
    if (payload.iss) {
        html += `<div class="claim"><strong>${t('token.claim.issuer')}:</strong> ${sanitizeHtml(String(payload.iss))}</div>`;
    }
    if (payload.sub) {
        html += `<div class="claim"><strong>${t('token.claim.subject')}:</strong> ${sanitizeHtml(String(payload.sub))}</div>`;
    }
    html += '</div>';
    return html;
};
