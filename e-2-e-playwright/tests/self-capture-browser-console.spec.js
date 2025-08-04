/* eslint-disable no-console */
import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import {
    checkLoadingIndicatorStatus,
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import {
    globalCriticalErrorDetector,
    cleanupCriticalErrorDetection,
} from "../utils/critical-error-detector.js";

test.describe("Browser Console Error Capture", () => {
    test("should capture and validate browser console errors", async ({
        page,
        processorManager,
    }, testInfo) => {
        // Setup unified console logging system instead of custom implementation
        // Skip initial canvas checks since processor UI page doesn't have a canvas
        await setupAuthAwareErrorDetection(page, testInfo);

        // First authenticate to NiFi
        console.log("Authenticating to NiFi...");
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure processor is on canvas first
        await processorManager.ensureProcessorOnCanvas();

        // Find and open a JWT processor instead of hardcoded URL
        const processorService = new ProcessorService(page, testInfo);
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });
        await processorService.openAdvancedUI(processor);

        // Wait for page to load properly
        await page.waitForLoadState("networkidle");
        await page.waitForLoadState("domcontentloaded");

        // Check if loading indicator is visible using utility function
        const loadingStatus = await checkLoadingIndicatorStatus(page);

        // Loading indicator should NOT be visible - if it is, the UI is stuck
        expect(loadingStatus.isVisible).toBe(false);

        if (loadingStatus.isVisible && loadingStatus.text) {
            throw new Error(
                `UI is stuck with loading indicator: "${loadingStatus.text}"`,
            );
        }

        // Check for critical errors after navigation (skip canvas checks for processor UI page)
        // The processor UI page doesn't have a canvas, so we only check for console errors
        const criticalErrors = globalCriticalErrorDetector.getDetectedErrors();
        if (criticalErrors.length > 0) {
            const jsErrors = criticalErrors.filter(
                (error) =>
                    error.type === "JAVASCRIPT_ERROR" ||
                    error.type === "MODULE_LOADING_ERROR",
            );
            if (jsErrors.length > 0) {
                throw new Error(
                    `Critical JavaScript errors detected: ${jsErrors.map((e) => e.message).join(", ")}`,
                );
            }
        }

        // Add processor UI specific information to the browser console so it gets captured in the unified log
        await page.evaluate(
            (analysisData) => {
                console.log("=== PROCESSOR UI ANALYSIS SUMMARY ===");
                console.log(
                    `Loading indicator visible: ${analysisData.loadingIndicatorVisible}`,
                );
                if (analysisData.loadingIndicatorText) {
                    console.log(
                        `Loading indicator text: "${analysisData.loadingIndicatorText}"`,
                    );
                }
                console.log(
                    `Critical errors detected: ${analysisData.criticalErrors}`,
                );
                console.log("=== END PROCESSOR UI ANALYSIS ===");
            },
            {
                loadingIndicatorVisible: loadingStatus.isVisible,
                loadingIndicatorText: loadingStatus.text,
                criticalErrors: criticalErrors.length,
            },
        );

        // Save the captured logs using the unified logging system
        // All console output (including JWT UI analysis) will be in this single unified log
        const logResult = await saveTestBrowserLogs(testInfo);

        if (logResult) {
            console.log("\n=== UNIFIED LOGGING SYSTEM REPORT ===");
            console.log(`Console logs saved to: ${logResult.textLog}`);
            console.log(`Total log entries: ${logResult.totalLogs}`);
            console.log(`Test ID: ${logResult.testId}`);
            console.log(
                "Processor UI analysis has been injected into the browser console and captured in the unified log.",
            );
        }

        // Cleanup
        cleanupCriticalErrorDetection();
    });
});
