'use strict';

/**
 * Tests for issuer-config.js — Issuer Configuration editor component.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/issuer-config.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

describe('issuer-config', () => {
    let container;

    beforeEach(() => {
        // Re-apply mock implementations (resetMocks clears them between tests)
        utils.sanitizeHtml.mockImplementation((s) => s);
        utils.displayUiError.mockImplementation(() => {});
        utils.displayUiSuccess.mockImplementation(() => {});
        utils.confirmRemoveIssuer.mockImplementation((name, cb) => cb());
        utils.validateIssuerConfig.mockImplementation(() => ({ isValid: true }));
        utils.validateProcessorIdFromUrl.mockImplementation((url) => {
            const match = url.match(/[?&]id=([^&]+)/);
            if (match) return { isValid: true, sanitizedValue: match[1] };
            return { isValid: false, sanitizedValue: '' };
        });
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

        container = document.createElement('div');
        container.id = 'issuer-config';
        document.body.appendChild(container);

        // Default: no processor ID in URL (standalone mode)
        delete globalThis.location;
        globalThis.location = { href: 'http://localhost:8080/nifi-cuioss-ui/' };
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should initialize the issuer config editor', async () => {
        await init(container);

        expect(container.querySelector('.issuer-config-editor')).not.toBeNull();
        expect(container.querySelector('.issuers-container')).not.toBeNull();
        expect(container.querySelector('.add-issuer-button')).not.toBeNull();
    });

    it('should not re-initialize if already initialized', async () => {
        await init(container);
        const firstContent = container.innerHTML;
        await init(container);
        expect(container.innerHTML).toBe(firstContent);
    });

    it('should return early for null container', async () => {
        await init(null);
        expect(document.body.children.length).toBe(1); // only the test container
    });

    it('should show sample issuer form in standalone mode', async () => {
        await init(container);

        const issuerForms = container.querySelectorAll('.issuer-form');
        expect(issuerForms.length).toBe(1);

        const nameInput = issuerForms[0].querySelector('.issuer-name');
        expect(nameInput.value).toBe('sample-issuer');
    });

    it('should load existing issuers when processor ID is present', async () => {
        globalThis.location = { href: 'http://localhost:8080/nifi-cuioss-ui/?id=test-processor-123' };
        api.getProcessorProperties.mockResolvedValue({
            properties: {
                'issuer.keycloak.issuer': 'https://kc.example.com',
                'issuer.keycloak.jwks-url': 'https://kc.example.com/jwks',
                'issuer.auth0.issuer': 'https://auth0.example.com',
                'issuer.auth0.jwks-url': 'https://auth0.example.com/jwks'
            }
        });

        await init(container);
        await new Promise((r) => setTimeout(r, 10));

        const issuerForms = container.querySelectorAll('.issuer-form');
        expect(issuerForms.length).toBe(2);
    });

    it('should fall back to sample issuer when API fails', async () => {
        globalThis.location = { href: 'http://localhost:8080/nifi-cuioss-ui/?id=test-processor-123' };
        api.getProcessorProperties.mockRejectedValue(new Error('API error'));

        await init(container);
        await new Promise((r) => setTimeout(r, 10));

        const nameInput = container.querySelector('.issuer-name');
        expect(nameInput.value).toBe('sample-issuer');
    });

    it('should add new issuer form when Add Issuer button is clicked', async () => {
        await init(container);

        container.querySelector('.add-issuer-button').click();

        const issuerForms = container.querySelectorAll('.issuer-form');
        expect(issuerForms.length).toBe(2);
    });

    it('should have correct form fields in issuer form', async () => {
        await init(container);

        const form = container.querySelector('.issuer-form');
        expect(form.querySelector('.issuer-name')).not.toBeNull();
        expect(form.querySelector('.field-issuer')).not.toBeNull();
        expect(form.querySelector('.field-jwks-url')).not.toBeNull();
        expect(form.querySelector('.field-jwks-type')).not.toBeNull();
        expect(form.querySelector('.field-audience')).not.toBeNull();
        expect(form.querySelector('.field-client-id')).not.toBeNull();
        expect(form.querySelector('.save-issuer-button')).not.toBeNull();
        expect(form.querySelector('.remove-issuer-button')).not.toBeNull();
        expect(form.querySelector('.verify-jwks-button')).not.toBeNull();
    });

    it('should toggle JWKS field visibility when type changes', async () => {
        await init(container);

        const form = container.querySelector('.issuer-form');
        const typeSelect = form.querySelector('.field-jwks-type');

        // Switch to file
        typeSelect.value = 'file';
        typeSelect.dispatchEvent(new Event('change'));

        expect(form.querySelector('.jwks-type-url').classList.contains('hidden')).toBe(true);
        expect(form.querySelector('.jwks-type-file').classList.contains('hidden')).toBe(false);

        // Switch to memory
        typeSelect.value = 'memory';
        typeSelect.dispatchEvent(new Event('change'));

        expect(form.querySelector('.jwks-type-file').classList.contains('hidden')).toBe(true);
        expect(form.querySelector('.jwks-type-memory').classList.contains('hidden')).toBe(false);
    });

    it('should save issuer in standalone mode', async () => {
        await init(container);

        const form = container.querySelector('.issuer-form');
        form.querySelector('.issuer-name').value = 'test-issuer';
        form.querySelector('.field-issuer').value = 'https://test.example.com';
        form.querySelector('.field-jwks-url').value = 'https://test.example.com/jwks';

        form.querySelector('.save-issuer-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiSuccess).toHaveBeenCalledWith(
            expect.any(Element),
            'Issuer configuration saved successfully (standalone mode).'
        );
    });

    it('should validate required fields before saving', async () => {
        await init(container);

        const form = container.querySelector('.issuer-form');
        form.querySelector('.issuer-name').value = '';
        form.querySelector('.field-issuer').value = '';

        form.querySelector('.save-issuer-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should save issuer via API when processor ID is present', async () => {
        globalThis.location = { href: 'http://localhost:8080/nifi-cuioss-ui/?id=test-processor-123' };
        api.getProcessorProperties.mockResolvedValue({ properties: {} });
        api.updateProcessorProperties.mockResolvedValue({});

        await init(container);
        await new Promise((r) => setTimeout(r, 10));

        // Empty properties produce no forms; add one manually
        container.querySelector('.add-issuer-button').click();

        const form = container.querySelector('.issuer-form');
        form.querySelector('.issuer-name').value = 'my-issuer';
        form.querySelector('.field-issuer').value = 'https://issuer.example.com';
        form.querySelector('.field-jwks-url').value = 'https://issuer.example.com/jwks';

        form.querySelector('.save-issuer-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.updateProcessorProperties).toHaveBeenCalledWith(
            'test-processor-123',
            expect.objectContaining({
                'issuer.my-issuer.jwks-type': 'url',
                'issuer.my-issuer.issuer': 'https://issuer.example.com',
                'issuer.my-issuer.jwks-url': 'https://issuer.example.com/jwks'
            })
        );
    });

    it('should remove issuer form when remove button is clicked', async () => {
        await init(container);

        const form = container.querySelector('.issuer-form');
        expect(form).not.toBeNull();

        form.querySelector('.remove-issuer-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(container.querySelectorAll('.issuer-form').length).toBe(0);
    });

    it('should test JWKS URL connection', async () => {
        api.validateJwksUrl.mockResolvedValue({ valid: true, keyCount: 3 });

        await init(container);

        const form = container.querySelector('.issuer-form');
        form.querySelector('.field-jwks-url').value = 'https://test.example.com/jwks';

        form.querySelector('.verify-jwks-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const result = form.querySelector('.verification-result');
        expect(result.textContent).toContain('Valid JWKS');
        expect(result.textContent).toContain('3 keys found');
    });

    it('should show error for invalid JWKS URL validation', async () => {
        api.validateJwksUrl.mockResolvedValue({ valid: false, error: 'Connection failed' });

        await init(container);

        const form = container.querySelector('.issuer-form');
        form.querySelector('.field-jwks-url').value = 'https://bad.example.com/jwks';

        form.querySelector('.verify-jwks-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should handle JWKS file type validation', async () => {
        api.validateJwksFile.mockResolvedValue({ valid: true, keyCount: 2 });

        await init(container);

        const form = container.querySelector('.issuer-form');
        const typeSelect = form.querySelector('.field-jwks-type');
        typeSelect.value = 'file';
        typeSelect.dispatchEvent(new Event('change'));

        form.querySelector('.field-jwks-file').value = '/path/to/jwks.json';
        form.querySelector('.verify-jwks-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.validateJwksFile).toHaveBeenCalledWith('/path/to/jwks.json');
    });

    it('should handle JWKS memory/content type validation', async () => {
        api.validateJwksContent.mockResolvedValue({ valid: true, keyCount: 1 });

        await init(container);

        const form = container.querySelector('.issuer-form');
        const typeSelect = form.querySelector('.field-jwks-type');
        typeSelect.value = 'memory';
        typeSelect.dispatchEvent(new Event('change'));

        form.querySelector('.field-jwks-content').value = '{"keys":[]}';
        form.querySelector('.verify-jwks-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.validateJwksContent).toHaveBeenCalledWith('{"keys":[]}');
    });

    it('should show error when save via API fails', async () => {
        globalThis.location = { href: 'http://localhost:8080/nifi-cuioss-ui/?id=test-processor-123' };
        api.getProcessorProperties.mockResolvedValue({ properties: {} });
        api.updateProcessorProperties.mockRejectedValue(new Error('Save failed'));

        await init(container);
        await new Promise((r) => setTimeout(r, 10));

        container.querySelector('.add-issuer-button').click();

        const form = container.querySelector('.issuer-form');
        form.querySelector('.issuer-name').value = 'fail-issuer';
        form.querySelector('.field-issuer').value = 'https://fail.example.com';
        form.querySelector('.field-jwks-url').value = 'https://fail.example.com/jwks';

        form.querySelector('.save-issuer-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should show error when JWKS URL validation throws', async () => {
        api.validateJwksUrl.mockRejectedValue(new Error('Network error'));

        await init(container);

        const form = container.querySelector('.issuer-form');
        form.querySelector('.field-jwks-url').value = 'https://bad.example.com/jwks';

        form.querySelector('.verify-jwks-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should remove issuer and clear API properties when processor ID is present', async () => {
        globalThis.location = { href: 'http://localhost:8080/nifi-cuioss-ui/?id=test-processor-123' };
        api.getProcessorProperties.mockResolvedValue({
            properties: {
                'issuer.keycloak.issuer': 'https://kc.example.com',
                'issuer.keycloak.jwks-url': 'https://kc.example.com/jwks'
            }
        });
        api.updateProcessorProperties.mockResolvedValue({});

        await init(container);
        await new Promise((r) => setTimeout(r, 10));

        const form = container.querySelector('.issuer-form');
        expect(form).not.toBeNull();

        form.querySelector('.remove-issuer-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.updateProcessorProperties).toHaveBeenCalledWith(
            'test-processor-123',
            expect.objectContaining({
                'issuer.keycloak.issuer': null,
                'issuer.keycloak.jwks-url': null
            })
        );
    });

    it('should call cleanup without error', () => {
        expect(() => cleanup()).not.toThrow();
    });
});
