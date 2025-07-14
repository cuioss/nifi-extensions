/**
 * @file Global Console Logger
 * Captures ALL browser console logs across all tests and saves to accessible file
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';

class IndividualTestLogger {
  constructor() {
    this.testLogs = new Map(); // Map of testId -> logs array
  }

  /**
   * Set up console logging for a specific test
   */
  setupLogging(page, testInfo) {
    if (!page || !testInfo) return;
    
    const testId = this.getTestId(testInfo);
    
    // Initialize logs array for this test
    if (!this.testLogs.has(testId)) {
      this.testLogs.set(testId, []);
    }
    
    const testLogsArray = this.testLogs.get(testId);

    // Capture all console messages for this specific test
    page.on('console', (msg) => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        args: msg.args()?.map(arg => arg.toString()) || []
      };
      
      testLogsArray.push(logEntry);
    });

    // Capture page errors for this specific test
    page.on('pageerror', (error) => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        location: null,
        args: []
      };
      
      testLogsArray.push(logEntry);
    });

    // Capture page crashes for this specific test
    page.on('crash', () => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: 'crash',
        text: 'Page crashed',
        location: null,
        args: []
      };
      
      testLogsArray.push(logEntry);
    });

    // Capture request failures for this specific test
    page.on('requestfailed', (request) => {
      const logEntry = {
        test: testInfo.title,
        testFile: testInfo.titlePath?.[0] || 'Unknown File',
        timestamp: new Date().toISOString(),
        type: 'requestfailed',
        text: `Request failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`,
        location: null,
        args: [request.url(), request.method()]
      };
      
      testLogsArray.push(logEntry);
    });
  }

  /**
   * Generate unique test identifier
   */
  getTestId(testInfo) {
    const sanitizedTitle = testInfo.title.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedFile = (testInfo.titlePath?.[0] || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedFile}-${sanitizedTitle}`;
  }

  /**
   * Save logs for a specific test
   */
  async saveTestLogs(testId, logs) {
    if (!logs || logs.length === 0) {
      return null;
    }

    // Create target/logs directory
    const targetDir = path.join(process.cwd(), 'target');
    const logsDir = path.join(targetDir, 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create individual test log files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `${testId}-console-logs-${timestamp}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    // Format logs for readability
    const formattedLogs = this.formatLogsForFile(logs, testId);

    // Write to file
    fs.writeFileSync(logFilePath, formattedLogs, 'utf8');

    // Also save as JSON for programmatic access
    const jsonFileName = `${testId}-console-logs-${timestamp}.json`;
    const jsonFilePath = path.join(logsDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(logs, null, 2), 'utf8');

    return {
      textLog: logFilePath,
      jsonLog: jsonFilePath,
      totalLogs: logs.length,
      testId
    };
  }

  /**
   * Save all captured logs for all tests
   */
  async saveAllLogs() {
    const results = [];
    
    for (const [testId, logs] of this.testLogs) {
      const result = await this.saveTestLogs(testId, logs);
      if (result) {
        results.push(result);
      }
    }
    
    return results.length > 0 ? results : null;
  }

  /**
   * Format logs for human-readable file
   */
  formatLogsForFile(logs, testId = 'ALL_TESTS') {
    const header = `
===============================================
      BROWSER CONSOLE LOGS - ${testId}
===============================================
Generated: ${new Date().toISOString()}
Total Log Entries: ${logs.length}
===============================================

`;

    const formattedEntries = logs.map((log, index) => {
      const separator = '---';
      return `
${separator} Entry ${index + 1} ${separator}
Test: ${log.test}
File: ${log.testFile}
Time: ${log.timestamp}
Type: ${log.type.toUpperCase()}
Message: ${log.text}
${log.location ? `Location: ${JSON.stringify(log.location)}` : ''}
${log.stack ? `Stack: ${log.stack}` : ''}
${log.args.length > 0 ? `Args: ${log.args.join(', ')}` : ''}
`;
    }).join('\n');

    return header + formattedEntries + '\n\n===============================================\n';
  }

  /**
   * Get current log count for a specific test
   */
  getLogCount(testId) {
    if (testId) {
      return this.testLogs.get(testId)?.length || 0;
    }
    // Return total count across all tests
    let total = 0;
    for (const logs of this.testLogs.values()) {
      total += logs.length;
    }
    return total;
  }

  /**
   * Clear logs for a specific test or all logs
   */
  clearLogs(testId) {
    if (testId) {
      this.testLogs.delete(testId);
    } else {
      this.testLogs.clear();
    }
  }

  /**
   * Get logs for a specific test
   */
  getTestLogs(testId) {
    return this.testLogs.get(testId) || [];
  }
}

// Export global instance
export const globalConsoleLogger = new IndividualTestLogger();

/**
 * Convenience function to setup logging on a page
 */
export function setupBrowserConsoleLogging(page, testInfo) {
  globalConsoleLogger.setupLogging(page, testInfo);
}

/**
 * Save all logs to file
 */
export async function saveAllBrowserLogs() {
  return globalConsoleLogger.saveAllLogs();
}

/**
 * Save logs for a specific test
 */
export async function saveTestBrowserLogs(testInfo) {
  const testId = globalConsoleLogger.getTestId(testInfo);
  const logs = globalConsoleLogger.getTestLogs(testId);
  return globalConsoleLogger.saveTestLogs(testId, logs);
}