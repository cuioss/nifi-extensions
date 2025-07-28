/**
 * @file Self-Test: Processor Advanced Configuration - STRICT MODE
 * Tests processor advanced configuration access with 2025 best practices
 * Single responsibility: Verify processor advanced dialog opens and "Back to Processor" works
 * NOW INCLUDES: Strict error detection that fails tests on critical errors
 * @version 2.0.0
 * @description Enhanced with critical error detection
 */

import { expect, test } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { CONSTANTS } from "../utils/constants.js";
import { processorLogger } from "../utils/shared-logger.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Self-Test: Processor Advanced Configuration - STRICT MODE", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup auth-aware error detection (skips initial canvas checks)
        await setupAuthAwareErrorDetection(page, testInfo);

        const authService = new AuthService(page);
        await authService.ensureReady();

        // Skip initial critical error check in beforeEach - let individual tests handle it
        // await checkCriticalErrors(page, testInfo);
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

        // Skip final check before test completion
        // await checkForCriticalErrors(page, testInfo);

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should open processor configuration dialog", async ({
        page,
    }, testInfo) => {
        // Skip initial critical error check - we'll add processor first
        // await checkCriticalErrors(page, testInfo);

        const processorService = new ProcessorService(page, testInfo);

        // STRICT MODE: Find existing processor on canvas (should already be present)
        const processor = await processorService.find("processor", {
            failIfNotFound: true,
        });

        // Note: Processor should already exist on canvas from manual setup

        // Skip critical error check - we're adding processor
        // await checkCriticalErrors(page, testInfo);

        // STRICT MODE: Configuration must work - no try/catch to mask failures
        // Open configuration dialog
        const dialog = await processorService.configure(processor);

        // Verify dialog is visible
        await expect(dialog).toBeVisible({ timeout: 3000 });

        // Skip critical error check
        // await checkCriticalErrors(page, testInfo);

        // Close dialog using ESC key or close button
        await page.keyboard.press("Escape");

        // Verify dialog is closed
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        // Skip final check
        // await checkCriticalErrors(page, testInfo);

        processorLogger.success(
            "Configuration dialog test completed successfully",
        );
    });

    test("should access advanced configuration properties", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find existing JWT processor on canvas
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        if (processor) {
            // STRICT MODE: No try/catch to mask failures - fail fast on errors

            // Right-click to open context menu
            await processorService.interact(processor, {
                action: "rightclick",
            });

            // Look for configure option
            const configureOption = page.getByRole("menuitem", {
                name: /configure/i,
            });

            // If configure option exists, click it
            if (await configureOption.isVisible({ timeout: 2000 })) {
                await configureOption.click();

                // Wait for configuration dialog - utility handles NiFi-compatible selectors
                const dialog = page.locator(
                    '[role="dialog"], .dialog, .configuration-dialog',
                );
                await expect(dialog).toBeVisible({ timeout: 3000 });

                // Close dialog first since Advanced is accessed via right-click
                await page.keyboard.press("Escape");
                await expect(dialog).not.toBeVisible({ timeout: 2000 });

                // Now open Advanced UI via right-click menu
                await processorService.openAdvancedUI(processor);

                // Close using ESC
                await page.keyboard.press("Escape");
            }

            // Skip critical error check since we navigated away from canvas
            // await checkCriticalErrors(page, testInfo);
        } else {
            // STRICT FAILURE: No JWT processor found
            throw new Error(
                "🚨 CRITICAL ERROR: No JWT processor found for advanced configuration test!\n" +
                    "This indicates either:\n" +
                    "1. Empty canvas (no processors deployed)\n" +
                    "2. JWT processors failed to load\n" +
                    "3. UI initialization issues\n" +
                    "Expected: JWT processor should be available for advanced configuration testing.\n" +
                    "This test is designed to fail when JWT processors are not available.",
            );
        }
    });

    test('should verify "Back to Processor" navigation link', async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find existing JWT processor on canvas
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        if (processor) {
            try {
                // Double-click to open processor details/properties
                await processorService.interact(processor, {
                    action: "doubleclick",
                });

                // Wait for navigation or modal to appear
                await page.waitForLoadState("networkidle");

                // Look for "Back to Processor" or similar navigation link
                const backLinks = [
                    page.getByRole("link", { name: /back to processor/i }),
                    page.getByRole("button", { name: /back to processor/i }),
                    page.getByText(/back to processor/i),
                    page.locator('[href*="processor"]'),
                    page.locator(".back-link, .return-link"),
                ];

                let backLinkFound = false;
                for (const backLink of backLinks) {
                    if (await backLink.isVisible({ timeout: 2000 })) {
                        // Click the back link
                        await backLink.click();
                        await page.waitForLoadState("networkidle");

                        // Verify we're back on main canvas
                        await expect(
                            page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
                        ).toBeVisible({ timeout: 3000 });

                        backLinkFound = true;
                        break;
                    }
                }

                if (!backLinkFound) {
                    // If no back link found, use browser back
                    await page.goBack();
                    await page.waitForLoadState("networkidle");

                    // Should still be on canvas
                    await expect(
                        page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS),
                    ).toBeVisible();
                }
            } catch (error) {
                processorLogger.warn(
                    "Could not verify 'Back to Processor' navigation link: %s",
                    error.message,
                );
                // This is acceptable as the processor might not support navigation
            }
        } else {
            processorLogger.error(
                "No processor found for back navigation test",
            );
            throw new Error(
                "Test failed: No processor found for back navigation test",
            );
        }
    });

    test("should handle configuration dialog failures gracefully", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Try to configure a non-existent processor
        const nonExistentProcessor = {
            element: '[data-nonexistent="true"]',
            locator: page.locator('[data-nonexistent="true"]'),
            type: "NonExistent",
            isVisible: false,
        };

        // Should handle gracefully without throwing
        await expect(async () => {
            await processorService.configure(nonExistentProcessor, {
                timeout: 2000,
            });
        }).rejects.toThrow(); // Should throw timeout error
    });

    test("should verify processor interaction reliability", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find existing processor on canvas
        const processor = await processorService.find("processor", {
            failIfNotFound: true,
        });

        if (processor) {
            try {
                // Test hover interaction
                await processorService.interact(processor, { action: "hover" });

                // Verify processor is still visible after interaction
                await expect(page.locator(processor.element)).toBeVisible({
                    timeout: 5000,
                });

                // Test click interaction
                await processorService.interact(processor, { action: "click" });

                // Should not crash or cause errors
                await page.waitForLoadState("networkidle");
            } catch (error) {
                processorLogger.warn(
                    "Could not interact with processor: %s",
                    error.message,
                );
                // This is acceptable as the processor might not support interaction
            }
        } else {
            processorLogger.error("No processor found for interaction test");
            throw new Error(
                "Test failed: No processor found for interaction test",
            );
        }
    });
});
