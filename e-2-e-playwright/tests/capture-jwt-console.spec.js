/* eslint-disable no-console */
const { test } = require("@playwright/test");

import { AuthService } from "../utils/auth-service.js";
import {
    setupAuthAwareErrorDetection,
    saveTestBrowserLogs,
} from "../utils/console-logger.js";

test.describe("JWT UI Console Error Capture", () => {
    test("Capture JWT UI Console Errors", async ({ page }, testInfo) => {
        // Setup unified console logging system instead of custom implementation
        // Skip initial canvas checks since JWT UI page doesn't have a canvas
        const errorDetection = await setupAuthAwareErrorDetection(
            page,
            testInfo,
        );

        // First authenticate to NiFi
        console.log("Authenticating to NiFi...");
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Navigate to JWT UI page after authentication
        const jwtUIUrl =
            "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/?id=08e20549-0198-1000-65a2-24abdfb667a2&revision=1&clientId=346173ec-4c73-459a-8a73-91c523fb9162&editable=true&disconnectedNodeAcknowledged=false";

        console.log("Navigating to JWT UI page...");
        await page.goto(jwtUIUrl);

        // Wait for page to load and modules to attempt loading
        await page.waitForTimeout(10000);

        // Check if loading indicator is visible
        const loadingIndicator = page.locator("#loading-indicator");
        const isVisible = await loadingIndicator.isVisible();
        console.log(`\n=== LOADING INDICATOR STATUS ===`);
        console.log(`Loading indicator visible: ${isVisible}`);

        if (isVisible) {
            const text = await loadingIndicator.textContent();
            console.log(`Loading indicator text: "${text}"`);
        }

        // Check for critical errors after navigation (skip canvas checks for JWT UI page)
        // The JWT UI page doesn't have a canvas, so we only check for console errors
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

        // Add JWT UI specific information to the browser console so it gets captured in the unified log
        await page.evaluate(
            (analysisData) => {
                console.log("=== JWT UI ANALYSIS SUMMARY ===");
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
                console.log("=== END JWT UI ANALYSIS ===");
            },
            {
                url: jwtUIUrl,
                loadingIndicatorVisible: isVisible,
                loadingIndicatorText: isVisible
                    ? await loadingIndicator.textContent()
                    : null,
                criticalErrors: criticalErrors.length,
            },
        );

        // Save the captured logs using the unified logging system
        // All console output (including JWT UI analysis) will be in this single unified log
        const logResult = await saveTestBrowserLogs(testInfo);

        if (logResult) {
            console.log("\n=== UNIFIED LOGGING SYSTEM REPORT ===");
            console.log(`Console logs saved to: ${logResult.jsonLog}`);
            console.log(`Human-readable logs saved to: ${logResult.textLog}`);
            console.log(`Total log entries: ${logResult.totalLogs}`);
            console.log(`Test ID: ${logResult.testId}`);
            console.log(
                "JWT UI analysis has been injected into the browser console and captured in the unified log.",
            );
        }

        // Cleanup
        errorDetection.cleanup();
    });
});
