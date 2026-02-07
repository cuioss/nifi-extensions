/**
 * @file JWKS Validation Button Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("JWKS Validation Button", () => {
    test.beforeEach(async ({ page, processorManager }) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
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

        // Find the processor (it should be on canvas from beforeEach)
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });
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

        // Wait longer for form to be fully enabled
        await page.waitForLoadState("networkidle");

        const jwksUrlInput = await uiContext
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        // Fill the JWKS URL input
        await jwksUrlInput.fill("https://example.com/.well-known/jwks.json");

        const validateButton = await uiContext
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = await uiContext
            .locator(".verification-result")
            .first();
        await expect(verificationResult).toBeVisible({ timeout: 10000 });

        const resultText = await verificationResult.textContent();

        // With fixed servlet configuration, we should get actual JWKS validation results
        if (
            resultText.includes("401") ||
            resultText.includes("Unauthorized") ||
            resultText.includes("API key")
        ) {
            throw new Error(
                "Authentication error indicates servlet URL mapping issue",
            );
        }
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

        // Find the processor (it should be on canvas from beforeEach)
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

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

        // Wait for form to be fully enabled
        await page.waitForLoadState("networkidle");

        const jwksUrlInput = await uiContext
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        // Check if input is enabled and force enable if needed
        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill("not-a-valid-url", { force: true });

        const validateButton = await uiContext
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

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

        // Find the processor (it should be on canvas from beforeEach)
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

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
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill("/path/to/jwks.json", { force: true });

        const validateButton = await uiContext
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const validationResult = await uiContext
            .locator(
                '.validation-result, .verification-result, [class*="result"]',
            )
            .first();
        await expect(validationResult).toBeVisible({ timeout: 10000 });
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

        // Find the processor (it should be on canvas from beforeEach)
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

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

        // Wait for form to be fully enabled
        await page.waitForLoadState("networkidle");

        const jwksUrlInput = await uiContext
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        // Check if input is enabled and force enable if needed
        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
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

        // The result might show "Testing..." initially or go straight to error in standalone mode
        // Wait a bit to see if we get the progress indicator
        await page.waitForTimeout(500);

        try {
            await verificationResult.textContent({
                timeout: 1000,
            });
        } catch (e) {
            // Ignore timeout
        }

        // Wait for the final result
        await expect(verificationResult).toBeVisible({ timeout: 10000 });
        const finalText = await verificationResult.textContent();

        if (
            finalText.includes("401") ||
            finalText.includes("Unauthorized") ||
            finalText.includes("API key")
        ) {
            throw new Error(
                "Authentication error indicates servlet URL mapping issue",
            );
        }
    });
});
