'use strict';

/**
 * Tests for rest-endpoint-config.js — Gateway endpoint configuration display.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/rest-endpoint-config.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

const SAMPLE_CONFIG = {
    component: 'RestApiGatewayProcessor',
    port: 9443,
    maxRequestBodySize: 1048576,
    queueSize: 100,
    ssl: false,
    corsAllowedOrigins: ['*'],
    routes: [
        {
            name: 'users',
            path: '/api/users',
            methods: ['GET', 'POST'],
            requiredRoles: ['ADMIN'],
            requiredScopes: []
        },
        {
            name: 'health',
            path: '/api/health',
            methods: ['GET'],
            requiredRoles: [],
            requiredScopes: ['read']
        }
    ]
};

describe('rest-endpoint-config', () => {
    let container;

    beforeEach(() => {
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

        container = document.createElement('div');
        container.id = 'endpoint-config';
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should display routes from gateway config', async () => {
        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);

        await init(container);

        const rows = container.querySelectorAll('.routes-table tbody tr');
        expect(rows.length).toBe(2);
        expect(rows[0].textContent).toContain('users');
        expect(rows[0].textContent).toContain('/api/users');
        expect(rows[1].textContent).toContain('health');
    });

    it('should display global settings', async () => {
        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);

        await init(container);

        const settingsTable = container.querySelector('.global-settings');
        expect(settingsTable.textContent).toContain('9443');
        expect(settingsTable.textContent).toContain('100');
        expect(settingsTable.textContent).toContain('1.0 MB');
        expect(settingsTable.textContent).toContain('No'); // SSL
    });

    it('should handle empty routes', async () => {
        api.fetchGatewayApi.mockResolvedValue({
            ...SAMPLE_CONFIG,
            routes: []
        });

        await init(container);

        expect(container.textContent).toContain('No routes configured');
        expect(container.querySelectorAll('.routes-table').length).toBe(0);
    });

    it('should refresh on click', async () => {
        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);

        await init(container);
        expect(api.fetchGatewayApi).toHaveBeenCalledTimes(1);

        // Click refresh
        container.querySelector('.refresh-config-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.fetchGatewayApi).toHaveBeenCalledTimes(2);
    });

    it('should show error when gateway is unavailable', async () => {
        api.fetchGatewayApi.mockRejectedValue(new Error('Gateway unavailable'));

        await init(container);

        expect(container.textContent).toContain('Failed to load gateway configuration');
        expect(container.querySelector('.config-error')).not.toBeNull();
    });

    it('should not re-initialize if already initialized', async () => {
        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);

        await init(container);
        const firstContent = container.innerHTML;
        await init(container);
        expect(container.innerHTML).toBe(firstContent);
    });

    it('should return early for null container', async () => {
        await init(null);
        expect(api.fetchGatewayApi).not.toHaveBeenCalled();
    });

    it('should display method badges for route methods', async () => {
        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);

        await init(container);

        const badges = container.querySelectorAll('.method-badge');
        expect(badges.length).toBe(3); // GET, POST for users + GET for health
        expect(badges[0].textContent).toBe('GET');
        expect(badges[1].textContent).toBe('POST');
    });

    it('should display required roles and scopes', async () => {
        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);

        await init(container);

        const rows = container.querySelectorAll('.routes-table tbody tr');
        expect(rows[0].textContent).toContain('ADMIN');
        expect(rows[1].textContent).toContain('read');
    });

    it('should display CORS origins', async () => {
        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);

        await init(container);

        expect(container.textContent).toContain('*');
    });

    it('should call cleanup without error', () => {
        expect(() => cleanup()).not.toThrow();
    });
});
