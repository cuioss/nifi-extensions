'use strict';

/**
 * Metrics Tab Component for JWT Authenticator UI
 *
 * Displays real-time metrics and statistics for JWT token validation,
 * including success/failure rates, issuer-specific metrics, and performance data.
 *
 * @module components/metricsTab
 */

import $ from 'cash-dom';
import { createLogger } from '../utils/logger.js';
import { formatNumber, formatDate } from '../utils/formatters.js';
import { UI_TEXT } from '../utils/constants.js';
import * as nfCommon from 'nf.Common';

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
    if (!$('#jwt-metrics-content').length) {
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
    const metricsTabPane = $('#metrics');
    logger.info('Metrics tab pane found:', metricsTabPane.length > 0);
    if (metricsTabPane.length) {
        logger.info('Appending metrics content to tab pane');
        metricsTabPane.html(metricsHtml);
        logger.info('Metrics content appended, new length:', metricsTabPane.html().length);
    } else {
        // Fallback: append to container if tab pane doesn't exist
        logger.warn('Metrics tab pane not found, appending to container');
        $('#jwt-validator-container').append(metricsHtml);
    }

    // Bind event handlers
    $('#refresh-metrics-btn').on('click', refreshMetrics);
};

let metricsInterval = null;

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
    // Mock implementation - in production, this would call the actual API
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                totalValidations: 1247,
                successCount: 1198,
                failureCount: 49,
                avgResponseTime: 23,
                activeIssuers: 3,
                issuerMetrics: [
                    {
                        name: 'Keycloak Production',
                        validations: 823,
                        successRate: 98.5,
                        lastValidation: new Date()
                    },
                    {
                        name: 'Auth0 Development',
                        validations: 324,
                        successRate: 94.2,
                        lastValidation: new Date()
                    },
                    {
                        name: 'Internal JWT Service',
                        validations: 100,
                        successRate: 87.0,
                        lastValidation: new Date()
                    }
                ],
                recentErrors: [
                    {
                        timestamp: new Date(),
                        issuer: 'Internal JWT Service',
                        error: 'Token expired',
                        count: 5
                    }
                ]
            });
        }, 100);
    });
};

/**
 * Updates the metrics display with new data
 * @param {Object} data - Metrics data
 */
const updateMetricsDisplay = (data) => {
    // Update summary metrics
    $('#total-validations').text(formatNumber(data.totalValidations));
    $('#success-rate').text(formatPercentage(data.successCount / data.totalValidations));
    $('#avg-response-time').text(`${data.avgResponseTime}ms`);
    $('#active-issuers').text(data.activeIssuers);

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

    $('#issuer-metrics-list').html(issuerListHtml ||
        '<div class="no-data">No issuer data available</div>');

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

        $('#error-metrics-list').html(errorListHtml);
    } else {
        $('#error-metrics-list').html('<div class="no-errors">No recent errors</div>');
    }
};

/**
 * Shows an error message when metrics cannot be loaded
 */
const showMetricsError = () => {
    $('#jwt-metrics-content').html(`
        <div class="metrics-error">
            <i class="fa fa-exclamation-triangle"></i>
            <p>Unable to load metrics. Please try again later.</p>
            <button onclick="location.reload()">Reload Page</button>
        </div>
    `);
};

/**
 * Cleans up the metrics tab component
 */
export const cleanup = () => {
    logger.debug('Cleaning up metrics tab');
    $('#refresh-metrics-btn').off('click');
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
