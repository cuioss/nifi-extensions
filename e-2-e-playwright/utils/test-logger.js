/**
 * @file Unified Test Logger
 * Captures browser and Node-side logs per test, persists as text files
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Unified logger that captures browser and Node-side logs per test.
 * Logs are persisted as separate text files: browser.log and test-run.log.
 */
class TestLogger {
    #logs = [];
    #testId = null;

    /**
     * Start capturing for a new test
     * @param {string} testId - unique test identifier from testInfo.testId
     */
    startTest(testId) {
        this.#testId = testId;
        this.#logs = [];
    }

    /**
     * Add a log entry
     * @param {string} source - origin of the log (e.g. 'browser', 'Processor', 'Auth')
     * @param {string} level - log level (e.g. 'info', 'warn', 'error')
     * @param {string} message - log message
     */
    log(source, level, message) {
        if (!this.#testId) return;
        this.#logs.push({
            timestamp: new Date().toISOString(),
            source,
            level,
            message,
        });
    }

    /**
     * Log an info message from a Node-side utility
     * @param {string} source - origin of the log
     * @param {string} message - log message
     */
    info(source, message) {
        this.log(source, "info", message);
    }

    /**
     * Log a warning from a Node-side utility
     * @param {string} source - origin of the log
     * @param {string} message - log message
     */
    warn(source, message) {
        this.log(source, "warn", message);
    }

    /**
     * Log an error from a Node-side utility
     * @param {string} source - origin of the log
     * @param {string} message - log message
     */
    error(source, message) {
        this.log(source, "error", message);
    }

    /**
     * Setup browser console/error/network capture on a Playwright page
     * @param {import('@playwright/test').Page} page - Playwright page object
     */
    setupBrowserCapture(page) {
        page.on("console", (msg) => {
            this.log("browser", msg.type(), msg.text());
        });
        page.on("pageerror", (err) => {
            this.log("browser", "exception", err.message);
        });
        page.on("response", (resp) => {
            if (resp.status() >= 400) {
                this.log(
                    "browser",
                    "network-error",
                    `HTTP ${resp.status()} - ${resp.url()}`,
                );
            }
        });
    }

    /**
     * Write logs as separate text files: browser.log and test-run.log
     * @param {import('@playwright/test').TestInfo} testInfo - Playwright testInfo object
     */
    writeLogs(testInfo) {
        const outputDir = testInfo.outputDir;
        mkdirSync(outputDir, { recursive: true });

        // browser.log — only browser-sourced entries
        const browserLines = this.#logs
            .filter((e) => e.source === "browser")
            .map(
                (e) =>
                    `[${e.timestamp.substring(11, 23)}] [${e.level}] ${e.message}`,
            );
        writeFileSync(
            join(outputDir, "browser.log"),
            browserLines.join("\n") + "\n",
            "utf-8",
        );

        // test-run.log — only Node-side utility entries
        const testRunLines = this.#logs
            .filter((e) => e.source !== "browser")
            .map(
                (e) =>
                    `[${e.timestamp.substring(11, 23)}] [${e.source}] [${e.level}] ${e.message}`,
            );
        writeFileSync(
            join(outputDir, "test-run.log"),
            testRunLines.join("\n") + "\n",
            "utf-8",
        );

        this.#logs = [];
    }

    /**
     * Get current logs (for assertions in tests)
     * @returns {Array<{timestamp: string, source: string, level: string, message: string}>} copy of current logs
     */
    getLogs() {
        return [...this.#logs];
    }
}

/**
 * Take a screenshot at the start of a test (after preconditions, before test body)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright testInfo object
 */
export async function takeStartScreenshot(page, testInfo) {
    mkdirSync(testInfo.outputDir, { recursive: true });
    await page.screenshot({ path: join(testInfo.outputDir, "before.png"), fullPage: true });
}

export const testLogger = new TestLogger();
