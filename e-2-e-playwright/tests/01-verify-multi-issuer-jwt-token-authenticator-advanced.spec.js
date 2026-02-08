/**
 * @file MultiIssuerJWTTokenAuthenticator Advanced Configuration Test
 * Verifies the advanced configuration of the MultiIssuerJWTTokenAuthenticator processor
 * @version 2.0.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { ProcessorService } from "../utils/processor.js";
import { AuthService } from "../utils/auth-service.js";

test.describe("MultiIssuerJWTTokenAuthenticator Advanced Configuration", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        // Login first before going to JWT UI
        const authService = new AuthService(page);
        await authService.ensureReady();

        await authService.verifyCanvasVisible();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
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
        const advancedOpened = await processorService.openAdvancedUI(processor);

        if (!advancedOpened) {
            throw new Error("Failed to open Advanced UI via right-click menu");
        }

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Could not find custom UI iframe");
        }

        // Verify advanced configuration elements on the Configuration tab
        const configTabElements = [
            {
                selector: 'h2:has-text("Issuer Configurations")',
                name: "Issuer Configurations header",
            },
            {
                selector: 'button:has-text("Add Issuer")',
                name: "Add Issuer button",
            },
        ];

        // Verify all required elements are present - no workarounds
        for (const element of configTabElements) {
            const el = customUIFrame.locator(element.selector);
            await expect(el).toBeVisible({
                timeout: 5000,
            });
        }

        // Take screenshot of advanced configuration
        await page.screenshot({
            path: `${testInfo.outputDir}/jwt-advanced-configuration.png`,
            fullPage: true,
        });

        // All elements verified - test will fail if any are missing

        // Test actual functionality - try to add an issuer
        const addIssuerButton = customUIFrame.locator(
            'button:has-text("Add Issuer")',
        );
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        // Wait for form to appear and check for new issuer name input
        await page.waitForTimeout(1000); // Give form time to render

        // Count issuer inputs to see if a new one was added
        const issuerInputCount = await customUIFrame
            .locator("input.issuer-name")
            .count();

        if (issuerInputCount > 0) {
            // Try to interact with the last (newest) input
            const lastInput = customUIFrame.locator("input.issuer-name").last();
            if (await lastInput.isVisible()) {
                await lastInput.fill("test-issuer");
            }
        }
    });
});
