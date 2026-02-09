'use strict';

/**
 * Tests for nifi-common-init.js — NiFi Common API shim.
 */

describe('nifi-common-init', () => {
    const originalNf = globalThis.nf;
    const originalNfCommon = globalThis.nfCommon;

    afterEach(() => {
        // Restore original state
        if (originalNf !== undefined) globalThis.nf = originalNf;
        else delete globalThis.nf;
        if (originalNfCommon !== undefined) globalThis.nfCommon = originalNfCommon;
        else delete globalThis.nfCommon;

        // Clear module cache so nifi-common-init.js re-executes
        jest.resetModules();
    });

    it('should map nf.Common to nfCommon when nf.Common is available', () => {
        const mockCommon = { registerCustomUiTab: jest.fn(), getI18n: jest.fn() };
        globalThis.nf = { Common: mockCommon };
        delete globalThis.nfCommon;

        require('../../main/webapp/js/nifi-common-init.js');

        expect(globalThis.nfCommon).toBe(mockCommon);
    });

    it('should create minimal stub when nf is not available', () => {
        delete globalThis.nf;
        delete globalThis.nfCommon;

        require('../../main/webapp/js/nifi-common-init.js');

        expect(globalThis.nfCommon).toBeDefined();
        expect(typeof globalThis.nfCommon.registerCustomUiTab).toBe('function');
        expect(typeof globalThis.nfCommon.getI18n).toBe('function');
    });

    it('should provide getI18n stub that returns key as property value', () => {
        delete globalThis.nf;
        delete globalThis.nfCommon;

        require('../../main/webapp/js/nifi-common-init.js');

        const i18n = globalThis.nfCommon.getI18n();
        expect(i18n.getProperty('some.key')).toBe('some.key');
    });

    it('should not overwrite existing nfCommon', () => {
        delete globalThis.nf;
        const existing = { custom: true };
        globalThis.nfCommon = existing;

        require('../../main/webapp/js/nifi-common-init.js');

        expect(globalThis.nfCommon).toBe(existing);
    });
});
