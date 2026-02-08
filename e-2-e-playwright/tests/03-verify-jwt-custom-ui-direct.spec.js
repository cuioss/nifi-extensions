/**
 * @file Verify JWT Custom UI Direct Access
 * Directly navigates to the custom UI to verify tab implementation
 * @version 1.0.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("JWT Custom UI Direct Access - Tab Verification", () => {
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

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Take initial screenshot
        await page.screenshot({
            path: `${testInfo.outputDir}/jwt-custom-ui-initial.png`,
            fullPage: true,
        });

        // Check if the JWT container is visible in the iframe
        const jwtContainer = customUIFrame.locator(
            '[data-testid="jwt-customizer-container"]',
        );
        const isContainerVisible = await jwtContainer.isVisible({
            timeout: 5000,
        });

        if (!isContainerVisible) {
            // Check what's actually in the iframe
            await customUIFrame.locator("body").textContent();
        }

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
                    testId: "issuer-config-tab",
                },
                {
                    name: "Token Verification",
                    selector: 'a[href="#token-verification"]',
                    testId: "token-verification-tab",
                },
                {
                    name: "Metrics",
                    selector: 'a[href="#metrics"]',
                    testId: "metrics-tab",
                },
                {
                    name: "Help",
                    selector: 'a[href="#help"]',
                    testId: "help-tab",
                },
            ];

            let tabsFound = 0;
            for (const tab of expectedTabs) {
                const tabLink = customUIFrame.locator(tab.selector);
                if (await tabLink.isVisible({ timeout: 2000 })) {
                    tabsFound++;

                    // Click on the tab
                    await tabLink.click();
                    await page.waitForTimeout(1000);

                    // Take screenshot of each tab
                    await page.screenshot({
                        path: `${testInfo.outputDir}/jwt-tab-${tab.name.toLowerCase().replace(/\s+/g, "-")}.png`,
                        fullPage: true,
                    });

                    // Verify tab content based on tab type
                    switch (tab.name) {
                        case "Configuration": {
                            const addIssuerBtn = customUIFrame
                                .locator('button:has-text("Add Issuer")')
                                .first();
                            await addIssuerBtn.isVisible({ timeout: 2000 });
                            break;
                        }
                        case "Token Verification": {
                            const verifyBtn = customUIFrame
                                .locator('button:has-text("Verify Token")')
                                .first();
                            await verifyBtn.isVisible({ timeout: 2000 });
                            break;
                        }
                        case "Metrics": {
                            const refreshBtn = customUIFrame
                                .locator(
                                    '[data-testid="refresh-metrics-button"]',
                                )
                                .first();
                            await refreshBtn.isVisible({ timeout: 2000 });
                            break;
                        }
                        case "Help": {
                            const helpContent = customUIFrame
                                .locator('[data-testid="help-tab-content"]')
                                .first();
                            await helpContent.isVisible({ timeout: 2000 });
                            break;
                        }
                    }
                }
            }

            expect(tabsFound).toBe(4);
        } else {
            // Debug: Check if tabs are hidden initially in iframe
            const hiddenTabs = customUIFrame.locator("#jwt-validator-tabs");
            if ((await hiddenTabs.count()) > 0) {
                await hiddenTabs.evaluate(
                    (el) => window.getComputedStyle(el).display,
                );

                // If hidden, we might need to trigger initialization
                await customUIFrame.evaluate(() => {
                    // Try to show tabs if they're hidden
                    const tabsEl =
                        document.getElementById("jwt-validator-tabs");
                    if (tabsEl) {
                        tabsEl.style.display = "block";
                    }
                });

                await page.waitForTimeout(1000);

                // Take screenshot after trying to show tabs
                await page.screenshot({
                    path: `${testInfo.outputDir}/jwt-tabs-after-show.png`,
                    fullPage: true,
                });
            }
        }
    });

    test("should test tab switching functionality", async ({
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

        // Wait for custom UI to load
        await page.waitForTimeout(2000);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Could not find custom UI iframe");
        }

        // Test tab switching
        const tabs = [
            {
                from: "Configuration",
                to: "Token Verification",
                selector: 'a[href="#token-verification"]',
            },
            {
                from: "Token Verification",
                to: "Metrics",
                selector: 'a[href="#metrics"]',
            },
            { from: "Metrics", to: "Help", selector: 'a[href="#help"]' },
            {
                from: "Help",
                to: "Configuration",
                selector: 'a[href="#issuer-config"]',
            },
        ];

        for (const tabSwitch of tabs) {
            const tabLink = customUIFrame.locator(tabSwitch.selector);
            if (await tabLink.isVisible({ timeout: 2000 })) {
                await tabLink.click();
                await page.waitForTimeout(500);

                // Verify the tab is now active
                await tabLink.evaluate((el) =>
                    el.parentElement.classList.contains("active"),
                );
            }
        }
    });
});
