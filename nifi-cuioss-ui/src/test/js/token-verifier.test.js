'use strict';

/**
 * Tests for token-verifier.js — Token Verification tab component.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

// eslint-disable-next-line no-unused-vars
import { init } from '../../main/webapp/js/token-verifier.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

describe('token-verifier', () => {
    let container;

    beforeEach(() => {
        // Re-apply mock implementations (resetMocks clears them between tests)
        utils.sanitizeHtml.mockImplementation((s) => s);
        utils.t.mockImplementation((key) => key);
        utils.displayUiError.mockImplementation(() => {});
        utils.confirmClearForm.mockImplementation((cb) => cb());
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

        container = document.createElement('div');
        container.id = 'token-verification';
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should initialize the token verification UI', () => {
        init(container);

        expect(container.querySelector('.token-verification-container')).not.toBeNull();
        expect(container.querySelector('#field-token-input')).not.toBeNull();
        expect(container.querySelector('.verify-token-button')).not.toBeNull();
        expect(container.querySelector('.clear-token-button')).not.toBeNull();
    });

    it('should not re-initialize if already initialized', () => {
        init(container);
        const firstContent = container.innerHTML;
        init(container);
        expect(container.innerHTML).toBe(firstContent);
    });

    it('should return early for null container', () => {
        expect(() => init(null)).not.toThrow();
    });

    it('should show error when verifying empty token', async () => {
        init(container);
        container.querySelector('.verify-token-button').click();

        await new Promise((r) => setTimeout(r, 0));

        expect(utils.displayUiError).toHaveBeenCalledWith(
            expect.any(Element), null, {}, 'processor.jwt.noTokenProvided'
        );
    });

    it('should call verifyToken API and render valid results', async () => {
        const mockResult = {
            valid: true,
            decoded: {
                header: { alg: 'RS256', typ: 'JWT' },
                payload: { sub: 'user1', iss: 'test-issuer', exp: Math.floor(Date.now() / 1000) + 3600 }
            }
        };
        api.verifyToken.mockResolvedValue(mockResult);

        init(container);
        container.querySelector('#field-token-input').value = 'test.jwt.token';
        container.querySelector('.verify-token-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const results = container.querySelector('.token-results-content');
        expect(results.querySelector('.verification-status.valid')).not.toBeNull();
        expect(results.textContent).toContain('token.status.valid');
    });

    it('should render invalid status for invalid token', async () => {
        const mockResult = {
            valid: false,
            decoded: { header: { alg: 'RS256' }, payload: {} },
            error: 'Signature verification failed'
        };
        api.verifyToken.mockResolvedValue(mockResult);

        init(container);
        container.querySelector('#field-token-input').value = 'invalid.jwt.token';
        container.querySelector('.verify-token-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const results = container.querySelector('.token-results-content');
        expect(results.querySelector('.verification-status.invalid')).not.toBeNull();
    });

    it('should render expired status for expired token', async () => {
        const mockResult = {
            valid: true,
            decoded: {
                header: { alg: 'RS256' },
                payload: { exp: Math.floor(Date.now() / 1000) - 3600 }
            }
        };
        api.verifyToken.mockResolvedValue(mockResult);

        init(container);
        container.querySelector('#field-token-input').value = 'expired.jwt.token';
        container.querySelector('.verify-token-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const results = container.querySelector('.token-results-content');
        expect(results.querySelector('.verification-status.expired')).not.toBeNull();
    });

    it('should display error when API call fails', async () => {
        const error = new Error('Network error');
        api.verifyToken.mockRejectedValue(error);

        init(container);
        container.querySelector('#field-token-input').value = 'test.jwt.token';
        container.querySelector('.verify-token-button').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(utils.displayUiError).toHaveBeenCalledWith(
            expect.any(Element), error, {}
        );
    });

    it('should clear form when clear button is clicked', () => {
        init(container);
        const tokenInput = container.querySelector('#field-token-input');
        tokenInput.value = 'some-token';
        container.querySelector('.token-results-content').innerHTML = 'Some results';

        container.querySelector('.clear-token-button').click();

        expect(utils.confirmClearForm).toHaveBeenCalled();
        expect(tokenInput.value).toBe('');
        expect(container.querySelector('.token-results-content').innerHTML).toBe('');
    });

    it('should render result without decoded section', async () => {
        const mockResult = { valid: true };
        api.verifyToken.mockResolvedValue(mockResult);

        init(container);
        container.querySelector('#field-token-input').value = 'minimal.jwt.token';
        container.querySelector('.verify-token-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const results = container.querySelector('.token-results-content');
        expect(results.querySelector('.verification-status.valid')).not.toBeNull();
        expect(results.querySelector('.token-details')).toBeNull();
    });

    it('should render result with header only (no payload)', async () => {
        const mockResult = {
            valid: true,
            decoded: { header: { alg: 'RS256' } }
        };
        api.verifyToken.mockResolvedValue(mockResult);

        init(container);
        container.querySelector('#field-token-input').value = 'header-only.jwt.token';
        container.querySelector('.verify-token-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const results = container.querySelector('.token-results-content');
        expect(results.textContent).toContain('token.section.header');
        expect(results.querySelector('.claims-table')).toBeNull();
    });

    it('should render claims with issuer and subject', async () => {
        const mockResult = {
            valid: true,
            decoded: {
                header: { alg: 'RS256' },
                payload: {
                    sub: 'user@example.com',
                    iss: 'https://issuer.example.com',
                    exp: Math.floor(Date.now() / 1000) + 3600
                }
            }
        };
        api.verifyToken.mockResolvedValue(mockResult);

        init(container);
        container.querySelector('#field-token-input').value = 'test.jwt.token';
        container.querySelector('.verify-token-button').click();
        await new Promise((r) => setTimeout(r, 10));

        const results = container.querySelector('.token-results-content');
        expect(results.textContent).toContain('token.claim.issuer');
        expect(results.textContent).toContain('token.claim.subject');
        expect(results.textContent).toContain('token.claim.expiration');
    });
});
