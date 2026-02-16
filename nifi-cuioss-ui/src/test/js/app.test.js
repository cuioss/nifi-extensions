'use strict';

/**
 * Tests for app.js — tab switching, collapsibles, loading state, component type routing.
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
jest.mock('../../main/webapp/js/api.js', () => ({
    getComponentId: jest.fn().mockReturnValue(''),
    detectComponentType: jest.fn().mockResolvedValue({ type: 'PROCESSOR', componentClass: '' })
}));

/** Full DOM structure matching index.html with both JWT and gateway tabs. */
const FULL_DOM = `
    <div id="jwt-validator-container">
        <div id="loading-indicator">Loading...</div>
        <main id="jwt-validator-tabs" class="jwt-tabs-container hidden">
            <div class="jwt-tabs-header">
                <div class="tabs" role="tablist">
                    <a href="#issuer-config" class="tab-item active jwt-tab" role="tab" data-toggle="tab">Configuration</a>
                    <a href="#token-verification" class="tab-item jwt-tab" role="tab" data-toggle="tab">Token Verification</a>
                    <a href="#endpoint-config" class="tab-item gateway-tab hidden" role="tab" data-toggle="tab">Endpoint Configuration</a>
                    <a href="#endpoint-tester" class="tab-item gateway-tab hidden" role="tab" data-toggle="tab">Endpoint Tester</a>
                    <a href="#metrics" class="tab-item" role="tab" data-toggle="tab">Metrics</a>
                    <a href="#help" class="tab-item" role="tab" data-toggle="tab">Help</a>
                </div>
            </div>
            <div class="jwt-tabs-content">
                <div id="issuer-config" class="tab-pane active jwt-tab" role="tabpanel"></div>
                <div id="token-verification" class="tab-pane jwt-tab" role="tabpanel"></div>
                <div id="endpoint-config" class="tab-pane gateway-tab hidden" role="tabpanel"></div>
                <div id="endpoint-tester" class="tab-pane gateway-tab hidden" role="tabpanel"></div>
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

describe('app.js', () => {
    beforeEach(() => {
        document.body.innerHTML = FULL_DOM;
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

        // Allow async initComponents to complete
        await new Promise((r) => setTimeout(r, 0));

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
        const configTabItem = document.querySelector('a[href="#issuer-config"]');
        const tokenTabItem = document.querySelector('a[href="#token-verification"]');
        expect(configTabItem.classList.contains('active')).toBe(false);
        expect(tokenTabItem.classList.contains('active')).toBe(true);
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

// ---------------------------------------------------------------------------
// Tab routing by component type
// ---------------------------------------------------------------------------

describe('configureTabsForType', () => {
    beforeEach(() => {
        document.body.innerHTML = FULL_DOM;
        jest.resetModules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show issuer tabs for JWT processor', async () => {
        const { configureTabsForType } = await import('../../main/webapp/js/app.js');
        configureTabsForType(false);

        // JWT tabs visible
        const jwtTabs = document.querySelectorAll('.jwt-tab');
        for (const el of jwtTabs) {
            expect(el.classList.contains('hidden')).toBe(false);
        }

        // Gateway tabs hidden
        const gatewayTabs = document.querySelectorAll('.gateway-tab');
        for (const el of gatewayTabs) {
            expect(el.classList.contains('hidden')).toBe(true);
        }
    });

    it('should show issuer tabs for controller service', async () => {
        const { configureTabsForType } = await import('../../main/webapp/js/app.js');
        configureTabsForType(false);

        const issuerConfig = document.getElementById('issuer-config');
        const tokenVerification = document.getElementById('token-verification');
        expect(issuerConfig.classList.contains('hidden')).toBe(false);
        expect(tokenVerification.classList.contains('hidden')).toBe(false);
    });

    it('should show gateway tabs for RestApiGateway', async () => {
        const { configureTabsForType } = await import('../../main/webapp/js/app.js');
        configureTabsForType(true);

        // Gateway tabs visible
        const gatewayTabs = document.querySelectorAll('.gateway-tab');
        for (const el of gatewayTabs) {
            expect(el.classList.contains('hidden')).toBe(false);
        }

        // JWT tabs hidden
        const jwtTabs = document.querySelectorAll('.jwt-tab');
        for (const el of jwtTabs) {
            expect(el.classList.contains('hidden')).toBe(true);
        }
    });

    it('should hide irrelevant tabs when gateway view is active', async () => {
        const { configureTabsForType } = await import('../../main/webapp/js/app.js');
        configureTabsForType(true);

        const issuerConfig = document.getElementById('issuer-config');
        const tokenVerification = document.getElementById('token-verification');
        expect(issuerConfig.classList.contains('hidden')).toBe(true);
        expect(tokenVerification.classList.contains('hidden')).toBe(true);
    });

    it('should activate endpoint-config as first tab for gateway', async () => {
        const { configureTabsForType } = await import('../../main/webapp/js/app.js');
        configureTabsForType(true);

        const endpointConfig = document.getElementById('endpoint-config');
        const firstGwTab = document.querySelector('.tab-item.gateway-tab');
        expect(endpointConfig.classList.contains('active')).toBe(true);
        expect(firstGwTab.classList.contains('active')).toBe(true);
    });

    it('should keep metrics and help tabs visible for both types', async () => {
        const { configureTabsForType } = await import('../../main/webapp/js/app.js');

        // Test JWT view
        configureTabsForType(false);
        expect(document.getElementById('metrics').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('help').classList.contains('hidden')).toBe(false);

        // Reset DOM and test gateway view
        document.body.innerHTML = FULL_DOM;
        configureTabsForType(true);
        expect(document.getElementById('metrics').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('help').classList.contains('hidden')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Component detection integration
// ---------------------------------------------------------------------------

describe('initComponents with component type detection', () => {
    beforeEach(() => {
        document.body.innerHTML = FULL_DOM;
        jest.resetModules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should detect gateway and configure tabs accordingly', async () => {
        const api = await import('../../main/webapp/js/api.js');
        api.getComponentId.mockReturnValue('gw-proc-123');
        api.detectComponentType.mockResolvedValue({
            type: 'PROCESSOR',
            componentClass: 'de.cuioss.nifi.rest.RestApiGatewayProcessor'
        });

        const { initComponents } = await import('../../main/webapp/js/app.js');
        await initComponents();

        // Gateway tabs should be visible
        const gatewayTabs = document.querySelectorAll('.gateway-tab');
        for (const el of gatewayTabs) {
            expect(el.classList.contains('hidden')).toBe(false);
        }

        // JWT tabs should be hidden
        const jwtTabs = document.querySelectorAll('.jwt-tab');
        for (const el of jwtTabs) {
            expect(el.classList.contains('hidden')).toBe(true);
        }

        // Issuer config should NOT have been initialized
        const issuerConfig = await import('../../main/webapp/js/issuer-config.js');
        expect(issuerConfig.init).not.toHaveBeenCalled();
    });

    it('should default to JWT view when no component ID', async () => {
        const api = await import('../../main/webapp/js/api.js');
        api.getComponentId.mockReturnValue('');

        const issuerConfig = await import('../../main/webapp/js/issuer-config.js');
        const tokenVerifier = await import('../../main/webapp/js/token-verifier.js');

        const { initComponents } = await import('../../main/webapp/js/app.js');
        await initComponents();

        expect(issuerConfig.init).toHaveBeenCalled();
        expect(tokenVerifier.init).toHaveBeenCalled();
    });

    it('should default to JWT view when detection fails', async () => {
        const api = await import('../../main/webapp/js/api.js');
        api.getComponentId.mockReturnValue('invalid-id');
        api.detectComponentType.mockRejectedValue(new Error('Not found'));

        const issuerConfig = await import('../../main/webapp/js/issuer-config.js');

        const { initComponents } = await import('../../main/webapp/js/app.js');
        await initComponents();

        expect(issuerConfig.init).toHaveBeenCalled();
    });
});
