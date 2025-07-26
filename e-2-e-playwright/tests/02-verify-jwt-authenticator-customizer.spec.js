/**
 * @file JWT Authenticator Customizer UI Test
 * Verifies the custom UI components of the MultiIssuerJWTTokenAuthenticator processor
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
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
    }, _testInfo) => {
        processorLogger.info("Testing JWT Authenticator Customizer UI");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

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
                const el = await page.locator(element.selector);
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
                const tab = await page.locator(tabSelector);
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
    }, _testInfo) => {
        processorLogger.info("Testing issuer configuration interactions");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const addIssuerButton = await page.locator(
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
                const input = await page.locator(field.selector);
                await expect(input).toBeVisible({ timeout: 5000 });
                await input.fill(field.value);
                processorLogger.info(
                    `✓ Filled ${field.description} with: ${field.value}`,
                );
            }

            const saveButton = await page.locator(
                '[data-testid="save-issuer-button"]',
            );
            await expect(saveButton).toBeVisible({ timeout: 5000 });
            await saveButton.click();
            processorLogger.info("Saved issuer configuration");

            const savedIssuer = await page.locator(
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
