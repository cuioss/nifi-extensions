#!/usr/bin/env node

/**
 * Unified Log Analysis Tool
 * Consolidates analyze-console-errors.js + enhanced-log-analyzer.js functionality
 * 
 * Modes:
 *   --basic       : Console errors only (original analyze-console-errors functionality)
 *   --enhanced    : Full analysis with performance metrics (default)
 *   --console-only: Alias for --basic
 *   --full        : Alias for --enhanced
 * 
 * Options:
 *   --json        : Output JSON format instead of HTML
 *   --verbose     : Detailed logging
 *   --no-html     : Skip HTML report generation
 * 
 * Usage:
 *   node scripts/log-analyzer.js                 # Enhanced analysis of latest run
 *   node scripts/log-analyzer.js run-123         # Enhanced analysis of specific run
 *   node scripts/log-analyzer.js --basic         # Basic console error analysis only
 *   node scripts/log-analyzer.js --verbose       # Enhanced with detailed logging
 */

const fs = require('fs');
const path = require('path');
const { getTimestamp } = require('./utils/common');
const { createLogger } = require('./utils/logger');

// Import allowlist for console warnings
const allowedWarnings = require('../cypress/support/console-warnings-allowlist');

/**
 * Unified Log Analyzer class combining console error analysis and enhanced metrics
 */
class UnifiedLogAnalyzer {
  constructor(options = {}) {
    this.options = {
      mode: 'enhanced',        // 'basic' or 'enhanced'
      generateHtml: true,
      verbose: false,
      outputJson: false,
      ...options
    };

    this.resultsDir = path.join(__dirname, '..', 'cypress', 'reports', 'log-analysis');
    this.consoleAnalysisDir = path.join(this.resultsDir, 'console-analysis');
    this.enhancedAnalysisDir = path.join(this.resultsDir, 'enhanced-analysis');
    this.trendsDir = path.join(this.enhancedAnalysisDir, 'trends');
    
    this.ensureDirectoryExists(this.resultsDir);
    this.ensureDirectoryExists(this.consoleAnalysisDir);
    
    if (this.options.mode === 'enhanced') {
      this.ensureDirectoryExists(this.enhancedAnalysisDir);
      this.ensureDirectoryExists(this.trendsDir);
    }

    // Initialize logger
    this.logger = createLogger({ context: 'LogAnalyzer' });
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Console Error Analysis (from original analyze-console-errors.js)
   */
  analyzeConsoleErrors(runId) {
    this.logger.step(`Analyzing console errors for run: ${runId}`);
    
    const logPath = path.join(__dirname, '..', 'cypress', 'logs', `run-${runId}.json`);
    
    // Check if log file exists
    if (!fs.existsSync(logPath)) {
      this.logger.warning(`Log file not found: ${logPath}`);
      this.logger.warning('Console error analysis requires Cypress to generate log files.');
      
      return {
        summary: {
          totalErrors: 0,
          totalUnexpectedWarnings: 0,
          totalAllowedWarnings: 0,
          runDate: new Date().toISOString(),
          runId,
          logFileFound: false
        },
        errors: [],
        unexpectedWarnings: [],
        allowedWarningsByPattern: {}
      };
    }

    const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));

    const errors = [];
    const unexpectedWarnings = [];
    const allowedWarningInstances = [];

    logs.forEach(log => {
      if (log.type === 'error') {
        errors.push({
          message: log.message,
          source: log.source,
          timestamp: log.timestamp,
          testFile: log.testFile,
          testName: log.testName
        });
      } else if (log.type === 'warning') {
        const isAllowed = allowedWarnings.some(pattern => 
          log.message.includes(pattern)
        );

        if (isAllowed) {
          allowedWarningInstances.push({
            message: log.message,
            pattern: allowedWarnings.find(pattern => log.message.includes(pattern)),
            source: log.source,
            testFile: log.testFile
          });
        } else {
          unexpectedWarnings.push({
            message: log.message,
            source: log.source,
            timestamp: log.timestamp,
            testFile: log.testFile,
            testName: log.testName
          });
        }
      }
    });

    // Generate report
    const report = {
      summary: {
        totalErrors: errors.length,
        totalUnexpectedWarnings: unexpectedWarnings.length,
        totalAllowedWarnings: allowedWarningInstances.length,
        runDate: new Date().toISOString(),
        runId,
        logFileFound: true
      },
      errors,
      unexpectedWarnings,
      allowedWarningsByPattern: this.groupByPattern(allowedWarningInstances)
    };

    this.logger.info(`Console analysis complete: ${errors.length} errors, ${unexpectedWarnings.length} unexpected warnings`);
    return report;
  }

  /**
   * Group allowed warnings by pattern for easier analysis
   */
  groupByPattern(allowedWarningInstances) {
    const grouped = {};
    
    allowedWarningInstances.forEach(warning => {
      if (!grouped[warning.pattern]) {
        grouped[warning.pattern] = [];
      }
      grouped[warning.pattern].push(warning);
    });
    
    return grouped;
  }

  /**
   * Performance Analysis (from enhanced-log-analyzer.js)
   */
  analyzePerformance(testResults) {
    this.logger.step('Analyzing test performance metrics');
    
    const performanceMetrics = {
      totalTests: 0,
      totalDuration: 0,
      avgTestDuration: 0,
      slowestTests: [],
      fastestTests: [],
      failureRate: 0,
      retryRate: 0
    };

    if (!testResults || !testResults.tests) {
      this.logger.warning('No test results available for performance analysis');
      return performanceMetrics;
    }

    const tests = testResults.tests;
    performanceMetrics.totalTests = tests.length;
    
    const durations = tests.map(test => test.duration || 0);
    performanceMetrics.totalDuration = durations.reduce((sum, d) => sum + d, 0);
    performanceMetrics.avgTestDuration = performanceMetrics.totalDuration / tests.length;
    
    // Sort by duration to find slowest/fastest
    const sortedTests = tests.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    performanceMetrics.slowestTests = sortedTests.slice(0, 5).map(test => ({
      title: test.title,
      duration: test.duration,
      file: test.file
    }));
    performanceMetrics.fastestTests = sortedTests.slice(-5).map(test => ({
      title: test.title,
      duration: test.duration,
      file: test.file
    }));

    // Calculate failure and retry rates
    const failures = tests.filter(test => test.state === 'failed').length;
    const retries = tests.filter(test => test.attempts && test.attempts.length > 1).length;
    
    performanceMetrics.failureRate = (failures / tests.length) * 100;
    performanceMetrics.retryRate = (retries / tests.length) * 100;

    this.logger.info(`Performance analysis complete: ${tests.length} tests, ${performanceMetrics.avgTestDuration.toFixed(0)}ms avg`);
    return performanceMetrics;
  }

  /**
   * Network Request Analysis (from enhanced-log-analyzer.js)
   */
  analyzeNetworkRequests(logs) {
    this.logger.step('Analyzing network request patterns');
    
    const networkAnalysis = {
      totalRequests: 0,
      failedRequests: 0,
      slowRequests: [],
      errorPatterns: {},
      requestsByType: {
        GET: 0,
        POST: 0,
        PUT: 0,
        DELETE: 0,
        OTHER: 0
      }
    };

    if (!logs || !Array.isArray(logs)) {
      return networkAnalysis;
    }

    logs.forEach(log => {
      if (log.message && log.message.includes('network')) {
        networkAnalysis.totalRequests++;
        
        // Analyze HTTP methods
        const methods = ['GET', 'POST', 'PUT', 'DELETE'];
        const method = methods.find(m => log.message.includes(m));
        if (method) {
          networkAnalysis.requestsByType[method]++;
        } else {
          networkAnalysis.requestsByType.OTHER++;
        }

        // Check for failures
        if (log.message.includes('failed') || log.message.includes('error') || log.message.includes('timeout')) {
          networkAnalysis.failedRequests++;
          
          // Pattern analysis for errors
          const errorType = this.extractErrorPattern(log.message);
          networkAnalysis.errorPatterns[errorType] = (networkAnalysis.errorPatterns[errorType] || 0) + 1;
        }

        // Check for slow requests (assuming timing info is available)
        const timeMatch = log.message.match(/(\d+)ms/);
        if (timeMatch && parseInt(timeMatch[1]) > 5000) {
          networkAnalysis.slowRequests.push({
            message: log.message,
            duration: parseInt(timeMatch[1]),
            timestamp: log.timestamp
          });
        }
      }
    });

    this.logger.info(`Network analysis complete: ${networkAnalysis.totalRequests} requests, ${networkAnalysis.failedRequests} failures`);
    return networkAnalysis;
  }

  extractErrorPattern(message) {
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('connection')) return 'connection';
    if (message.includes('404')) return 'not_found';
    if (message.includes('500')) return 'server_error';
    if (message.includes('403') || message.includes('401')) return 'auth_error';
    return 'other';
  }

  /**
   * Trend Analysis (from enhanced-log-analyzer.js)
   */
  analyzeTrends(currentResults) {
    if (this.options.mode === 'basic') {
      return null; // Skip trends for basic mode
    }

    this.logger.step('Analyzing historical trends');
    
    const trendsFile = path.join(this.trendsDir, 'historical-data.json');
    let historicalData = [];
    
    if (fs.existsSync(trendsFile)) {
      try {
        historicalData = JSON.parse(fs.readFileSync(trendsFile, 'utf8'));
      } catch (error) {
        this.logger.warning(`Error reading trends file: ${error.message}`);
      }
    }
    
    // Add current results to historical data
    const dataPoint = {
      timestamp: new Date().toISOString(),
      performance: currentResults.performance,
      console: currentResults.console ? currentResults.console.summary : null,
      network: currentResults.network
    };
    
    historicalData.push(dataPoint);
    
    // Keep only last 30 runs
    if (historicalData.length > 30) {
      historicalData = historicalData.slice(-30);
    }
    
    // Save updated historical data
    fs.writeFileSync(trendsFile, JSON.stringify(historicalData, null, 2));
    
    // Calculate trends
    const trends = this.calculateTrends(historicalData);
    
    this.logger.info(`Trend analysis complete: ${historicalData.length} data points`);
    return trends;
  }

  calculateTrends(historicalData) {
    if (historicalData.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const performanceValues = historicalData.map(d => d.performance?.avgTestDuration || 0);
    const failureRates = historicalData.map(d => d.performance?.failureRate || 0);
    const errorCounts = historicalData.map(d => d.console?.totalErrors || 0);

    return {
      performanceTrend: this.calculateTrend(performanceValues),
      failureRateTrend: this.calculateTrend(failureRates),
      errorCountTrend: this.calculateTrend(errorCounts),
      dataPoints: historicalData.length
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5); // Last 5 values
    const older = values.slice(-10, -5); // Previous 5 values
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, v) => sum + v, 0) / older.length : recentAvg;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate Console Error HTML Report (original functionality)
   */
  generateConsoleErrorHtmlReport(report, runId) {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Console Error Analysis - ${runId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007acc; padding-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background-color: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; margin-top: 5px; }
        .error { background-color: #fff5f5; border-left: 4px solid #e53e3e; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .warning { background-color: #fffbeb; border-left: 4px solid #d69e2e; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .allowed { background-color: #f0fff4; border-left: 4px solid #38a169; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .message { font-weight: bold; margin-bottom: 5px; word-break: break-word; }
        .meta { color: #666; font-size: 0.9em; }
        h1, h2 { color: #2d3748; }
        .no-issues { color: #38a169; font-size: 1.2em; text-align: center; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Console Error Analysis Report</h1>
            <p>Run ID: ${runId} | Generated: ${new Date().toISOString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${report.summary.totalErrors}</div>
                <div class="metric-label">Console Errors</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.totalUnexpectedWarnings}</div>
                <div class="metric-label">Unexpected Warnings</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.totalAllowedWarnings}</div>
                <div class="metric-label">Allowed Warnings</div>
            </div>
        </div>

        ${report.summary.totalErrors === 0 && report.summary.totalUnexpectedWarnings === 0 ? 
            '<div class="no-issues">✅ No console issues detected!</div>' : ''}

        ${report.errors.length > 0 ? `
        <h2>Console Errors (${report.errors.length})</h2>
        ${report.errors.map(error => `
            <div class="error">
                <div class="message">${this.escapeHtml(error.message)}</div>
                <div class="meta">
                    Source: ${error.source || 'Unknown'} | 
                    Test: ${error.testName || 'Unknown'} | 
                    Time: ${error.timestamp || 'Unknown'}
                </div>
            </div>
        `).join('')}
        ` : ''}

        ${report.unexpectedWarnings.length > 0 ? `
        <h2>Unexpected Warnings (${report.unexpectedWarnings.length})</h2>
        ${report.unexpectedWarnings.map(warning => `
            <div class="warning">
                <div class="message">${this.escapeHtml(warning.message)}</div>
                <div class="meta">
                    Source: ${warning.source || 'Unknown'} | 
                    Test: ${warning.testName || 'Unknown'} | 
                    Time: ${warning.timestamp || 'Unknown'}
                </div>
            </div>
        `).join('')}
        ` : ''}

        ${report.summary.totalAllowedWarnings > 0 ? `
        <h2>Allowed Warnings (${report.summary.totalAllowedWarnings})</h2>
        ${Object.entries(report.allowedWarningsByPattern).map(([pattern, warnings]) => `
            <div class="allowed">
                <div class="message">Pattern: ${this.escapeHtml(pattern)}</div>
                <div class="meta">Instances: ${warnings.length}</div>
            </div>
        `).join('')}
        ` : ''}

        ${!report.summary.logFileFound ? `
        <h2>Configuration Note</h2>
        <div class="warning">
            <div class="message">Console logging not configured</div>
            <div class="meta">To enable console error analysis, ensure Cypress is configured to capture console logs to JSON files.</div>
        </div>
        ` : ''}

    </div>
</body>
</html>`;

    const htmlPath = path.join(this.consoleAnalysisDir, `run-${runId}.html`);
    fs.writeFileSync(htmlPath, htmlContent);
    this.logger.success(`Console error HTML report generated: ${htmlPath}`);
    return htmlPath;
  }

  /**
   * Generate Enhanced HTML Report (enhanced functionality)
   */
  generateEnhancedHtmlReport(analysisResults, runId) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Enhanced Log Analysis - ${runId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; color: white; margin-bottom: 30px; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); transition: transform 0.2s; }
        .card:hover { transform: translateY(-2px); }
        .card h2 { color: #2d3748; margin-top: 0; font-size: 1.4em; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; }
        .metric { text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; font-size: 0.9em; margin-top: 5px; }
        .trend-up { color: #e53e3e; }
        .trend-down { color: #38a169; }
        .trend-stable { color: #2d3748; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .recommendations { background: #f7fafc; border-radius: 8px; padding: 20px; margin-top: 20px; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Enhanced Log Analysis Report</h1>
            <p>Run ID: ${runId} | Generated: ${new Date().toISOString()}</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>📊 Performance Metrics</h2>
                <div class="metrics">
                    ${this.renderPerformanceMetrics(analysisResults.performance)}
                </div>
            </div>
            
            <div class="card">
                <h2>🔍 Console Analysis</h2>
                ${this.renderConsoleAnalysis(analysisResults.console)}
            </div>
            
            <div class="card">   
                <h2>🌐 Network Requests</h2>
                ${this.renderNetworkAnalysis(analysisResults.network)}
            </div>
            
            ${analysisResults.trends ? `
            <div class="card">
                <h2>📈 Trend Analysis</h2>
                ${this.renderTrendAnalysis(analysisResults.trends)}
            </div>
            ` : ''}
        </div>
        
        <div class="card recommendations">
            <h2>💡 Recommendations</h2>
            ${this.generateRecommendations(analysisResults)}
        </div>
    </div>
</body>
</html>`;

    const reportPath = path.join(this.enhancedAnalysisDir, `comprehensive-report-${runId}.html`);
    fs.writeFileSync(reportPath, html);
    this.logger.success(`Enhanced HTML report generated: ${reportPath}`);
    return reportPath;
  }

  renderPerformanceMetrics(performance) {
    if (!performance) return '<p>No performance data available</p>';
    
    return `
        <div class="metric"><div class="metric-value">${performance.totalTests}</div><div class="metric-label">Total Tests</div></div>
        <div class="metric"><div class="metric-value">${(performance.avgTestDuration || 0).toFixed(0)}ms</div><div class="metric-label">Avg Duration</div></div>
        <div class="metric"><div class="metric-value">${(performance.failureRate || 0).toFixed(1)}%</div><div class="metric-label">Failure Rate</div></div>
        <div class="metric"><div class="metric-value">${(performance.retryRate || 0).toFixed(1)}%</div><div class="metric-label">Retry Rate</div></div>
    `;
  }

  renderConsoleAnalysis(console) {
    if (!console) return '<p>No console data available</p>';
    
    return `
        <div class="metrics">
            <div class="metric"><div class="metric-value">${console.summary.totalErrors}</div><div class="metric-label">Errors</div></div>
            <div class="metric"><div class="metric-value">${console.summary.totalUnexpectedWarnings}</div><div class="metric-label">Warnings</div></div>
        </div>
        ${console.summary.totalErrors === 0 && console.summary.totalUnexpectedWarnings === 0 ? 
            '<p style="color: #38a169; text-align: center; margin-top: 15px;">✅ No console issues detected!</p>' : ''}
    `;
  }

  renderNetworkAnalysis(network) {
    if (!network) return '<p>No network data available</p>';
    
    return `
        <div class="metrics">
            <div class="metric"><div class="metric-value">${network.totalRequests}</div><div class="metric-label">Total Requests</div></div>
            <div class="metric"><div class="metric-value">${network.failedRequests}</div><div class="metric-label">Failed</div></div>
        </div>
        ${network.totalRequests > 0 ? `
            <p style="margin-top: 15px;">Failure Rate: ${((network.failedRequests / network.totalRequests) * 100).toFixed(1)}%</p>
        ` : ''}
    `;
  }

  renderTrendAnalysis(trends) {
    if (!trends || trends.message) {
      return '<p>Insufficient data for trend analysis</p>';
    }
    
    return `
        <div class="metrics">
            <div class="metric">
                <div class="metric-value trend-${trends.performanceTrend}">${trends.performanceTrend}</div>
                <div class="metric-label">Performance</div>
            </div>
            <div class="metric">
                <div class="metric-value trend-${trends.failureRateTrend}">${trends.failureRateTrend}</div>
                <div class="metric-label">Failure Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${trends.dataPoints}</div>
                <div class="metric-label">Data Points</div>
            </div>
        </div>
    `;
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    if (results.performance?.failureRate > 5) {
      recommendations.push('⚠️ High failure rate detected. Review failed test logs and consider test stability improvements.');
    }
    
    if (results.performance?.avgTestDuration > 30000) {
      recommendations.push('🐌 Tests are running slowly. Consider optimizing test setup or adding more focused test cases.');
    }
    
    if (results.console?.summary?.totalErrors > 0) {
      recommendations.push('🔍 Console errors detected. Review error logs and fix application issues.');
    }
    
    if (results.network?.failedRequests > (results.network?.totalRequests || 0) * 0.1) {
      recommendations.push('🌐 High network request failure rate. Check service availability and network configuration.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All metrics look healthy. Great job!');
    }
    
    return `<ul>${recommendations.map(r => `<li>${r}</li>`).join('')}</ul>`;
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Save results to JSON files
   */
  saveResults(results, runId) {
    if (this.options.mode === 'basic') {
      // Save console analysis only
      const consoleResultsPath = path.join(this.consoleAnalysisDir, `run-${runId}.json`);
      fs.writeFileSync(consoleResultsPath, JSON.stringify(results.console, null, 2));
      this.logger.info(`Console analysis saved: ${consoleResultsPath}`);
    } else {
      // Save enhanced analysis
      const enhancedResultsPath = path.join(this.enhancedAnalysisDir, `enhanced-analysis-${runId}.json`);
      fs.writeFileSync(enhancedResultsPath, JSON.stringify(results, null, 2));
      this.logger.info(`Enhanced analysis saved: ${enhancedResultsPath}`);
    }
  }

  /**
   * Main analysis function
   */
  async analyze(runId = 'latest') {
    this.logger.info(`🔍 Starting ${this.options.mode} log analysis for run: ${runId}`);
    
    try {
      // Always start with console analysis
      const consoleAnalysis = this.analyzeConsoleErrors(runId);
      
      let results = {
        console: consoleAnalysis,
        runId,
        timestamp: new Date().toISOString(),
        mode: this.options.mode
      };

      if (this.options.mode === 'enhanced') {
        // Load test results for performance analysis
        const testResultsPath = path.join(__dirname, '..', 'tests-report', 'mochawesome.json');
        let testResults = null;
        if (fs.existsSync(testResultsPath)) {
          testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
        }

        // Add enhanced metrics
        results.performance = this.analyzePerformance(testResults);
        results.network = this.analyzeNetworkRequests(consoleAnalysis.errors.concat(consoleAnalysis.unexpectedWarnings));
        results.trends = this.analyzeTrends(results);
      }

      // Save JSON results
      this.saveResults(results, runId);

      // Generate HTML reports
      if (this.options.generateHtml) {
        if (this.options.mode === 'basic') {
          this.generateConsoleErrorHtmlReport(results.console, runId);
        } else {
          this.generateEnhancedHtmlReport(results, runId);
        }
      }

      // Summary output
      this.logger.success(`${this.options.mode} log analysis completed successfully!`);
      
      if (this.options.verbose) {
        this.logger.info('Analysis Summary:');
        this.logger.info(`  Mode: ${this.options.mode}`);
        this.logger.info(`  Console Errors: ${results.console.summary.totalErrors}`);
        this.logger.info(`  Unexpected Warnings: ${results.console.summary.totalUnexpectedWarnings}`);
        
        if (this.options.mode === 'enhanced') {
          this.logger.info(`  Total Tests: ${results.performance?.totalTests || 0}`);
          this.logger.info(`  Avg Duration: ${(results.performance?.avgTestDuration || 0).toFixed(0)}ms`);
          this.logger.info(`  Failure Rate: ${(results.performance?.failureRate || 0).toFixed(1)}%`);
        }
      }

      // Exit with error code if console errors or unexpected warnings found
      if (results.console.summary.totalErrors > 0 || results.console.summary.totalUnexpectedWarnings > 0) {
        this.logger.failure('Console issues detected! Check the generated reports for details.');
        process.exit(1);
      } else {
        this.logger.success('No console issues detected.');
      }
      
      return results;

    } catch (error) {
      this.logger.failure(`Log analysis failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error);
      }
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let runId = 'latest';
  const options = {
    mode: 'enhanced',
    generateHtml: true,
    verbose: false,
    outputJson: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--basic':
      case '--console-only':
        options.mode = 'basic';
        break;
      case '--enhanced':
      case '--full':
        options.mode = 'enhanced';
        break;
      case '--json':
        options.outputJson = true;
        break;
      case '--no-html':
        options.generateHtml = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Unified Log Analysis Tool

Usage: node scripts/log-analyzer.js [runId] [options]

Modes:
  --basic, --console-only    Console errors only (original analyze-console-errors functionality)
  --enhanced, --full         Full analysis with performance metrics (default)

Options:
  --json                     Output JSON format instead of HTML
  --verbose, -v              Detailed logging
  --no-html                  Skip HTML report generation
  --help, -h                 Show this help

Examples:
  node scripts/log-analyzer.js                         # Enhanced analysis of latest run
  node scripts/log-analyzer.js run-123                 # Enhanced analysis of specific run
  node scripts/log-analyzer.js --basic                 # Basic console error analysis only
  node scripts/log-analyzer.js --verbose --no-html     # Enhanced with detailed logging, no HTML
`);
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--')) {
          runId = arg;
        } else {
          console.warn(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  // Run analysis
  const analyzer = new UnifiedLogAnalyzer(options);
  analyzer.analyze(runId).catch(error => {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  });
}

module.exports = UnifiedLogAnalyzer;
