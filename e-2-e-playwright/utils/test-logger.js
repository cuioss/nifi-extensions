/**
 * @file Unified Test Logger
 * Captures browser and Node-side logs per test, persists via testInfo.attach()
 */

/**
 * Unified logger that captures browser and Node-side logs per test.
 * Logs are persisted as structured JSON attached to each test via testInfo.attach().
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
     * Persist logs as structured JSON attached to the test
     * @param {import('@playwright/test').TestInfo} testInfo - Playwright testInfo object
     */
    async attachToTest(testInfo) {
        if (this.#logs.length === 0) return;
        await testInfo.attach("test-logs", {
            body: Buffer.from(JSON.stringify(this.#logs, null, 2)),
            contentType: "application/json",
        });
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

export const testLogger = new TestLogger();
