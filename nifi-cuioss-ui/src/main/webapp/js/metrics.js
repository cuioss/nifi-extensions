'use strict';

/**
 * Metrics dashboard tab component.
 * Supports both JWT/CS metrics and gateway metrics (3-category display).
 *
 * @module js/metrics
 */

import { fetchGatewayApi } from './api.js';
import { sanitizeHtml, formatNumber, formatDate, t, log } from './utils.js';

let lastMetricsData = null;
let metricsInterval = null;
let metricsEndpointAvailable = true;
let _isGateway = false;
let _refreshGeneration = 0;

/** All known gateway event types — shown even when zero to give a complete dashboard view. */
const GATEWAY_EVENT_TYPES = [
    'MISSING_BEARER_TOKEN', 'AUTH_FAILED', 'AUTHZ_ROLE_DENIED', 'AUTHZ_SCOPE_DENIED',
    'BODY_TOO_LARGE', 'ROUTE_NOT_FOUND', 'METHOD_NOT_ALLOWED', 'SCHEMA_VALIDATION_FAILED',
    'QUEUE_FULL'
];

/** Key HTTP security event types from cui-http UrlSecurityFailureType — curated subset. */
const HTTP_SECURITY_TYPES = [
    'invalid_encoding', 'path_traversal_detected', 'null_byte_injection',
    'control_characters', 'suspicious_pattern_detected', 'known_attack_signature',
    'protocol_violation', 'malformed_url'
];

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const metricsHeaderHtml = (title) => `
    <div class="metrics-header">
        <h2>${title}</h2>
        <div class="metrics-actions">
            <button id="refresh-metrics-btn" class="btn btn-small"
                    data-testid="refresh-metrics-button">
                <i class="fa fa-refresh"></i> ${t('metrics.btn.refresh')}
            </button>
            <button id="export-metrics-btn" class="btn btn-small"
                    data-testid="export-metrics-button">
                <i class="fa fa-download"></i> ${t('metrics.btn.export')}
            </button>
        </div>
    </div>`;

const metricsFooterHtml = () => `
    <div class="metrics-footer">
        <span class="last-updated" data-testid="last-updated"
              aria-live="polite" role="status">${t('metrics.last.updated.never')}</span>
        <span class="refresh-indicator hidden" data-testid="refresh-indicator"
              aria-live="polite">
            <i class="fa fa-spinner fa-spin"></i> ${t('metrics.refreshing')}
        </span>
    </div>
    <div id="export-options" class="export-options" data-testid="export-options">
        <h5>${t('metrics.export.heading')}</h5>
        <button class="btn btn-small" data-format="csv"
                data-testid="export-csv">CSV</button>
        <button class="btn btn-small" data-format="json"
                data-testid="export-json">JSON</button>
        <button class="btn btn-small" data-format="prometheus"
                data-testid="export-prometheus">Prometheus</button>
    </div>`;

const buildNonGatewayTemplate = () => `
    <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
        ${metricsHeaderHtml(t('jwt.validator.metrics.title'))}
        ${metricsFooterHtml()}
    </div>`;

const buildGatewayTemplate = () => `
    <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
        ${metricsHeaderHtml(t('metrics.gateway.heading'))}

        <div class="gateway-metrics-section" data-testid="token-validation-metrics">
            <h4>${t('metrics.section.token.validation')}</h4>
            <div class="metrics-grid" id="token-validation-grid">
                <div class="no-data">${t('common.loading')}</div>
            </div>
        </div>

        <div class="gateway-metrics-section" data-testid="http-security-metrics">
            <h4>${t('metrics.section.http.security')}</h4>
            <div class="metrics-grid" id="http-security-grid">
                <div class="no-data">${t('common.loading')}</div>
            </div>
        </div>

        <div class="gateway-metrics-section" data-testid="gateway-events-metrics">
            <h4>${t('metrics.section.gateway.events')}</h4>
            <div class="metrics-grid" id="gateway-events-grid">
                <div class="no-data">${t('common.loading')}</div>
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

    container.innerHTML = isGateway ? buildGatewayTemplate() : buildNonGatewayTemplate();

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

    // Initial load + periodic refresh (gateway only)
    refreshMetrics();
    if (typeof jest === 'undefined' && isGateway) {
        metricsInterval = setInterval(refreshMetrics, 10000);
    }
};

export const cleanup = () => {
    if (metricsInterval) { clearInterval(metricsInterval); metricsInterval = null; }
    metricsEndpointAvailable = true;
    _isGateway = false;
    _refreshGeneration = 0;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const handleRefresh = async () => {
    const ind = document.querySelector('[data-testid="refresh-indicator"]');
    if (ind) ind.classList.remove('hidden');
    await refreshMetrics();
    if (ind) setTimeout(() => { ind.classList.add('hidden'); }, 500);
};

const refreshMetrics = async () => {
    if (!metricsEndpointAvailable) return;
    if (!_isGateway) {
        showNotAvailable();
        return;
    }
    // Generation counter prevents stale in-flight requests from overwriting
    // a successful display — e.g. when the initial fetch hangs during startup
    // and the interval fires a second call that succeeds first.
    const gen = ++_refreshGeneration;
    try {
        const raw = await fetchGatewayApi('/metrics');
        if (gen !== _refreshGeneration) return; // superseded by a newer call
        // Validate response structure — gateway errors may arrive as RFC 9457 problem detail
        if (!raw || (raw.type && raw.status && !raw.tokenValidation)) {
            log.error('Metrics endpoint returned error:', raw?.title, raw?.detail);
            showError();
            return;
        }
        updateGatewayDisplay(raw);
    } catch (error) {
        if (gen !== _refreshGeneration) return; // superseded by a newer call
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
// Gateway display
// ---------------------------------------------------------------------------

const formatCounterName = (key) =>
    key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Render a counter grid with optional known-key expansion.
 * @param {string} containerId  target grid element ID
 * @param {Object} counters     key→value counter map from the API
 * @param {string[]} [allKeys]  when provided, all keys are shown (zero-value ones included)
 */
const renderCounterGrid = (containerId, counters, allKeys) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Build merged entries: if allKeys supplied, fill in zeros for missing keys,
    // then append any unknown keys from the response (future-proofing)
    const merged = allKeys
        ? [
            ...allKeys.map((key) => [key, counters[key] ?? 0]),
            ...Object.entries(counters).filter(([key]) => !allKeys.includes(key))
        ]
        : Object.entries(counters);

    if (merged.length === 0) {
        container.innerHTML = `<div class="no-data">${t('metrics.no.data')}</div>`;
        return;
    }

    const total = merged.reduce((sum, [, v]) => sum + v, 0);

    container.innerHTML =
        `<div class="section-summary">${t('metrics.section.total', formatNumber(total))}</div>` +
        merged.map(([key, value]) => {
            const cls = value > 0 ? 'metric-card metric-card--active' : 'metric-card metric-card--zero';
            return `<div class="${cls}">
            <h5>${sanitizeHtml(formatCounterName(key))}</h5>
            <div class="metric-value">${formatNumber(value)}</div>
        </div>`;
        }).join('');
};

const updateGatewayDisplay = (data) => {
    lastMetricsData = data;

    // Clear any previous error banner on successful data load
    const el = document.getElementById('jwt-metrics-content');
    const existingBanner = el?.querySelector('.metrics-status-banner');
    if (existingBanner) existingBanner.remove();

    renderCounterGrid('token-validation-grid', data.tokenValidation || {});
    renderCounterGrid('http-security-grid', data.httpSecurity || {}, HTTP_SECURITY_TYPES);
    renderCounterGrid('gateway-events-grid', data.gatewayEvents || {}, GATEWAY_EVENT_TYPES);

    const lu = document.querySelector('[data-testid="last-updated"]');
    if (lu) lu.textContent = t('metrics.last.updated', formatDate(new Date()));
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
            `<div class="error-content"><strong>${t('common.error.prefix')}</strong> ${t('metrics.error.load')}</div>`);
    }
};

const showNotAvailable = () => {
    const el = document.getElementById('jwt-metrics-content');
    if (el) {
        showStatusBanner(el, 'validation-error',
            `<div class="error-content"><strong>${t('metrics.error.not.available.title')}</strong> — ${t('metrics.error.not.available')}</div>`);
    }
    cleanup();
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const handleExport = (format) => {
    handleGatewayExport(format);
};

const triggerDownload = (content, mimeType, filename) => {
    const blob = new Blob([content], { type: mimeType });
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    globalThis.URL.revokeObjectURL(url);
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
                    output += 'nifi_jwt_validations_total'
                        + `{result="${sanitizeHtml(key)}"} ${value}\n`;
                }
                output += '\n';
            }
            if (data.httpSecurity) {
                output += '# HELP nifi_gateway_http_security_events_total Transport-level security events (cui-http)\n';
                output += '# TYPE nifi_gateway_http_security_events_total counter\n';
                for (const [key, value] of Object.entries(data.httpSecurity)) {
                    output += 'nifi_gateway_http_security_events_total'
                        + `{type="${sanitizeHtml(key)}"} ${value}\n`;
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
