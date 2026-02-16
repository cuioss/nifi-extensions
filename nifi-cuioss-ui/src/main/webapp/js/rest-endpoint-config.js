'use strict';

/**
 * Gateway endpoint configuration display component.
 * Fetches configuration from the gateway's management API via the proxy servlet
 * and renders a read-only view of routes and global settings.
 *
 * @module js/rest-endpoint-config
 */

import { fetchGatewayApi } from './api.js';
import { log } from './utils.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the endpoint configuration display inside the given element.
 * @param {HTMLElement} element  the #endpoint-config pane
 */
export const init = async (element) => {
    if (!element || element.querySelector('.endpoint-config-display')) return;

    const container = document.createElement('div');
    container.className = 'endpoint-config-display';
    element.appendChild(container);

    container.innerHTML = `
        <div class="endpoint-config-header">
            <h2>Gateway Endpoint Configuration</h2>
            <button class="refresh-config-button" title="Reload configuration from gateway">
                <i class="fa fa-refresh"></i> Refresh
            </button>
        </div>
        <div class="endpoint-config-content">
            <p>Loading configuration...</p>
        </div>`;

    const contentEl = container.querySelector('.endpoint-config-content');
    container.querySelector('.refresh-config-button').addEventListener('click', () => {
        loadConfig(contentEl);
    });

    await loadConfig(contentEl);
};

export const cleanup = () => { /* no persistent resources */ };

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const loadConfig = async (contentEl) => {
    contentEl.innerHTML = '<p>Loading configuration...</p>';
    try {
        const config = await fetchGatewayApi('/config');
        renderConfig(contentEl, config);
    } catch (err) {
        log.error('Failed to load gateway configuration:', err.message);
        contentEl.innerHTML = `
            <div class="config-error" role="alert">
                <p>Failed to load gateway configuration: ${escapeHtml(err.message)}</p>
                <p>The gateway may not be running or the proxy is not configured.</p>
            </div>`;
    }
};

const renderConfig = (contentEl, config) => {
    contentEl.innerHTML = '';

    // Global settings section
    const settingsSection = document.createElement('div');
    settingsSection.className = 'config-section global-settings';
    settingsSection.innerHTML = `
        <h3>Global Settings</h3>
        <table class="config-table">
            <tbody>
                <tr><td>Component</td><td>${escapeHtml(config.component || 'N/A')}</td></tr>
                <tr><td>Listening Port</td><td>${escapeHtml(String(config.port || 'N/A'))}</td></tr>
                <tr><td>Max Request Body Size</td><td>${formatBytes(config.maxRequestBodySize)}</td></tr>
                <tr><td>Queue Size</td><td>${escapeHtml(String(config.queueSize || 'N/A'))}</td></tr>
                <tr><td>SSL Enabled</td><td>${config.ssl ? 'Yes' : 'No'}</td></tr>
                <tr><td>CORS Allowed Origins</td><td>${escapeHtml((config.corsAllowedOrigins || []).join(', ') || 'None')}</td></tr>
            </tbody>
        </table>`;
    contentEl.appendChild(settingsSection);

    // Routes section
    const routesSection = document.createElement('div');
    routesSection.className = 'config-section routes-section';

    const routes = config.routes || [];
    if (routes.length === 0) {
        routesSection.innerHTML = `
            <h3>Routes</h3>
            <p class="empty-state">No routes configured.</p>`;
    } else {
        routesSection.innerHTML = `
            <h3>Routes (${routes.length})</h3>
            <table class="config-table routes-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Path</th>
                        <th>Methods</th>
                        <th>Required Roles</th>
                        <th>Required Scopes</th>
                    </tr>
                </thead>
                <tbody>
                    ${routes.map((r) => `
                        <tr>
                            <td>${escapeHtml(r.name || '')}</td>
                            <td><code>${escapeHtml(r.path || '')}</code></td>
                            <td>${(r.methods || []).map((m) => `<span class="method-badge">${escapeHtml(m)}</span>`).join(' ')}</td>
                            <td>${(r.requiredRoles || []).map((role) => escapeHtml(role)).join(', ') || '<em>none</em>'}</td>
                            <td>${(r.requiredScopes || []).map((s) => escapeHtml(s)).join(', ') || '<em>none</em>'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }
    contentEl.appendChild(routesSection);
};

const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

const formatBytes = (bytes) => {
    if (bytes == null) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};
