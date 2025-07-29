/**
 * @file MultiIssuerJWTTokenAuthenticator Advanced Configuration Test
 * Verifies the advanced configuration of the MultiIssuerJWTTokenAuthenticator processor
 * @version 2.0.0
 */

import { test, expect } from "@playwright/test";
import { ProcessorService } from "../utils/processor.js";
import { AuthService } from "../utils/auth-service.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("MultiIssuerJWTTokenAuthenticator Advanced Configuration", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            // Setup auth-aware error detection
            await setupAuthAwareErrorDetection(page, testInfo);

            // Login first before going to JWT UI
            const authService = new AuthService(page);
            await authService.ensureReady();

            await authService.verifyCanvasVisible();
        } catch (error) {
            // Save console logs immediately if beforeEach fails
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                logTestWarning(
                    "beforeEach",
                    `Failed to save console logs during beforeEach error: ${logError.message}`,
                );
            }
            throw error; // Re-throw the original error
        }
    });

    test.afterEach(async ({ page: _page }, testInfo) => {
        // Always try to save console logs first, regardless of test outcome
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }

        // Critical error check is handled by setupAuthAwareErrorDetection

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should access and verify advanced configuration", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Verify advanced configuration elements
        const advancedElements = [
            {
                selector: 'h3:has-text("Issuer Configurations")',
                name: "Issuer Configurations header",
            },
            {
                selector: 'button:has-text("Add Issuer")',
                name: "Add Issuer button",
            },
            {
                selector: 'input[placeholder*="Issuer Name"]',
                name: "Issuer Name input",
            },
            {
                selector: 'button:has-text("Verify Token")',
                name: "Verify Token button",
            },
            {
                selector: 'h3:has-text("Verification Results")',
                name: "Verification Results section",
            },
        ];

        // Verify all required elements are present - no workarounds
        for (const element of advancedElements) {
            const el = customUIFrame.locator(element.selector);
            await expect(el).toBeVisible({
                timeout: 5000,
            });
            processorLogger.info(` ✓ Found: ${element.name}`);
        }

        // Take screenshot of advanced configuration
        await page.screenshot({
            path: `target/test-results/jwt-advanced-configuration-${Date.now()}.png`,
            fullPage: true,
        });
        processorLogger.info("Screenshot of JWT advanced configuration saved");

        // All elements verified - test will fail if any are missing

        // Test actual functionality - try to add an issuer
        const addIssuerButton = customUIFrame.locator(
            'button:has-text("Add Issuer")',
        );
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();
        processorLogger.info("Successfully clicked Add Issuer button");

        // Verify form appears
        const issuerNameInput = customUIFrame.locator(
            'input[placeholder*="Issuer Name"]',
        );
        await expect(issuerNameInput).toBeVisible({ timeout: 5000 });
        processorLogger.info("Add Issuer form appeared successfully");

        processorLogger.success(
            "JWT UI advanced configuration verified with all required elements and functionality tested",
        );
    });
});
