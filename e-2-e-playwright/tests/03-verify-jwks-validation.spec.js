/**
 * @file JWKS Validation Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI.
 *
 * Note: SSRF protection blocks private/loopback addresses (including localhost),
 * so the real Keycloak JWKS URL cannot be validated through the UI. Instead,
 * we test that SSRF protection works correctly and that invalid URLs are rejected.
 * @version 1.2.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { assertNoAuthError } from "../utils/test-assertions.js";

test.describe("JWKS Validation", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should block private/loopback JWKS URLs via SSRF protection", async ({
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
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        // Use localhost Keycloak JWKS URL — SSRF protection should block this
        await jwksUrlInput.fill(
            "http://localhost:9080/realms/oauth_integration_tests/protocol/openid-connect/certs",
        );

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for SSRF error
        await expect(verificationResult).toContainText(
            /private|loopback|address/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Must indicate SSRF block — not a generic error
        expect(resultText).toMatch(/private|loopback/i);

        // Must NOT show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
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
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        await jwksUrlInput.fill("not-a-valid-url");

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
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        await jwksUrlInput.fill("/path/to/jwks.json");

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

        // File path must not show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });
});
