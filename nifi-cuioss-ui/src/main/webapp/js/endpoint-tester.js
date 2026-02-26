'use strict';

/**
 * Gateway endpoint tester component.
 * Allows users to send test HTTP requests to gateway routes via the proxy servlet
 * and view the response (status, headers, body).
 *
 * @module js/endpoint-tester
 */

import { fetchGatewayApi, sendGatewayTestRequest } from './api.js';
import { log, t } from './utils.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the endpoint tester inside the given element.
 * @param {HTMLElement} element  the #endpoint-tester pane
 */
export const init = async (element) => {
    if (!element || element.querySelector('.endpoint-tester-display')) return;

    const container = document.createElement('div');
    container.className = 'endpoint-tester-display';
    element.appendChild(container);

    container.innerHTML = `
        <div class="tester-header">
            <h2>${t('tester.heading')}</h2>
        </div>
        <div class="tester-form">
            <div class="tester-form-row">
                <div class="form-group">
                    <label for="route-selector">${t('tester.form.route')}</label>
                    <select class="route-selector" id="route-selector">
                        <option value="">${t('tester.routes.loading')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="method-selector">${t('tester.form.method')}</label>
                    <select class="method-selector" id="method-selector">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label for="token-input">${t('tester.form.token')}</label>
                <textarea class="token-input" id="token-input"
                    placeholder="${t('tester.form.token.placeholder')}"></textarea>
            </div>
            <div class="form-group body-group hidden">
                <label for="body-input">${t('tester.form.body')}</label>
                <textarea class="body-input" id="body-input"
                    placeholder='${t('tester.form.body.placeholder')}'></textarea>
            </div>
            <button class="send-request-button">
                <i class="fa fa-paper-plane"></i> ${t('tester.btn.send')}
            </button>
        </div>
        <div class="response-display hidden">
            <h3>${t('tester.response.heading')}</h3>
            <div class="response-status"></div>
            <div class="response-headers"></div>
            <div class="response-body"></div>
        </div>`;

    // Load routes
    await loadRoutes(container);

    // Toggle body editor based on method
    container.querySelector('.method-selector').addEventListener('change', (e) => {
        const bodyGroup = container.querySelector('.body-group');
        const needsBody = ['POST', 'PUT', 'PATCH'].includes(e.target.value);
        bodyGroup.classList.toggle('hidden', !needsBody);
    });

    // Send request handler
    container.querySelector('.send-request-button').addEventListener('click', () => {
        handleSendRequest(container);
    });
};

export const cleanup = () => { /* no persistent resources */ };

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const loadRoutes = async (container) => {
    const selector = container.querySelector('.route-selector');
    try {
        const config = await fetchGatewayApi('/config');
        const routes = config.routes || [];

        if (routes.length === 0) {
            selector.innerHTML = `<option value="">${t('tester.routes.none')}</option>`;
            return;
        }

        selector.innerHTML = routes.map((r) =>
            `<option value="${escapeAttr(r.path)}" data-methods="${escapeAttr((r.methods || []).join(','))}">${escapeHtml(r.name)} (${escapeHtml(r.path)})</option>`
        ).join('');

        // Update method selector to match route's allowed methods
        selector.addEventListener('change', () => {
            updateMethodsForRoute(container);
        });
        updateMethodsForRoute(container);
    } catch (err) {
        log.error('Failed to load routes for tester:', err.message);
        selector.innerHTML = `<option value="">${t('tester.routes.failed')}</option>`;
    }
};

const updateMethodsForRoute = (container) => {
    const selector = container.querySelector('.route-selector');
    const methodSelector = container.querySelector('.method-selector');
    const selected = selector.options[selector.selectedIndex];

    if (!selected) return;

    const methods = selected.dataset.methods;
    if (methods) {
        const allowed = methods.split(',').filter(Boolean);
        if (allowed.length > 0) {
            methodSelector.innerHTML = allowed.map((m) =>
                `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`
            ).join('');
        }
    }
};

const handleSendRequest = async (container) => {
    const path = container.querySelector('.route-selector').value;
    const method = container.querySelector('.method-selector').value;
    const token = container.querySelector('.token-input').value.trim();
    const bodyInput = container.querySelector('.body-input');
    const body = bodyInput && !container.querySelector('.body-group').classList.contains('hidden')
        ? bodyInput.value.trim() || null
        : null;

    if (!path) {
        showError(container, t('tester.error.no.route'));
        return;
    }

    const headers = {};
    if (token) {
        // Add Bearer prefix if not already present
        headers['Authorization'] = token.startsWith('Bearer ')
            ? token : `Bearer ${token}`;
    }

    const btn = container.querySelector('.send-request-button');
    btn.disabled = true;
    btn.textContent = t('tester.btn.sending');

    try {
        const result = await sendGatewayTestRequest({ path, method, headers, body });
        displayResponse(container, result);
    } catch (err) {
        log.error('Test request failed:', err.message);
        showError(container, t('tester.error.request.failed', err.message));
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa fa-paper-plane"></i> ${t('tester.btn.send')}`;
    }
};

const displayResponse = (container, result) => {
    const display = container.querySelector('.response-display');
    display.classList.remove('hidden');

    // Status
    const statusEl = display.querySelector('.response-status');
    const statusCode = result.status || 0;
    const statusClass = statusCode >= 500 ? 'status-5xx'
        : statusCode >= 400 ? 'status-4xx'
            : 'status-2xx';
    statusEl.className = `response-status ${statusClass}`;
    statusEl.textContent = t('tester.response.status', statusCode);

    // Headers
    const headersEl = display.querySelector('.response-headers');
    const responseHeaders = result.headers || {};
    const headerLines = Object.entries(responseHeaders)
        .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`)
        .join('\n');
    headersEl.textContent = headerLines || t('tester.response.no.headers');

    // Body
    const bodyEl = display.querySelector('.response-body');
    const bodyStr = result.body || '';
    try {
        // Try to pretty-print JSON
        const parsed = JSON.parse(bodyStr);
        bodyEl.textContent = JSON.stringify(parsed, null, 2);
    } catch {
        bodyEl.textContent = bodyStr;
    }
};

const showError = (container, message) => {
    const display = container.querySelector('.response-display');
    display.classList.remove('hidden');
    display.querySelector('.response-status').className = 'response-status status-5xx';
    display.querySelector('.response-status').textContent = t('tester.response.error');
    display.querySelector('.response-headers').textContent = '';
    display.querySelector('.response-body').textContent = message;
};

const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

const escapeAttr = (str) => {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
