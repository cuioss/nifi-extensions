/**
 * @file Verify JWT Custom UI Tabs
 * Verifies the custom UI implementation for the MultiIssuerJWTTokenAuthenticator processor
 * @version 1.0.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("JWT Custom UI Tabs Verification", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should display all four tabs in custom UI", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find existing JWT processor on canvas
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        if (!processor) {
            throw new Error("No JWT processor found on canvas");
        }

        // Open Advanced UI using the verified navigation pattern
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame");
        }

        // Take screenshot of the custom UI
        await page.screenshot({
            path: `${testInfo.outputDir}/jwt-custom-ui-tabs.png`,
            fullPage: true,
        });

        // Check for tab container in the iframe
        const tabContainer = customUIFrame.locator(
            '[data-testid="jwt-config-tabs"]',
        );
        const isTabContainerVisible = await tabContainer.isVisible({
            timeout: 5000,
        });

        if (isTabContainerVisible) {
            // Verify all four tabs are present
            const expectedTabs = [
                {
                    name: "Configuration",
                    selector: 'a[href="#issuer-config"]',
                },
                {
                    name: "Token Verification",
                    selector: 'a[href="#token-verification"]',
                },
                { name: "Metrics", selector: 'a[href="#metrics"]' },
                { name: "Help", selector: 'a[href="#help"]' },
            ];

            let tabsFound = 0;
            for (const tab of expectedTabs) {
                const tabLink = customUIFrame.locator(tab.selector);
                await expect(tabLink).toBeVisible({ timeout: 5000 });
                tabsFound++;

                // Click on the tab to verify it works
                await tabLink.click();
                await page.waitForTimeout(500);

                // Take screenshot of each tab
                await page.screenshot({
                    path: `${testInfo.outputDir}/jwt-tab-${tab.name.toLowerCase().replace(/\s+/g, "-")}.png`,
                    fullPage: true,
                });
            }

            expect(tabsFound).toBe(4);
        } else {
            throw new Error(
                "Tab container with data-testid='jwt-config-tabs' not found in JWT Custom UI",
            );
        }
    });

    test("should verify tab content functionality", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find existing JWT processor on canvas
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        if (!processor) {
            throw new Error("No JWT processor found on canvas");
        }

        // Open Advanced UI using the verified navigation pattern
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame");
        }

        // Test specific tab content
        // Configuration tab (should be active by default)
        const addIssuerButton = customUIFrame.locator(
            'button:has-text("Add Issuer")',
        );
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });

        // Token Verification tab
        const tokenVerificationTab = customUIFrame.locator(
            'a[href="#token-verification"]',
        );
        await expect(tokenVerificationTab).toBeVisible({ timeout: 5000 });
        await tokenVerificationTab.click();
        await page.waitForTimeout(500);

        const verifyButton = customUIFrame
            .locator('button:has-text("Verify Token")')
            .first();
        await expect(verifyButton).toBeVisible({ timeout: 5000 });

        // Metrics tab
        const metricsTab = customUIFrame.locator('a[href="#metrics"]');
        await expect(metricsTab).toBeVisible({ timeout: 5000 });
        await metricsTab.click();
        await page.waitForTimeout(1000); // Give more time for metrics to load

        // Look for any metrics content instead of specific button
        const metricsContent = customUIFrame.locator("#metrics").first();
        await expect(metricsContent).toBeVisible({ timeout: 5000 });

        // Help tab
        const helpTab = customUIFrame.locator('a[href="#help"]');
        await expect(helpTab).toBeVisible({ timeout: 5000 });
        await helpTab.click();
        await page.waitForTimeout(1000); // Give more time for help content to load

        // Look for any help content
        const helpContent = customUIFrame.locator("#help").first();
        await expect(helpContent).toBeVisible({ timeout: 5000 });

        // Verify the Help tab title is properly translated (not showing the i18n key)
        const helpTitle = customUIFrame.locator("#help h3, #help h2").first();
        const helpTitleText = await helpTitle.textContent();
        expect(helpTitleText).not.toContain("jwt.validator.help.title");
        expect(helpTitleText).toMatch(
            /JWT Authenticator Help|JWT-Authentifikator-Hilfe/,
        );

        // Go back to Metrics tab to verify its title
        await metricsTab.click();
        await page.waitForTimeout(500);

        const metricsTitle = customUIFrame
            .locator("#metrics h3, #metrics h2")
            .first();
        const metricsTitleText = await metricsTitle.textContent();
        expect(metricsTitleText).not.toContain("jwt.validator.metrics.title");
        expect(metricsTitleText).toMatch(
            /JWT Validation Metrics|JWT-Validierungsmetriken/,
        );
    });
});
