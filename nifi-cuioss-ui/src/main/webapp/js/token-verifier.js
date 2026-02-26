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
            displayUiError(results, null, {}, 'processor.jwt.noTokenProvided');
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
    const expired = result.decoded?.payload?.exp
        ? new Date(result.decoded.payload.exp * 1000) < new Date()
        : false;

    let statusClass, statusText, statusIcon;
    if (expired) {
        statusClass = 'expired'; statusText = t('token.status.expired'); statusIcon = 'fa-clock';
    } else if (result.valid) {
        statusClass = 'valid'; statusText = t('token.status.valid'); statusIcon = 'fa-check-circle';
    } else {
        statusClass = 'invalid'; statusText = t('token.status.invalid'); statusIcon = 'fa-times-circle';
    }

    let html = `<div class="verification-status ${statusClass}">
        <i class="fa ${statusIcon}"></i> <span>${statusText}</span></div>`;

    if (result.decoded) {
        html += '<div class="token-details">';
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
    if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const isExpired = expDate < new Date();
        html += `<div class="claim ${isExpired ? 'expired' : ''}">
            <strong>${t('token.claim.expiration')}:</strong> ${expDate.toLocaleString()}
            ${isExpired ? ` <span class="expired-label">${t('token.claim.expired')}</span>` : ''}</div>`;
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
