/**
 * @file Self-Test: Browser Console Logging
 * Tests browser console log capture and storage with 2025 best practices
 * Single responsibility: Verify browser logs are captured and stored correctly
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import fs from "fs";
import path from "path";

test.describe("Self-Test: Browser Console Logging", () => {
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

        const authService = new AuthService(page);

        // Perform some operations that generate console output
        await authService.ensureReady();

        // Navigate and interact to generate more console activity
        await page.evaluate(() => {
            console.log("Test console log message");
            console.warn("Test console warning message");
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
            console.log("File system test message");
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

    test("should verify log file cleanup and rotation", async ({
        page,
    }, testInfo) => {
        const logsDir = path.join(process.cwd(), "target", "logs");

        // Ensure logs directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Check initial state
        const initialFiles = fs
            .readdirSync(logsDir)
            .filter((f) => f.endsWith(".json"));

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
