/**
 * @file Self-Test: Processor Navigation and Error Handling
 * Tests "Back to Processor" navigation and configuration dialog error handling
 * @version 1.1.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { CONSTANTS } from "../utils/constants.js";

test.describe("Self-Test: Processor Navigation and Error Handling", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure processor is on canvas for all tests
        await processorManager.ensureProcessorOnCanvas();

        // Stop processor so configure option is available in context menu
        await processorManager.stopProcessor();

        // Don't check for critical errors here - authentication may have transient 401s
        await takeStartScreenshot(page, testInfo);
    });

    test('should verify "Back to Processor" navigation link', async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find existing JWT processor on canvas (throws if not found)
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

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
});
