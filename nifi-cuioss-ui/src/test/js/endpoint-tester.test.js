'use strict';

/**
 * Tests for endpoint-tester.js — Gateway endpoint testing component.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/endpoint-tester.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

const SAMPLE_CS_PROPERTIES = {
    properties: {
        'issuer.primary.issuer': 'https://keycloak:8443/realms/master',
        'issuer.primary.jwks-url': 'https://keycloak:8443/realms/master/protocol/openid-connect/certs'
    }
};

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
        utils.t.mockImplementation((key) => key);
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

        container = document.createElement('div');
        container.id = 'endpoint-tester';
        document.body.appendChild(container);

        api.fetchGatewayApi.mockResolvedValue(SAMPLE_CONFIG);
        api.sendGatewayTestRequest.mockResolvedValue(SAMPLE_RESPONSE);
        api.getComponentId.mockReturnValue('test-processor-id');
        api.resolveJwtConfigServiceId.mockResolvedValue('test-cs-id');
        api.getControllerServiceProperties.mockResolvedValue(SAMPLE_CS_PROPERTIES);
        api.fetchOAuthToken.mockResolvedValue({
            access_token: 'fetched-token-123',
            expires_in: 300,
            idpStatus: 200
        });
        api.discoverTokenEndpoint.mockResolvedValue({
            tokenEndpoint: 'https://keycloak:8443/realms/master/protocol/openid-connect/token'
        });
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
        expect(status.textContent).toContain('tester.response.status');
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
        expect(status.textContent).toContain('tester.response.status');
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
        expect(selector.options[0].textContent).toContain('tester.routes.none');
    });

    it('should handle gateway unavailable for routes', async () => {
        api.fetchGatewayApi.mockRejectedValue(new Error('Gateway unavailable'));

        await init(container);

        const selector = container.querySelector('.route-selector');
        expect(selector.options[0].textContent).toContain('tester.routes.failed');
    });

    it('should show error when send request fails', async () => {
        api.sendGatewayTestRequest.mockRejectedValue(new Error('Network error'));

        await init(container);

        container.querySelector('.send-request-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const body = container.querySelector('.response-body');
        expect(body.textContent).toContain('tester.error.request.failed');
    });

    it('should not re-initialize if already initialized', async () => {
        await init(container);
        // Wait for async issuer loading to settle
        await new Promise((r) => setTimeout(r, 10));
        const firstContent = container.innerHTML;
        await init(container);
        await new Promise((r) => setTimeout(r, 10));
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
        expect(status.textContent).toContain('tester.response.status');
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
        expect(body.textContent).toContain('tester.error.no.route');
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

    it('should show body editor automatically when route only has POST', async () => {
        api.fetchGatewayApi.mockResolvedValue({
            ...SAMPLE_CONFIG,
            routes: [
                { name: 'validated', path: '/api/validated', methods: ['POST'], requiredRoles: [], requiredScopes: [] }
            ]
        });

        await init(container);

        const bodyGroup = container.querySelector('.body-group');
        expect(bodyGroup.classList.contains('hidden')).toBe(false);
    });

    it('should show body editor when switching to a POST-only route', async () => {
        api.fetchGatewayApi.mockResolvedValue({
            ...SAMPLE_CONFIG,
            routes: [
                { name: 'health', path: '/api/health', methods: ['GET'], requiredRoles: [], requiredScopes: [] },
                { name: 'validated', path: '/api/validated', methods: ['POST'], requiredRoles: [], requiredScopes: [] }
            ]
        });

        await init(container);

        // Initially GET route is selected — body should be hidden
        const bodyGroup = container.querySelector('.body-group');
        expect(bodyGroup.classList.contains('hidden')).toBe(true);

        // Switch to POST-only route
        const routeSelector = container.querySelector('.route-selector');
        routeSelector.selectedIndex = 1;
        routeSelector.dispatchEvent(new Event('change'));

        expect(bodyGroup.classList.contains('hidden')).toBe(false);
    });

    it('should call cleanup without error', () => {
        expect(() => cleanup()).not.toThrow();
    });

    // -----------------------------------------------------------------------
    // Token fetch section
    // -----------------------------------------------------------------------

    describe('token fetch section', () => {
        it('should render collapsed token fetch section', async () => {
            await init(container);

            const section = container.querySelector('.token-fetch-section');
            expect(section).not.toBeNull();

            const body = container.querySelector('.token-fetch-body');
            expect(body.classList.contains('hidden')).toBe(true);
        });

        it('should toggle token fetch section on click', async () => {
            await init(container);

            const toggle = container.querySelector('.token-fetch-toggle');
            const body = container.querySelector('.token-fetch-body');

            // Expand
            toggle.click();
            expect(body.classList.contains('hidden')).toBe(false);

            // Collapse
            toggle.click();
            expect(body.classList.contains('hidden')).toBe(true);
        });

        it('should populate issuer dropdown from controller service', async () => {
            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            const selector = container.querySelector('.issuer-selector');
            expect(selector.options.length).toBeGreaterThanOrEqual(1);
            expect(selector.options[0].value).toBe('https://keycloak:8443/realms/master');
        });

        it('should show custom URL option in issuer dropdown', async () => {
            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            const selector = container.querySelector('.issuer-selector');
            const lastOption = selector.options[selector.options.length - 1];
            expect(lastOption.value).toBe('__custom__');
        });

        it('should hide ROPC fields for client_credentials grant', async () => {
            await init(container);

            const grantSelector = container.querySelector('.grant-type-selector');
            grantSelector.value = 'client_credentials';
            grantSelector.dispatchEvent(new Event('change'));

            const ropcFields = container.querySelector('.ropc-fields');
            expect(ropcFields.classList.contains('hidden')).toBe(true);
        });

        it('should show ROPC fields for password grant', async () => {
            await init(container);

            const grantSelector = container.querySelector('.grant-type-selector');
            grantSelector.value = 'password';
            grantSelector.dispatchEvent(new Event('change'));

            const ropcFields = container.querySelector('.ropc-fields');
            expect(ropcFields.classList.contains('hidden')).toBe(false);
        });

        it('should fetch token and populate textarea', async () => {
            await init(container);

            // Fill in required fields (default grant type is password/ROPC)
            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'test-client';
            container.querySelector('.tf-client-secret').value = 'secret';
            container.querySelector('.tf-username').value = 'testUser';
            container.querySelector('.tf-password').value = 'testPass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(api.fetchOAuthToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    tokenEndpointUrl: 'https://keycloak:8443/token',
                    clientId: 'test-client'
                })
            );

            const tokenInput = container.querySelector('.token-input');
            expect(tokenInput.value).toBe('fetched-token-123');
        });

        it('should show success status after token fetch', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'test-client';
            container.querySelector('.tf-username').value = 'testUser';
            container.querySelector('.tf-password').value = 'testPass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('success')).toBe(true);
            expect(status.textContent).toContain('tester.token.fetch.success');
        });

        it('should show error when token fetch fails', async () => {
            api.fetchOAuthToken.mockRejectedValue(new Error('Network error'));

            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'test-client';
            container.querySelector('.tf-username').value = 'testUser';
            container.querySelector('.tf-password').value = 'testPass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('error')).toBe(true);
            expect(status.textContent).toContain('tester.token.fetch.error');
        });

        it('should show error when token endpoint URL is missing', async () => {
            await init(container);

            container.querySelector('.tf-client-id').value = 'test-client';
            container.querySelector('.tf-username').value = 'testUser';
            container.querySelector('.tf-password').value = 'pass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('error')).toBe(true);
            expect(container.querySelector('.token-endpoint-url').classList.contains('input-error')).toBe(true);
        });

        it('should show error when client ID is missing', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('error')).toBe(true);
            expect(status.textContent).toContain('tester.token.fetch.error.missing.fields');
        });

        it('should discover token endpoint via OIDC', async () => {
            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            // Issuer should have loaded and first option should be the issuer URL
            const issuerSelector = container.querySelector('.issuer-selector');
            expect(issuerSelector.options[0].value).toBe(
                'https://keycloak:8443/realms/master'
            );

            // Trigger change to discover endpoint
            issuerSelector.dispatchEvent(new Event('change'));
            await new Promise((r) => setTimeout(r, 10));

            expect(api.discoverTokenEndpoint).toHaveBeenCalled();
        });

        it('should handle empty issuers gracefully', async () => {
            api.resolveJwtConfigServiceId.mockResolvedValue(null);

            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            const selector = container.querySelector('.issuer-selector');
            expect(selector.options[0].textContent).toContain('tester.token.fetch.issuer.none');
        });

        it('should handle issuer loading error gracefully', async () => {
            api.resolveJwtConfigServiceId.mockRejectedValue(new Error('Not found'));

            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            const selector = container.querySelector('.issuer-selector');
            expect(selector.options[0].textContent).toContain('tester.token.fetch.issuer.none');
        });

        it('should include username and password for password grant', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.grant-type-selector').value = 'password';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'admin';
            container.querySelector('.tf-password').value = 'secret';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(api.fetchOAuthToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    grantType: 'password',
                    username: 'admin',
                    password: 'secret'
                })
            );
        });

        it('should not include username and password for client_credentials grant', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.grant-type-selector').value = 'client_credentials';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-client-secret').value = 'secret';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const calledPayload = api.fetchOAuthToken.mock.calls[0][0];
            expect(calledPayload.grantType).toBe('client_credentials');
            expect(calledPayload.username).toBeUndefined();
            expect(calledPayload.password).toBeUndefined();
        });

        it('should show error status for IDP error response', async () => {
            api.fetchOAuthToken.mockResolvedValue({
                idpStatus: 401,
                error: 'invalid_client'
            });

            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.grant-type-selector').value = 'client_credentials';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-client-secret').value = 'secret';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('error')).toBe(true);
        });

        it('should clear endpoint URL when custom issuer is selected', async () => {
            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            // Set a URL first
            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';

            // Select custom option
            const issuerSelector = container.querySelector('.issuer-selector');
            issuerSelector.value = '__custom__';
            issuerSelector.dispatchEvent(new Event('change'));

            expect(container.querySelector('.token-endpoint-url').value).toBe('');
        });

        it('should populate endpoint URL from auto-discovery on issuer change', async () => {
            api.discoverTokenEndpoint.mockResolvedValue({
                tokenEndpoint: 'https://keycloak:8443/realms/master/protocol/openid-connect/token'
            });

            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            const issuerSelector = container.querySelector('.issuer-selector');
            issuerSelector.dispatchEvent(new Event('change'));
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.token-endpoint-url').value).toBe(
                'https://keycloak:8443/realms/master/protocol/openid-connect/token'
            );
        });

        it('should show error when token endpoint discovery fails', async () => {
            api.discoverTokenEndpoint.mockRejectedValue(new Error('Discovery failed'));

            await init(container);
            await new Promise((r) => setTimeout(r, 10));

            const issuerSelector = container.querySelector('.issuer-selector');
            issuerSelector.dispatchEvent(new Event('change'));
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('error')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Red border validation
    // -----------------------------------------------------------------------

    describe('red border validation', () => {
        it('should add input-error to empty endpoint URL on submit', async () => {
            await init(container);

            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'user';
            container.querySelector('.tf-password').value = 'pass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.token-endpoint-url').classList.contains('input-error')).toBe(true);
        });

        it('should add input-error to empty client-id on submit', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-username').value = 'user';
            container.querySelector('.tf-password').value = 'pass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.tf-client-id').classList.contains('input-error')).toBe(true);
        });

        it('should clear input-error on typing', async () => {
            await init(container);

            // Trigger error state
            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const urlField = container.querySelector('.token-endpoint-url');
            expect(urlField.classList.contains('input-error')).toBe(true);

            // Type in the field
            urlField.value = 'https://keycloak:8443/token';
            urlField.dispatchEvent(new Event('input', { bubbles: true }));

            expect(urlField.classList.contains('input-error')).toBe(false);
        });

        it('should clear all input-error classes on next submit attempt', async () => {
            await init(container);

            // Trigger errors
            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));
            expect(container.querySelector('.token-endpoint-url').classList.contains('input-error')).toBe(true);

            // Fill in all fields and submit again
            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'user';
            container.querySelector('.tf-password').value = 'pass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.token-endpoint-url').classList.contains('input-error')).toBe(false);
            expect(container.querySelector('.tf-client-id').classList.contains('input-error')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Required field asterisks
    // -----------------------------------------------------------------------

    describe('required field asterisks', () => {
        it('should mark correct labels for ROPC grant type', async () => {
            await init(container);

            const body = container.querySelector('.token-fetch-body');
            const requiredLabels = body.querySelectorAll('label.required-field');
            const forValues = Array.from(requiredLabels).map((l) => l.getAttribute('for'));

            expect(forValues).toContain('token-endpoint-url');
            expect(forValues).toContain('tf-client-id');
            expect(forValues).toContain('tf-username');
            expect(forValues).toContain('tf-password');
            expect(forValues).not.toContain('tf-client-secret');
        });

        it('should mark correct labels for client_credentials grant type', async () => {
            await init(container);

            const grantSelector = container.querySelector('.grant-type-selector');
            grantSelector.value = 'client_credentials';
            grantSelector.dispatchEvent(new Event('change'));

            const body = container.querySelector('.token-fetch-body');
            const requiredLabels = body.querySelectorAll('label.required-field');
            const forValues = Array.from(requiredLabels).map((l) => l.getAttribute('for'));

            expect(forValues).toContain('token-endpoint-url');
            expect(forValues).toContain('tf-client-id');
            expect(forValues).toContain('tf-client-secret');
            expect(forValues).not.toContain('tf-username');
            expect(forValues).not.toContain('tf-password');
        });

        it('should update asterisks when grant type changes', async () => {
            await init(container);

            const grantSelector = container.querySelector('.grant-type-selector');

            // Switch to client_credentials
            grantSelector.value = 'client_credentials';
            grantSelector.dispatchEvent(new Event('change'));

            const body = container.querySelector('.token-fetch-body');
            let forValues = Array.from(body.querySelectorAll('label.required-field'))
                .map((l) => l.getAttribute('for'));
            expect(forValues).toContain('tf-client-secret');

            // Switch back to password
            grantSelector.value = 'password';
            grantSelector.dispatchEvent(new Event('change'));

            forValues = Array.from(body.querySelectorAll('label.required-field'))
                .map((l) => l.getAttribute('for'));
            expect(forValues).toContain('tf-username');
            expect(forValues).not.toContain('tf-client-secret');
        });
    });

    // -----------------------------------------------------------------------
    // Expiry countdown
    // -----------------------------------------------------------------------

    describe('expiry countdown', () => {
        it('should start countdown after successful token fetch', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'user';
            container.querySelector('.tf-password').value = 'pass';

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('success')).toBe(true);
            expect(status.textContent).toContain('tester.token.fetch.success');
        });

        it('should show expired message when countdown reaches 0', async () => {
            jest.useFakeTimers({ legacyFakeTimers: false });

            api.fetchOAuthToken.mockResolvedValue({
                access_token: 'token-123',
                expires_in: 2,
                idpStatus: 200
            });

            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'user';
            container.querySelector('.tf-password').value = 'pass';

            container.querySelector('.fetch-token-btn').click();
            // Flush microtasks (promises) without advancing timers
            await jest.advanceTimersByTimeAsync(0);

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('success')).toBe(true);

            // Advance past expiry
            jest.advanceTimersByTime(2000);

            expect(status.textContent).toContain('tester.token.fetch.expired');
            expect(status.classList.contains('error')).toBe(true);

            jest.useRealTimers();
        });

        it('should stop previous countdown on re-fetch', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'user';
            container.querySelector('.tf-password').value = 'pass';

            // First fetch
            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            // Second fetch should not throw
            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            const status = container.querySelector('.token-fetch-status');
            expect(status.classList.contains('success')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Validation rules per grant type
    // -----------------------------------------------------------------------

    describe('validation rules per grant type', () => {
        it('should require password for ROPC grant', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'user';
            // password left empty

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.tf-password').classList.contains('input-error')).toBe(true);
            expect(api.fetchOAuthToken).not.toHaveBeenCalled();
        });

        it('should require client-secret for client_credentials grant', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.grant-type-selector').value = 'client_credentials';
            container.querySelector('.tf-client-id').value = 'client';
            // client secret left empty

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.tf-client-secret').classList.contains('input-error')).toBe(true);
            expect(api.fetchOAuthToken).not.toHaveBeenCalled();
        });

        it('should allow empty client-secret for ROPC grant', async () => {
            await init(container);

            container.querySelector('.token-endpoint-url').value = 'https://keycloak:8443/token';
            container.querySelector('.tf-client-id').value = 'client';
            container.querySelector('.tf-username').value = 'user';
            container.querySelector('.tf-password').value = 'pass';
            // client secret intentionally empty

            container.querySelector('.fetch-token-btn').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.tf-client-secret').classList.contains('input-error')).toBe(false);
            expect(api.fetchOAuthToken).toHaveBeenCalled();
        });
    });
});
