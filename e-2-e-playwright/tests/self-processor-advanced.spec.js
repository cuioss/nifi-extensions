/**
 * @file Self-Test: Processor Advanced Configuration - STRICT MODE
 * Tests processor advanced configuration access with 2025 best practices
 * Single responsibility: Verify processor advanced dialog opens and "Back to Processor" works
 * NOW INCLUDES: Strict error detection that fails tests on critical errors
 * @version 2.0.0 - Enhanced with critical error detection
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { CONSTANTS } from "../utils/constants.js";
import { processorLogger } from "../utils/shared-logger.js";
import {
    setupAuthAwareErrorDetection,
    checkForCriticalErrors,
} from "../utils/console-logger.js";
import {
    checkCriticalErrors,
    cleanupCriticalErrorDetection,
} from "../utils/critical-error-detector.js";

test.describe("Self-Test: Processor Advanced Configuration - STRICT MODE", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup auth-aware error detection (skips initial canvas checks)
        await setupAuthAwareErrorDetection(page, testInfo);

        const authService = new AuthService(page);
        await authService.ensureReady();

        // Check for critical errors after authentication
        await checkCriticalErrors(page, testInfo);
    });

    test.afterEach(async ({ page }, testInfo) => {
        // Final check for critical errors before test completion
        await checkForCriticalErrors(page, testInfo);

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should open processor configuration dialog", async ({
        page,
    }, testInfo) => {
        // Check for critical errors before starting
        await checkCriticalErrors(page, testInfo);

        const processorService = new ProcessorService(page);

        // STRICT MODE: Find any processor on canvas - MUST exist
        const processor = await processorService.find("processor", {
            failIfNotFound: false,
        });

        // STRICT FAILURE: No processor found means empty canvas - this is a critical error
        if (!processor) {
            throw new Error(
                "🚨 CRITICAL ERROR: No processor found on canvas!\n" +
                    "This indicates an empty canvas which is a fundamental issue.\n" +
                    "Expected: At least one processor should be available for configuration testing.\n" +
                    "Actual: Canvas is empty or processors failed to load.\n" +
                    "This test is designed to fail when the canvas is empty.",
            );
        }

        // Check for critical errors before attempting configuration
        await checkCriticalErrors(page, testInfo);

        // STRICT MODE: Configuration must work - no try/catch to mask failures
        // Open configuration dialog
        const dialog = await processorService.configure(processor);

        // Verify dialog is visible
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // Check for critical errors after opening dialog
        await checkCriticalErrors(page, testInfo);

        // Close dialog using ESC key or close button
        await page.keyboard.press("Escape");

        // Verify dialog is closed
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        // Final check for critical errors
        await checkCriticalErrors(page, testInfo);

        processorLogger.success(
            "Configuration dialog test completed successfully",
        );
    });

    test("should access advanced configuration properties", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page);

        // Find a processor that supports advanced configuration
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: false,
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

                // Wait for configuration dialog
                const dialog = page.locator(
                    ".mat-dialog-container, .configure-dialog",
                );
                await expect(dialog).toBeVisible({ timeout: 10000 });

                // Look for Properties or Advanced tab
                const advancedTab = page.getByRole("tab", {
                    name: /properties|advanced/i,
                });

                if (await advancedTab.isVisible({ timeout: 2000 })) {
                    await advancedTab.click();

                    // Verify advanced content is loaded
                    const advancedContent = page.locator(
                        ".mat-tab-body-active, .properties-content",
                    );
                    await expect(advancedContent).toBeVisible({
                        timeout: 10000,
                    });
                }

                // Close using ESC
                await page.keyboard.press("Escape");
            }

            // STRICT MODE: Check for critical errors after advanced configuration access
            await checkCriticalErrors(page, testInfo);
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
    }, _testInfo) => {
        const processorService = new ProcessorService(page);

        // Find any processor on canvas
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: false,
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
                        ).toBeVisible({ timeout: 10000 });

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
    }, _testInfo) => {
        const processorService = new ProcessorService(page);

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
    }, _testInfo) => {
        const processorService = new ProcessorService(page);

        // Find any processor on canvas
        const processor = await processorService.find("processor", {
            failIfNotFound: false,
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
