// scripts/analyze-console-errors.js
const fs = require('fs');
const path = require('path');
const allowedWarnings = require('../cypress/support/console-warnings-allowlist');

// Parse Cypress console logs from test runs
function analyzeConsoleErrors(runId) {
  const logPath = path.join(__dirname, '..', 'cypress', 'logs', `run-${runId}.json`);
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
      runId
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
  const htmlPath = path.join(__dirname, '..', 'cypress', 'reports', 'console-analysis', `run-${runId}.html`);
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Console Error Analysis - Run ${runId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #2c3e50; }
    .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary-item { margin-bottom: 10px; }
    .error { margin-bottom: 20px; padding: 15px; background-color: #ffebee; border-left: 5px solid #f44336; border-radius: 3px; }
    .warning { margin-bottom: 20px; padding: 15px; background-color: #fff8e1; border-left: 5px solid #ffc107; border-radius: 3px; }
    .allowed { margin-bottom: 20px; padding: 15px; background-color: #e8f5e9; border-left: 5px solid #4caf50; border-radius: 3px; }
    .message { font-family: monospace; white-space: pre-wrap; margin: 10px 0; padding: 10px; background-color: rgba(0,0,0,0.05); }
    .pattern { font-weight: bold; margin-bottom: 10px; }
    .count { font-weight: bold; color: #555; }
    .meta { font-size: 0.9em; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; padding: 10px; background-color: #f0f0f0; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; }
    .error-count { color: #f44336; font-weight: bold; }
    .warning-count { color: #ffc107; font-weight: bold; }
    .allowed-count { color: #4caf50; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Console Error Analysis - Run ${runId}</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="summary-item">Run Date: ${report.summary.runDate}</div>
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
  ` : '<h2>No Errors Found</h2>'}

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
  ` : '<h2>No Unexpected Warnings Found</h2>'}

  <h2>Allowed Warnings by Pattern</h2>
  ${Object.keys(report.allowedWarningsByPattern).length > 0 ? `
    ${Object.entries(report.allowedWarningsByPattern).map(([pattern, instances]) => `
      <div class="allowed">
        <div class="pattern">Pattern: "${escapeHtml(pattern)}"</div>
        <div class="count">Occurrences: ${instances.length}</div>
        <h4>Example Instances:</h4>
        <table>
          <tr>
            <th>Source</th>
            <th>Test File</th>
            <th>Message</th>
          </tr>
          ${instances.slice(0, 5).map(instance => `
            <tr>
              <td>${instance.source || 'Unknown'}</td>
              <td>${instance.testFile}</td>
              <td><div class="message">${escapeHtml(instance.message.substring(0, 100))}${instance.message.length > 100 ? '...' : ''}</div></td>
            </tr>
          `).join('')}
        </table>
      </div>
    `).join('')}
  ` : '<p>No allowed warnings were encountered during this test run.</p>'}

  <script>
    // Add any interactive features if needed
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlPath, html);
  console.log(`HTML report saved to ${htmlPath}`);
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
  const runId = process.argv[2];
  if (!runId) {
    console.error('Please provide a run ID');
    process.exit(1);
  }
  
  const report = analyzeConsoleErrors(runId);
  console.log(`Found ${report.summary.totalErrors} errors and ${report.summary.totalUnexpectedWarnings} unexpected warnings`);
}

module.exports = { analyzeConsoleErrors };
