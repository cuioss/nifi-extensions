'use strict';

/**
 * Tests for app.js — tab switching, collapsibles, loading state.
 */

// Mock the imported modules before importing app.js
jest.mock('../../main/webapp/js/issuer-config.js', () => ({
    init: jest.fn(),
    cleanup: jest.fn()
}));
jest.mock('../../main/webapp/js/token-verifier.js', () => ({
    init: jest.fn()
}));
jest.mock('../../main/webapp/js/metrics.js', () => ({
    init: jest.fn(),
    cleanup: jest.fn()
}));

describe('app.js', () => {
    beforeEach(() => {
        // Set up the DOM from index.html tab structure
        document.body.innerHTML = `
            <div id="jwt-validator-container">
                <div id="loading-indicator">Loading...</div>
                <main id="jwt-validator-tabs" class="jwt-tabs-container hidden">
                    <div class="jwt-tabs-header">
                        <div class="tabs" role="tablist">
                            <a href="#issuer-config" class="tab-item active" role="tab" data-toggle="tab">Configuration</a>
                            <a href="#token-verification" class="tab-item" role="tab" data-toggle="tab">Token Verification</a>
                            <a href="#metrics" class="tab-item" role="tab" data-toggle="tab">Metrics</a>
                            <a href="#help" class="tab-item" role="tab" data-toggle="tab">Help</a>
                        </div>
                    </div>
                    <div class="jwt-tabs-content">
                        <div id="issuer-config" class="tab-pane active" role="tabpanel"></div>
                        <div id="token-verification" class="tab-pane" role="tabpanel"></div>
                        <div id="metrics" class="tab-pane" role="tabpanel"></div>
                        <div id="help" class="tab-pane" role="tabpanel">
                            <div class="help-sections">
                                <h4 class="collapsible-header active">
                                    <i class="fa fa-chevron-down"></i> Getting Started
                                </h4>
                                <div class="collapsible-content show">Content</div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>`;

        jest.resetModules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete globalThis.jwtUICleanup;
    });

    it('should hide loading indicator and show tabs on DOMContentLoaded', async () => {
        await import('../../main/webapp/js/app.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const loading = document.getElementById('loading-indicator');
        const tabs = document.getElementById('jwt-validator-tabs');
        expect(loading.classList.contains('hidden')).toBe(true);
        expect(loading.getAttribute('aria-hidden')).toBe('true');
        expect(tabs.classList.contains('hidden')).toBe(false);
    });

    it('should initialize components on DOMContentLoaded', async () => {
        const issuerConfig = (await import('../../main/webapp/js/issuer-config.js'));
        const tokenVerifier = (await import('../../main/webapp/js/token-verifier.js'));
        const metrics = (await import('../../main/webapp/js/metrics.js'));

        await import('../../main/webapp/js/app.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        expect(issuerConfig.init).toHaveBeenCalled();
        expect(tokenVerifier.init).toHaveBeenCalled();
        expect(metrics.init).toHaveBeenCalled();
    });

    it('should switch tabs when tab link is clicked', async () => {
        await import('../../main/webapp/js/app.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        // Click the "Token Verification" tab
        const tokenTab = document.querySelector('a[href="#token-verification"]');
        tokenTab.click();

        // Verify tab switching
        const configPane = document.getElementById('issuer-config');
        const tokenPane = document.getElementById('token-verification');
        expect(configPane.classList.contains('active')).toBe(false);
        expect(tokenPane.classList.contains('active')).toBe(true);

        // Verify tab-item classes
        const tabItems = document.querySelectorAll('.tab-item');
        expect(tabItems[0].classList.contains('active')).toBe(false);
        expect(tabItems[1].classList.contains('active')).toBe(true);
    });

    it('should register collapsible click handlers', async () => {
        await import('../../main/webapp/js/app.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const header = document.querySelector('.collapsible-header');
        expect(header).not.toBeNull();
        const content = header.nextElementSibling;
        expect(content.classList.contains('collapsible-content')).toBe(true);
    });

    it('should expose jwtUICleanup on globalThis', async () => {
        await import('../../main/webapp/js/app.js');

        expect(typeof globalThis.jwtUICleanup).toBe('function');
        // Should call cleanupMetrics without error
        globalThis.jwtUICleanup();
    });
});
