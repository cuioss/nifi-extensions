#!/usr/bin/env node

/**
 * Enhanced Log Analysis Tool
 * Provides comprehensive analysis of E2E test logs including:
 * - Console error analysis
 * - Performance metrics
 * - Network request analysis
 * - Test execution trends
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the existing console error analyzer
const analyzeConsoleErrors = require('./analyze-console-errors');

/**
 * Enhanced log analysis with additional metrics
 */
class EnhancedLogAnalyzer {
  constructor() {
    this.resultsDir = path.join(__dirname, '..', 'cypress', 'reports', 'enhanced-analysis');
    this.ensureDirectoryExists(this.resultsDir);
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Analyze test execution performance
   */
  analyzePerformance(testResults) {
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

    return performanceMetrics;
  }

  /**
   * Analyze network requests from test logs
   */
  analyzeNetworkRequests(logs) {
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
   * Generate trend analysis by comparing with historical data
   */
  analyzeTrends(currentResults) {
    const trendsDir = path.join(this.resultsDir, 'trends');
    this.ensureDirectoryExists(trendsDir);
    
    const currentDate = new Date().toISOString().split('T')[0];
    const trendFile = path.join(trendsDir, `${currentDate}.json`);
    
    // Save current results for trend analysis
    fs.writeFileSync(trendFile, JSON.stringify({
      date: currentDate,
      timestamp: new Date().toISOString(),
      results: currentResults
    }, null, 2));

    // Load historical data for comparison
    const trendFiles = fs.readdirSync(trendsDir).filter(f => f.endsWith('.json')).slice(-30); // Last 30 days
    const historicalData = trendFiles.map(file => {
      try {
        return JSON.parse(fs.readFileSync(path.join(trendsDir, file), 'utf8'));
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    return this.calculateTrends(historicalData);
  }

  calculateTrends(historicalData) {
    if (historicalData.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const trends = {
      testCount: this.calculateTrend(historicalData.map(d => d.results.performance?.totalTests || 0)),
      avgDuration: this.calculateTrend(historicalData.map(d => d.results.performance?.avgTestDuration || 0)),
      failureRate: this.calculateTrend(historicalData.map(d => d.results.performance?.failureRate || 0)),
      errorCount: this.calculateTrend(historicalData.map(d => d.results.console?.summary?.totalErrors || 0))
    };

    return trends;
  }

  calculateTrend(values) {
    if (values.length < 2) return { trend: 'stable', change: 0 };
    
    const recent = values.slice(-7).reduce((sum, v) => sum + v, 0) / Math.min(7, values.length);
    const previous = values.slice(-14, -7).reduce((sum, v) => sum + v, 0) / Math.min(7, values.length - 7);
    
    const change = recent - previous;
    const percentChange = previous === 0 ? 0 : (change / previous) * 100;
    
    let trend = 'stable';
    if (Math.abs(percentChange) > 10) {
      trend = percentChange > 0 ? 'increasing' : 'decreasing';
    }
    
    return { trend, change: percentChange.toFixed(2) };
  }

  /**
   * Generate comprehensive HTML report
   */
  generateComprehensiveReport(analysisResults) {
    const reportPath = path.join(this.resultsDir, 'comprehensive-report.html');
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NiFi Extensions - Comprehensive E2E Test Analysis</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 4px; margin: 10px 0; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-stable { color: #6c757d; }
        .error-list { max-height: 300px; overflow-y: auto; }
        .error-item { padding: 8px; border-left: 3px solid #dc3545; background: #fff5f5; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>NiFi Extensions - E2E Test Analysis Report</h1>
            <p>Generated: ${new Date().toISOString()}</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>Performance Metrics</h2>
                ${this.renderPerformanceMetrics(analysisResults.performance)}
            </div>
            
            <div class="card">
                <h2>Console Analysis Summary</h2>
                ${this.renderConsoleAnalysis(analysisResults.console)}
            </div>
            
            <div class="card">   
                <h2>Network Request Analysis</h2>
                ${this.renderNetworkAnalysis(analysisResults.network)}
            </div>
            
            <div class="card">
                <h2>Trend Analysis</h2>
                ${this.renderTrendAnalysis(analysisResults.trends)}
            </div>
        </div>
        
        <div class="card" style="margin-top: 20px;">
            <h2>Recommendations</h2>
            ${this.generateRecommendations(analysisResults)}
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(reportPath, html);
    console.log(`📊 Comprehensive analysis report generated: ${reportPath}`);
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
    if (!console || !console.summary) return '<p>No console data available</p>';
    
    return `
        <div class="metric"><div class="metric-value">${console.summary.totalErrors}</div><div class="metric-label">Errors</div></div>
        <div class="metric"><div class="metric-value">${console.summary.totalUnexpectedWarnings}</div><div class="metric-label">Warnings</div></div>
        <div class="metric"><div class="metric-value">${console.summary.totalAllowedWarnings}</div><div class="metric-label">Allowed Warnings</div></div>
    `;
  }

  renderNetworkAnalysis(network) {
    if (!network) return '<p>No network data available</p>';
    
    return `
        <div class="metric"><div class="metric-value">${network.totalRequests}</div><div class="metric-label">Total Requests</div></div>
        <div class="metric"><div class="metric-value">${network.failedRequests}</div><div class="metric-label">Failed Requests</div></div>
        <div class="metric"><div class="metric-value">${network.slowRequests.length}</div><div class="metric-label">Slow Requests (>5s)</div></div>
    `;
  }

  renderTrendAnalysis(trends) {
    if (!trends || trends.message) return `<p>${trends?.message || 'No trend data available'}</p>`;
    
    return `
        <table>
            <tr><th>Metric</th><th>Trend</th><th>Change</th></tr>
            <tr><td>Test Count</td><td class="trend-${trends.testCount.trend}">${trends.testCount.trend}</td><td>${trends.testCount.change}%</td></tr>
            <tr><td>Avg Duration</td><td class="trend-${trends.avgDuration.trend}">${trends.avgDuration.trend}</td><td>${trends.avgDuration.change}%</td></tr>
            <tr><td>Failure Rate</td><td class="trend-${trends.failureRate.trend}">${trends.failureRate.trend}</td><td>${trends.failureRate.change}%</td></tr>
            <tr><td>Error Count</td><td class="trend-${trends.errorCount.trend}">${trends.errorCount.trend}</td><td>${trends.errorCount.change}%</td></tr>
        </table>
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
    
    if (results.network?.failedRequests > results.network?.totalRequests * 0.1) {
      recommendations.push('🌐 High network request failure rate. Check service availability and network configuration.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All metrics look healthy. Great job!');
    }
    
    return `<ul>${recommendations.map(r => `<li>${r}</li>`).join('')}</ul>`;
  }

  /**
   * Main analysis function
   */
  async analyze(runId = 'latest') {
    console.log('🔍 Starting enhanced log analysis...');
    
    try {
      // Run console error analysis
      const consoleAnalysis = await analyzeConsoleErrors(runId);
      
      // Load test results for performance analysis
      const testResultsPath = path.join(__dirname, '..', 'tests-report', 'mochawesome.json');
      let testResults = null;
      if (fs.existsSync(testResultsPath)) {
        testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
      }
      
      // Analyze performance
      const performanceAnalysis = this.analyzePerformance(testResults);
      
      // Analyze network requests (from console logs)
      const networkAnalysis = this.analyzeNetworkRequests(consoleAnalysis.errors.concat(consoleAnalysis.unexpectedWarnings));
      
      // Generate trends
      const analysisResults = {
        console: consoleAnalysis,
        performance: performanceAnalysis,
        network: networkAnalysis
      };
      
      const trendsAnalysis = this.analyzeTrends(analysisResults);
      analysisResults.trends = trendsAnalysis;
      
      // Save comprehensive results
      const resultsPath = path.join(this.resultsDir, `enhanced-analysis-${runId}.json`);
      fs.writeFileSync(resultsPath, JSON.stringify(analysisResults, null, 2));
      
      // Generate HTML report
      const reportPath = this.generateComprehensiveReport(analysisResults);
      
      console.log('✅ Enhanced log analysis complete!');
      console.log(`📋 Results: ${resultsPath}`);
      console.log(`📊 Report: ${reportPath}`);
      
      return analysisResults;
      
    } catch (error) {
      console.error('❌ Enhanced log analysis failed:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const runId = process.argv[2] || 'latest';
  const analyzer = new EnhancedLogAnalyzer();
  analyzer.analyze(runId).catch(console.error);
}

module.exports = EnhancedLogAnalyzer;
