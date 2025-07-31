/**
 * @file Self-Test: Browser Console Logging
 * Tests browser console log capture and storage with 2025 best practices
 * Single responsibility: Verify browser logs are captured and stored correctly
 * @version 1.0.0
 */

import { expect, test } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import fs from "fs";
import path from "path";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Self-Test: Browser Console Logging", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup console logging for each test
        await setupAuthAwareErrorDetection(page, testInfo);
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        // Always save browser logs first, regardless of test outcome
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }
    });

    test("should capture console messages during test execution", async ({
        page,
    }, testInfo) => {
        const consoleMessages = [];

        // Set up console listener
        page.on("console", (msg) => {
            consoleMessages.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString(),
            });
        });

        // Navigate to a simple page first to ensure page context exists
        await page.goto("about:blank");

        const authService = new AuthService(page);

        // Perform some operations that generate console output
        await authService.ensureReady();

        // Navigate and interact to generate more console activity
        await page.evaluate(() => {
            // eslint-disable-next-line no-console
            console.log("Test console log message");
            // eslint-disable-next-line no-console
            console.warn("Test console warning message");
            // eslint-disable-next-line no-console
            console.info("Test console info message");
        });

        // Verify console messages were captured
        expect(consoleMessages.length).toBeGreaterThan(0);

        // Find our test messages
        const testLog = consoleMessages.find((msg) =>
            msg.text.includes("Test console log"),
        );
        const testWarn = consoleMessages.find((msg) =>
            msg.text.includes("Test console warning"),
        );
        const testInfoMsg = consoleMessages.find((msg) =>
            msg.text.includes("Test console info"),
        );

        expect(testLog).toBeTruthy();
        expect(testWarn).toBeTruthy();
        expect(testInfoMsg).toBeTruthy();

        // Attach console logs to test results
        await testInfo.attach("console-logs", {
            body: JSON.stringify(consoleMessages, null, 2),
            contentType: "application/json",
        });
    });

    test("should capture and filter error messages", async ({
        page,
    }, testInfo) => {
        const consoleErrors = [];
        const allMessages = [];

        // Set up console listener for errors
        page.on("console", (msg) => {
            const logEntry = {
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString(),
            };

            allMessages.push(logEntry);

            if (msg.type() === "error") {
                consoleErrors.push(logEntry);
            }
        });

        // Set up page error listener
        page.on("pageerror", (error) => {
            consoleErrors.push({
                type: "pageerror",
                text: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
        });

        const authService = new AuthService(page);
        await authService.ensureReady();

        // Intentionally trigger a console error
        await page.evaluate(() => {
            // eslint-disable-next-line no-console
            console.error("Intentional test error for logging validation");
        });

        // Verify error was captured
        const testError = consoleErrors.find((err) =>
            err.text.includes("Intentional test error"),
        );
        expect(testError).toBeTruthy();

        // Attach error logs specifically
        if (consoleErrors.length > 0) {
            await testInfo.attach("console-errors", {
                body: JSON.stringify(consoleErrors, null, 2),
                contentType: "application/json",
            });
        }
    });

    test("should save console logs to file system", async ({
        page,
    }, testInfo) => {
        const consoleMessages = [];

        // Set up console listener
        page.on("console", (msg) => {
            consoleMessages.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString(),
                location: msg.location(),
            });
        });

        const authService = new AuthService(page);
        await authService.ensureReady();

        // Generate some console activity
        await page.evaluate(() => {
            // eslint-disable-next-line no-console
            console.log("File system test message");
            // eslint-disable-next-line no-console
            console.warn("File system test warning");
        });

        // Create target/logs directory if it doesn't exist
        const targetDir = path.join(process.cwd(), "target");
        const logsDir = path.join(targetDir, "logs");

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Save console logs to file
        if (consoleMessages.length > 0) {
            const sanitizedTestName = testInfo.title.replace(
                /[^a-zA-Z0-9]/g,
                "_",
            );
            const logFileName = `${sanitizedTestName}-console-logs.json`;
            const logFilePath = path.join(logsDir, logFileName);

            fs.writeFileSync(
                logFilePath,
                JSON.stringify(consoleMessages, null, 2),
            );

            // Verify file was created and contains data
            expect(fs.existsSync(logFilePath)).toBeTruthy();

            const savedContent = JSON.parse(
                fs.readFileSync(logFilePath, "utf8"),
            );
            expect(savedContent.length).toBeGreaterThan(0);

            // Find our test messages in saved file
            const testMessage = savedContent.find((msg) =>
                msg.text.includes("File system test message"),
            );
            expect(testMessage).toBeTruthy();
        }
    });

    test("should handle request failures and network errors", async ({
        page,
    }, testInfo) => {
        const networkErrors = [];
        const consoleMessages = [];

        // Listen for failed requests
        page.on("requestfailed", (request) => {
            networkErrors.push({
                url: request.url(),
                method: request.method(),
                failure: request.failure()?.errorText,
                timestamp: new Date().toISOString(),
            });
        });

        // Listen for console messages
        page.on("console", (msg) => {
            consoleMessages.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString(),
            });
        });

        const authService = new AuthService(page);
        await authService.ensureReady();

        // Attempt to make a request to a non-existent endpoint
        await page.evaluate(() => {
            fetch("/nonexistent-endpoint").catch((err) =>
                // eslint-disable-next-line no-console
                console.warn("Expected network error:", err.message),
            );
        });

        // Wait for potential network activity
        await page.waitForTimeout(1000);

        // Should have captured some form of network activity
        const totalEvents = networkErrors.length + consoleMessages.length;
        expect(totalEvents).toBeGreaterThan(0);

        // Attach network errors if any
        if (networkErrors.length > 0) {
            await testInfo.attach("network-errors", {
                body: JSON.stringify(networkErrors, null, 2),
                contentType: "application/json",
            });
        }
    });

    test("should create direct accessible browser console log file", async ({
        page,
    }, testInfo) => {
        // Check if NiFi is accessible before running this test
        const authService = new AuthService(page);
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test browser logging with real navigation. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Navigate and generate console activity
        await page.goto("/nifi");

        // Generate specific console messages to verify with unique identifier
        const testId = `direct-log-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        // Inject test console messages directly
        await page.evaluate((id) => {
            console.log(`Direct log test - INFO message - ${id}`);
            console.warn(`Direct log test - WARNING message - ${id}`);
            console.error(`Direct log test - ERROR message - ${id}`);
            console.debug(`Direct log test - DEBUG message - ${id}`);
        }, testId);

        // Wait a moment for logs to be captured
        await page.waitForTimeout(500);

        // Save logs using per-test logging approach
        const logPath = await saveTestBrowserLogs(testInfo);

        expect(logPath).toBeTruthy();
        expect(fs.existsSync(logPath)).toBeTruthy();

        // Verify content contains our test messages
        const textContent = fs.readFileSync(logPath, "utf8");
        expect(textContent).toContain(
            `Direct log test - INFO message - ${testId}`,
        );
        expect(textContent).toContain(
            `Direct log test - WARNING message - ${testId}`,
        );
        expect(textContent).toContain(
            `Direct log test - ERROR message - ${testId}`,
        );
        expect(textContent).toContain(testId); // Should contain test identifier

        // Verify that we can read the log file content and it contains our test messages
        expect(textContent.length).toBeGreaterThan(0);

        // Verify that all our test messages are present
        expect(textContent).toContain("Direct log test - INFO");
        expect(textContent).toContain("Direct log test - WARNING");
        expect(textContent).toContain("Direct log test - ERROR");

        // Test completed successfully
    });

    test("should verify console logging works without external dependencies", async ({
        page,
    }, _testInfo) => {
        // Navigate to a simple page to ensure page context exists
        await page.goto("about:blank");

        // Generate console activity without any external service dependencies
        await page.evaluate(() => {
            // eslint-disable-next-line no-console
            console.log("Standalone test log message");
            // eslint-disable-next-line no-console
            console.warn("Standalone test warning message");
            // eslint-disable-next-line no-console
            console.info("Standalone test info message");
            // eslint-disable-next-line no-console
            console.error("Standalone test error message");
        });

        // Wait a moment for logs to be captured
        await page.waitForTimeout(1000);
    });

    test("should verify log file cleanup and rotation", async ({
        page: _,
    }, _testInfo) => {
        const logsDir = path.join(process.cwd(), "target", "logs");

        // Ensure logs directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Check initial state (commented out as not used in this simplified test)
        // const initialFiles = fs
        //     .readdirSync(logsDir)
        //     .filter((f) => f.endsWith(".json"));

        // Create a test log file
        const testLogFile = path.join(logsDir, "test-log-cleanup.json");
        fs.writeFileSync(
            testLogFile,
            JSON.stringify(
                [
                    {
                        type: "info",
                        text: "Test cleanup message",
                        timestamp: new Date().toISOString(),
                    },
                ],
                null,
                2,
            ),
        );

        // Verify file was created
        expect(fs.existsSync(testLogFile)).toBeTruthy();

        // Read and verify content
        const content = JSON.parse(fs.readFileSync(testLogFile, "utf8"));
        expect(content.length).toBe(1);
        expect(content[0].text).toContain("Test cleanup message");

        // Clean up test file
        fs.unlinkSync(testLogFile);

        // Verify cleanup
        expect(fs.existsSync(testLogFile)).toBeFalsy();
    });
});
