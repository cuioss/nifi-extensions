#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const allowedWarnings = require('../cypress/support/console-warnings-allowlist');

/**
 * Analyzes console errors and warnings from Cypress test runs
 * Generates reports for CI/CD and development use
 */

// Parse Cypress console logs from test runs
function analyzeConsoleErrors(runId) {
  const logPath = path.join(__dirname, '..', 'cypress', 'logs', `run-${runId}.json`);
  
  // Check if log file exists
  if (!fs.existsSync(logPath)) {
    console.warn(`Log file not found: ${logPath}`);
    console.warn('Console error analysis requires Cypress to generate log files.');
    console.warn('This may indicate that console logging is not properly configured.');
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
    allowedWarningsByPattern: groupByPattern(allowedWarningInstances)
  };

  // Write report
  const reportPath = path.join(__dirname, '..', 'cypress', 'reports', 'console-analysis', `run-${runId}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Generate HTML report for easier viewing
  generateHtmlReport(report, runId);

  console.log(`Console error analysis complete. Report saved to ${reportPath}`);
  return report;
}

// Group allowed warnings by pattern for easier analysis
function groupByPattern(allowedWarnings) {
  const grouped = {};
  allowedWarnings.forEach(warning => {
    if (!grouped[warning.pattern]) {
      grouped[warning.pattern] = [];
    }
    grouped[warning.pattern].push(warning);
  });

  return grouped;
}

// Generate an HTML report for easier viewing
function generateHtmlReport(report, runId) {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Console Error Analysis - Run ${runId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary-item { margin: 5px 0; }
    .error { background: #ffebee; border-left: 4px solid #f44336; padding: 10px; margin: 10px 0; }
    .warning { background: #fff3e0; border-left: 4px solid #ff9800; padding: 10px; margin: 10px 0; }
    .allowed { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 10px; margin: 10px 0; }
    .message { font-weight: bold; margin-bottom: 5px; }
    .meta { color: #666; font-size: 0.9em; }
    .error-count { color: #f44336; font-weight: bold; }
    .warning-count { color: #ff9800; font-weight: bold; }
    .allowed-count { color: #4caf50; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Console Error Analysis - Run ${runId}</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="summary-item">Run Date: ${report.summary.runDate}</div>
    <div class="summary-item">Log File Found: ${report.summary.logFileFound ? 'Yes' : 'No'}</div>
    <div class="summary-item">Errors: <span class="error-count">${report.summary.totalErrors}</span></div>
    <div class="summary-item">Unexpected Warnings: <span class="warning-count">${report.summary.totalUnexpectedWarnings}</span></div>
    <div class="summary-item">Allowed Warnings: <span class="allowed-count">${report.summary.totalAllowedWarnings}</span></div>
  </div>

  ${report.summary.totalErrors > 0 ? `
  <h2>Errors (${report.summary.totalErrors})</h2>
  ${report.errors.map(error => `
    <div class="error">
      <div class="message">${escapeHtml(error.message)}</div>
      <div class="meta">Source: ${error.source || 'Unknown'}</div>
      <div class="meta">Test: ${error.testFile} - ${error.testName}</div>
      <div class="meta">Timestamp: ${error.timestamp}</div>
    </div>
  `).join('')}
  ` : '<h2>No Errors Found ✅</h2>'}

  ${report.summary.totalUnexpectedWarnings > 0 ? `
  <h2>Unexpected Warnings (${report.summary.totalUnexpectedWarnings})</h2>
  ${report.unexpectedWarnings.map(warning => `
    <div class="warning">
      <div class="message">${escapeHtml(warning.message)}</div>
      <div class="meta">Source: ${warning.source || 'Unknown'}</div>
      <div class="meta">Test: ${warning.testFile} - ${warning.testName}</div>
      <div class="meta">Timestamp: ${warning.timestamp}</div>
    </div>
  `).join('')}
  ` : '<h2>No Unexpected Warnings Found ✅</h2>'}

  ${report.summary.totalAllowedWarnings > 0 ? `
  <h2>Allowed Warnings (${report.summary.totalAllowedWarnings})</h2>
  ${Object.entries(report.allowedWarningsByPattern).map(([pattern, warnings]) => `
    <div class="allowed">
      <div class="message">Pattern: ${escapeHtml(pattern)}</div>
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

</body>
</html>`;

  const htmlPath = path.join(__dirname, '..', 'cypress', 'reports', 'console-analysis', `run-${runId}.html`);
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`HTML report generated: ${htmlPath}`);
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Example usage
if (require.main === module) {
  const runId = process.argv[2] || new Date().toISOString().replace(/[:.]/g, '-');
  
  console.log(`Analyzing console errors for run ID: ${runId}`);
  
  const report = analyzeConsoleErrors(runId);
  
  console.log(`Analysis Summary:`);
  console.log(`  Errors: ${report.summary.totalErrors}`);
  console.log(`  Unexpected Warnings: ${report.summary.totalUnexpectedWarnings}`);
  console.log(`  Allowed Warnings: ${report.summary.totalAllowedWarnings}`);
  console.log(`  Log File Found: ${report.summary.logFileFound}`);
  
  // Exit with error code if console errors or unexpected warnings found
  if (report.summary.totalErrors > 0 || report.summary.totalUnexpectedWarnings > 0) {
    console.error('\n❌ Console issues detected! Check the generated reports for details.');
    process.exit(1);
  } else {
    console.log('\n✅ No console issues detected.');
    process.exit(0);
  }
}

module.exports = { analyzeConsoleErrors };
