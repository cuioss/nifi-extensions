'use strict';

/**
 * Token Verification tab component.
 *
 * @module js/token-verifier
 */

import { verifyToken } from './api.js';
import { sanitizeHtml, displayUiError, confirmClearForm } from './utils.js';

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
                    <label for="field-token-input">Enter Token:</label>
                    <textarea id="field-token-input" class="form-input"
                              rows="5" placeholder="Paste token here..."
                              aria-label="JWT Token Input"></textarea>
                </div>
                <div class="button-container">
                    <button class="verify-token-button btn btn-primary">
                        <i class="fa fa-check"></i> Verify Token
                    </button>
                    <button class="clear-token-button btn btn-secondary">
                        <i class="fa fa-trash"></i> Clear
                    </button>
                </div>
            </div>
            <div class="token-results-section">
                <h3>Verification Results</h3>
                <div class="token-results-content"></div>
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
        results.innerHTML = '<div class="verifying">Verifying token...</div>';
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
        statusClass = 'expired'; statusText = 'Token has expired'; statusIcon = 'fa-clock';
    } else if (result.valid) {
        statusClass = 'valid'; statusText = 'Token is valid'; statusIcon = 'fa-check-circle';
    } else {
        statusClass = 'invalid'; statusText = 'Token is invalid'; statusIcon = 'fa-times-circle';
    }

    let html = `<div class="verification-status ${statusClass}">
        <i class="fa ${statusIcon}"></i> <span>${statusText}</span></div>`;

    if (result.decoded) {
        html += '<div class="token-details">';
        if (result.decoded.header) {
            html += `<div class="token-section"><h4>Header</h4>
                <pre>${sanitizeHtml(JSON.stringify(result.decoded.header, null, 2))}</pre></div>`;
        }
        if (result.decoded.payload) {
            html += `<div class="token-section"><h4>Payload</h4>
                <pre>${sanitizeHtml(JSON.stringify(result.decoded.payload, null, 2))}</pre></div>`;
            html += buildClaimsHtml(result.decoded.payload);
        }
        html += '</div>';
    }

    if (result.error) {
        html += `<div class="verification-error">
            <strong>Error:</strong> ${sanitizeHtml(String(result.error))}</div>`;
    }

    el.innerHTML = html;
};

const buildClaimsHtml = (payload) => {
    let html = '<div class="token-claims">';
    if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const isExpired = expDate < new Date();
        html += `<div class="claim ${isExpired ? 'expired' : ''}">
            <strong>Expiration:</strong> ${expDate.toLocaleString()}
            ${isExpired ? ' <span class="expired-label">(Expired)</span>' : ''}</div>`;
    }
    if (payload.iss) {
        html += `<div class="claim"><strong>Issuer:</strong> ${sanitizeHtml(String(payload.iss))}</div>`;
    }
    if (payload.sub) {
        html += `<div class="claim"><strong>Subject:</strong> ${sanitizeHtml(String(payload.sub))}</div>`;
    }
    html += '</div>';
    return html;
};
