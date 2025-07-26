/**
 * @file JWT Authenticator Customizer UI Test
 * Verifies the custom UI components of the MultiIssuerJWTTokenAuthenticator processor
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import {
    saveTestBrowserLogs,
    setupStrictErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("JWT Authenticator Customizer UI", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            await setupStrictErrorDetection(page, testInfo, false);
            const authService = new AuthService(page);
            await authService.ensureReady();
        } catch (error) {
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                logTestWarning(
                    "beforeEach",
                    `Failed to save console logs during beforeEach error: ${logError.message}`,
                );
            }
            throw error;
        }
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }
        cleanupCriticalErrorDetection();
    });

    test("should display custom JWT authenticator UI", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing JWT Authenticator Customizer UI");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Find the MultiIssuerJWTTokenAuthenticator processor on the canvas
            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: true,
                });

            // Open processor configuration
            const dialog = await processorService.configure(processor);

            // Access advanced properties to get to custom UI
            await processorService.accessAdvancedProperties(dialog);

            // Wait for custom UI to load
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            // Check if custom UI is in an iframe
            const customUIFrame = page.frameLocator("iframe").first();
            let uiContext = page;

            // Try to find elements in iframe first
            const iframeContainer = customUIFrame.locator(
                '[data-testid="jwt-customizer-container"]',
            );
            if ((await iframeContainer.count()) > 0) {
                uiContext = customUIFrame;
                processorLogger.info("Custom UI found in iframe");
            }

            const customUIElements = [
                {
                    selector: '[data-testid="jwt-customizer-container"]',
                    description: "JWT Customizer Container",
                },
                {
                    selector: '[data-testid="issuer-config-panel"]',
                    description: "Issuer Configuration Panel",
                },
                {
                    selector: '[data-testid="jwt-config-tabs"]',
                    description: "Configuration Tabs",
                },
            ];

            for (const element of customUIElements) {
                processorLogger.info(
                    `Checking for ${element.description}: ${element.selector}`,
                );
                const el = await uiContext.locator(element.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found ${element.description}`);
            }

            const tabs = [
                "Configuration",
                "Token Verification",
                "Metrics",
                "Help",
            ];

            for (const tabName of tabs) {
                const tabSelector = `[role="tab"]:has-text("${tabName}")`;
                processorLogger.info(`Checking for tab: ${tabName}`);
                const tab = await uiContext.locator(tabSelector);
                await expect(tab).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found ${tabName} tab`);
            }

            processorLogger.success(
                "JWT Authenticator Customizer UI verified successfully",
            );
        } catch (error) {
            processorLogger.error(
                `Error during customizer UI test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should handle issuer configuration interactions", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing issuer configuration interactions");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Find and configure processor
            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: true,
                });
            const dialog = await processorService.configure(processor);
            await processorService.accessAdvancedProperties(dialog);

            // Wait for custom UI to load
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            // Determine UI context (iframe or main page)
            const customUIFrame = page.frameLocator("iframe").first();
            let uiContext = page;

            const iframeButton = customUIFrame.locator(
                '[data-testid="add-issuer-button"]',
            );
            if ((await iframeButton.count()) > 0) {
                uiContext = customUIFrame;
                processorLogger.info("Working with custom UI in iframe");
            }

            const addIssuerButton = await uiContext.locator(
                '[data-testid="add-issuer-button"]',
            );
            await expect(addIssuerButton).toBeVisible({ timeout: 5000 });

            await addIssuerButton.click();
            processorLogger.info("Clicked Add Issuer button");

            const issuerFormFields = [
                {
                    selector: '[data-testid="issuer-name-input"]',
                    value: "test-issuer",
                    description: "Issuer Name",
                },
                {
                    selector: '[data-testid="jwks-url-input"]',
                    value: "https://example.com/.well-known/jwks.json",
                    description: "JWKS URL",
                },
                {
                    selector: '[data-testid="audience-input"]',
                    value: "test-audience",
                    description: "Audience",
                },
            ];

            for (const field of issuerFormFields) {
                processorLogger.info(`Filling ${field.description}`);
                const input = await uiContext.locator(field.selector);
                await expect(input).toBeVisible({ timeout: 5000 });
                await input.fill(field.value);
                processorLogger.info(
                    `✓ Filled ${field.description} with: ${field.value}`,
                );
            }

            const saveButton = await uiContext.locator(
                '[data-testid="save-issuer-button"]',
            );
            await expect(saveButton).toBeVisible({ timeout: 5000 });
            await saveButton.click();
            processorLogger.info("Saved issuer configuration");

            const savedIssuer = await uiContext.locator(
                '[data-testid="issuer-item"]:has-text("test-issuer")',
            );
            await expect(savedIssuer).toBeVisible({ timeout: 5000 });
            processorLogger.success("Issuer configuration saved successfully");
        } catch (error) {
            processorLogger.error(
                `Error during issuer configuration test: ${error.message}`,
            );
            throw error;
        }
    });
});
