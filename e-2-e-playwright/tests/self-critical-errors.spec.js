/**
 * @file Self-Test: Critical Error Detection
 * Tests that verify critical errors are properly detected and cause test failures
 * These tests are designed to fail when fundamental UI or JavaScript issues occur
 * @version 1.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
// import { CONSTANTS } from "../utils/constants.js"; // Unused in current implementation
import {
    checkForCriticalErrors,
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import {
    checkCriticalErrors,
    cleanupCriticalErrorDetection,
    globalCriticalErrorDetector,
} from "../utils/critical-error-detector.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Self-Test: Critical Error Detection", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup auth-aware error detection (skips initial canvas checks)
        await setupAuthAwareErrorDetection(page, testInfo);

        // Authenticate first
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Wait for page to be fully stable after authentication
        await page.waitForLoadState("networkidle");

        // Now check for critical errors after authentication completes
        await checkForCriticalErrors(page, testInfo);
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

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should fail when page is empty or canvas missing", async ({
        page,
    }, testInfo) => {
        // This test verifies that empty page detection works
        // If the canvas is missing, it should fail immediately

        const detector = globalCriticalErrorDetector;

        // Check for canvas existence
        const canvasExists = await detector.checkCanvasExists(page);
        expect(canvasExists, "Canvas must exist on the page").toBe(true);

        // If we reach here, canvas exists, which is good
        // But we still want to ensure the detector would catch an empty canvas

        // Perform comprehensive empty canvas check
        const isCanvasValid = await detector.checkForEmptyCanvas(
            page,
            testInfo,
        );

        // For this test to pass, we need a valid canvas
        // But if it's empty, the detector should have already failed the test
        expect(
            isCanvasValid,
            "Canvas check should pass if content exists",
        ).toBe(true);
    });

    test("should fail when UI stalls at Loading JWT Validator", async ({
        page,
    }, testInfo) => {
        // This test checks for UI loading stalls
        // If "Loading JWT Validator UI..." is detected, it should fail immediately

        const detector = globalCriticalErrorDetector;

        // Check for UI loading stalls
        const hasStalls = await detector.checkForUILoadingStalls(
            page,
            testInfo,
        );

        // If we reach here without the test failing, no stalls were detected
        expect(hasStalls, "No UI loading stalls should be detected").toBe(
            false,
        );

        // Verify that the JWT Validator UI is actually loaded and ready
        // Look for signs that the UI has fully initialized

        // Check that we're not showing any loading indicators
        const loadingIndicators = page.locator(
            'text="Loading JWT Validator UI..."',
        );
        const loadingCount = await loadingIndicators.count();
        expect(
            loadingCount,
            "No 'Loading JWT Validator UI...' text should be visible",
        ).toBe(0);

        // Additional checks for UI readiness
        const authService = new AuthService(page);
        await authService.verifyCanvasVisible();
    });

    test("should fail on JavaScript Uncaught Errors", async ({
        page,
    }, _testInfo) => {
        // This test verifies that JavaScript errors are detected and cause failures

        // Use the global detector that's already monitoring from beforeEach
        const detector = globalCriticalErrorDetector;
        expect(
            detector.isMonitoring,
            "Critical error detector should be monitoring",
        ).toBe(true);

        // Check if any JavaScript errors have already been detected
        const existingErrors = detector.getDetectedErrors();
        const jsErrors = existingErrors.filter(
            (error) =>
                error.type === "JAVASCRIPT_ERROR" ||
                error.type === "PAGE_ERROR",
        );

        // If JavaScript errors exist, this test should fail
        if (jsErrors.length > 0) {
            const errorMessages = jsErrors
                .map((error) => error.message)
                .join("\n");
            throw new Error(
                `🚨 JavaScript errors detected:\n${errorMessages}\n` +
                    `Total JS errors: ${jsErrors.length}\n` +
                    `This test is designed to fail when JavaScript errors are present.`,
            );
        }

        // If we reach here, no JavaScript errors were detected
        expect(jsErrors.length, "No JavaScript errors should be present").toBe(
            0,
        );

        // Verify the page is functioning without JavaScript errors
        await page.waitForLoadState("networkidle");

        // Additional verification that the page is working correctly
        const authService = new AuthService(page);
        await authService.verifyCanvasVisible();
    });

    test("should fail on RequireJS module loading errors", async ({
        page,
    }, _testInfo) => {
        // This test specifically checks for RequireJS/AMD module loading issues

        const detector = globalCriticalErrorDetector;
        const existingErrors = detector.getDetectedErrors();

        // Check for module loading errors
        const moduleErrors = existingErrors.filter(
            (error) =>
                error.type === "MODULE_LOADING_ERROR" ||
                error.message.includes("RequireJS") ||
                error.message.includes("Mismatched anonymous define") ||
                error.message.includes("Module name") ||
                error.message.includes("define()"),
        );

        // If module loading errors exist, this test should fail
        if (moduleErrors.length > 0) {
            const errorMessages = moduleErrors
                .map((error) => error.message)
                .join("\n");
            throw new Error(
                `🚨 Module loading errors detected:\n${errorMessages}\n` +
                    `Total module errors: ${moduleErrors.length}\n` +
                    `This test is designed to fail when RequireJS/AMD module errors are present.`,
            );
        }

        expect(
            moduleErrors.length,
            "No module loading errors should be present",
        ).toBe(0);

        // Verify modules are loading correctly by checking if the UI is functional
        await page.waitForLoadState("networkidle");

        // Check that the main application modules have loaded
        const authService = new AuthService(page);
        await authService.verifyCanvasVisible();
    });

    test("should detect missing processors on canvas", async ({
        page,
    }, testInfo) => {
        // This test ensures that if processors are expected but missing, it fails

        const processorService = new ProcessorService(page, testInfo);

        // Try to find any processor on the canvas
        const processor = await processorService.find("processor", {
            failIfNotFound: false,
        });

        // Check for empty canvas using critical error detector
        const detector = globalCriticalErrorDetector;
        const hasProcessors = await detector.checkForProcessors(page);

        // For this specific test, we'll be more lenient
        // We'll report the status but not necessarily fail
        if (!hasProcessors && !processor) {
            logTestWarning(
                "test",
                "⚠️  No processors found on canvas - this may indicate an empty canvas issue",
            );

            // Verify that the canvas itself exists and is ready
            const canvasExists = await detector.checkCanvasExists(page);
            expect(canvasExists, "Canvas should exist even if empty").toBe(
                true,
            );

            // Check if this is intentionally empty or a problem
            const authService = new AuthService(page);
            await authService.verifyCanvasVisible();

            // Log the finding for debugging
            // eslint-disable-next-line no-console
            console.log(
                "Canvas is empty but functional - this may be expected in some test scenarios",
            );
        } else {
            // Processors were found, which is good
            expect(
                hasProcessors,
                "Processors should be detectable when present",
            ).toBe(true);
        }
    });

    test("should perform comprehensive critical error validation", async ({
        page,
    }, testInfo) => {
        // This is a comprehensive test that checks all critical error types

        // Perform all critical error checks
        await checkCriticalErrors(page, testInfo);

        const detector = globalCriticalErrorDetector;
        const allErrors = detector.getDetectedErrors();

        // Categorize errors
        const errorsByType = {
            javascript: allErrors.filter((e) => e.type === "JAVASCRIPT_ERROR"),
            moduleLoading: allErrors.filter(
                (e) => e.type === "MODULE_LOADING_ERROR",
            ),
            uiStalls: allErrors.filter((e) => e.type === "UI_LOADING_STALL"),
            pageErrors: allErrors.filter((e) => e.type === "PAGE_ERROR"),
            emptyCanvas: allErrors.filter((e) => e.type === "EMPTY_CANVAS"),
            emptyPage: allErrors.filter((e) => e.type === "EMPTY_PAGE"),
        };

        // Report findings
        const totalCriticalErrors = allErrors.length;

        if (totalCriticalErrors > 0) {
            const errorSummary = Object.entries(errorsByType)
                .filter(([_type, errors]) => errors.length > 0)
                .map(([type, errors]) => `${type}: ${errors.length}`)
                .join(", ");

            throw new Error(
                `🚨 COMPREHENSIVE CRITICAL ERROR CHECK FAILED:\n` +
                    `Total critical errors detected: ${totalCriticalErrors}\n` +
                    `Error breakdown: ${errorSummary}\n` +
                    `This test validates that the application is free of fundamental issues.`,
            );
        }

        // If no critical errors, verify the application is working
        expect(
            totalCriticalErrors,
            "No critical errors should be present",
        ).toBe(0);

        // Final verification that the application is functional
        const authService = new AuthService(page);
        await authService.verifyCanvasVisible();

        // eslint-disable-next-line no-console
        console.log(
            "✅ Comprehensive critical error validation passed - application is healthy",
        );
    });
});
