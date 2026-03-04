'use strict';

/**
 * Gateway endpoint tester component.
 * Allows users to send test HTTP requests to gateway routes via the proxy servlet
 * and view the response (status, headers, body).
 *
 * @module js/endpoint-tester
 */

import {
    fetchGatewayApi, sendGatewayTestRequest, fetchOAuthToken,
    discoverTokenEndpoint, resolveJwtConfigServiceId,
    getControllerServiceProperties, getComponentId
} from './api.js';
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
            <div class="token-fetch-section">
                <button type="button" class="token-fetch-toggle">
                    <span class="toggle-icon">&#9654;</span>
                    ${t('tester.token.fetch.heading')}
                </button>
                <div class="token-fetch-body hidden">
                    <div class="form-group">
                        <label for="issuer-selector">${t('tester.token.fetch.issuer')}</label>
                        <select class="issuer-selector" id="issuer-selector">
                            <option value="">${t('tester.token.fetch.issuer.loading')}</option>
                        </select>
                    </div>
                    <div class="token-fetch-endpoint-row">
                        <div class="form-group">
                            <label for="token-endpoint-url">${t('tester.token.fetch.endpoint')}</label>
                            <input type="text" class="token-endpoint-url" id="token-endpoint-url"
                                placeholder="${t('tester.token.fetch.endpoint.placeholder')}" autocomplete="off">
                        </div>
                        <button type="button" class="discover-btn">${t('tester.token.fetch.discover')}</button>
                    </div>
                    <div class="form-group">
                        <label for="grant-type-selector">${t('tester.token.fetch.grant.type')}</label>
                        <select class="grant-type-selector" id="grant-type-selector">
                            <option value="password">${t('tester.token.fetch.grant.password')}</option>
                            <option value="client_credentials">${t('tester.token.fetch.grant.client')}</option>
                        </select>
                    </div>
                    <div class="token-fetch-row">
                        <div class="form-group">
                            <label for="tf-client-id">${t('tester.token.fetch.client.id')}</label>
                            <input type="text" class="tf-client-id" id="tf-client-id" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="tf-client-secret">${t('tester.token.fetch.client.secret')}</label>
                            <input type="password" class="tf-client-secret" id="tf-client-secret" autocomplete="off">
                        </div>
                    </div>
                    <div class="token-fetch-row ropc-fields">
                        <div class="form-group">
                            <label for="tf-username">${t('tester.token.fetch.username')}</label>
                            <input type="text" class="tf-username" id="tf-username" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label for="tf-password">${t('tester.token.fetch.password')}</label>
                            <input type="password" class="tf-password" id="tf-password" autocomplete="off">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="tf-scope">${t('tester.token.fetch.scope')}</label>
                        <input type="text" class="tf-scope" id="tf-scope" value="openid" autocomplete="off">
                    </div>
                    <button type="button" class="fetch-token-btn">${t('tester.token.fetch.btn')}</button>
                    <div class="token-fetch-status"></div>
                </div>
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
    container.querySelector('.method-selector').addEventListener('change', () => {
        updateBodyVisibility(container);
    });

    // Send request handler
    container.querySelector('.send-request-button').addEventListener('click', () => {
        handleSendRequest(container);
    });

    // Token fetch section: toggle visibility
    container.querySelector('.token-fetch-toggle').addEventListener('click', () => {
        toggleTokenFetchSection(container);
    });

    // Grant type toggle: show/hide ROPC fields
    container.querySelector('.grant-type-selector').addEventListener('change', () => {
        updateRopcFieldsVisibility(container);
    });

    // Discover button
    container.querySelector('.discover-btn').addEventListener('click', () => {
        handleDiscoverTokenEndpoint(container);
    });

    // Fetch token button
    container.querySelector('.fetch-token-btn').addEventListener('click', () => {
        handleFetchToken(container);
    });

    // Load issuers for the dropdown
    loadIssuers(container);
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

        // Update method selector and body visibility for the selected route
        const updateForSelectedRoute = () => {
            updateMethodsForRoute(container);
            updateBodyVisibility(container);
        };
        selector.addEventListener('change', updateForSelectedRoute);
        updateForSelectedRoute();
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

const updateBodyVisibility = (container) => {
    const method = container.querySelector('.method-selector').value;
    const bodyGroup = container.querySelector('.body-group');
    const needsBody = ['POST', 'PUT', 'PATCH'].includes(method);
    bodyGroup.classList.toggle('hidden', !needsBody);
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

const toggleTokenFetchSection = (container) => {
    const body = container.querySelector('.token-fetch-body');
    const icon = container.querySelector('.toggle-icon');
    const isHidden = body.classList.contains('hidden');
    body.classList.toggle('hidden', !isHidden);
    icon.classList.toggle('expanded', isHidden);
};

const updateRopcFieldsVisibility = (container) => {
    const grantType = container.querySelector('.grant-type-selector').value;
    const ropcFields = container.querySelector('.ropc-fields');
    ropcFields.classList.toggle('hidden', grantType !== 'password');
};

const loadIssuers = async (container) => {
    const selector = container.querySelector('.issuer-selector');
    try {
        const processorId = getComponentId();
        if (!processorId) {
            selector.innerHTML = `<option value="">${t('tester.token.fetch.issuer.none')}</option>`;
            return;
        }

        const csId = await resolveJwtConfigServiceId(processorId);
        if (!csId) {
            selector.innerHTML = `<option value="">${t('tester.token.fetch.issuer.none')}</option>`;
            return;
        }

        const { properties } = await getControllerServiceProperties(csId);

        // Extract issuer URLs from issuer.*.issuer properties
        const issuers = [];
        for (const [key, value] of Object.entries(properties)) {
            if (key.endsWith('.issuer') && value) {
                issuers.push(value);
            }
        }

        if (issuers.length === 0) {
            selector.innerHTML = `<option value="">${t('tester.token.fetch.issuer.none')}</option>`;
            return;
        }

        let options = issuers.map((issuer) =>
            `<option value="${escapeAttr(issuer)}">${escapeHtml(issuer)}</option>`
        ).join('');
        options += `<option value="__custom__">${t('tester.token.fetch.issuer.custom')}</option>`;
        selector.innerHTML = options;

        // Auto-discover when first issuer is selected
        selector.addEventListener('change', () => {
            const val = selector.value;
            if (val && val !== '__custom__') {
                handleDiscoverTokenEndpoint(container);
            } else if (val === '__custom__') {
                container.querySelector('.token-endpoint-url').value = '';
                container.querySelector('.token-endpoint-url').focus();
            }
        });
    } catch (err) {
        log.warn('Failed to load issuers for token fetch:', err.message);
        selector.innerHTML = `<option value="">${t('tester.token.fetch.issuer.none')}</option>`;
    }
};

const handleDiscoverTokenEndpoint = async (container) => {
    const issuerSelector = container.querySelector('.issuer-selector');
    const issuerUrl = issuerSelector.value;
    const endpointInput = container.querySelector('.token-endpoint-url');
    const discoverBtn = container.querySelector('.discover-btn');
    const statusEl = container.querySelector('.token-fetch-status');

    if (!issuerUrl || issuerUrl === '__custom__') {
        return;
    }

    discoverBtn.disabled = true;
    discoverBtn.textContent = t('tester.token.fetch.discovering');
    statusEl.textContent = '';
    statusEl.className = 'token-fetch-status';

    try {
        const result = await discoverTokenEndpoint(issuerUrl);
        endpointInput.value = result.tokenEndpoint || '';
    } catch (err) {
        log.error('Token endpoint discovery failed:', err.message);
        statusEl.textContent = t('tester.token.fetch.error', err.message);
        statusEl.className = 'token-fetch-status error';
    } finally {
        discoverBtn.disabled = false;
        discoverBtn.textContent = t('tester.token.fetch.discover');
    }
};

const handleFetchToken = async (container) => {
    const tokenEndpointUrl = container.querySelector('.token-endpoint-url').value.trim();
    const grantType = container.querySelector('.grant-type-selector').value;
    const clientId = container.querySelector('.tf-client-id').value.trim();
    const clientSecret = container.querySelector('.tf-client-secret').value;
    const scope = container.querySelector('.tf-scope').value.trim();
    const statusEl = container.querySelector('.token-fetch-status');
    const fetchBtn = container.querySelector('.fetch-token-btn');

    if (!tokenEndpointUrl) {
        statusEl.textContent = t('tester.token.fetch.error.missing.endpoint');
        statusEl.className = 'token-fetch-status error';
        return;
    }

    if (!clientId) {
        statusEl.textContent = t('tester.token.fetch.error.missing.fields');
        statusEl.className = 'token-fetch-status error';
        return;
    }

    const payload = { tokenEndpointUrl, grantType, clientId, clientSecret, scope };

    if (grantType === 'password') {
        payload.username = container.querySelector('.tf-username').value.trim();
        payload.password = container.querySelector('.tf-password').value;
    }

    fetchBtn.disabled = true;
    fetchBtn.textContent = t('tester.token.fetch.btn.fetching');
    statusEl.textContent = '';
    statusEl.className = 'token-fetch-status';

    try {
        const result = await fetchOAuthToken(payload);

        if (result.access_token) {
            container.querySelector('.token-input').value = result.access_token;
            const expiresMsg = result.expires_in
                ? t('tester.token.fetch.success', result.expires_in)
                : t('tester.token.fetch.success', '?');
            statusEl.textContent = expiresMsg;
            statusEl.className = 'token-fetch-status success';
        } else {
            const errorMsg = result.error || 'No access_token in response';
            statusEl.textContent = t('tester.token.fetch.error', errorMsg);
            statusEl.className = 'token-fetch-status error';
        }
    } catch (err) {
        log.error('Token fetch failed:', err.message);
        statusEl.textContent = t('tester.token.fetch.error', err.message);
        statusEl.className = 'token-fetch-status error';
    } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = t('tester.token.fetch.btn');
    }
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
