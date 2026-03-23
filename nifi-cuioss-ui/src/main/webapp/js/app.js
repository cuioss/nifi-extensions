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
import { init as initEndpointTester, cleanup as cleanupEndpointTester } from './endpoint-tester.js';
import { getComponentId, detectComponentType, resolveJwtConfigServiceId } from './api.js';
import { log, t, lang } from './utils.js';

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

/** Toggle visibility + active state on a set of elements. */
const setTabGroupVisibility = (elements, visible) => {
    for (const el of elements) {
        el.classList.toggle('hidden', !visible);
        if (!visible) el.classList.remove('active');
    }
};

/**
 * Shows/hides tabs based on detected component type.
 * @param {boolean} isGateway  true if component is RestApiGatewayProcessor
 */
const configureTabsForType = (isGateway) => {
    setTabGroupVisibility(document.querySelectorAll('.jwt-tab'), !isGateway);
    setTabGroupVisibility(document.querySelectorAll('.gateway-tab'), isGateway);

    if (isGateway) {
        const firstGwTab = document.querySelector('.tab-item.gateway-tab');
        const firstGwPane = document.getElementById('endpoint-config');
        if (firstGwTab) firstGwTab.classList.add('active');
        if (firstGwPane) firstGwPane.classList.add('active');
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

/** Detect whether the component is a gateway processor. */
const detectIsGateway = async (componentId) => {
    if (!componentId) return false;
    try {
        const { componentClass } = await detectComponentType(componentId);
        const isGw = componentClass?.includes('RestApiGateway') || false;
        log.info(`Detected component type: ${isGw ? 'Gateway' : 'JWT'}`);
        return isGw;
    } catch (err) {
        log.warn('Component type detection failed, defaulting to JWT view:',
            err.message);
        return false;
    }
};

/** Initialise gateway-specific tabs. */
const initGatewayTabs = async (componentId) => {
    const endpointConfigEl = document.getElementById('endpoint-config');
    if (endpointConfigEl) initEndpointConfig(endpointConfigEl);

    const endpointTesterEl = document.getElementById('endpoint-tester');
    if (endpointTesterEl) initEndpointTester(endpointTesterEl);

    await initGatewayIssuerTabs(componentId);
};

/** Initialise JWT/CS-specific tabs. */
const initJwtTabs = () => {
    const issuerEl = document.getElementById('issuer-config');
    if (issuerEl) initIssuerConfig(issuerEl);

    const tokenEl = document.getElementById('token-verification');
    if (tokenEl) initTokenVerifier(tokenEl);
};

const initComponents = async () => {
    const componentId = getComponentId();
    const isGateway = await detectIsGateway(componentId);

    configureTabsForType(isGateway);

    if (isGateway) {
        await initGatewayTabs(componentId);
    } else {
        initJwtTabs();
    }

    const metricsEl = document.getElementById('metrics');
    if (metricsEl) initMetrics(metricsEl, isGateway);
};

// ---------------------------------------------------------------------------
// Gateway issuer tabs initialization
// ---------------------------------------------------------------------------

const initGatewayIssuerTabs = async (processorId) => {
    const issuerConfigEl = document.getElementById('gateway-issuer-config');
    const tokenVerifEl = document.getElementById('gateway-token-verification');

    let csId = null;
    try {
        csId = await resolveJwtConfigServiceId(processorId);
    } catch (err) {
        log.warn('Failed to resolve JWT Config Service ID:', err.message);
    }

    if (csId) {
        log.info(`Resolved JWT Config Service: ${csId}`);
        if (issuerConfigEl) {
            initIssuerConfig(issuerConfigEl, {
                targetComponentId: csId,
                useControllerService: true,
                isGatewayContext: true
            });
        }
        if (tokenVerifEl) initTokenVerifier(tokenVerifEl);
    } else {
        log.info('No JWT Config Service configured for gateway');
        if (issuerConfigEl) {
            issuerConfigEl.innerHTML = `
                <div class="config-info-message">
                    <p><i class="fa fa-info-circle"></i>
                    ${t('app.gateway.no.issuer.service')}</p>
                </div>`;
        }
        if (tokenVerifEl) {
            tokenVerifEl.innerHTML = `
                <div class="config-info-message">
                    <p><i class="fa fa-info-circle"></i>
                    ${t('app.gateway.no.token.service')}</p>
                </div>`;
        }
    }
};

// ---------------------------------------------------------------------------
// DOM i18n
// ---------------------------------------------------------------------------

/**
 * Translate all elements with a `data-i18n` attribute.
 * Sets `textContent` to the translated value of the attribute's key.
 */
const applyI18nToDom = () => {
    document.documentElement.lang = lang;
    for (const el of document.querySelectorAll('[data-i18n]')) {
        const key = el.dataset.i18n;
        if (key) el.textContent = t(key);
    }
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
    applyI18nToDom();
    initComponents();
    log.info('Component UI ready');
});

// Expose cleanup for potential NiFi lifecycle
globalThis.jwtUICleanup = () => { cleanupMetrics(); cleanupEndpointTester(); };

// Expose for testing
export { configureTabsForType, initComponents };
