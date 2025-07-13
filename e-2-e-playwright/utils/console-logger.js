/**
 * @file Global Console Logger
 * Captures ALL browser console logs across all tests and saves to accessible file
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';

class GlobalConsoleLogger {
  constructor() {
    this.allLogs = [];
    this.isSetup = false;
  }

  /**
   * Set up global console logging for a page
   */
  setupLogging(page, testInfo) {
    if (!page || this.isSetup) return;

    // Capture all console messages
    page.on('console', (msg) => {
      const logEntry = {
        test: testInfo?.title || 'Unknown Test',
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        args: msg.args()?.map(arg => arg.toString()) || []
      };
      
      this.allLogs.push(logEntry);
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      const logEntry = {
        test: testInfo?.title || 'Unknown Test',
        timestamp: new Date().toISOString(),
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        location: null,
        args: []
      };
      
      this.allLogs.push(logEntry);
    });

    // Capture unhandled exceptions
    page.on('crash', () => {
      const logEntry = {
        test: testInfo?.title || 'Unknown Test',
        timestamp: new Date().toISOString(),
        type: 'crash',
        text: 'Page crashed',
        location: null,
        args: []
      };
      
      this.allLogs.push(logEntry);
    });

    // Capture request failures
    page.on('requestfailed', (request) => {
      const logEntry = {
        test: testInfo?.title || 'Unknown Test',
        timestamp: new Date().toISOString(),
        type: 'requestfailed',
        text: `Request failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`,
        location: null,
        args: [request.url(), request.method()]
      };
      
      this.allLogs.push(logEntry);
    });

    this.isSetup = true;
  }

  /**
   * Save all captured logs to a file
   */
  async saveAllLogs() {
    if (this.allLogs.length === 0) {
      return null;
    }

    // Create target/logs directory
    const targetDir = path.join(process.cwd(), 'target');
    const logsDir = path.join(targetDir, 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create comprehensive log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `all-browser-console-logs-${timestamp}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    // Format logs for readability
    const formattedLogs = this.formatLogsForFile(this.allLogs);

    // Write to file
    fs.writeFileSync(logFilePath, formattedLogs, 'utf8');

    // Also save as JSON for programmatic access
    const jsonFileName = `all-browser-console-logs-${timestamp}.json`;
    const jsonFilePath = path.join(logsDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(this.allLogs, null, 2), 'utf8');

    return {
      textLog: logFilePath,
      jsonLog: jsonFilePath,
      totalLogs: this.allLogs.length
    };
  }

  /**
   * Format logs for human-readable file
   */
  formatLogsForFile(logs) {
    const header = `
===============================================
      ALL BROWSER CONSOLE LOGS
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
   * Get current log count
   */
  getLogCount() {
    return this.allLogs.length;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.allLogs = [];
    this.isSetup = false;
  }
}

// Export global instance
export const globalConsoleLogger = new GlobalConsoleLogger();

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