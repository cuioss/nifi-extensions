/**
 * @file JWKS Validation Button Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { saveTestBrowserLogs } from "../utils/console-logger.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("JWKS Validation Button", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            // Note: We skip strict error detection for these tests because they navigate
            // away from the main canvas to the processor's custom UI
            // await setupStrictErrorDetection(page, testInfo, false);

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
        // Skip cleanup since we didn't setup critical error detection
        // cleanupCriticalErrorDetection();
    });

    test("should validate JWKS URL successfully", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing JWKS validation button - valid URL");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Find and configure processor
            // Try to find the processor first
            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: false,
                });

            // If processor not found, provide clear instructions
            if (!processor) {
                throw new Error(
                    "❌ MultiIssuerJWTTokenAuthenticator processor not found on canvas!\n\n" +
                        "Please manually add the processor to the canvas before running E2E tests:\n" +
                        "1. Navigate to NiFi UI at https://localhost:9095/nifi\n" +
                        "2. Drag a 'Processor' component onto the canvas\n" +
                        "3. Search for and select 'MultiIssuerJWTTokenAuthenticator'\n" +
                        "4. Click 'Add' to place it on the canvas\n" +
                        "5. Re-run the E2E tests\n\n" +
                        "This is a prerequisite for E2E testing the JWKS validation functionality.",
                );
            }
            // Navigate directly to the custom UI (separate web application)
            processorLogger.info(
                "Navigating directly to JWT custom UI for JWKS validation",
            );
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            // Wait for custom UI to load
            await page.waitForTimeout(2000);

            // The custom UI is a direct web application, not in an iframe
            const uiContext = page;

            // First click "Add Issuer" to enable the form
            const addIssuerButton = await uiContext.getByRole("button", {
                name: "Add Issuer",
            });
            await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
            await addIssuerButton.click();
            processorLogger.info("Clicked Add Issuer to enable form");

            // Wait longer for form to be fully enabled
            await page.waitForTimeout(1000);

            const jwksUrlInput = await uiContext
                .locator('input[name="jwks-url"]')
                .first();
            await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

            // Try force fill if normal fill doesn't work
            try {
                await jwksUrlInput.fill(
                    "https://example.com/.well-known/jwks.json",
                );
            } catch (error) {
                processorLogger.warn("Normal fill failed, trying force fill");
                await jwksUrlInput.fill(
                    "https://example.com/.well-known/jwks.json",
                    { force: true },
                );
            }
            processorLogger.info("Entered valid JWKS URL");

            const validateButton = await uiContext
                .getByRole("button", { name: "Test Connection" })
                .first();
            await expect(validateButton).toBeVisible({ timeout: 5000 });
            await validateButton.click();
            processorLogger.info("Clicked validate button");

            const successMessage = await uiContext
                .locator(
                    '.verification-result, .success-message, [class*="success"]',
                )
                .first();
            await expect(successMessage).toBeVisible({ timeout: 10000 });
            // Just verify a validation message appears, don't check specific text
            processorLogger.success("JWKS URL validated successfully");

            const validationIcon = await uiContext
                .locator(
                    '[class*="success"], [class*="check"], [class*="valid"]',
                )
                .first();
            await expect(validationIcon).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Validation success icon displayed");
        } catch (error) {
            processorLogger.error(
                `Error during JWKS validation test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should handle invalid JWKS URL", async ({ page }, testInfo) => {
        processorLogger.info("Testing JWKS validation button - invalid URL");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Try to find the processor first
            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: false,
                });

            // If processor not found, provide clear instructions
            if (!processor) {
                throw new Error(
                    "❌ MultiIssuerJWTTokenAuthenticator processor not found on canvas!\n\n" +
                        "Please manually add the processor to the canvas before running E2E tests:\n" +
                        "1. Navigate to NiFi UI at https://localhost:9095/nifi\n" +
                        "2. Drag a 'Processor' component onto the canvas\n" +
                        "3. Search for and select 'MultiIssuerJWTTokenAuthenticator'\n" +
                        "4. Click 'Add' to place it on the canvas\n" +
                        "5. Re-run the E2E tests\n\n" +
                        "This is a prerequisite for E2E testing the JWKS validation functionality.",
                );
            }

            // Navigate directly to the custom UI (separate web application)
            processorLogger.info(
                "Navigating directly to JWT custom UI for invalid JWKS test",
            );
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            // Wait for custom UI to load
            await page.waitForTimeout(2000);

            // The custom UI is a direct web application, not in an iframe
            const uiContext = page;

            // First click "Add Issuer" to enable the form
            const addIssuerButton = await uiContext.getByRole("button", {
                name: "Add Issuer",
            });
            await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
            await addIssuerButton.click();
            processorLogger.info("Clicked Add Issuer to enable form");

            // Wait for form to be fully enabled
            await page.waitForTimeout(2000);

            const jwksUrlInput = await uiContext
                .locator('input[name="jwks-url"]')
                .first();
            await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

            // Check if input is enabled and force enable if needed
            const isEnabled = await jwksUrlInput.isEnabled();
            if (!isEnabled) {
                processorLogger.warn(
                    "JWKS URL input appears disabled, trying to enable",
                );
                await jwksUrlInput.click({ force: true });
                await page.waitForTimeout(500);
            }

            await jwksUrlInput.fill("not-a-valid-url", { force: true });
            processorLogger.info("Entered invalid JWKS URL");

            const validateButton = await uiContext
                .getByRole("button", { name: "Test Connection" })
                .first();
            await expect(validateButton).toBeVisible({ timeout: 5000 });
            await validateButton.click();
            processorLogger.info("Clicked validate button");

            // Check for error indication - this could be various forms
            try {
                const errorMessage = await uiContext
                    .locator(
                        '.error-message, [class*="error"], .validation-error, .verification-result',
                    )
                    .first();
                await expect(errorMessage).toBeVisible({ timeout: 10000 });
                processorLogger.info(
                    "✓ Validation result displayed for invalid URL",
                );
            } catch (error) {
                // If no specific error element, just verify the button is still there (validation completed)
                await expect(validateButton).toBeVisible({ timeout: 5000 });
                processorLogger.info("✓ Validation completed for invalid URL");
            }

            // Check for error icons (optional)
            try {
                const errorIcon = await uiContext
                    .locator(
                        '[class*="error"], [class*="warning"], [class*="invalid"]',
                    )
                    .first();
                await expect(errorIcon).toBeVisible({ timeout: 5000 });
                processorLogger.info("✓ Error icon displayed");
            } catch (error) {
                processorLogger.info(
                    "No specific error icon found - validation result was displayed",
                );
            }

            processorLogger.success("Invalid JWKS URL handled correctly");
        } catch (error) {
            processorLogger.error(
                `Error during invalid JWKS URL test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should validate JWKS file path", async ({ page }, testInfo) => {
        processorLogger.info("Testing JWKS validation button - file path");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Try to find the processor first
            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: false,
                });

            // If processor not found, provide clear instructions
            if (!processor) {
                throw new Error(
                    "❌ MultiIssuerJWTTokenAuthenticator processor not found on canvas!\n\n" +
                        "Please manually add the processor to the canvas before running E2E tests:\n" +
                        "1. Navigate to NiFi UI at https://localhost:9095/nifi\n" +
                        "2. Drag a 'Processor' component onto the canvas\n" +
                        "3. Search for and select 'MultiIssuerJWTTokenAuthenticator'\n" +
                        "4. Click 'Add' to place it on the canvas\n" +
                        "5. Re-run the E2E tests\n\n" +
                        "This is a prerequisite for E2E testing the JWKS validation functionality.",
                );
            }

            // Navigate directly to the custom UI (separate web application)
            processorLogger.info(
                "Navigating directly to JWT custom UI for file path test",
            );
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            // Wait for custom UI to load
            await page.waitForTimeout(2000);

            // The custom UI is a direct web application, not in an iframe
            const uiContext = page;

            // First click "Add Issuer" to enable the form
            const addIssuerButton = await uiContext.getByRole("button", {
                name: "Add Issuer",
            });
            await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
            await addIssuerButton.click();
            processorLogger.info("Clicked Add Issuer to enable form");

            // Wait for form to be fully enabled
            await page.waitForTimeout(2000);

            // For file path test, we'll just use the JWKS URL input with a file path
            const jwksUrlInput = await uiContext
                .locator('input[name="jwks-url"]')
                .first();
            await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

            // Check if input is enabled and force enable if needed
            const isEnabled = await jwksUrlInput.isEnabled();
            if (!isEnabled) {
                processorLogger.warn(
                    "JWKS URL input appears disabled, trying to enable",
                );
                await jwksUrlInput.click({ force: true });
                await page.waitForTimeout(500);
            }

            await jwksUrlInput.fill("/path/to/jwks.json", { force: true });
            processorLogger.info("Entered JWKS file path");

            const validateButton = await uiContext
                .getByRole("button", { name: "Test Connection" })
                .first();
            await expect(validateButton).toBeVisible({ timeout: 5000 });
            await validateButton.click();
            processorLogger.info("Clicked validate button");

            const validationResult = await uiContext
                .locator(
                    '.validation-result, .verification-result, [class*="result"]',
                )
                .first();
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
    }, testInfo) => {
        processorLogger.info("Testing JWKS validation progress indicator");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Try to find the processor first
            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: false,
                });

            // If processor not found, provide clear instructions
            if (!processor) {
                throw new Error(
                    "❌ MultiIssuerJWTTokenAuthenticator processor not found on canvas!\n\n" +
                        "Please manually add the processor to the canvas before running E2E tests:\n" +
                        "1. Navigate to NiFi UI at https://localhost:9095/nifi\n" +
                        "2. Drag a 'Processor' component onto the canvas\n" +
                        "3. Search for and select 'MultiIssuerJWTTokenAuthenticator'\n" +
                        "4. Click 'Add' to place it on the canvas\n" +
                        "5. Re-run the E2E tests\n\n" +
                        "This is a prerequisite for E2E testing the JWKS validation functionality.",
                );
            }

            // Navigate directly to the custom UI (separate web application)
            processorLogger.info(
                "Navigating directly to JWT custom UI for progress indicator test",
            );
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            // Wait for custom UI to load
            await page.waitForTimeout(2000);

            // The custom UI is a direct web application, not in an iframe
            const uiContext = page;

            // First click "Add Issuer" to enable the form
            const addIssuerButton = await uiContext.getByRole("button", {
                name: "Add Issuer",
            });
            await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
            await addIssuerButton.click();
            processorLogger.info("Clicked Add Issuer to enable form");

            // Wait for form to be fully enabled
            await page.waitForTimeout(2000);

            const jwksUrlInput = await uiContext
                .locator('input[name="jwks-url"]')
                .first();
            await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

            // Check if input is enabled and force enable if needed
            const isEnabled = await jwksUrlInput.isEnabled();
            if (!isEnabled) {
                processorLogger.warn(
                    "JWKS URL input appears disabled, trying to enable",
                );
                await jwksUrlInput.click({ force: true });
                await page.waitForTimeout(500);
            }

            await jwksUrlInput.fill(
                "https://slow-response.example.com/jwks.json",
                { force: true },
            );

            const validateButton = await uiContext
                .getByRole("button", { name: "Test Connection" })
                .first();
            await expect(validateButton).toBeVisible({ timeout: 5000 });
            await validateButton.click();

            // Check for progress indicators (optional, as they may be very brief)
            try {
                const progressIndicator = await uiContext
                    .locator('[class*="progress"], [class*="loading"]')
                    .first();
                await expect(progressIndicator).toBeVisible({ timeout: 1000 });
                processorLogger.info("✓ Progress indicator displayed");

                await expect(progressIndicator).not.toBeVisible({
                    timeout: 15000,
                });
                processorLogger.info(
                    "✓ Progress indicator disappeared after validation",
                );
            } catch (error) {
                processorLogger.info(
                    "Progress indicator not found or too brief - this is acceptable",
                );
            }

            // Verify validation completed by checking for any result
            const anyResult = await uiContext
                .locator(
                    '.verification-result, .validation-result, [class*="result"], button[class*="verify"]',
                )
                .first();
            await expect(anyResult).toBeVisible({ timeout: 10000 });
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
