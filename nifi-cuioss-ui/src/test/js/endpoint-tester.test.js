'use strict';

/**
 * Tests for endpoint-tester.js — Gateway endpoint testing component.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/endpoint-tester.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

const SAMPLE_CONFIG = {
    component: 'RestApiGatewayProcessor',
    port: 9443,
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
            requiredScopes: []
        }
    ]
};

const SAMPLE_RESPONSE = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: '{"users":["alice","bob"]}'
};

describe('endpoint-tester', () => {
    let container;

    beforeEach(() => {
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

        container = document.createElement('div');
        container.id = 'endpoint-tester';
        document.body.appendChild(container);

        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);
        api.sendGatewayTestRequest.mockResolvedValue(SAMPLE_RESPONSE);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should display route selector with routes from config', async () => {
        await init(container);

        const selector = container.querySelector('.route-selector');
        expect(selector).not.toBeNull();
        expect(selector.options.length).toBe(2);
        expect(selector.options[0].textContent).toContain('users');
        expect(selector.options[0].value).toBe('/api/users');
        expect(selector.options[1].textContent).toContain('health');
    });

    it('should display method selector', async () => {
        await init(container);

        const methodSelector = container.querySelector('.method-selector');
        expect(methodSelector).not.toBeNull();
        // Methods should reflect selected route's allowed methods
        const options = Array.from(methodSelector.options).map((o) => o.value);
        expect(options).toContain('GET');
    });

    it('should update methods when route changes', async () => {
        await init(container);

        const routeSelector = container.querySelector('.route-selector');
        const methodSelector = container.querySelector('.method-selector');

        // Select health route (GET only)
        routeSelector.selectedIndex = 1;
        routeSelector.dispatchEvent(new Event('change'));

        const options = Array.from(methodSelector.options).map((o) => o.value);
        expect(options).toEqual(['GET']);
    });

    it('should toggle body editor based on method', async () => {
        await init(container);

        const methodSelector = container.querySelector('.method-selector');
        const bodyGroup = container.querySelector('.body-group');

        // Select first route which has GET and POST
        // Change to POST
        methodSelector.innerHTML = '<option value="GET">GET</option><option value="POST">POST</option>';
        methodSelector.value = 'POST';
        methodSelector.dispatchEvent(new Event('change'));

        expect(bodyGroup.classList.contains('hidden')).toBe(false);

        // Change back to GET
        methodSelector.value = 'GET';
        methodSelector.dispatchEvent(new Event('change'));

        expect(bodyGroup.classList.contains('hidden')).toBe(true);
    });

    it('should send GET request via proxy', async () => {
        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.sendGatewayTestRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/users',
                method: 'GET'
            })
        );
    });

    it('should include Bearer token in request headers', async () => {
        await init(container);

        container.querySelector('.token-input').value = 'eyJtest';

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.sendGatewayTestRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer eyJtest'
                })
            })
        );
    });

    it('should not duplicate Bearer prefix if already present', async () => {
        await init(container);

        container.querySelector('.token-input').value = 'Bearer existingToken';

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.sendGatewayTestRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer existingToken'
                })
            })
        );
    });

    it('should display response with status code', async () => {
        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const display = container.querySelector('.response-display');
        expect(display.classList.contains('hidden')).toBe(false);

        const status = container.querySelector('.response-status');
        expect(status.textContent).toContain('200');
        expect(status.classList.contains('status-2xx')).toBe(true);
    });

    it('should color-code error status', async () => {
        api.sendGatewayTestRequest.mockResolvedValue({
            status: 403,
            headers: {},
            body: '{"error":"Forbidden"}'
        });

        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const status = container.querySelector('.response-status');
        expect(status.textContent).toContain('403');
        expect(status.classList.contains('status-4xx')).toBe(true);
    });

    it('should display formatted JSON response body', async () => {
        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const body = container.querySelector('.response-body');
        expect(body.textContent).toContain('alice');
        expect(body.textContent).toContain('bob');
    });

    it('should handle empty routes', async () => {
        api.fetchGatewayApi.mockResolvedValue({
            ...SAMPLE_CONFIG,
            routes: []
        });

        await init(container);

        const selector = container.querySelector('.route-selector');
        expect(selector.options[0].textContent).toContain('No routes');
    });

    it('should handle gateway unavailable for routes', async () => {
        api.fetchGatewayApi.mockRejectedValue(new Error('Gateway unavailable'));

        await init(container);

        const selector = container.querySelector('.route-selector');
        expect(selector.options[0].textContent).toContain('Failed to load');
    });

    it('should show error when send request fails', async () => {
        api.sendGatewayTestRequest.mockRejectedValue(new Error('Network error'));

        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const body = container.querySelector('.response-body');
        expect(body.textContent).toContain('Network error');
    });

    it('should not re-initialize if already initialized', async () => {
        await init(container);
        const firstContent = container.innerHTML;
        await init(container);
        expect(container.innerHTML).toBe(firstContent);
    });

    it('should return early for null container', async () => {
        await init(null);
        expect(api.fetchGatewayApi).not.toHaveBeenCalled();
    });

    it('should color-code server error status (5xx)', async () => {
        api.sendGatewayTestRequest.mockResolvedValue({
            status: 500,
            headers: {},
            body: 'Internal Server Error'
        });

        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const status = container.querySelector('.response-status');
        expect(status.textContent).toContain('500');
        expect(status.classList.contains('status-5xx')).toBe(true);
    });

    it('should display non-JSON response body as plain text', async () => {
        api.sendGatewayTestRequest.mockResolvedValue({
            status: 200,
            headers: {},
            body: 'plain text response'
        });

        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const body = container.querySelector('.response-body');
        expect(body.textContent).toBe('plain text response');
    });

    it('should display response headers', async () => {
        api.sendGatewayTestRequest.mockResolvedValue({
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
            body: '{}'
        });

        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const headers = container.querySelector('.response-headers');
        expect(headers.textContent).toContain('Content-Type');
    });

    it('should show body editor for POST method', async () => {
        await init(container);

        // Override method selector to have POST
        const methodSelector = container.querySelector('.method-selector');
        methodSelector.innerHTML = '<option value="GET">GET</option><option value="POST">POST</option>';
        methodSelector.value = 'POST';
        methodSelector.dispatchEvent(new Event('change'));

        const bodyGroup = container.querySelector('.body-group');
        expect(bodyGroup.classList.contains('hidden')).toBe(false);
    });

    it('should show body editor for PUT method', async () => {
        await init(container);

        const methodSelector = container.querySelector('.method-selector');
        methodSelector.innerHTML = '<option value="PUT">PUT</option>';
        methodSelector.value = 'PUT';
        methodSelector.dispatchEvent(new Event('change'));

        expect(container.querySelector('.body-group').classList.contains('hidden')).toBe(false);
    });

    it('should show error when no route is selected', async () => {
        api.fetchGatewayApi.mockResolvedValue({ ...SAMPLE_CONFIG, routes: [] });

        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const body = container.querySelector('.response-body');
        expect(body.textContent).toContain('select a route');
    });

    it('should include request body for POST requests', async () => {
        await init(container);

        // Set method to POST
        const methodSelector = container.querySelector('.method-selector');
        methodSelector.innerHTML = '<option value="POST">POST</option>';
        methodSelector.value = 'POST';
        methodSelector.dispatchEvent(new Event('change'));

        // Set body
        container.querySelector('.body-input').value = '{"name":"test"}';

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.sendGatewayTestRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                body: '{"name":"test"}'
            })
        );
    });

    it('should call cleanup without error', () => {
        expect(() => cleanup()).not.toThrow();
    });
});
