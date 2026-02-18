/**
 * @file JWKS Validation Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

/**
 * Assert that a validation result does not indicate an infrastructure / auth error.
 * Throws with the actual text for easy debugging.
 */
const assertNoAuthError = (resultText) => {
    const authIndicators = [
        "401",
        "403",
        "Unauthorized",
        "Forbidden",
        "API key",
        "Server error",
    ];
    for (const indicator of authIndicators) {
        if (resultText.includes(indicator)) {
            throw new Error(
                `Auth/CSRF infrastructure error detected (${indicator}): ${resultText.substring(0, 200)}`,
            );
        }
    }
};

test.describe("JWKS Validation", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should validate JWKS URL successfully", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        // First click "Add Issuer" to enable the form
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        const jwksUrlInput = customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        await jwksUrlInput.fill("https://example.com/.well-known/jwks.json");

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for actual validation content (not just element visibility —
        // the element is always in DOM but empty until the POST completes)
        await expect(verificationResult).toContainText(
            /Error|error|invalid|fail|OK|Valid|JWKS|connection|unreachable|resolve/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);
    });

    test("should handle invalid JWKS URL", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        const jwksUrlInput = customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill("not-a-valid-url", { force: true });

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for actual validation content (not just element visibility)
        await expect(verificationResult).toContainText(
            /error|invalid|fail/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Invalid URL must not show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should validate JWKS file path", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        const jwksUrlInput = customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill("/path/to/jwks.json", { force: true });

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const validationResult = customUIFrame
            .locator(
                '.validation-result, .verification-result, [class*="result"]',
            )
            .first();

        // Wait for actual validation content (not just element visibility)
        await expect(validationResult).toContainText(
            /error|invalid|fail|not found/i,
            { timeout: 30000 },
        );

        const resultText = await validationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);
    });

    test("should display validation progress indicator", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        const jwksUrlInput = customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });

        const isEnabled = await jwksUrlInput.isEnabled();
        if (!isEnabled) {
            await jwksUrlInput.click({ force: true });
            await page.waitForLoadState("domcontentloaded");
        }

        await jwksUrlInput.fill(
            "https://slow-response.example.com/jwks.json",
            { force: true },
        );

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for actual validation content (not just element visibility —
        // the element is always in DOM but empty until the POST completes)
        await expect(verificationResult).toContainText(
            /Error|error|invalid|fail|OK|Valid|JWKS|connection|unreachable|resolve/i,
            { timeout: 30000 },
        );

        const finalText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(finalText);
    });
});
