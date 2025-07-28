/* eslint-disable no-console */
import { test } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import {
    checkLoadingIndicatorStatus,
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";

test.describe("Browser Console Error Capture", () => {
    test("Capture Browser Console Errors", async ({ page }, testInfo) => {
        // Setup unified console logging system instead of custom implementation
        // Skip initial canvas checks since processor UI page doesn't have a canvas
        const errorDetection = await setupAuthAwareErrorDetection(
            page,
            testInfo,
        );

        // First authenticate to NiFi
        console.log("Authenticating to NiFi...");
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Navigate to processor UI page after authentication
        const processorUIUrl =
            "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/?id=08e20549-0198-1000-65a2-24abdfb667a2&revision=1&clientId=346173ec-4c73-459a-8a73-91c523fb9162&editable=true&disconnectedNodeAcknowledged=false";

        console.log("Navigating to processor UI page...");
        await page.goto(processorUIUrl);

        // Wait for page to load and modules to attempt loading
        await page.waitForTimeout(10000);

        // Check if loading indicator is visible using utility function
        const loadingStatus = await checkLoadingIndicatorStatus(page);
        console.log(`\n=== LOADING INDICATOR STATUS ===`);
        console.log(`Loading indicator visible: ${loadingStatus.isVisible}`);

        if (loadingStatus.isVisible && loadingStatus.text) {
            console.log(`Loading indicator text: "${loadingStatus.text}"`);
        }

        // Check for critical errors after navigation (skip canvas checks for processor UI page)
        // The processor UI page doesn't have a canvas, so we only check for console errors
        const criticalErrors = errorDetection.getCriticalErrors();
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
                console.log(`URL: ${analysisData.url}`);
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
                url: processorUIUrl,
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
        errorDetection.cleanup();
    });
});
