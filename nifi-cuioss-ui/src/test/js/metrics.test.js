'use strict';

/**
 * Tests for metrics.js — Metrics dashboard tab component.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/metrics.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

describe('metrics', () => {
    let container;

    beforeEach(() => {
        // Re-apply mock implementations (resetMocks clears them between tests)
        utils.sanitizeHtml.mockImplementation((s) => s);
        utils.formatNumber.mockImplementation((n) => String(n));
        utils.formatDate.mockImplementation((d) => d instanceof Date ? d.toISOString() : String(d));
        utils.t.mockImplementation((key) => key);
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

        container = document.createElement('div');
        container.id = 'metrics';
        document.body.appendChild(container);

        // Default successful metrics response
        api.getSecurityMetrics.mockResolvedValue({
            totalTokensValidated: 100,
            validTokens: 90,
            invalidTokens: 10,
            averageResponseTime: 50,
            minResponseTime: 5,
            maxResponseTime: 200,
            p95ResponseTime: 150,
            activeIssuers: 2,
            issuerMetrics: [
                { name: 'keycloak', totalRequests: 80, successCount: 75, failureCount: 5, successRate: 93.75, avgResponseTime: 45 },
                { name: 'auth0', totalRequests: 20, successCount: 15, failureCount: 5, successRate: 75.0, avgResponseTime: 60 }
            ],
            topErrors: [
                { issuer: 'auth0', error: 'Token expired', count: 3, timestamp: '2026-01-15T10:00:00Z' }
            ]
        });
    });

    afterEach(() => {
        cleanup();
        document.body.innerHTML = '';
    });

    it('should initialize the metrics dashboard', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 50));

        expect(container.querySelector('#jwt-metrics-content')).not.toBeNull();
        expect(container.querySelector('#refresh-metrics-btn')).not.toBeNull();
        expect(container.querySelector('#export-metrics-btn')).not.toBeNull();
    });

    it('should not re-initialize if already initialized', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 10));
        const firstContent = container.innerHTML;
        init(container);
        expect(container.innerHTML).toBe(firstContent);
    });

    it('should return early for null container', () => {
        expect(() => init(null)).not.toThrow();
    });

    it('should load and display metrics on initialization', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 50));

        expect(document.getElementById('total-validations').textContent).toBe('100');
        expect(document.getElementById('active-issuers').textContent).toBe('2');
        expect(document.getElementById('avg-response-time').textContent).toBe('50 ms');
    });

    it('should render issuer metrics table', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const rows = document.querySelectorAll('[data-testid="issuer-metrics-row"]');
        expect(rows.length).toBe(2);
        expect(rows[0].querySelector('[data-testid="issuer-name"]').textContent).toBe('keycloak');
    });

    it('should render recent errors', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const errorList = document.getElementById('error-metrics-list');
        expect(errorList.querySelector('.error-metric-item')).not.toBeNull();
        expect(errorList.textContent).toContain('Token expired');
    });

    it('should show no-data message when no issuer metrics', async () => {
        api.getSecurityMetrics.mockResolvedValue({
            totalTokensValidated: 0,
            validTokens: 0,
            invalidTokens: 0,
            activeIssuers: 0,
            issuerMetrics: [],
            topErrors: []
        });

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const tbody = document.getElementById('issuer-metrics-list');
        expect(tbody.textContent).toContain('No issuer data available');
    });

    it('should handle refresh button click', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 50));

        api.getSecurityMetrics.mockClear();
        api.getSecurityMetrics.mockResolvedValue({
            totalTokensValidated: 200,
            validTokens: 180,
            invalidTokens: 20,
            issuerMetrics: [],
            topErrors: []
        });

        document.getElementById('refresh-metrics-btn').click();
        await new Promise((r) => setTimeout(r, 50));

        expect(api.getSecurityMetrics).toHaveBeenCalled();
    });

    it('should toggle export options on export button click', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 10));

        const exportBtn = document.getElementById('export-metrics-btn');
        const exportOpts = document.getElementById('export-options');

        exportBtn.click();
        expect(exportOpts.classList.contains('visible')).toBe(true);

        exportBtn.click();
        expect(exportOpts.classList.contains('visible')).toBe(false);
    });

    it('should export metrics as JSON', async () => {
        const mockUrl = 'blob:mock-url';
        globalThis.URL.createObjectURL = jest.fn(() => mockUrl);
        globalThis.URL.revokeObjectURL = jest.fn();

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const clickSpy = jest.fn();
        const origCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'a') el.click = clickSpy;
            return el;
        });

        document.querySelector('[data-format="json"]').click();

        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();

        document.createElement.mockRestore();
    });

    it('should export metrics as CSV', async () => {
        globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
        globalThis.URL.revokeObjectURL = jest.fn();

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const clickSpy = jest.fn();
        const origCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'a') el.click = clickSpy;
            return el;
        });

        document.querySelector('[data-format="csv"]').click();

        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
        document.createElement.mockRestore();
    });

    it('should export metrics as Prometheus format', async () => {
        globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
        globalThis.URL.revokeObjectURL = jest.fn();

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const clickSpy = jest.fn();
        const origCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'a') el.click = clickSpy;
            return el;
        });

        document.querySelector('[data-format="prometheus"]').click();

        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
        document.createElement.mockRestore();
    });

    it('should show error banner when API fails', async () => {
        api.getSecurityMetrics.mockRejectedValue(new Error('Network error'));

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const banner = document.querySelector('.metrics-status-banner.server-error');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('Unable to load metrics');
    });

    it('should show not-available banner for 404 and stop polling', async () => {
        const error = new Error('Not Found');
        error.status = 404;
        api.getSecurityMetrics.mockRejectedValue(error);

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const banner = document.querySelector('.metrics-status-banner.validation-error');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('Metrics Not Available');
    });

    it('should cleanup interval on cleanup()', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 10));

        expect(() => cleanup()).not.toThrow();
        expect(() => cleanup()).not.toThrow(); // Double cleanup should be safe
    });

    it('should handle unknown export format gracefully', async () => {
        globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
        globalThis.URL.revokeObjectURL = jest.fn();

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        // Create a button with unknown format and click it
        const exportOpts = document.getElementById('export-options');
        const unknownBtn = document.createElement('button');
        unknownBtn.setAttribute('data-format', 'unknown');
        exportOpts.appendChild(unknownBtn);

        unknownBtn.click();

        // Should not have created a download (default branch returns early)
        expect(globalThis.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('should show no-errors message when no recent errors', async () => {
        api.getSecurityMetrics.mockResolvedValue({
            totalTokensValidated: 10,
            validTokens: 10,
            invalidTokens: 0,
            issuerMetrics: [],
            topErrors: []
        });

        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const errList = document.getElementById('error-metrics-list');
        expect(errList.textContent).toContain('No recent errors');
    });
});

// ---------------------------------------------------------------------------
// Gateway metrics mode
// ---------------------------------------------------------------------------

const GATEWAY_METRICS = {
    tokenValidation: { valid: 42, expired: 3, invalid_signature: 1 },
    httpSecurity: { ssrf_blocked: 2, tls_errors: 0 },
    gatewayEvents: { AUTH_FAILED: 5, ROUTE_NOT_FOUND: 3, REQUEST_TOO_LARGE: 1 }
};

describe('metrics — gateway mode', () => {
    let container;

    beforeEach(() => {
        utils.sanitizeHtml.mockImplementation((s) => s);
        utils.formatNumber.mockImplementation((n) => String(n));
        utils.formatDate.mockImplementation((d) => d instanceof Date ? d.toISOString() : String(d));
        utils.t.mockImplementation((key) => key);
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

        container = document.createElement('div');
        container.id = 'metrics';
        document.body.appendChild(container);

        api.fetchGatewayApi.mockResolvedValue(GATEWAY_METRICS);
    });

    afterEach(() => {
        cleanup();
        document.body.innerHTML = '';
    });

    it('should render gateway template with three sections', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        expect(container.querySelector('[data-testid="token-validation-metrics"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="http-security-metrics"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="gateway-events-metrics"]')).not.toBeNull();
    });

    it('should fetch from gateway proxy instead of getSecurityMetrics', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        expect(api.fetchGatewayApi).toHaveBeenCalledWith('/metrics');
        expect(api.getSecurityMetrics).not.toHaveBeenCalled();
    });

    it('should display token validation counters', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('token-validation-grid');
        expect(grid.querySelectorAll('.metric-card').length).toBe(3);
        expect(grid.textContent).toContain('42');
        expect(grid.textContent).toContain('3');
    });

    it('should display http security counters', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('http-security-grid');
        expect(grid.querySelectorAll('.metric-card').length).toBe(2);
        expect(grid.textContent).toContain('2');
    });

    it('should display gateway events counters', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('gateway-events-grid');
        expect(grid.querySelectorAll('.metric-card').length).toBe(3);
        expect(grid.textContent).toContain('5');
    });

    it('should format counter names for display', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('token-validation-grid');
        // "invalid_signature" → "Invalid Signature"
        expect(grid.textContent).toContain('Invalid Signature');
    });

    it('should show "No data available" for empty counter categories', async () => {
        api.fetchGatewayApi.mockResolvedValue({
            tokenValidation: {},
            httpSecurity: {},
            gatewayEvents: {}
        });

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('token-validation-grid');
        expect(grid.textContent).toContain('No data available');
    });

    it('should show error banner when gateway is unavailable', async () => {
        api.fetchGatewayApi.mockRejectedValue(new Error('Gateway unavailable'));

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const banner = document.querySelector('.metrics-status-banner.server-error');
        expect(banner).not.toBeNull();
    });

    it('should display "Gateway Metrics" as title', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        expect(container.querySelector('.metrics-header h2').textContent).toBe('Gateway Metrics');
    });

    it('should have refresh and export buttons', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        expect(container.querySelector('#refresh-metrics-btn')).not.toBeNull();
        expect(container.querySelector('#export-metrics-btn')).not.toBeNull();
    });

    it('should refresh gateway metrics on button click', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        api.fetchGatewayApi.mockClear();
        api.fetchGatewayApi.mockResolvedValue(GATEWAY_METRICS);

        document.getElementById('refresh-metrics-btn').click();
        await new Promise((r) => setTimeout(r, 50));

        expect(api.fetchGatewayApi).toHaveBeenCalledWith('/metrics');
    });

    it('should export gateway metrics as JSON', async () => {
        globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
        globalThis.URL.revokeObjectURL = jest.fn();

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const clickSpy = jest.fn();
        const origCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'a') el.click = clickSpy;
            return el;
        });

        document.querySelector('[data-format="json"]').click();

        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        document.createElement.mockRestore();
    });

    it('should export gateway metrics as CSV', async () => {
        globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
        globalThis.URL.revokeObjectURL = jest.fn();

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const clickSpy = jest.fn();
        const origCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'a') el.click = clickSpy;
            return el;
        });

        document.querySelector('[data-format="csv"]').click();

        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
        document.createElement.mockRestore();
    });

    it('should export gateway metrics as Prometheus format', async () => {
        globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
        globalThis.URL.revokeObjectURL = jest.fn();

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const clickSpy = jest.fn();
        const origCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'a') el.click = clickSpy;
            return el;
        });

        document.querySelector('[data-format="prometheus"]').click();

        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
        document.createElement.mockRestore();
    });

    it('should update last-updated timestamp after data loads', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const lu = container.querySelector('[data-testid="last-updated"]');
        expect(lu.textContent).toContain('Last updated:');
        expect(lu.textContent).not.toContain('Never');
    });

    it('should handle missing categories gracefully', async () => {
        api.fetchGatewayApi.mockResolvedValue({});

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        // All grids should show "No data available"
        const tokenGrid = document.getElementById('token-validation-grid');
        expect(tokenGrid.textContent).toContain('No data available');
    });

    it('should not render JWT-specific elements in gateway mode', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        expect(document.getElementById('total-validations')).toBeNull();
        expect(document.getElementById('issuer-metrics-list')).toBeNull();
        expect(document.getElementById('error-metrics-list')).toBeNull();
    });
});
