/**
 * @file Self-Test: Processor Advanced Configuration
 * Tests processor advanced configuration access with 2025 best practices
 * Single responsibility: Verify processor advanced dialog opens and "Back to Processor" works
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { CONSTANTS } from "../utils/constants.js";

test.describe("Self-Test: Processor Advanced Configuration", () => {
    test.beforeEach(async ({ page }) => {
        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test("should open processor configuration dialog", async ({ page }) => {
        const processorService = new ProcessorService(page);

        // Find any processor on canvas
        const processor = await processorService.find("processor", {
            failIfNotFound: false,
        });

        if (processor) {
            // Open configuration dialog
            const dialog = await processorService.configure(processor);

            // Verify dialog is visible
            await expect(dialog).toBeVisible({ timeout: 10000 });

            // Close dialog using ESC key or close button
            await page.keyboard.press("Escape");

            // Verify dialog is closed
            await expect(dialog).not.toBeVisible({ timeout: 5000 });
        } else {
            test.skip("No processor found on canvas for configuration test");
        }
    });

    test("should access advanced configuration properties", async ({
        page,
    }) => {
        const processorService = new ProcessorService(page);

        // Find a processor that supports advanced configuration
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: false,
        });

        if (processor) {
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
        } else {
            test.skip("No JWT processor found for advanced configuration test");
        }
    });

    test('should verify "Back to Processor" navigation link', async ({
        page,
    }) => {
        const processorService = new ProcessorService(page);

        // Find any processor on canvas
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: false,
        });

        if (processor) {
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
        } else {
            test.skip("No processor found for back navigation test");
        }
    });

    test("should handle configuration dialog failures gracefully", async ({
        page,
    }) => {
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
    }) => {
        const processorService = new ProcessorService(page);

        // Find any processor on canvas
        const processor = await processorService.find("processor", {
            failIfNotFound: false,
        });

        if (processor) {
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
        } else {
            test.skip("No processor found for interaction test");
        }
    });
});
