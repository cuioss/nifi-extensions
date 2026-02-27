'use strict';

/**
 * Tests for issuer-config.js — Issuer Configuration editor component.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');
jest.mock('../../main/webapp/js/context-help.js');

import { init, cleanup } from '../../main/webapp/js/issuer-config.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';
import { createContextHelp } from '../../main/webapp/js/context-help.js';

const mockCreateContextHelp = ({ helpKey, propertyKey, currentValue }) => {
    const button = document.createElement('button');
    button.className = 'context-help-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.dataset.helpKey = helpKey;

    const panel = document.createElement('div');
    panel.className = 'context-help-panel';
    panel.hidden = true;
    panel.innerHTML = `<code>${propertyKey}</code><span>${currentValue || ''}</span>`;

    button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
    });

    return { button, panel };
};

describe('issuer-config', () => {
    let container;

    beforeEach(() => {
        // Re-apply mock implementations (resetMocks clears them between tests)
        utils.sanitizeHtml.mockImplementation((s) => s);
        utils.t.mockImplementation((key) => key);
        createContextHelp.mockImplementation(mockCreateContextHelp);
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
        api.getComponentProperties.mockResolvedValue({
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
        api.getComponentProperties.mockRejectedValue(new Error('API error'));

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
            'issuer.save.success.standalone'
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
        api.getComponentProperties.mockResolvedValue({ properties: {} });
        api.updateComponentProperties.mockResolvedValue({});

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

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
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
        expect(result.textContent).toContain('issuer.jwks.valid');
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
        api.getComponentProperties.mockResolvedValue({ properties: {} });
        api.updateComponentProperties.mockRejectedValue(new Error('Save failed'));

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
        api.getComponentProperties.mockResolvedValue({
            properties: {
                'issuer.keycloak.issuer': 'https://kc.example.com',
                'issuer.keycloak.jwks-url': 'https://kc.example.com/jwks'
            }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);
        await new Promise((r) => setTimeout(r, 10));

        const form = container.querySelector('.issuer-form');
        expect(form).not.toBeNull();

        form.querySelector('.remove-issuer-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
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

    // -----------------------------------------------------------------------
    // Gateway context (options)
    // -----------------------------------------------------------------------

    describe('gateway context (isGatewayContext)', () => {
        beforeEach(() => {
            // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual CS stub
            api.getControllerServiceProperties = jest.fn();
            // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual CS stub
            api.updateControllerServiceProperties = jest.fn();
            // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual t() stub
            utils.t = jest.fn().mockImplementation((key) => key);
        });

        it('should render summary table in gateway context', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.keycloak.issuer': 'https://kc.example.com',
                    'issuer.keycloak.jwks-url': 'https://kc.example.com/jwks',
                    'issuer.keycloak.jwks-type': 'url'
                }
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.issuer-summary-table')).not.toBeNull();
            const rows = container.querySelectorAll('tr[data-issuer-name]');
            expect(rows.length).toBe(1);
            expect(rows[0].dataset.issuerName).toBe('keycloak');
        });

        it('should show empty state when no issuers in gateway context', async () => {
            api.getControllerServiceProperties.mockResolvedValue({ properties: {} });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.empty-state')).not.toBeNull();
        });

        it('should open inline editor when edit button is clicked', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                }
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            const editBtn = container.querySelector('.edit-issuer-button');
            editBtn.click();

            expect(container.querySelector('.issuer-inline-form')).not.toBeNull();
            const nameInput = container.querySelector('.issuer-inline-form .issuer-name');
            expect(nameInput.value).toBe('kc');
        });

        it('should save issuer via CS API in gateway context', async () => {
            api.getControllerServiceProperties.mockResolvedValue({ properties: {} });
            api.updateControllerServiceProperties.mockResolvedValue({});

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            // Click Add Issuer
            container.querySelector('.add-issuer-button').click();

            const form = container.querySelector('.issuer-inline-form');
            form.querySelector('.issuer-name').value = 'my-issuer';
            form.querySelector('.field-issuer').value = 'https://issuer.example.com';
            form.querySelector('.field-jwks-url').value = 'https://issuer.example.com/jwks';

            form.querySelector('.save-issuer-button').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(api.updateControllerServiceProperties).toHaveBeenCalledWith(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                expect.objectContaining({
                    'issuer.my-issuer.issuer': 'https://issuer.example.com',
                    'issuer.my-issuer.jwks-url': 'https://issuer.example.com/jwks'
                })
            );
        });

        it('should remove issuer via CS API in gateway context', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                }
            });
            api.updateControllerServiceProperties.mockResolvedValue({});

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            const removeBtn = container.querySelector('.remove-issuer-gw-button');
            removeBtn.click();
            await new Promise((r) => setTimeout(r, 10));

            expect(api.updateControllerServiceProperties).toHaveBeenCalledWith(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                expect.objectContaining({
                    'issuer.kc.issuer': null,
                    'issuer.kc.jwks-url': null
                })
            );
        });

        it('should handle save error in gateway context', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {}
            });
            api.updateControllerServiceProperties.mockRejectedValue(
                new Error('CS update failed')
            );

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.add-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            form.querySelector('.issuer-name').value = 'fail-issuer';
            form.querySelector('.field-issuer').value = 'https://fail.example.com';
            form.querySelector('.field-jwks-url').value = 'https://fail.example.com/jwks';

            form.querySelector('.save-issuer-button').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(utils.displayUiError).toHaveBeenCalled();
        });

        it('should toggle JWKS type fields in gateway inline editor', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                }
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.edit-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            const typeSelect = form.querySelector('.field-jwks-type');

            typeSelect.value = 'file';
            typeSelect.dispatchEvent(new Event('change'));

            const urlField = form.querySelector('.jwks-type-url');
            const fileField = form.querySelector('.jwks-type-file');
            expect(urlField.classList.contains('hidden')).toBe(true);
            expect(fileField.classList.contains('hidden')).toBe(false);

            typeSelect.value = 'memory';
            typeSelect.dispatchEvent(new Event('change'));

            const memoryField = form.querySelector('.jwks-type-memory');
            expect(fileField.classList.contains('hidden')).toBe(true);
            expect(memoryField.classList.contains('hidden')).toBe(false);
        });

        it('should test JWKS connection from gateway inline editor', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                }
            });
            api.validateJwksUrl.mockResolvedValue({
                valid: true, keyCount: 2
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.edit-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            form.querySelector('.field-jwks-url').value =
                'https://kc.example.com/jwks';

            form.querySelector('.verify-jwks-button').click();
            await new Promise((r) => setTimeout(r, 10));

            const result = form.querySelector('.verification-result');
            expect(result.textContent).toContain('issuer.jwks.valid');
        });

        it('should validate required fields in gateway context', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {}
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.add-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            form.querySelector('.issuer-name').value = '';
            form.querySelector('.field-issuer').value = '';

            form.querySelector('.save-issuer-button').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(utils.displayUiError).toHaveBeenCalled();
        });

        it('should update existing row after edit save', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                }
            });
            api.updateControllerServiceProperties.mockResolvedValue({});

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            // Edit existing issuer
            container.querySelector('.edit-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            form.querySelector('.field-issuer').value =
                'https://kc-new.example.com';
            form.querySelector('.field-jwks-url').value =
                'https://kc-new.example.com/jwks';

            form.querySelector('.save-issuer-button').click();
            await new Promise((r) => setTimeout(r, 10));

            // Inline form should be removed
            expect(container.querySelector('.issuer-inline-form')).toBeNull();
            // Row should show modified badge
            const row = container.querySelector(
                'tr[data-issuer-name="kc"]'
            );
            expect(row.dataset.origin).toBe('modified');
        });

        it('should handle API failure when removing issuer', async () => {
            api.getControllerServiceProperties
                .mockResolvedValueOnce({
                    properties: {
                        'issuer.kc.issuer': 'https://kc.example.com',
                        'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                    }
                })
                .mockRejectedValueOnce(new Error('API error'));

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.remove-issuer-gw-button').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(utils.displayUiError).toHaveBeenCalled();
        });

        it('should handle empty summary table on API failure', async () => {
            api.getControllerServiceProperties.mockRejectedValue(
                new Error('CS not found')
            );

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.issuer-summary-table'))
                .not.toBeNull();
            expect(container.querySelector('.empty-state'))
                .not.toBeNull();
        });

        it('should render table without componentId in gateway mode', async () => {
            await init(container, {
                targetComponentId: '',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelector('.issuer-summary-table'))
                .not.toBeNull();
            expect(container.querySelector('.empty-state'))
                .not.toBeNull();
        });

        it('should save in standalone mode without componentId', async () => {
            await init(container, {
                targetComponentId: '',
                useControllerService: false,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.add-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            form.querySelector('.issuer-name').value = 'standalone-issuer';
            form.querySelector('.field-issuer').value = 'https://standalone.example.com';
            form.querySelector('.field-jwks-url').value = 'https://standalone.example.com/jwks';

            form.querySelector('.save-issuer-button').click();
            await new Promise((r) => setTimeout(r, 10));

            // Form should be removed and row added
            expect(container.querySelector('.issuer-inline-form')).toBeNull();
            const row = container.querySelector('tr[data-issuer-name="standalone-issuer"]');
            expect(row).not.toBeNull();
        });

        it('should handle rename by clearing old properties', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.old-name.issuer': 'https://old.example.com',
                    'issuer.old-name.jwks-url': 'https://old.example.com/jwks'
                }
            });
            api.updateControllerServiceProperties.mockResolvedValue({});

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.edit-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            // Rename issuer
            form.querySelector('.issuer-name').value = 'new-name';
            form.querySelector('.field-issuer').value = 'https://old.example.com';
            form.querySelector('.field-jwks-url').value = 'https://old.example.com/jwks';

            form.querySelector('.save-issuer-button').click();
            await new Promise((r) => setTimeout(r, 10));

            // Should have called update with null for old props
            expect(api.updateControllerServiceProperties)
                .toHaveBeenCalledWith(
                    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    expect.objectContaining({
                        'issuer.old-name.issuer': null,
                        'issuer.old-name.jwks-url': null,
                        'issuer.new-name.issuer': 'https://old.example.com'
                    })
                );
        });

        it('should test JWKS file connection in gateway editor', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-file': '/path/to/jwks.json',
                    'issuer.kc.jwks-type': 'file'
                }
            });
            api.validateJwksFile.mockResolvedValue({
                valid: true, keyCount: 1
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.edit-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');

            // Switch to file type and test
            const typeSelect = form.querySelector('.field-jwks-type');
            typeSelect.value = 'file';
            typeSelect.dispatchEvent(new Event('change'));

            form.querySelector('.field-jwks-file').value = '/path/to/jwks.json';
            form.querySelector('.verify-jwks-button').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(api.validateJwksFile)
                .toHaveBeenCalledWith('/path/to/jwks.json');
        });

        it('should test JWKS memory content in gateway editor', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                }
            });
            api.validateJwksContent.mockResolvedValue({
                valid: true, keyCount: 1
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.edit-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');

            const typeSelect = form.querySelector('.field-jwks-type');
            typeSelect.value = 'memory';
            typeSelect.dispatchEvent(new Event('change'));

            form.querySelector('.field-jwks-content').value = '{"keys":[]}';
            form.querySelector('.verify-jwks-button').click();
            await new Promise((r) => setTimeout(r, 10));

            expect(api.validateJwksContent)
                .toHaveBeenCalledWith('{"keys":[]}');
        });

        it('should remove issuer standalone mode in gateway context', async () => {
            await init(container, {
                targetComponentId: '',
                useControllerService: false,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            // Add an issuer first in standalone mode
            container.querySelector('.add-issuer-button').click();
            const form = container.querySelector('.issuer-inline-form');
            form.querySelector('.issuer-name').value = 'test-iss';
            form.querySelector('.field-issuer').value = 'https://test.com';
            form.querySelector('.field-jwks-url').value = 'https://test.com/j';

            form.querySelector('.save-issuer-button').click();
            await new Promise((r) => setTimeout(r, 10));

            // Now remove it
            const removeBtn = container.querySelector(
                '.remove-issuer-gw-button'
            );
            removeBtn.click();
            await new Promise((r) => setTimeout(r, 10));

            expect(container.querySelectorAll(
                'tr[data-issuer-name]'
            ).length).toBe(0);
        });

        it('should cancel inline editor and restore row', async () => {
            api.getControllerServiceProperties.mockResolvedValue({
                properties: {
                    'issuer.kc.issuer': 'https://kc.example.com',
                    'issuer.kc.jwks-url': 'https://kc.example.com/jwks'
                }
            });

            await init(container, {
                targetComponentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                useControllerService: true,
                isGatewayContext: true
            });
            await new Promise((r) => setTimeout(r, 10));

            container.querySelector('.edit-issuer-button').click();
            expect(container.querySelector('.issuer-inline-form')).not.toBeNull();

            container.querySelector('.cancel-issuer-button').click();
            expect(container.querySelector('.issuer-inline-form')).toBeNull();
            // Row should be visible again
            const row = container.querySelector('tr[data-issuer-name="kc"]');
            expect(row.classList.contains('hidden')).toBe(false);
        });
    });

    // -------------------------------------------------------------------
    // Context help on issuer forms
    // -------------------------------------------------------------------

    it('should render context help buttons in standalone issuer form', async () => {
        await init(container);

        const issuerForm = container.querySelector('.issuer-form');
        expect(issuerForm).not.toBeNull();

        const helpButtons = issuerForm.querySelectorAll('.context-help-toggle');
        // name + jwks-type + issuer-uri + jwks-url + audience + client-id = 6 visible
        // (jwks-file and jwks-content are hidden but present)
        expect(helpButtons.length).toBeGreaterThanOrEqual(6);
    });

    it('should display property key in issuer context help panel', async () => {
        await init(container);

        const panel = container.querySelector('.issuer-form .context-help-panel');
        expect(panel).not.toBeNull();
        const code = panel.querySelector('code');
        expect(code).not.toBeNull();
        // Should contain an issuer property key pattern
        expect(code.textContent).toMatch(/^issuer\./);
    });
});
