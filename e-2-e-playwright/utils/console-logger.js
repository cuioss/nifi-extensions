/**
 * @file Browser Console Logger for E2E Tests - Cleaned Version
 * Captures browser console messages during tests with only used methods
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { globalCriticalErrorDetector } from './critical-error-detector.js';

/**
 * Individual test logger that manages console logs per test
 */
class IndividualTestLogger {
    constructor() {
        this.testLogs = new Map();
        this.activeTestId = null;
        this.globalLogPath = path.join(process.cwd(), 'target', 'browser-console-logs');
        this.failOnErrors = false;
        this.errorWhitelist = [];
    }

    /**
     * Set the active test being logged
     */
    setActiveTest(testId) {
        this.activeTestId = testId;
        if (!this.testLogs.has(testId)) {
            this.testLogs.set(testId, []);
        }
    }

    /**
     * Add a log entry for the active test
     */
    addLog(entry) {
        if (!this.activeTestId) return;
        
        const logs = this.testLogs.get(this.activeTestId) || [];
        logs.push({
            ...entry,
            timestamp: new Date().toISOString()
        });
        this.testLogs.set(this.activeTestId, logs);
    }

    /**
     * Get logs for a specific test
     */
    getTestLogs(testId) {
        return this.testLogs.get(testId) || [];
    }

    /**
     * Clear logs for a specific test
     */
    clearTestLogs(testId) {
        this.testLogs.delete(testId);
    }

    /**
     * Save logs for a specific test to file
     */
    async saveTestLogs(testInfo) {
        const testId = `${testInfo.titlePath.join('-')}-${testInfo.testId}`;
        const logs = this.getTestLogs(testId);
        
        if (!logs || logs.length === 0) {
            return null;
        }

        // Ensure directory exists
        await fs.mkdir(this.globalLogPath, { recursive: true });

        // Create filename with test info
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeTitle = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-');
        const filename = `${safeTitle}-${timestamp}.json`;
        const filepath = path.join(this.globalLogPath, filename);

        // Save logs
        await fs.writeFile(filepath, JSON.stringify({
            testInfo: {
                title: testInfo.title,
                titlePath: testInfo.titlePath,
                file: testInfo.file,
                line: testInfo.line,
                column: testInfo.column,
                testId: testInfo.testId,
                status: testInfo.status,
                duration: testInfo.duration,
                errors: testInfo.errors,
                annotations: testInfo.annotations
            },
            logs,
            summary: {
                total: logs.length,
                errors: logs.filter(l => l.type === 'error').length,
                warnings: logs.filter(l => l.type === 'warning').length,
                info: logs.filter(l => l.type === 'log' || l.type === 'info').length
            }
        }, null, 2));

        // Clear logs after saving
        this.clearTestLogs(testId);

        return filepath;
    }

    /**
     * Save all accumulated logs
     */
    async saveAllLogs() {
        const allLogs = {};
        for (const [testId, logs] of this.testLogs.entries()) {
            allLogs[testId] = logs;
        }

        if (Object.keys(allLogs).length === 0) {
            return null;
        }

        // Ensure directory exists
        await fs.mkdir(this.globalLogPath, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `all-browser-logs-${timestamp}.json`;
        const filepath = path.join(this.globalLogPath, filename);

        await fs.writeFile(filepath, JSON.stringify(allLogs, null, 2));
        
        // Clear all logs after saving
        this.testLogs.clear();

        return filepath;
    }
}

// Create global instance
export const globalConsoleLogger = new IndividualTestLogger();

/**
 * Save test browser logs
 */
export async function saveTestBrowserLogs(testInfo) {
    return globalConsoleLogger.saveTestLogs(testInfo);
}

/**
 * Setup auth-aware error detection (doesn't fail on auth-related errors)
 */
export async function setupAuthAwareErrorDetection(page, testInfo) {
    await setupStrictErrorDetection(page, testInfo, false);
}

/**
 * Setup strict error detection for tests
 */
export async function setupStrictErrorDetection(page, testInfo, skipInitialChecks = false) {
    const testId = `${testInfo.titlePath.join('-')}-${testInfo.testId}`;
    globalConsoleLogger.setActiveTest(testId);
    
    // Clear any previous critical errors
    globalCriticalErrorDetector.clearErrors();
    
    // Setup console message handler
    page.on('console', async (msg) => {
        const type = msg.type();
        const text = msg.text();
        const location = msg.location();
        
        // Add to logger
        globalConsoleLogger.addLog({
            type,
            text,
            location,
            args: await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => 'Unable to serialize')))
        });
        
        // Check for critical errors
        if (type === 'error' && !isErrorWhitelisted(text)) {
            // Check console messages for critical errors
            globalCriticalErrorDetector.checkConsoleMessage(msg, testInfo);
        }
    });
    
    // Setup page error handler
    page.on('pageerror', (error) => {
        globalConsoleLogger.addLog({
            type: 'pageerror',
            text: error.message,
            stack: error.stack
        });
        
        if (!isErrorWhitelisted(error.message)) {
            globalCriticalErrorDetector.addCriticalError('PAGE_ERROR', error.message, testInfo);
        }
    });
    
    // Setup response handler for failed requests
    page.on('response', (response) => {
        if (response.status() >= 400) {
            const message = `HTTP ${response.status()} - ${response.url()}`;
            globalConsoleLogger.addLog({
                type: 'network-error',
                text: message,
                status: response.status(),
                url: response.url()
            });
            
            // Don't treat 401/403 as critical in auth-aware mode
            if (response.status() !== 401 && response.status() !== 403) {
                // Check HTTP errors for critical patterns
                globalCriticalErrorDetector.addCriticalError('HTTP_ERROR', message, testInfo);
            }
        }
    });
}

/**
 * Check if an error message is whitelisted
 */
export function isErrorWhitelisted(message) {
    const whitelist = [
        'ResizeObserver loop',
        'Non-Error promise rejection',
        'Failed to load resource',
        'net::ERR_',
        'Authorization required',
        'Unauthorized'
    ];
    
    return whitelist.some(pattern => message.includes(pattern));
}

/**
 * Create a test log file in the test output directory
 */
export async function createTestLogFile(testInfo, content, filename = 'console-logs.log') {
    if (!testInfo || !testInfo.outputDir) {
        throw new Error('testInfo.outputDir is required for proper test result organization');
    }
    
    const outputDir = testInfo.outputDir;
    await fs.mkdir(outputDir, { recursive: true });
    
    const filepath = path.join(outputDir, filename);
    
    if (typeof content === 'object') {
        await fs.writeFile(filepath, JSON.stringify(content, null, 2));
    } else {
        await fs.writeFile(filepath, content);
    }
    
    return filepath;
}

