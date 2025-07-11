/**
 * @file Minimal Processor Test
 * A minimal test that only adds a processor to the canvas
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { addJwtTokenAuthenticator } from "../utils/processor-tool";
import { ensureNiFiReady } from "../utils/login-tool";
import { PROCESSOR_TYPES, PAGE_TYPES } from "../utils/constants";
import { verifyPageType } from "../utils/navigation-tool";

test.describe("Minimal Processor Test", () => {
    // Make sure we're logged in before the test
    test.beforeEach(async ({ page }) => {
        await ensureNiFiReady(page);
    });

    test("should add a JWT Token Authenticator processor", async ({ page }) => {
        // Verify the canvas is ready
        await verifyPageType(page, PAGE_TYPES.MAIN_CANVAS, {
            waitForReady: true,
        });

        // Add the JWT Token Authenticator processor
        const processor = await addJwtTokenAuthenticator(page);

        // Verify processor was added successfully
        expect(
            processor,
            "JWT Token Authenticator should be added",
        ).toBeTruthy();
        expect(processor.type).toBe(PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR);
        expect(processor.isVisible).toBeTruthy();
    });

    // Clean up after the test to ensure a clean canvas
    test.afterEach(async ({ page }) => {
        try {
            // Try to remove the processor if it exists
            const processor = await page.$(
                `text=${PROCESSOR_TYPES.JWT_TOKEN_AUTHENTICATOR}`,
            );
            if (processor) {
                // Right-click on the processor to open context menu
                await processor.click({ button: "right" });

                // Find and click the Delete option
                const deleteOption = await page.$(
                    'mat-menu-item:has-text("Delete"), .mat-menu-item:has-text("Delete")',
                );
                if (deleteOption) {
                    await deleteOption.click();

                    // Confirm deletion if a dialog appears
                    const confirmButton = await page.$(
                        'button:has-text("Delete"), .mat-button:has-text("Delete")',
                    );
                    if (confirmButton) {
                        await confirmButton.click();
                    }
                }
            }
        } catch (error) {
            // Use a more appropriate logging mechanism
            // eslint-disable-next-line no-console
            console.log(`Cleanup error: ${error.message}`);
        }
    });
});
