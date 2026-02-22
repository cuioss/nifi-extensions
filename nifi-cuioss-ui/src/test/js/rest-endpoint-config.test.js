'use strict';

/**
 * Tests for rest-endpoint-config.js — Gateway route configuration CRUD editor.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/rest-endpoint-config.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

const SAMPLE_PROPERTIES = {
    'rest.gateway.listening.port': '9443',
    'rest.gateway.max.request.size': '1048576',
    'rest.gateway.request.queue.size': '100',
    'rest.gateway.ssl.context.service': '',
    'rest.gateway.cors.allowed.origins': '*',
    'restapi.health.path': '/api/health',
    'restapi.health.methods': 'GET',
    'restapi.health.enabled': 'true',
    'restapi.health.required-roles': '',
    'restapi.health.required-scopes': '',
    'restapi.data.path': '/api/data',
    'restapi.data.methods': 'GET,POST',
    'restapi.data.enabled': 'true',
    'restapi.data.required-roles': 'admin',
    'restapi.data.required-scopes': 'read,write'
};

describe('rest-endpoint-config', () => {
    let container;

    beforeEach(() => {
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
        // Stub sanitizeHtml to pass through
        utils.sanitizeHtml.mockImplementation((s) => s || '');
        // Stub displayUiError/Success
        utils.displayUiError.mockImplementation(() => {});
        utils.displayUiSuccess.mockImplementation(() => {});
        // Stub validateProcessorIdFromUrl to return a valid ID
        utils.validateProcessorIdFromUrl.mockReturnValue({
            isValid: true,
            sanitizedValue: 'test-processor-id'
        });
        // Stub confirmRemoveRoute to auto-confirm
        utils.confirmRemoveRoute.mockImplementation((name, onConfirm) => {
            onConfirm();
            return Promise.resolve(true);
        });

        // Mock location for component ID extraction
        Object.defineProperty(globalThis, 'location', {
            value: { href: 'http://localhost:8080/nifi-jwt-ui/?id=test-processor-id' },
            writable: true
        });

        container = document.createElement('div');
        container.id = 'endpoint-config';
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should load existing routes from properties', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const forms = container.querySelectorAll('.route-form');
        expect(forms.length).toBe(2);
    });

    it('should display global settings', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const settingsDisplay = container.querySelector('.global-settings-display');
        expect(settingsDisplay).not.toBeNull();
        expect(settingsDisplay.textContent).toContain('Listening Port');
        expect(settingsDisplay.textContent).toContain('9443');
    });

    it('should add a new route form', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const addBtn = container.querySelector('.add-route-button');
        expect(addBtn).not.toBeNull();

        addBtn.click();

        const forms = container.querySelectorAll('.route-form');
        expect(forms.length).toBe(3); // 2 existing + 1 new
    });

    it('should save route via API', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const saveBtn = container.querySelector('.save-route-button');
        saveBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
            'test-processor-id',
            expect.objectContaining({
                'restapi.health.path': '/api/health'
            })
        );
    });

    it('should remove a route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const initialForms = container.querySelectorAll('.route-form');
        expect(initialForms.length).toBe(2);

        const removeBtn = container.querySelector('.remove-route-button');
        removeBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        const remainingForms = container.querySelectorAll('.route-form');
        expect(remainingForms.length).toBe(1);
    });

    it('should have enabled checkbox per route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const checkboxes = container.querySelectorAll('.route-enabled');
        expect(checkboxes.length).toBe(2);
        expect(checkboxes[0].checked).toBe(true);
    });

    it('should validate missing route name', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.test.path': '/api/test' },
            revision: { version: 1 }
        });

        await init(container);

        // Clear the route name
        const nameInput = container.querySelector('.route-name');
        nameInput.value = '';

        const saveBtn = container.querySelector('.save-route-button');
        saveBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should validate missing path', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.test.path': '/api/test' },
            revision: { version: 1 }
        });

        await init(container);

        // Clear the path field
        const pathInput = container.querySelector('.field-path');
        pathInput.value = '';

        const saveBtn = container.querySelector('.save-route-button');
        saveBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should display schema textarea', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const schemaFields = container.querySelectorAll('.field-schema');
        expect(schemaFields.length).toBe(2);
        expect(schemaFields[0].tagName.toLowerCase()).toBe('textarea');
    });

    it('should not re-initialize if already initialized', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        const firstContent = container.innerHTML;
        await init(container);
        expect(container.innerHTML).toBe(firstContent);
    });

    it('should return early for null container', async () => {
        await init(null);
        expect(api.getComponentProperties).not.toHaveBeenCalled();
    });

    it('should show sample form when no component ID', async () => {
        utils.validateProcessorIdFromUrl.mockReturnValue({
            isValid: false,
            sanitizedValue: ''
        });

        await init(container);

        const forms = container.querySelectorAll('.route-form');
        expect(forms.length).toBe(1);
    });

    it('should show sample form when API fails', async () => {
        api.getComponentProperties.mockRejectedValue(new Error('API error'));

        await init(container);

        const forms = container.querySelectorAll('.route-form');
        expect(forms.length).toBe(1);
    });

    it('should call cleanup without error', () => {
        expect(() => cleanup()).not.toThrow();
    });

    it('should display route name and path in form', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const nameInputs = container.querySelectorAll('.route-name');
        expect(nameInputs.length).toBe(2);

        const pathInputs = container.querySelectorAll('.field-path');
        expect(pathInputs.length).toBe(2);
    });

    it('should handle disabled route', async () => {
        const props = {
            ...SAMPLE_PROPERTIES,
            'restapi.disabled.path': '/api/disabled',
            'restapi.disabled.enabled': 'false'
        };
        api.getComponentProperties.mockResolvedValue({
            properties: props,
            revision: { version: 1 }
        });

        await init(container);

        const forms = container.querySelectorAll('.route-form');
        expect(forms.length).toBe(3);

        // Find the disabled route's checkbox
        const checkboxes = container.querySelectorAll('.route-enabled');
        const disabledCheckbox = Array.from(checkboxes).find((cb) => !cb.checked);
        expect(disabledCheckbox).toBeDefined();
    });
});
