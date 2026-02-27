'use strict';

/**
 * Tests for metrics.js — Metrics dashboard tab component.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/metrics.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

describe('metrics — non-gateway mode', () => {
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

    it('should show not-available banner immediately for non-gateway', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 50));

        const banner = document.querySelector('.metrics-status-banner.validation-error');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('metrics.error.not.available.title');
        expect(banner.textContent).toContain('metrics.error.not.available');
    });

    it('should not call any API for non-gateway mode', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 50));

        expect(api.fetchGatewayApi).not.toHaveBeenCalled();
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

    it('should cleanup interval on cleanup()', async () => {
        init(container);
        await new Promise((r) => setTimeout(r, 10));

        expect(() => cleanup()).not.toThrow();
        expect(() => cleanup()).not.toThrow(); // Double cleanup should be safe
    });
});

// ---------------------------------------------------------------------------
// Gateway metrics mode
// ---------------------------------------------------------------------------

const GATEWAY_METRICS = {
    tokenValidation: { valid: 42, expired: 3, invalid_signature: 1 },
    httpSecurity: { invalid_encoding: 2, path_traversal_detected: 1 },
    gatewayEvents: { AUTH_FAILED: 5, ROUTE_NOT_FOUND: 3, BODY_TOO_LARGE: 1 }
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
    });

    it('should display token validation counters', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('token-validation-grid');
        expect(grid.querySelectorAll('.metric-card').length).toBe(3);
        expect(grid.textContent).toContain('42');
        expect(grid.textContent).toContain('3');
    });

    it('should display all 8 http security types including zero-value ones', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('http-security-grid');
        // All 8 known HTTP security types shown, not just the 2 with non-zero values
        expect(grid.querySelectorAll('.metric-card').length).toBe(8);
        expect(grid.querySelectorAll('.metric-card--active').length).toBe(2);
        expect(grid.querySelectorAll('.metric-card--zero').length).toBe(6);
        expect(grid.textContent).toContain('2');
    });

    it('should display all 9 gateway event types including zero-value ones', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('gateway-events-grid');
        // All 9 known event types are shown, not just the 3 with non-zero values
        expect(grid.querySelectorAll('.metric-card').length).toBe(9);
        expect(grid.querySelectorAll('.metric-card--active').length).toBe(3);
        expect(grid.querySelectorAll('.metric-card--zero').length).toBe(6);
        expect(grid.textContent).toContain('5');
    });

    it('should format counter names for display', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const grid = document.getElementById('token-validation-grid');
        // "invalid_signature" → "Invalid Signature"
        expect(grid.textContent).toContain('Invalid Signature');
    });

    it('should show "No data available" for empty token validation and zero tiles for known types', async () => {
        api.fetchGatewayApi.mockResolvedValue({
            tokenValidation: {},
            httpSecurity: {},
            gatewayEvents: {}
        });

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        // Token validation is fully dynamic — shows "no data" when empty
        const tokenGrid = document.getElementById('token-validation-grid');
        expect(tokenGrid.textContent).toContain('metrics.no.data');

        // HTTP security shows all 8 known types with zero values
        const httpGrid = document.getElementById('http-security-grid');
        expect(httpGrid.querySelectorAll('.metric-card').length).toBe(8);
        expect(httpGrid.querySelectorAll('.metric-card--zero').length).toBe(8);

        // Gateway events show all 9 known types with zero values
        const gwGrid = document.getElementById('gateway-events-grid');
        expect(gwGrid.querySelectorAll('.metric-card').length).toBe(9);
        expect(gwGrid.querySelectorAll('.metric-card--zero').length).toBe(9);
    });

    it('should show error banner when gateway is unavailable', async () => {
        api.fetchGatewayApi.mockRejectedValue(new Error('Gateway unavailable'));

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const banner = document.querySelector('.metrics-status-banner.server-error');
        expect(banner).not.toBeNull();
    });

    it('should show error banner when gateway returns RFC 9457 problem detail', async () => {
        api.fetchGatewayApi.mockResolvedValue({
            type: 'https://example.com/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Valid API key required'
        });

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        const banner = document.querySelector('.metrics-status-banner.server-error');
        expect(banner).not.toBeNull();
        expect(utils.log.error).toHaveBeenCalled();
    });

    it('should display "Gateway Metrics" as title', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        expect(container.querySelector('.metrics-header h2').textContent).toBe('metrics.gateway.heading');
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
        expect(lu.textContent).toContain('metrics.last.updated');
        expect(lu.textContent).not.toContain('Never');
    });

    it('should handle missing categories gracefully', async () => {
        api.fetchGatewayApi.mockResolvedValue({});

        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        // Token validation (fully dynamic) shows "no data"
        const tokenGrid = document.getElementById('token-validation-grid');
        expect(tokenGrid.textContent).toContain('metrics.no.data');
        // HTTP security still shows 8 known types with zero values
        const httpGrid = document.getElementById('http-security-grid');
        expect(httpGrid.querySelectorAll('.metric-card').length).toBe(8);
    });

    it('should not render JWT-specific elements in gateway mode', async () => {
        init(container, true);
        await new Promise((r) => setTimeout(r, 50));

        expect(document.getElementById('total-validations')).toBeNull();
        expect(document.getElementById('issuer-metrics-list')).toBeNull();
        expect(document.getElementById('error-metrics-list')).toBeNull();
    });

    it('should discard stale error when a newer refresh already succeeded', async () => {
        // Simulate: slow initial call hangs, then interval call succeeds first,
        // then the stale initial call fails — banner should NOT reappear.
        let slowReject;
        const slowPromise = new Promise((_, reject) => { slowReject = reject; });

        // First call hangs (simulates startup delay)
        api.fetchGatewayApi.mockReturnValueOnce(slowPromise);
        // Second call succeeds immediately
        api.fetchGatewayApi.mockResolvedValueOnce(GATEWAY_METRICS);

        init(container, true);
        // Wait a tick for the first (slow) call to start
        await new Promise((r) => setTimeout(r, 10));

        // Trigger a second refresh (simulates the interval firing)
        document.getElementById('refresh-metrics-btn').click();
        await new Promise((r) => setTimeout(r, 50));

        // Data should be loaded, no error banner
        const grid = document.getElementById('token-validation-grid');
        expect(grid.querySelectorAll('.metric-card').length).toBe(3);
        expect(document.querySelector('.metrics-status-banner')).toBeNull();

        // Now the stale initial call finally fails
        slowReject(new Error('Stale network error'));
        await new Promise((r) => setTimeout(r, 50));

        // Banner should NOT appear because the stale call was superseded
        expect(document.querySelector('.metrics-status-banner')).toBeNull();
        // Data should still be visible
        expect(grid.querySelectorAll('.metric-card').length).toBe(3);
    });
});
