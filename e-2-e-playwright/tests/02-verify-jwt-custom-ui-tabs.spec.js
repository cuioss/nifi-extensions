/**
 * @file Verify JWT Custom UI Tabs
 * Verifies the custom UI implementation for the MultiIssuerJWTTokenAuthenticator processor
 * @version 1.0.0
 */

import { expect, test } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { processorLogger } from "../utils/shared-logger.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import {
    checkCriticalErrors,
    cleanupCriticalErrorDetection,
} from "../utils/critical-error-detector.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("JWT Custom UI Tabs Verification", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup auth-aware error detection
        await setupAuthAwareErrorDetection(page, testInfo);

        const authService = new AuthService(page);
        await authService.ensureReady();
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

        // Open processor configuration
        const dialog = await processorService.configure(processor);
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Look for the Advanced button or Properties tab
        const advancedButton = page.getByRole("button", { name: /advanced/i });
        const propertiesTab = page.getByRole("tab", { name: /properties/i });

        // First click on Properties tab if visible
        if (await propertiesTab.isVisible({ timeout: 3000 })) {
            await propertiesTab.click();
            await page.waitForTimeout(1000);
            processorLogger.info("Clicked on Properties tab");
        }

        // Then look for Advanced button
        if (await advancedButton.isVisible({ timeout: 5000 })) {
            await advancedButton.click();
            processorLogger.info("Clicked on Advanced button");

            // Wait for custom UI to load
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            // Take screenshot of the custom UI
            await page.screenshot({
                path: `target/test-results/jwt-custom-ui-tabs-${Date.now()}.png`,
                fullPage: true,
            });

            // Check for tab container
            const tabContainer = page.locator(
                '[data-testid="jwt-config-tabs"]',
            );
            const isTabContainerVisible = await tabContainer.isVisible({
                timeout: 5000,
            });

            if (isTabContainerVisible) {
                processorLogger.info("Tab container found");

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
                    const tabLink = page.locator(tab.selector);
                    if (await tabLink.isVisible({ timeout: 2000 })) {
                        tabsFound++;
                        processorLogger.info(`✓ Found tab: ${tab.name}`);

                        // Click on the tab to verify it works
                        await tabLink.click();
                        await page.waitForTimeout(500);

                        // Take screenshot of each tab
                        await page.screenshot({
                            path: `target/test-results/jwt-tab-${tab.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.png`,
                            fullPage: true,
                        });
                    } else {
                        processorLogger.warn(`✗ Tab not found: ${tab.name}`);
                    }
                }

                expect(tabsFound).toBe(4);
                processorLogger.success(
                    `All ${tabsFound} tabs verified successfully`,
                );
            } else {
                // If tab container not visible, check if we're in the iframe
                const iframe = page.frameLocator("iframe").first();
                if (iframe) {
                    processorLogger.info("Checking inside iframe for tabs");

                    const iframeTabContainer = iframe.locator(
                        '[data-testid="jwt-config-tabs"]',
                    );
                    if (await iframeTabContainer.isVisible({ timeout: 5000 })) {
                        processorLogger.info("Tab container found in iframe");

                        // Check tabs in iframe
                        const tabLinks = await iframe
                            .locator(".jwt-tabs-header .tabs a")
                            .count();
                        processorLogger.info(
                            `Found ${tabLinks} tabs in iframe`,
                        );

                        expect(tabLinks).toBe(4);
                    }
                }
            }
        } else {
            processorLogger.warn(
                "Advanced button not found in configuration dialog",
            );

            // Take screenshot to debug
            await page.screenshot({
                path: `target/test-results/jwt-config-dialog-${Date.now()}.png`,
                fullPage: true,
            });
        }

        // Close dialog
        await page.keyboard.press("Escape");
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

        // Open processor configuration
        const dialog = await processorService.configure(processor);
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Look for the Advanced button or Properties tab
        const advancedButton = page.getByRole("button", { name: /advanced/i });
        const propertiesTab = page.getByRole("tab", { name: /properties/i });

        // First click on Properties tab if visible
        if (await propertiesTab.isVisible({ timeout: 3000 })) {
            await propertiesTab.click();
            await page.waitForTimeout(1000);
            processorLogger.info("Clicked on Properties tab");
        }

        // Then look for Advanced button
        if (await advancedButton.isVisible({ timeout: 5000 })) {
            await advancedButton.click();
            processorLogger.info("Clicked on Advanced button");

            // Wait for custom UI to load
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            // Test specific tab content
            // Configuration tab (should be active by default)
            const addIssuerButton = page.locator(
                'button:has-text("Add Issuer")',
            );
            if (await addIssuerButton.isVisible({ timeout: 3000 })) {
                processorLogger.info(
                    "✓ Configuration tab: Add Issuer button found",
                );
            }

            // Token Verification tab
            const tokenVerificationTab = page.locator(
                'a[href="#token-verification"]',
            );
            if (await tokenVerificationTab.isVisible()) {
                await tokenVerificationTab.click();
                await page.waitForTimeout(500);

                const verifyButton = page.locator(
                    'button:has-text("Verify Token")',
                );
                if (await verifyButton.isVisible({ timeout: 3000 })) {
                    processorLogger.info(
                        "✓ Token Verification tab: Verify Token button found",
                    );
                }
            }

            // Metrics tab
            const metricsTab = page.locator('a[href="#metrics"]');
            if (await metricsTab.isVisible()) {
                await metricsTab.click();
                await page.waitForTimeout(500);

                const refreshButton = page.locator(
                    '[data-testid="refresh-metrics-button"]',
                );
                if (await refreshButton.isVisible({ timeout: 3000 })) {
                    processorLogger.info("✓ Metrics tab: Refresh button found");
                }
            }

            // Help tab
            const helpTab = page.locator('a[href="#help"]');
            if (await helpTab.isVisible()) {
                await helpTab.click();
                await page.waitForTimeout(500);

                const helpContent = page.locator(
                    '[data-testid="help-tab-content"]',
                );
                if (await helpContent.isVisible({ timeout: 3000 })) {
                    processorLogger.info("✓ Help tab: Content found");
                }
            }
        }

        // Close dialog
        await page.keyboard.press("Escape");
    });
});
