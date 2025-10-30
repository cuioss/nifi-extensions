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
import { getSecurityMetrics } from '../services/apiClient.js';
import { translate } from '../utils/i18n.js';

const logger = createLogger('MetricsTab');

// Store last metrics data for export
let lastMetricsData = null;

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
                <h2>${translate(UI_TEXT.I18N_KEYS.METRICS_TITLE)}</h2>
                <div class="metrics-actions">
                    <button id="refresh-metrics-btn" class="btn btn-small" 
                    data-testid="refresh-metrics-button">
                        <i class="fa fa-refresh"></i> Refresh
                    </button>
                    <button id="export-metrics-btn" class="btn btn-small" 
                    data-testid="export-metrics-button">
                        <i class="fa fa-download"></i> Export
                    </button>
                </div>
            </div>
            
            <div class="metrics-summary" data-testid="validation-metrics">
                <h4>Validation Metrics</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Total Validations</h5>
                        <div class="metric-value" id="total-validations"
                             data-testid="total-validations">0</div>
                    </div>
                    <div class="metric-card">
                        <h5>Success Rate</h5>
                        <div class="metric-value" id="success-rate"
                             data-testid="success-rate">0%</div>
                    </div>
                    <div class="metric-card">
                        <h5>Failure Rate</h5>
                        <div class="metric-value" id="failure-rate"
                             data-testid="failure-rate">0%</div>
                    </div>
                    <div class="metric-card">
                        <h5>Active Issuers</h5>
                        <div class="metric-value" id="active-issuers">0</div>
                    </div>
                </div>
            </div>
            
            <div class="performance-metrics" data-testid="performance-metrics">
                <h4>Performance Metrics</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Average Response Time</h5>
                        <div class="metric-value" id="avg-response-time"
                             data-testid="avg-response-time">0 ms</div>
                    </div>
                    <div class="metric-card">
                        <h5>Min Response Time</h5>
                        <div class="metric-value" id="min-response-time"
                             data-testid="min-response-time">0 ms</div>
                    </div>
                    <div class="metric-card">
                        <h5>Max Response Time</h5>
                        <div class="metric-value" id="max-response-time"
                             data-testid="max-response-time">0 ms</div>
                    </div>
                    <div class="metric-card">
                        <h5>P95 Response Time</h5>
                        <div class="metric-value" id="p95-response-time"
                             data-testid="p95-response-time">0 ms</div>
                    </div>
                </div>
            </div>
            
            <div class="issuer-metrics" data-testid="issuer-metrics">
                <h4>Issuer-Specific Metrics</h4>
                <div class="issuer-metrics-container">
                    <table class="issuer-metrics-table" data-testid="issuer-metrics-table">
                        <thead>
                            <tr>
                                <th>Issuer</th>
                                <th>Total Requests</th>
                                <th>Success</th>
                                <th>Failed</th>
                                <th>Success Rate</th>
                                <th>Avg Response Time</th>
                            </tr>
                        </thead>
                        <tbody id="issuer-metrics-list">
                            <tr>
                                <td colspan="6" class="metrics-loading">Loading metrics...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="error-metrics" data-testid="error-metrics">
                <h4>Recent Errors</h4>
                <div id="error-metrics-list" class="metrics-list"
                     data-testid="error-metrics-list">
                    <div class="no-errors">No recent errors</div>
                </div>
            </div>
            
            <div class="metrics-footer">
                <span class="last-updated" data-testid="last-updated">
                    Last updated: Never
                </span>
                <span class="refresh-indicator" data-testid="refresh-indicator"
                      style="display:none;">
                    <i class="fa fa-spinner fa-spin"></i> Refreshing...
                </span>
            </div>
            
            <div id="export-options" class="export-options" data-testid="export-options"
                 style="display:none;">
                <h5>Export Format:</h5>
                <button class="btn btn-small" data-testid="export-csv">CSV</button>
                <button class="btn btn-small" data-testid="export-json">JSON</button>
                <button class="btn btn-small" data-testid="export-prometheus">Prometheus</button>
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
        refreshBtn.addEventListener('click', handleRefreshClick);
    }

    const exportBtn = document.getElementById('export-metrics-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportClick);
    }

    // Bind export format buttons
    const exportOptions = document.getElementById('export-options');
    if (exportOptions) {
        exportOptions.addEventListener('click', (e) => {
            if (e.target.matches('[data-testid^="export-"]')) {
                const format = e.target.getAttribute('data-testid').replace('export-', '');
                handleExport(format);
                exportOptions.style.display = 'none';
            }
        });
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
 * Handles refresh button click
 */
const handleRefreshClick = async () => {
    const refreshIndicator = document.querySelector('[data-testid="refresh-indicator"]');
    if (refreshIndicator) {
        refreshIndicator.style.display = 'inline-block';
    }

    await refreshMetrics();

    if (refreshIndicator) {
        setTimeout(() => {
            refreshIndicator.style.display = 'none';
        }, 500);
    }
};

/**
 * Handles export button click
 */
const handleExportClick = () => {
    const exportOptions = document.getElementById('export-options');
    if (exportOptions) {
        exportOptions.style.display = exportOptions.style.display === 'none' ? 'block' : 'none';
    }
};

/**
 * Handles export in specific format
 */
const handleExport = (format) => {
    logger.info(`Exporting metrics in ${format} format`);

    // Get current metrics data
    const metricsData = {
        timestamp: new Date().toISOString(),
        totalValidations: document.getElementById('total-validations')?.textContent || '0',
        successRate: document.getElementById('success-rate')?.textContent || '0%',
        failureRate: document.getElementById('failure-rate')?.textContent || '0%',
        activeIssuers: document.getElementById('active-issuers')?.textContent || '0',
        avgResponseTime: document.getElementById('avg-response-time')?.textContent || '0 ms',
        minResponseTime: document.getElementById('min-response-time')?.textContent || '0 ms',
        maxResponseTime: document.getElementById('max-response-time')?.textContent || '0 ms',
        p95ResponseTime: document.getElementById('p95-response-time')?.textContent || '0 ms',
        lastMetricsData: lastMetricsData
    };

    let content = '';
    let mimeType = '';
    let filename = '';

    switch (format) {
        case 'json':
            content = JSON.stringify(metricsData, null, 2);
            mimeType = 'application/json';
            filename = `jwt-metrics-${Date.now()}.json`;
            break;

        case 'csv':
            content = 'Metric,Value\n';
            content += `Timestamp,${metricsData.timestamp}\n`;
            content += `Total Validations,${metricsData.totalValidations}\n`;
            content += `Success Rate,${metricsData.successRate}\n`;
            content += `Failure Rate,${metricsData.failureRate}\n`;
            content += `Active Issuers,${metricsData.activeIssuers}\n`;
            content += `Average Response Time,${metricsData.avgResponseTime}\n`;
            content += `Min Response Time,${metricsData.minResponseTime}\n`;
            content += `Max Response Time,${metricsData.maxResponseTime}\n`;
            content += `P95 Response Time,${metricsData.p95ResponseTime}\n`;
            mimeType = 'text/csv';
            filename = `jwt-metrics-${Date.now()}.csv`;
            break;

        case 'prometheus':
            content = '# HELP jwt_total_validations Total number of JWT validations\n';
            content += '# TYPE jwt_total_validations counter\n';
            content += `jwt_total_validations ${metricsData.totalValidations.replace(/,/g, '')}\n\n`;
            content += '# HELP jwt_success_rate JWT validation success rate\n';
            content += '# TYPE jwt_success_rate gauge\n';
            content += `jwt_success_rate ${Number.parseFloat(metricsData.successRate) / 100}\n\n`;
            content += '# HELP jwt_active_issuers Number of active JWT issuers\n';
            content += '# TYPE jwt_active_issuers gauge\n';
            content += `jwt_active_issuers ${metricsData.activeIssuers}\n`;
            mimeType = 'text/plain';
            filename = `jwt-metrics-${Date.now()}.txt`;
            break;

        default:
            logger.error(`Unknown export format: ${format}`);
            return;
    }

    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    globalThis.URL.revokeObjectURL(url);

    logger.info(`Exported metrics as ${filename}`);
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
        updateLastUpdated();
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
            minResponseTime: metricsResponse.minResponseTime || 0,
            maxResponseTime: metricsResponse.maxResponseTime || 0,
            p95ResponseTime: metricsResponse.p95ResponseTime || 0,
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
            minResponseTime: 0,
            maxResponseTime: 0,
            p95ResponseTime: 0,
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
    // Store the data for export
    lastMetricsData = data;

    // Update summary metrics
    const totalValidationsEl = document.getElementById('total-validations');
    if (totalValidationsEl) totalValidationsEl.textContent = formatNumber(data.totalValidations);

    // Calculate success and failure rates safely
    const successRate = data.totalValidations > 0
        ? data.successCount / data.totalValidations
        : 0;
    const failureRate = data.totalValidations > 0
        ? data.failureCount / data.totalValidations
        : 0;

    const successRateEl = document.getElementById('success-rate');
    if (successRateEl) successRateEl.textContent = formatPercentage(successRate);

    const failureRateEl = document.getElementById('failure-rate');
    if (failureRateEl) failureRateEl.textContent = formatPercentage(failureRate);

    // Update performance metrics
    const avgResponseTimeEl = document.getElementById('avg-response-time');
    if (avgResponseTimeEl) avgResponseTimeEl.textContent = `${data.avgResponseTime || 0} ms`;

    const minResponseTimeEl = document.getElementById('min-response-time');
    if (minResponseTimeEl) minResponseTimeEl.textContent = `${data.minResponseTime || 0} ms`;

    const maxResponseTimeEl = document.getElementById('max-response-time');
    if (maxResponseTimeEl) maxResponseTimeEl.textContent = `${data.maxResponseTime || 0} ms`;

    const p95ResponseTimeEl = document.getElementById('p95-response-time');
    if (p95ResponseTimeEl) p95ResponseTimeEl.textContent = `${data.p95ResponseTime || 0} ms`;

    const activeIssuersEl = document.getElementById('active-issuers');
    if (activeIssuersEl) activeIssuersEl.textContent = data.activeIssuers;

    // Update issuer-specific metrics table
    if (data.issuerMetrics && data.issuerMetrics.length > 0) {
        const issuerListHtml = data.issuerMetrics.map(issuer => `
            <tr data-testid="issuer-metrics-row">
                <td data-testid="issuer-name">${issuer.name}</td>
                <td>${formatNumber(issuer.totalRequests || issuer.validations || 0)}</td>
                <td>${formatNumber(issuer.successCount || 0)}</td>
                <td>${formatNumber(issuer.failureCount || 0)}</td>
                <td>${formatPercentage((issuer.successRate || 0) / 100)}</td>
                <td>${issuer.avgResponseTime || 0} ms</td>
            </tr>
        `).join('');

        const issuerListEl = document.getElementById('issuer-metrics-list');
        if (issuerListEl) {
            issuerListEl.innerHTML = issuerListHtml;
        }
    } else {
        const issuerListEl = document.getElementById('issuer-metrics-list');
        if (issuerListEl) {
            issuerListEl.innerHTML = '<tr><td colspan="6" class="no-data">No issuer data available</td></tr>';
        }
    }

    // Update error metrics
    if (data.recentErrors && data.recentErrors.length > 0) {
        const errorListHtml = data.recentErrors.map(error => `
            <div class="error-metric-item">
                <div class="error-details">
                    <span class="error-issuer">${error.issuer || 'Unknown'}</span>
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
 * Updates the last updated timestamp
 */
const updateLastUpdated = () => {
    const lastUpdatedEl = document.querySelector('[data-testid="last-updated"]');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Last updated: ${formatTime(new Date())}`;
    }
};

/**
 * Shows an error message when metrics cannot be loaded
 */
const showMetricsError = () => {
    const metricsContent = document.getElementById('jwt-metrics-content');
    if (metricsContent) {
        metricsContent.innerHTML = `
            <div class="error-message server-error">
                <div class="error-content">
                    <strong>Error:</strong> Unable to load metrics. Please try again later.
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-primary" onclick="location.reload()">Reload Page</button>
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
            <div class="metrics-not-available validation-error">
                <div class="error-content">
                    <h3>Metrics Not Available</h3>
                    <p>The metrics endpoint is not currently implemented.</p>
                    <p>Metrics functionality will be available in a future release.</p>
                </div>
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
    return translate(UI_TEXT.I18N_KEYS.METRICS_TAB_NAME);
};

// Export refreshMetrics for global access
globalThis.metricsTab = { refreshMetrics };
