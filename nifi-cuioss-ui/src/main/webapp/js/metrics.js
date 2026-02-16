'use strict';

/**
 * Metrics dashboard tab component.
 * Supports both JWT/CS metrics and gateway metrics (3-category display).
 *
 * @module js/metrics
 */

import { getSecurityMetrics, fetchGatewayApi } from './api.js';
import { sanitizeHtml, formatNumber, formatDate, t, log } from './utils.js';

let lastMetricsData = null;
let metricsInterval = null;
let metricsEndpointAvailable = true;
let _isGateway = false;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const metricsHeaderHtml = (title) => `
    <div class="metrics-header">
        <h2>${title}</h2>
        <div class="metrics-actions">
            <button id="refresh-metrics-btn" class="btn btn-small"
                    data-testid="refresh-metrics-button">
                <i class="fa fa-refresh"></i> Refresh
            </button>
            <button id="export-metrics-btn" class="btn btn-small"
                    data-testid="export-metrics-button">
                <i class="fa fa-download"></i> Export
            </button>
        </div>
    </div>`;

const metricsFooterHtml = () => `
    <div class="metrics-footer">
        <span class="last-updated" data-testid="last-updated"
              aria-live="polite" role="status">Last updated: Never</span>
        <span class="refresh-indicator hidden" data-testid="refresh-indicator"
              aria-live="polite">
            <i class="fa fa-spinner fa-spin"></i> Refreshing...
        </span>
    </div>
    <div id="export-options" class="export-options" data-testid="export-options">
        <h5>Export Format:</h5>
        <button class="btn btn-small" data-format="csv"
                data-testid="export-csv">CSV</button>
        <button class="btn btn-small" data-format="json"
                data-testid="export-json">JSON</button>
        <button class="btn btn-small" data-format="prometheus"
                data-testid="export-prometheus">Prometheus</button>
    </div>`;

const buildJwtTemplate = () => `
    <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
        ${metricsHeaderHtml(t('jwt.validator.metrics.title'))}

        <div class="metrics-summary" data-testid="validation-metrics">
            <h4>Validation Metrics</h4>
            <div class="metrics-grid">
                <div class="metric-card"><h5>Total Validations</h5>
                    <div class="metric-value" id="total-validations"
                         data-testid="total-validations">0</div></div>
                <div class="metric-card"><h5>Success Rate</h5>
                    <div class="metric-value" id="success-rate"
                         data-testid="success-rate">0%</div></div>
                <div class="metric-card"><h5>Failure Rate</h5>
                    <div class="metric-value" id="failure-rate"
                         data-testid="failure-rate">0%</div></div>
                <div class="metric-card"><h5>Active Issuers</h5>
                    <div class="metric-value" id="active-issuers">0</div></div>
            </div>
        </div>

        <div class="performance-metrics" data-testid="performance-metrics">
            <h4>Performance Metrics</h4>
            <div class="metrics-grid">
                <div class="metric-card"><h5>Average Response Time</h5>
                    <div class="metric-value" id="avg-response-time"
                         data-testid="avg-response-time">0 ms</div></div>
                <div class="metric-card"><h5>Min Response Time</h5>
                    <div class="metric-value" id="min-response-time"
                         data-testid="min-response-time">0 ms</div></div>
                <div class="metric-card"><h5>Max Response Time</h5>
                    <div class="metric-value" id="max-response-time"
                         data-testid="max-response-time">0 ms</div></div>
                <div class="metric-card"><h5>P95 Response Time</h5>
                    <div class="metric-value" id="p95-response-time"
                         data-testid="p95-response-time">0 ms</div></div>
            </div>
        </div>

        <div class="issuer-metrics" data-testid="issuer-metrics">
            <h4>Issuer-Specific Metrics</h4>
            <div class="issuer-metrics-container">
                <table class="issuer-metrics-table" data-testid="issuer-metrics-table">
                    <thead><tr>
                        <th>Issuer</th><th>Total Requests</th><th>Success</th>
                        <th>Failed</th><th>Success Rate</th><th>Avg Response Time</th>
                    </tr></thead>
                    <tbody id="issuer-metrics-list">
                        <tr><td colspan="6" class="metrics-loading">Loading metrics...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="error-metrics" data-testid="error-metrics">
            <h4>Recent Errors</h4>
            <div id="error-metrics-list" class="metrics-list"
                 data-testid="error-metrics-list">
                <div class="no-errors">No recent errors</div>
            </div>
        </div>

        ${metricsFooterHtml()}
    </div>`;

const buildGatewayTemplate = () => `
    <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
        ${metricsHeaderHtml('Gateway Metrics')}

        <div class="gateway-metrics-section" data-testid="token-validation-metrics">
            <h4>Token Validation</h4>
            <div class="metrics-grid" id="token-validation-grid">
                <div class="no-data">Loading...</div>
            </div>
        </div>

        <div class="gateway-metrics-section" data-testid="http-security-metrics">
            <h4>HTTP Security</h4>
            <div class="metrics-grid" id="http-security-grid">
                <div class="no-data">Loading...</div>
            </div>
        </div>

        <div class="gateway-metrics-section" data-testid="gateway-events-metrics">
            <h4>Gateway Events</h4>
            <div class="metrics-grid" id="gateway-events-grid">
                <div class="no-data">Loading...</div>
            </div>
        </div>

        ${metricsFooterHtml()}
    </div>`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the Metrics tab inside the given container element.
 * @param {HTMLElement} container  the #metrics pane
 * @param {boolean} [isGateway=false]  whether to show gateway metrics
 */
export const init = (container, isGateway = false) => {
    if (!container || container.querySelector('#jwt-metrics-content')) return;
    _isGateway = isGateway;

    container.innerHTML = isGateway ? buildGatewayTemplate() : buildJwtTemplate();

    // Bind event handlers
    container.querySelector('#refresh-metrics-btn')
        ?.addEventListener('click', handleRefresh);
    container.querySelector('#export-metrics-btn')
        ?.addEventListener('click', () => {
            const opts = container.querySelector('#export-options');
            if (opts) opts.classList.toggle('visible');
        });
    container.querySelector('#export-options')
        ?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-format]');
            if (btn) {
                handleExport(btn.dataset.format);
                container.querySelector('#export-options')
                    ?.classList.remove('visible');
            }
        });

    // Initial load + periodic refresh
    refreshMetrics();
    if (typeof jest === 'undefined') {
        metricsInterval = setInterval(refreshMetrics, 10000);
    }
};

export const cleanup = () => {
    if (metricsInterval) { clearInterval(metricsInterval); metricsInterval = null; }
    metricsEndpointAvailable = true;
    _isGateway = false;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};

const pct = (v) => (v * 100).toFixed(1) + '%';

const handleRefresh = async () => {
    const ind = document.querySelector('[data-testid="refresh-indicator"]');
    if (ind) ind.classList.remove('hidden');
    await refreshMetrics();
    if (ind) setTimeout(() => { ind.classList.add('hidden'); }, 500);
};

const refreshMetrics = async () => {
    if (!metricsEndpointAvailable) return;
    try {
        if (_isGateway) {
            const raw = await fetchGatewayApi('/metrics');
            updateGatewayDisplay(raw);
        } else {
            const raw = await getSecurityMetrics();
            const data = {
                totalValidations: raw.totalTokensValidated || 0,
                successCount: raw.validTokens || 0,
                failureCount: raw.invalidTokens || 0,
                avgResponseTime: raw.averageResponseTime || 0,
                minResponseTime: raw.minResponseTime || 0,
                maxResponseTime: raw.maxResponseTime || 0,
                p95ResponseTime: raw.p95ResponseTime || 0,
                activeIssuers: raw.activeIssuers || 0,
                issuerMetrics: raw.issuerMetrics || [],
                recentErrors: raw.topErrors || []
            };
            updateDisplay(data);
        }
    } catch (error) {
        log.error('Failed to refresh metrics:', error);
        if (error.status === 404) {
            metricsEndpointAvailable = false;
            showNotAvailable();
        } else {
            showError();
        }
    }
};

// ---------------------------------------------------------------------------
// JWT display
// ---------------------------------------------------------------------------

const updateDisplay = (d) => {
    lastMetricsData = d;
    setText('total-validations', formatNumber(d.totalValidations));
    const sr = d.totalValidations > 0 ? d.successCount / d.totalValidations : 0;
    const fr = d.totalValidations > 0 ? d.failureCount / d.totalValidations : 0;
    setText('success-rate', pct(sr));
    setText('failure-rate', pct(fr));
    setText('active-issuers', String(d.activeIssuers));
    setText('avg-response-time', `${d.avgResponseTime} ms`);
    setText('min-response-time', `${d.minResponseTime} ms`);
    setText('max-response-time', `${d.maxResponseTime} ms`);
    setText('p95-response-time', `${d.p95ResponseTime} ms`);

    // Issuer table
    const tbody = document.getElementById('issuer-metrics-list');
    if (tbody) {
        tbody.innerHTML = d.issuerMetrics.length > 0
            ? d.issuerMetrics.map((i) => `
                <tr data-testid="issuer-metrics-row">
                    <td data-testid="issuer-name">${sanitizeHtml(String(i.name || ''))}</td>
                    <td>${formatNumber(i.totalRequests || i.validations || 0)}</td>
                    <td>${formatNumber(i.successCount || 0)}</td>
                    <td>${formatNumber(i.failureCount || 0)}</td>
                    <td>${pct((i.successRate || 0) / 100)}</td>
                    <td>${i.avgResponseTime || 0} ms</td>
                </tr>`).join('')
            : '<tr><td colspan="6" class="no-data">No issuer data available</td></tr>';
    }

    // Errors
    const errList = document.getElementById('error-metrics-list');
    if (errList) {
        errList.innerHTML = d.recentErrors.length > 0
            ? d.recentErrors.map((e) => `
                <div class="error-metric-item">
                    <div class="error-details">
                        <span class="error-issuer">${sanitizeHtml(String(e.issuer || 'Unknown'))}</span>
                        <span class="error-message">${sanitizeHtml(String(e.error || ''))}</span>
                        <span class="error-count">(${e.count} occurrences)</span>
                    </div>
                    <div class="error-time">${formatDate(e.timestamp)}</div>
                </div>`).join('')
            : '<div class="no-errors">No recent errors</div>';
    }

    // Last updated
    const lu = document.querySelector('[data-testid="last-updated"]');
    if (lu) lu.textContent = `Last updated: ${formatDate(new Date())}`;
};

// ---------------------------------------------------------------------------
// Gateway display
// ---------------------------------------------------------------------------

const formatCounterName = (key) =>
    key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const renderCounterGrid = (containerId, counters) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const entries = Object.entries(counters);
    if (entries.length === 0) {
        container.innerHTML = '<div class="no-data">No data available</div>';
        return;
    }

    container.innerHTML = entries.map(([key, value]) =>
        `<div class="metric-card">
            <h5>${sanitizeHtml(formatCounterName(key))}</h5>
            <div class="metric-value">${formatNumber(value)}</div>
        </div>`
    ).join('');
};

const updateGatewayDisplay = (data) => {
    lastMetricsData = data;

    renderCounterGrid('token-validation-grid', data.tokenValidation || {});
    renderCounterGrid('http-security-grid', data.httpSecurity || {});
    renderCounterGrid('gateway-events-grid', data.gatewayEvents || {});

    const lu = document.querySelector('[data-testid="last-updated"]');
    if (lu) lu.textContent = `Last updated: ${formatDate(new Date())}`;
};

// ---------------------------------------------------------------------------
// Status banners
// ---------------------------------------------------------------------------

const showStatusBanner = (el, className, html) => {
    // Insert a banner at the top of the dashboard without destroying the structure
    const existing = el.querySelector('.metrics-status-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.className = `metrics-status-banner ${className}`;
    banner.innerHTML = html;
    el.prepend(banner);
};

const showError = () => {
    const el = document.getElementById('jwt-metrics-content');
    if (el) {
        showStatusBanner(el, 'server-error',
            '<div class="error-content"><strong>Error:</strong> Unable to load metrics.</div>');
    }
};

const showNotAvailable = () => {
    const el = document.getElementById('jwt-metrics-content');
    if (el) {
        showStatusBanner(el, 'validation-error',
            '<div class="error-content">' +
            '<strong>Metrics Not Available</strong> — ' +
            'The metrics endpoint is not currently implemented.</div>');
    }
    cleanup();
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const handleExport = (format) => {
    if (_isGateway) {
        handleGatewayExport(format);
        return;
    }
    handleJwtExport(format);
};

const triggerDownload = (content, mimeType, filename) => {
    const blob = new Blob([content], { type: mimeType });
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    globalThis.URL.revokeObjectURL(url);
};

const handleJwtExport = (format) => {
    const m = {
        timestamp: new Date().toISOString(),
        totalValidations: document.getElementById('total-validations')?.textContent || '0',
        successRate: document.getElementById('success-rate')?.textContent || '0%',
        failureRate: document.getElementById('failure-rate')?.textContent || '0%',
        activeIssuers: document.getElementById('active-issuers')?.textContent || '0',
        avgResponseTime: document.getElementById('avg-response-time')?.textContent || '0 ms',
        minResponseTime: document.getElementById('min-response-time')?.textContent || '0 ms',
        maxResponseTime: document.getElementById('max-response-time')?.textContent || '0 ms',
        p95ResponseTime: document.getElementById('p95-response-time')?.textContent || '0 ms',
        lastMetricsData
    };

    let content, mimeType, filename;
    switch (format) {
        case 'json':
            content = JSON.stringify(m, null, 2);
            mimeType = 'application/json';
            filename = `jwt-metrics-${Date.now()}.json`;
            break;
        case 'csv':
            content = 'Metric,Value\n' +
                `Timestamp,${m.timestamp}\nTotal Validations,${m.totalValidations}\n` +
                `Success Rate,${m.successRate}\nFailure Rate,${m.failureRate}\n` +
                `Active Issuers,${m.activeIssuers}\n` +
                `Average Response Time,${m.avgResponseTime}\n` +
                `Min Response Time,${m.minResponseTime}\n` +
                `Max Response Time,${m.maxResponseTime}\n` +
                `P95 Response Time,${m.p95ResponseTime}\n`;
            mimeType = 'text/csv';
            filename = `jwt-metrics-${Date.now()}.csv`;
            break;
        case 'prometheus':
            content = '# HELP jwt_total_validations Total number of JWT validations\n' +
                '# TYPE jwt_total_validations counter\n' +
                `jwt_total_validations ${m.totalValidations.replaceAll(',', '')}\n\n` +
                '# HELP jwt_success_rate JWT validation success rate\n' +
                '# TYPE jwt_success_rate gauge\n' +
                `jwt_success_rate ${Number.parseFloat(m.successRate) / 100}\n\n` +
                '# HELP jwt_active_issuers Number of active JWT issuers\n' +
                '# TYPE jwt_active_issuers gauge\n' +
                `jwt_active_issuers ${m.activeIssuers}\n`;
            mimeType = 'text/plain';
            filename = `jwt-metrics-${Date.now()}.txt`;
            break;
        default:
            return;
    }

    triggerDownload(content, mimeType, filename);
};

const handleGatewayExport = (format) => {
    const data = lastMetricsData || {};
    const ts = new Date().toISOString();

    let content, mimeType, filename;
    switch (format) {
        case 'json':
            content = JSON.stringify({ timestamp: ts, ...data }, null, 2);
            mimeType = 'application/json';
            filename = `gateway-metrics-${Date.now()}.json`;
            break;
        case 'csv': {
            let csv = 'Category,Metric,Value\n';
            for (const [category, counters] of Object.entries(data)) {
                if (typeof counters !== 'object' || counters === null) continue;
                for (const [key, value] of Object.entries(counters)) {
                    csv += `${category},${key},${value}\n`;
                }
            }
            content = csv;
            mimeType = 'text/csv';
            filename = `gateway-metrics-${Date.now()}.csv`;
            break;
        }
        case 'prometheus': {
            let output = '';
            if (data.tokenValidation) {
                output += '# HELP nifi_jwt_validations_total Token validation events (oauth-sheriff)\n';
                output += '# TYPE nifi_jwt_validations_total counter\n';
                for (const [key, value] of Object.entries(data.tokenValidation)) {
                    output += `nifi_jwt_validations_total{result="${sanitizeHtml(key)}"} ${value}\n`;
                }
                output += '\n';
            }
            if (data.httpSecurity) {
                output += '# HELP nifi_gateway_http_security_events_total Transport-level security events (cui-http)\n';
                output += '# TYPE nifi_gateway_http_security_events_total counter\n';
                for (const [key, value] of Object.entries(data.httpSecurity)) {
                    output += `nifi_gateway_http_security_events_total{type="${sanitizeHtml(key)}"} ${value}\n`;
                }
                output += '\n';
            }
            if (data.gatewayEvents) {
                output += '# HELP nifi_gateway_events_total Application-level gateway events\n';
                output += '# TYPE nifi_gateway_events_total counter\n';
                for (const [key, value] of Object.entries(data.gatewayEvents)) {
                    output += `nifi_gateway_events_total{type="${sanitizeHtml(key)}"} ${value}\n`;
                }
                output += '\n';
            }
            content = output;
            mimeType = 'text/plain';
            filename = `gateway-metrics-${Date.now()}.txt`;
            break;
        }
        default:
            return;
    }

    triggerDownload(content, mimeType, filename);
};
