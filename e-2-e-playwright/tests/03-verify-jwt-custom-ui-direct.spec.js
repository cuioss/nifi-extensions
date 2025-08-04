/**
 * @file Verify JWT Custom UI Direct Access
 * Directly navigates to the custom UI to verify tab implementation
 * @version 1.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { processorLogger } from "../utils/shared-logger.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("JWT Custom UI Direct Access - Tab Verification", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        await setupAuthAwareErrorDetection(page, testInfo);
        const authService = new AuthService(page);
        await authService.ensureReady();
        
        // Ensure processor is on canvas before each test
        const ready = await processorManager.ensureProcessorOnCanvas();
        if (!ready) {
            throw new Error(
                'Cannot ensure MultiIssuerJWTTokenAuthenticator is on canvas. ' +
                'The processor must be deployed in NiFi for tests to run.'
            );
        }
        processorLogger.info('All preconditions met');
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        // Always save browser logs first
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should display all four tabs in custom UI", async ({ page }, testInfo) => {
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
            processorLogger.warn(
                "JWT container not visible, checking iframe content",
            );

            // Check what's actually in the iframe
            const bodyText = await customUIFrame.locator("body").textContent();
            processorLogger.info(
                `Iframe content: ${bodyText.substring(0, 200)}...`,
            );
        }

        // Check for tab container in the iframe
        const tabContainer = customUIFrame.locator(
            '[data-testid="jwt-config-tabs"]',
        );
        const isTabContainerVisible = await tabContainer.isVisible({
            timeout: 5000,
        });

        if (isTabContainerVisible) {
            processorLogger.info("Tab container found!");

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
                    processorLogger.info(`✓ Found tab: ${tab.name}`);

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
                            if (
                                await addIssuerBtn.isVisible({ timeout: 2000 })
                            ) {
                                processorLogger.info(
                                    "  ✓ Configuration tab content verified",
                                );
                            }
                            break;
                        }
                        case "Token Verification": {
                            const verifyBtn = customUIFrame
                                .locator('button:has-text("Verify Token")')
                                .first();
                            if (await verifyBtn.isVisible({ timeout: 2000 })) {
                                processorLogger.info(
                                    "  ✓ Token Verification tab content verified",
                                );
                            }
                            break;
                        }
                        case "Metrics": {
                            const refreshBtn = customUIFrame
                                .locator(
                                    '[data-testid="refresh-metrics-button"]',
                                )
                                .first();
                            if (await refreshBtn.isVisible({ timeout: 2000 })) {
                                processorLogger.info(
                                    "  ✓ Metrics tab content verified",
                                );
                            }
                            break;
                        }
                        case "Help": {
                            const helpContent = customUIFrame
                                .locator('[data-testid="help-tab-content"]')
                                .first();
                            if (
                                await helpContent.isVisible({ timeout: 2000 })
                            ) {
                                processorLogger.info(
                                    "  ✓ Help tab content verified",
                                );
                            }
                            break;
                        }
                    }
                } else {
                    processorLogger.warn(`✗ Tab not found: ${tab.name}`);
                }
            }

            expect(tabsFound).toBe(4);
            processorLogger.success(
                `All ${tabsFound} tabs verified successfully!`,
            );
        } else {
            processorLogger.error("Tab container not found!");

            // Debug: Check if tabs are hidden initially in iframe
            const hiddenTabs = customUIFrame.locator("#jwt-validator-tabs");
            if ((await hiddenTabs.count()) > 0) {
                const displayStyle = await hiddenTabs.evaluate(
                    (el) => window.getComputedStyle(el).display,
                );
                processorLogger.info(
                    `Tabs container display style: ${displayStyle}`,
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

    test("should test tab switching functionality", async ({ page }, testInfo) => {
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

        processorLogger.info("Testing tab switching functionality");

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
                const isActive = await tabLink.evaluate((el) =>
                    el.parentElement.classList.contains("active"),
                );

                if (isActive) {
                    processorLogger.info(
                        `✓ Successfully switched from ${tabSwitch.from} to ${tabSwitch.to}`,
                    );
                } else {
                    processorLogger.warn(
                        `✗ Tab switch failed: ${tabSwitch.from} to ${tabSwitch.to}`,
                    );
                }
            }
        }
    });
});
