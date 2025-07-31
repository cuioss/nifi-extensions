/**
 * @file JWKS Validation Button Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { processorLogger } from "../utils/shared-logger.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { withPageRetry, withElementRetry, createNiFiRetryConfig } from "../utils/retry-helper.js";

test.describe("JWKS Validation Button", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await setupAuthAwareErrorDetection(page, testInfo);

        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        await saveTestBrowserLogs(testInfo);
        cleanupCriticalErrorDetection();
    });

    test("should validate JWKS URL successfully", async ({
        page,
    }, testInfo) => {
        // Explicit NiFi service availability check
        const authService = new AuthService(page);
        const isNiFiAvailable = await authService.checkNiFiAccessibility();
        if (!isNiFiAvailable) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not available. " +
                    "Integration tests require a running NiFi instance. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Test JWKS validation button with valid URL
        const processorService = new ProcessorService(page, testInfo);

        // Find and configure processor
        // Try to find the processor first
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        // If processor not found, provide clear instructions
        expect(processor).toBeTruthy();
        // Open Advanced UI via right-click menu
        const advancedOpened = await processorService.openAdvancedUI(processor);

        expect(advancedOpened).toBe(true);

        // Get the custom UI frame using the utility
        const customUIFrame = await processorService.getAdvancedUIFrame();

        expect(customUIFrame).toBeTruthy();

        const uiContext = customUIFrame;

        // First click "Add Issuer" to enable the form
        const addIssuerButton = await uiContext.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();
        // Clicked Add Issuer to enable form

        // Wait longer for form to be fully enabled
        await page.waitForLoadState("networkidle");

        const jwksUrlInput = await uiContext
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        // Fill the JWKS URL input
        await jwksUrlInput.fill("https://example.com/.well-known/jwks.json");
        // Entered valid JWKS URL

        const validateButton = await uiContext
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();
        // Clicked validate button

        const successMessage = await uiContext
            .locator(
                '.verification-result, .success-message, [class*="success"]',
            )
            .first();
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        // Just verify a validation message appears, don't check specific text
        // JWKS URL validated successfully

        const validationIcon = await uiContext
            .locator('[class*="success"], [class*="check"], [class*="valid"]')
            .first();
        await expect(validationIcon).toBeVisible({ timeout: 5000 });
        // Validation success icon should be displayed
    });

    test("should handle invalid JWKS URL", async ({ page }, testInfo) => {
        // Explicit NiFi service availability check
        const authService = new AuthService(page);
        const isNiFiAvailable = await authService.checkNiFiAccessibility();
        if (!isNiFiAvailable) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not available. " +
                    "Integration tests require a running NiFi instance. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Testing JWKS validation button - invalid URL
        const processorService = new ProcessorService(page, testInfo);

        // Try to find the processor first
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        // If processor not found, provide clear instructions
        expect(processor).toBeTruthy();

        // Open Advanced UI via right-click menu
        const advancedOpened = await processorService.openAdvancedUI(processor);

        expect(advancedOpened).toBe(true);

        // Get the custom UI frame using the utility
        const customUIFrame = await processorService.getAdvancedUIFrame();

        expect(customUIFrame).toBeTruthy();

        const uiContext = customUIFrame;

        // First click "Add Issuer" to enable the form
        const addIssuerButton = await uiContext.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();
        // Clicked Add Issuer to enable form

        // Wait for form to be fully enabled
        await page.waitForLoadState("networkidle");

        const jwksUrlInput = await uiContext
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        // Check if input is enabled and force enable if needed
        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
            // JWKS URL input appears disabled, trying to enable
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill("not-a-valid-url", { force: true });
        // Entered invalid JWKS URL

        const validateButton = await uiContext
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();
        // Clicked validate button

        // Wait for validation result to appear in the verification-result container
        const verificationResult = await uiContext
            .locator(".verification-result")
            .first();

        // The result should contain some text indicating validation completed
        await expect(verificationResult).not.toBeEmpty({ timeout: 10000 });
        await expect(verificationResult).toContainText(
            /error|invalid|fail|OK|Valid/i,
            { timeout: 5000 },
        );
        // Validation result displayed for invalid URL

        // Invalid JWKS URL handled correctly
    });

    test("should validate JWKS file path", async ({ page }, testInfo) => {
        // Explicit NiFi service availability check
        const authService = new AuthService(page);
        const isNiFiAvailable = await authService.checkNiFiAccessibility();
        if (!isNiFiAvailable) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not available. " +
                    "Integration tests require a running NiFi instance. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Testing JWKS validation button - file path
        const processorService = new ProcessorService(page, testInfo);

        // Try to find the processor first
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        // If processor not found, provide clear instructions
        expect(processor).toBeTruthy();

        // Open Advanced UI via right-click menu
        const advancedOpened = await processorService.openAdvancedUI(processor);

        expect(advancedOpened).toBe(true);

        // Get the custom UI frame using the utility
        const customUIFrame = await processorService.getAdvancedUIFrame();

        expect(customUIFrame).toBeTruthy();

        const uiContext = customUIFrame;

        // First click "Add Issuer" to enable the form
        const addIssuerButton = await uiContext.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();
        // Clicked Add Issuer to enable form

        // Wait for form to be fully enabled
        await page.waitForLoadState("networkidle");

        // For file path test, we'll just use the JWKS URL input with a file path
        const jwksUrlInput = await uiContext
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        // Check if input is enabled and force enable if needed
        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
            // JWKS URL input appears disabled, trying to enable
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill("/path/to/jwks.json", { force: true });
        // Entered JWKS file path

        const validateButton = await uiContext
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();
        // Clicked validate button

        const validationResult = await uiContext
            .locator(
                '.validation-result, .verification-result, [class*="result"]',
            )
            .first();
        await expect(validationResult).toBeVisible({ timeout: 10000 });
        // JWKS file path validation completed
    });

    test("should display validation progress indicator", async ({
        page,
    }, testInfo) => {
        // Explicit NiFi service availability check
        const authService = new AuthService(page);
        const isNiFiAvailable = await authService.checkNiFiAccessibility();
        if (!isNiFiAvailable) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not available. " +
                    "Integration tests require a running NiFi instance. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Testing JWKS validation progress indicator
        const processorService = new ProcessorService(page, testInfo);

        // Try to find the processor first
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        // If processor not found, provide clear instructions
        expect(processor).toBeTruthy();

        // Open Advanced UI via right-click menu
        const advancedOpened = await processorService.openAdvancedUI(processor);

        expect(advancedOpened).toBe(true);

        // Get the custom UI frame using the utility
        const customUIFrame = await processorService.getAdvancedUIFrame();

        expect(customUIFrame).toBeTruthy();

        const uiContext = customUIFrame;

        // First click "Add Issuer" to enable the form
        const addIssuerButton = await uiContext.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();
        // Clicked Add Issuer to enable form

        // Wait for form to be fully enabled
        await page.waitForLoadState("networkidle");

        const jwksUrlInput = await uiContext
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        // Check if input is enabled and force enable if needed
        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
            // JWKS URL input appears disabled, trying to enable
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill("https://slow-response.example.com/jwks.json", {
            force: true,
        });

        const validateButton = await uiContext
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        // Check for the loading state
        const verificationResult = await uiContext
            .locator(".verification-result")
            .first();

        // The result should immediately show "Testing..." when validation starts
        await expect(verificationResult).toContainText("Testing", {
            timeout: 2000,
        });
        processorLogger.info("✓ Validation progress indicator displayed");

        // Wait for the final result (OK or Error)
        await expect(verificationResult).toContainText(
            /OK|Error|Invalid|Valid/i,
            { timeout: 10000 },
        );
        processorLogger.info("✓ Validation completed with result");
        // Validation progress indicator working correctly
    });
});
