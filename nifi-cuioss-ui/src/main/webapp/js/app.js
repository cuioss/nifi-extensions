'use strict';

/**
 * Application entry point — tab switching, component initialisation, loading state.
 * Detects component type and shows the appropriate tab set.
 *
 * Loaded as <script type="module"> from index.html.
 *
 * @module js/app
 */

import { init as initIssuerConfig } from './issuer-config.js';
import { init as initTokenVerifier } from './token-verifier.js';
import { init as initMetrics, cleanup as cleanupMetrics } from './metrics.js';
import { init as initEndpointConfig } from './rest-endpoint-config.js';
import { init as initEndpointTester } from './endpoint-tester.js';
import { getComponentId, detectComponentType } from './api.js';
import { log } from './utils.js';

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

const initCollapsibles = () => {
    for (const header of document.querySelectorAll('.collapsible-header')) {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            const icon = this.querySelector('i.fa');
            this.classList.toggle('active');
            if (content?.classList.contains('collapsible-content')) {
                content.classList.toggle('show');
            }
            if (icon) {
                icon.classList.toggle('fa-chevron-right', !this.classList.contains('active'));
                icon.classList.toggle('fa-chevron-down', this.classList.contains('active'));
            }
        });
    }
};

const initTabs = () => {
    const tabLinks = document.querySelectorAll('.tabs a[data-toggle="tab"]');
    const tabPanes = document.querySelectorAll('.tab-pane');

    for (const link of tabLinks) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href');

            // Deactivate all visible tabs and panes
            for (const item of document.querySelectorAll('.tabs .tab-item')) {
                item.classList.remove('active');
            }
            for (const pane of tabPanes) pane.classList.remove('active');

            // Activate clicked
            link.classList.add('active');
            const targetPane = document.querySelector(target);
            if (targetPane) targetPane.classList.add('active');
        });
    }
};

// ---------------------------------------------------------------------------
// Tab visibility by component type
// ---------------------------------------------------------------------------

/**
 * Shows/hides tabs based on detected component type.
 * JWT tabs for CS/Processor, gateway tabs for RestApiGateway.
 *
 * @param {boolean} isGateway  true if component is RestApiGatewayProcessor
 */
const configureTabsForType = (isGateway) => {
    const jwtElements = document.querySelectorAll('.jwt-tab');
    const gatewayElements = document.querySelectorAll('.gateway-tab');

    if (isGateway) {
        // Hide JWT tabs, show gateway tabs
        for (const el of jwtElements) {
            el.classList.add('hidden');
            el.classList.remove('active');
        }
        for (const el of gatewayElements) {
            el.classList.remove('hidden');
        }
        // Activate first gateway tab
        const firstGwTab = document.querySelector('.tab-item.gateway-tab');
        const firstGwPane = document.getElementById('endpoint-config');
        if (firstGwTab) firstGwTab.classList.add('active');
        if (firstGwPane) firstGwPane.classList.add('active');
    } else {
        // Show JWT tabs (default), hide gateway tabs
        for (const el of jwtElements) {
            el.classList.remove('hidden');
        }
        for (const el of gatewayElements) {
            el.classList.add('hidden');
            el.classList.remove('active');
        }
    }

    // Toggle help sections by component type
    for (const el of document.querySelectorAll('.jwt-help')) {
        el.style.display = isGateway ? 'none' : '';
    }
    for (const el of document.querySelectorAll('.gateway-help')) {
        el.style.display = isGateway ? '' : 'none';
    }
};

// ---------------------------------------------------------------------------
// Component initialisation
// ---------------------------------------------------------------------------

const initComponents = async () => {
    const componentId = getComponentId();
    let isGateway = false;

    if (componentId) {
        try {
            const { componentClass } = await detectComponentType(componentId);
            isGateway = componentClass?.includes('RestApiGateway') || false;
            log.info(`Detected component type: ${isGateway ? 'Gateway' : 'JWT'}`);
        } catch (err) {
            log.warn('Component type detection failed, defaulting to JWT view:', err.message);
        }
    }

    configureTabsForType(isGateway);

    if (isGateway) {
        const endpointConfigEl = document.getElementById('endpoint-config');
        if (endpointConfigEl) initEndpointConfig(endpointConfigEl);

        const endpointTesterEl = document.getElementById('endpoint-tester');
        if (endpointTesterEl) initEndpointTester(endpointTesterEl);
    } else {
        const issuerEl = document.getElementById('issuer-config');
        if (issuerEl) initIssuerConfig(issuerEl);

        const tokenEl = document.getElementById('token-verification');
        if (tokenEl) initTokenVerifier(tokenEl);
    }

    const metricsEl = document.getElementById('metrics');
    if (metricsEl) initMetrics(metricsEl, isGateway);

    // Help tab is static HTML in index.html — nothing to initialise.
};

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

const hideLoading = () => {
    const loading = document.getElementById('loading-indicator');
    if (loading) {
        loading.classList.add('hidden');
        loading.setAttribute('aria-hidden', 'true');
    }
    const tabs = document.getElementById('jwt-validator-tabs');
    if (tabs) tabs.classList.remove('hidden');
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    log.info('Component UI initialising...');
    hideLoading();
    initTabs();
    initCollapsibles();
    initComponents();
    log.info('Component UI ready');
});

// Expose cleanup for potential NiFi lifecycle
globalThis.jwtUICleanup = () => { cleanupMetrics(); };

// Expose for testing
export { configureTabsForType, initComponents };
