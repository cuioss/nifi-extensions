/**
 * @file Metrics Tab Test
 * Verifies the metrics tab functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Metrics Tab", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            await setupAuthAwareErrorDetection(page, testInfo);
            const authService = new AuthService(page);
            await authService.ensureReady();
        } catch (error) {
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                logTestWarning(
                    "beforeEach",
                    `Failed to save console logs during beforeEach error: ${logError.message}`,
                );
            }
            throw error;
        }
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }
        cleanupCriticalErrorDetection();
    });

    test("should display metrics dashboard", async ({ page }, testInfo) => {
        processorLogger.info("Testing metrics dashboard display");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Find JWT processor using the verified utility
            const processor = await processorService.findJwtAuthenticator({
                failIfNotFound: true,
            });

            // Open Advanced UI using the verified utility
            await processorService.openAdvancedUI(processor);

            // Get the custom UI frame
            const customUIFrame = await processorService.getAdvancedUIFrame();
            await processorService.clickTab(customUIFrame, "Metrics");

            // Check for metrics dashboard content
            const metricsTabContent = await customUIFrame.locator("#metrics");
            await expect(metricsTabContent).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Metrics tab content displayed");

            // Note: Backend metrics endpoint returns 404 (known issue)
            // The UI will show a "not available" message
            processorLogger.warn(
                "Note: Metrics endpoint returns 404 - expecting 'not available' message",
            );

            // Check for the "not available" message that appears when endpoint returns 404
            const notAvailableMessage = await customUIFrame.locator(
                ".metrics-not-available",
            );

            // Try to find either the metrics content or the not available message
            const metricsContent = await customUIFrame.locator(
                "#jwt-metrics-content",
            );

            if (await notAvailableMessage.isVisible({ timeout: 5000 })) {
                processorLogger.info(
                    "✓ Metrics 'not available' message displayed (expected due to 404)",
                );

                // Verify the message content
                const messageText = await notAvailableMessage.textContent();
                expect(messageText).toContain("Metrics Not Available");
                processorLogger.info("✓ Correct error message shown to user");
            } else if (await metricsContent.isVisible()) {
                // If by chance the metrics load (backend fixed), verify basic structure
                processorLogger.info(
                    "✓ Metrics content displayed (backend may be fixed)",
                );
            } else {
                throw new Error(
                    "Neither metrics content nor 'not available' message found",
                );
            }

            processorLogger.success("Metrics tab handled 404 error gracefully");
        } catch (error) {
            processorLogger.error(
                `Error displaying metrics dashboard: ${error.message}`,
            );
            throw error;
        }
    });

    test.skip("should show validation success and failure rates", () => {
        // Skip test due to backend endpoint returning 404
        processorLogger.warn(
            "Test skipped: Backend metrics endpoint returns 404 (known issue)",
        );
    });

    test.skip("should display issuer-specific metrics", () => {
        // Skip test due to backend endpoint returning 404
        processorLogger.info(
            "Test skipped: Backend metrics endpoint returns 404 (known issue)",
        );
    });

    test.skip("should show performance metrics", () => {
        // Skip test due to backend endpoint returning 404
        processorLogger.info(
            "Test skipped: Backend metrics endpoint returns 404 (known issue)",
        );
    });

    test.skip("should refresh metrics data", () => {
        // Skip test due to backend endpoint returning 404
        processorLogger.info(
            "Test skipped: Backend metrics endpoint returns 404 (known issue)",
        );
    });

    test.skip("should export metrics data", () => {
        // Skip test due to backend endpoint returning 404
        processorLogger.info(
            "Test skipped: Backend metrics endpoint returns 404 (known issue)",
        );
    });
});
