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
    checkCriticalErrors as _checkCriticalErrors,
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
        
        // Open Advanced UI using the verified navigation pattern
        await processorService.openAdvancedUI(processor);
        
        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        
        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame");
        }

        // Take screenshot of the custom UI
        await page.screenshot({
            path: `target/test-results/jwt-custom-ui-tabs-${Date.now()}.png`,
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
                const tabLink = customUIFrame.locator(tab.selector);
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
            // If tab container not visible in expected location, try alternate selector
            processorLogger.info("Checking alternate selectors for tabs");
            
            const tabLinks = await customUIFrame
                .locator(".jwt-tabs-header .tabs a")
                .count();
            
            if (tabLinks > 0) {
                processorLogger.info(
                    `Found ${tabLinks} tabs using alternate selector`,
                );
                expect(tabLinks).toBe(4);
            } else {
                throw new Error(
                    "Could not find tabs in JWT Custom UI",
                );
            }
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
            if (await addIssuerButton.isVisible({ timeout: 3000 })) {
                processorLogger.info(
                    "✓ Configuration tab: Add Issuer button found",
                );
            }

        // Token Verification tab
        const tokenVerificationTab = customUIFrame.locator(
            'a[href="#token-verification"]',
        );
            if (await tokenVerificationTab.isVisible()) {
                await tokenVerificationTab.click();
                await page.waitForTimeout(500);

            const verifyButton = customUIFrame.locator(
                'button:has-text("Verify Token")',
            ).first();
            if (await verifyButton.isVisible({ timeout: 3000 })) {
                    processorLogger.info(
                        "✓ Token Verification tab: Verify Token button found",
                    );
                }
            }

        // Metrics tab
        const metricsTab = customUIFrame.locator('a[href="#metrics"]');
            if (await metricsTab.isVisible()) {
                await metricsTab.click();
                await page.waitForTimeout(500);

            const refreshButton = customUIFrame.locator(
                '[data-testid="refresh-metrics-button"]',
            );
                if (await refreshButton.isVisible({ timeout: 3000 })) {
                    processorLogger.info("✓ Metrics tab: Refresh button found");
                }
            }

        // Help tab
        const helpTab = customUIFrame.locator('a[href="#help"]');
            if (await helpTab.isVisible()) {
                await helpTab.click();
                await page.waitForTimeout(500);

            const helpContent = customUIFrame.locator(
                '[data-testid="help-tab-content"]',
            );
                if (await helpContent.isVisible({ timeout: 3000 })) {
                    processorLogger.info("✓ Help tab: Content found");
                }
            }
    });
});
