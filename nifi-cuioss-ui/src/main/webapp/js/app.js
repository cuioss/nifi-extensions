'use strict';

/**
 * Application entry point — tab switching, component initialisation, loading state.
 *
 * Loaded as <script type="module"> from index.html.
 *
 * @module js/app
 */

import { init as initIssuerConfig } from './issuer-config.js';
import { init as initTokenVerifier } from './token-verifier.js';
import { init as initMetrics, cleanup as cleanupMetrics } from './metrics.js';
import { log } from './utils.js';

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

const initTabs = () => {
    const tabLinks = document.querySelectorAll('.tabs a[data-toggle="tab"]');
    const tabPanes = document.querySelectorAll('.tab-pane');

    for (const link of tabLinks) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href');

            // Deactivate all
            for (const li of document.querySelectorAll('.tabs li')) {
                li.classList.remove('active');
            }
            for (const pane of tabPanes) pane.classList.remove('active');

            // Activate clicked
            link.parentElement.classList.add('active');
            const targetPane = document.querySelector(target);
            if (targetPane) targetPane.classList.add('active');
        });
    }
};

// ---------------------------------------------------------------------------
// Component initialisation
// ---------------------------------------------------------------------------

const initComponents = () => {
    const issuerEl = document.getElementById('issuer-config');
    if (issuerEl) initIssuerConfig(issuerEl);

    const tokenEl = document.getElementById('token-verification');
    if (tokenEl) initTokenVerifier(tokenEl);

    const metricsEl = document.getElementById('metrics');
    if (metricsEl) initMetrics(metricsEl);

    // Help tab is static HTML in index.html — nothing to initialise.
};

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

const hideLoading = () => {
    const loading = document.getElementById('loading-indicator');
    if (loading) {
        loading.style.display = 'none';
        loading.setAttribute('aria-hidden', 'true');
    }
    const tabs = document.getElementById('jwt-validator-tabs');
    if (tabs) tabs.style.display = '';
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    log.info('JWT UI initialising…');
    hideLoading();
    initTabs();
    initComponents();
    log.info('JWT UI ready');
});

// Expose cleanup for potential NiFi lifecycle
globalThis.jwtUICleanup = () => { cleanupMetrics(); };
