'use strict';

/**
 * Metrics Tab Component for JWT Authenticator UI
 *
 * Displays real-time metrics and statistics for JWT token validation,
 * including success/failure rates, issuer-specific metrics, and performance data.
 *
 * @module components/metricsTab
 */

import { createLogger } from '../utils/logger.js';
import { formatNumber, formatDate } from '../utils/formatters.js';
import { UI_TEXT } from '../utils/constants.js';
import * as nfCommon from 'nf.Common';
import { getSecurityMetrics } from '../services/apiClient.js';

const logger = createLogger('MetricsTab');

/**
 * Formats a decimal number as a percentage
 * @param {number} value - Decimal value (e.g., 0.95 for 95%)
 * @returns {string} Formatted percentage string
 */
const formatPercentage = (value) => {
    return (value * 100).toFixed(1) + '%';
};

/**
 * Formats a date object as a time string
 * @param {Date} date - Date object to format
 * @returns {string} Formatted time string
 */
const formatTime = (date) => {
    return formatDate(date);
};

/**
 * Initializes the metrics tab component
 * @returns {void}
 */
export const init = () => {
    logger.info('Initializing metrics tab');

    // Create the metrics tab content if it doesn't exist
    if (!document.getElementById('jwt-metrics-content')) {
        logger.info('Creating metrics tab content...');
        createMetricsContent();
        // Start periodic metrics refresh only after creating content
        startMetricsRefresh();
    } else {
        logger.debug('Metrics tab content already exists, skipping creation');
    }
};

/**
 * Creates the metrics tab content structure
 */
const createMetricsContent = () => {
    const metricsHtml = `
        <div id="jwt-metrics-content" class="jwt-tab-content" data-testid="metrics-tab-content">
            <div class="metrics-header">
                <h3>${nfCommon.getI18n().getProperty(UI_TEXT.I18N_KEYS.METRICS_TITLE) ||
                'JWT Validation Metrics'}</h3>
                <button id="refresh-metrics-btn" class="btn btn-small" 
                data-testid="refresh-metrics-button">
                    <i class="fa fa-refresh"></i> Refresh
                </button>
            </div>
            
            <div class="metrics-summary" data-testid="metrics-summary">
                <div class="metric-card">
                    <h4>Total Validations</h4>
                    <div class="metric-value" id="total-validations">0</div>
                </div>
                <div class="metric-card">
                    <h4>Success Rate</h4>
                    <div class="metric-value" id="success-rate">0%</div>
                </div>
                <div class="metric-card">
                    <h4>Average Response Time</h4>
                    <div class="metric-value" id="avg-response-time">0ms</div>
                </div>
                <div class="metric-card">
                    <h4>Active Issuers</h4>
                    <div class="metric-value" id="active-issuers">0</div>
                </div>
            </div>
            
            <div class="issuer-metrics" data-testid="issuer-metrics">
                <h4>Issuer-Specific Metrics</h4>
                <div id="issuer-metrics-list" class="metrics-list">
                    <div class="metrics-loading">Loading metrics...</div>
                </div>
            </div>
            
            <div class="error-metrics" data-testid="error-metrics">
                <h4>Recent Errors</h4>
                <div id="error-metrics-list" class="metrics-list">
                    <div class="no-errors">No recent errors</div>
                </div>
            </div>
        </div>
    `;

    // Append to the metrics tab pane
    const metricsTabPane = document.getElementById('metrics');
    logger.info('Metrics tab pane found:', !!metricsTabPane);
    if (metricsTabPane) {
        logger.info('Appending metrics content to tab pane');
        metricsTabPane.innerHTML = metricsHtml;
        logger.info('Metrics content appended, new length:', metricsTabPane.innerHTML.length);
    } else {
        // Fallback: append to container if tab pane doesn't exist
        logger.warn('Metrics tab pane not found, appending to container');
        const container = document.getElementById('jwt-validator-container');
        if (container) {
            container.insertAdjacentHTML('beforeend', metricsHtml);
        }
    }

    // Bind event handlers
    const refreshBtn = document.getElementById('refresh-metrics-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshMetrics);
    }
};

let metricsInterval = null;
let metricsEndpointAvailable = true; // Track if the endpoint is available

/**
 * Starts periodic metrics refresh
 */
const startMetricsRefresh = () => {
    // Initial load
    refreshMetrics();

    // Refresh every 10 seconds - skip in test environment
    if (typeof jest === 'undefined') {
        metricsInterval = setInterval(refreshMetrics, 10000);
    }
};

/**
 * Refreshes metrics data from the server
 */
const refreshMetrics = async () => {
    logger.debug('Refreshing metrics');

    // Don't try to refresh if we know the endpoint is not available
    if (!metricsEndpointAvailable) {
        logger.debug('Metrics endpoint not available, skipping refresh');
        return;
    }

    try {
        // In a real implementation, this would fetch from the processor's metrics endpoint
        const metricsData = await fetchMetricsData();
        updateMetricsDisplay(metricsData);
    } catch (error) {
        logger.error('Failed to refresh metrics:', error);
        showMetricsError();
    }
};

/**
 * Fetches metrics data from the server
 * @returns {Promise<Object>} Metrics data
 */
const fetchMetricsData = async () => {
    try {
        // Call the actual API endpoint for security metrics
        const metricsResponse = await getSecurityMetrics();

        // Transform the response to match expected format
        const totalValidations = metricsResponse.totalTokensValidated || 0;
        const successCount = metricsResponse.validTokens || 0;
        const failureCount = metricsResponse.invalidTokens || 0;

        return {
            totalValidations: totalValidations,
            successCount: successCount,
            failureCount: failureCount,
            avgResponseTime: metricsResponse.averageResponseTime || 0,
            activeIssuers: metricsResponse.activeIssuers || 0,
            issuerMetrics: metricsResponse.issuerMetrics || [],
            recentErrors: metricsResponse.topErrors || []
        };
    } catch (error) {
        logger.error('Failed to fetch metrics from API:', error);
        // If it's a 404 error, the endpoint is not implemented yet
        if (error.status === 404) {
            logger.info('Metrics endpoint not available (404), showing placeholder data');
            metricsEndpointAvailable = false; // Mark endpoint as unavailable
            // Show placeholder message in the UI
            showMetricsNotAvailable();
        }
        // Return default values on error
        return {
            totalValidations: 0,
            successCount: 0,
            failureCount: 0,
            avgResponseTime: 0,
            activeIssuers: 0,
            issuerMetrics: [],
            recentErrors: []
        };
    }
};

/**
 * Updates the metrics display with new data
 * @param {Object} data - Metrics data
 */
const updateMetricsDisplay = (data) => {
    // Update summary metrics
    const totalValidationsEl = document.getElementById('total-validations');
    if (totalValidationsEl) totalValidationsEl.textContent = formatNumber(data.totalValidations);

    // Calculate success rate safely
    const successRate = data.totalValidations > 0
        ? data.successCount / data.totalValidations
        : 0;
    const successRateEl = document.getElementById('success-rate');
    if (successRateEl) successRateEl.textContent = formatPercentage(successRate);

    const avgResponseTimeEl = document.getElementById('avg-response-time');
    if (avgResponseTimeEl) avgResponseTimeEl.textContent = `${data.avgResponseTime}ms`;

    const activeIssuersEl = document.getElementById('active-issuers');
    if (activeIssuersEl) activeIssuersEl.textContent = data.activeIssuers;

    // Update issuer-specific metrics
    const issuerListHtml = data.issuerMetrics.map(issuer => `
        <div class="issuer-metric-item">
            <div class="issuer-name">${issuer.name}</div>
            <div class="issuer-stats">
                <span class="stat">Validations: ${formatNumber(issuer.validations)}</span>
                <span class="stat">Success Rate: 
                ${formatPercentage(issuer.successRate / 100)}</span>
                <span class="stat">Last: ${formatTime(issuer.lastValidation)}</span>
            </div>
        </div>
    `).join('');

    const issuerListEl = document.getElementById('issuer-metrics-list');
    if (issuerListEl) {
        issuerListEl.innerHTML = issuerListHtml ||
            '<div class="no-data">No issuer data available</div>';
    }

    // Update error metrics
    if (data.recentErrors.length > 0) {
        const errorListHtml = data.recentErrors.map(error => `
            <div class="error-metric-item">
                <div class="error-details">
                    <span class="error-issuer">${error.issuer}</span>
                    <span class="error-message">${error.error}</span>
                    <span class="error-count">(${error.count} occurrences)</span>
                </div>
                <div class="error-time">${formatTime(error.timestamp)}</div>
            </div>
        `).join('');

        const errorListEl = document.getElementById('error-metrics-list');
        if (errorListEl) errorListEl.innerHTML = errorListHtml;
    } else {
        const errorListEl = document.getElementById('error-metrics-list');
        if (errorListEl) errorListEl.innerHTML = '<div class="no-errors">No recent errors</div>';
    }
};

/**
 * Shows an error message when metrics cannot be loaded
 */
const showMetricsError = () => {
    const metricsContent = document.getElementById('jwt-metrics-content');
    if (metricsContent) {
        metricsContent.innerHTML = `
            <div class="metrics-error">
                <i class="fa fa-exclamation-triangle"></i>
                <p>Unable to load metrics. Please try again later.</p>
                <button onclick="location.reload()">Reload Page</button>
            </div>
        `;
    }
};

/**
 * Shows a message when metrics endpoint is not available
 */
const showMetricsNotAvailable = () => {
    const metricsContent = document.getElementById('jwt-metrics-content');
    if (metricsContent) {
        metricsContent.innerHTML = `
            <div class="metrics-not-available">
                <i class="fa fa-info-circle"></i>
                <h3>Metrics Not Available</h3>
                <p>The metrics endpoint is not currently implemented.</p>
                <p>Metrics functionality will be available in a future release.</p>
            </div>
        `;
    }
    // Stop the refresh interval if metrics are not available
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
};

/**
 * Cleans up the metrics tab component
 */
export const cleanup = () => {
    logger.debug('Cleaning up metrics tab');
    // Event listeners are automatically cleaned up when elements are removed
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
};

/**
 * Gets the display name for this tab
 * @returns {string} Tab display name
 */
export const getDisplayName = () => {
    return nfCommon.getI18n().getProperty(UI_TEXT.I18N_KEYS.METRICS_TAB_NAME) || 'Metrics';
};

// Export refreshMetrics for global access
window.metricsTab = { refreshMetrics };
