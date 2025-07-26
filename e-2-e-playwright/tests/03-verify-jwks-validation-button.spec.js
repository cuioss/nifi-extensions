/**
 * @file JWKS Validation Button Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI
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

test.describe("JWKS Validation Button", () => {
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

    test("should validate JWKS URL successfully", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing JWKS validation button - valid URL");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const jwksUrlInput = await page.locator(
                '[data-testid="jwks-url-input"]',
            );
            await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
            await jwksUrlInput.fill(
                "https://example.com/.well-known/jwks.json",
            );
            processorLogger.info("Entered valid JWKS URL");

            const validateButton = await page.locator(
                '[data-testid="validate-jwks-button"]',
            );
            await expect(validateButton).toBeVisible({ timeout: 5000 });
            await validateButton.click();
            processorLogger.info("Clicked validate button");

            const successMessage = await page.locator(
                '[data-testid="validation-success-message"]',
            );
            await expect(successMessage).toBeVisible({ timeout: 10000 });
            await expect(successMessage).toContainText(
                "JWKS validation successful",
            );
            processorLogger.success("JWKS URL validated successfully");

            const validationIcon = await page.locator(
                '[data-testid="validation-success-icon"]',
            );
            await expect(validationIcon).toBeVisible({ timeout: 5000 });
            await expect(validationIcon).toHaveClass(/success|check|valid/);
            processorLogger.info("✓ Validation success icon displayed");
        } catch (error) {
            processorLogger.error(
                `Error during JWKS validation test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should handle invalid JWKS URL", async ({ page }, _testInfo) => {
        processorLogger.info("Testing JWKS validation button - invalid URL");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const jwksUrlInput = await page.locator(
                '[data-testid="jwks-url-input"]',
            );
            await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
            await jwksUrlInput.fill("not-a-valid-url");
            processorLogger.info("Entered invalid JWKS URL");

            const validateButton = await page.locator(
                '[data-testid="validate-jwks-button"]',
            );
            await expect(validateButton).toBeVisible({ timeout: 5000 });
            await validateButton.click();
            processorLogger.info("Clicked validate button");

            const errorMessage = await page.locator(
                '[data-testid="validation-error-message"]',
            );
            await expect(errorMessage).toBeVisible({ timeout: 10000 });
            await expect(errorMessage).toContainText(/invalid|error|failed/i);
            processorLogger.info("✓ Error message displayed for invalid URL");

            const errorIcon = await page.locator(
                '[data-testid="validation-error-icon"]',
            );
            await expect(errorIcon).toBeVisible({ timeout: 5000 });
            await expect(errorIcon).toHaveClass(/error|warning|invalid/);
            processorLogger.success("Invalid JWKS URL handled correctly");
        } catch (error) {
            processorLogger.error(
                `Error during invalid JWKS URL test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should validate JWKS file path", async ({ page }, _testInfo) => {
        processorLogger.info("Testing JWKS validation button - file path");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const filePathRadio = await page.locator(
                '[data-testid="jwks-source-file"]',
            );
            await expect(filePathRadio).toBeVisible({ timeout: 5000 });
            await filePathRadio.click();
            processorLogger.info("Selected file path option");

            const jwksFileInput = await page.locator(
                '[data-testid="jwks-file-input"]',
            );
            await expect(jwksFileInput).toBeVisible({ timeout: 5000 });
            await jwksFileInput.fill("/path/to/jwks.json");
            processorLogger.info("Entered JWKS file path");

            const validateButton = await page.locator(
                '[data-testid="validate-jwks-button"]',
            );
            await expect(validateButton).toBeVisible({ timeout: 5000 });
            await validateButton.click();
            processorLogger.info("Clicked validate button");

            const validationResult = await page.locator(
                '[data-testid="validation-result"]',
            );
            await expect(validationResult).toBeVisible({ timeout: 10000 });
            processorLogger.success("JWKS file path validation completed");
        } catch (error) {
            processorLogger.error(
                `Error during JWKS file validation test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should display validation progress indicator", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing JWKS validation progress indicator");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const jwksUrlInput = await page.locator(
                '[data-testid="jwks-url-input"]',
            );
            await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
            await jwksUrlInput.fill(
                "https://slow-response.example.com/jwks.json",
            );

            const validateButton = await page.locator(
                '[data-testid="validate-jwks-button"]',
            );
            await validateButton.click();

            const progressIndicator = await page.locator(
                '[data-testid="validation-progress"]',
            );
            await expect(progressIndicator).toBeVisible({ timeout: 2000 });
            processorLogger.info("✓ Progress indicator displayed");

            const spinner = await page.locator(
                '[data-testid="validation-spinner"]',
            );
            await expect(spinner).toBeVisible({ timeout: 2000 });
            processorLogger.info("✓ Loading spinner visible during validation");

            await expect(progressIndicator).not.toBeVisible({ timeout: 15000 });
            processorLogger.success(
                "Validation progress indicator working correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error during progress indicator test: ${error.message}`,
            );
            throw error;
        }
    });
});
